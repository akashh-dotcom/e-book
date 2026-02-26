"""
Word-level forced alignment using WhisperX.

Uses Whisper transcription + phoneme-level forced alignment via
wav2vec2 / torchaudio to produce accurate per-word timestamps.

Usage:
  python whisperx_align.py <audio_path> <text_path> <output_json_path> [language] [model_size]

Input:
  audio_path       - Path to audio file (MP3, WAV, FLAC, etc.)
  text_path        - Path to text file with ONE WORD PER LINE
  output_json_path - Where to write the JSON timestamps
  language         - 2-letter language code (default: en)
  model_size       - Whisper model size: tiny, base, small, medium, large-v2 (default: base)

Output (JSON):
  [
    { "id": "f000001", "word": "The",   "start": 0.000, "end": 0.320 },
    { "id": "f000002", "word": "quick", "start": 0.320, "end": 0.580 },
    ...
  ]
"""

import sys
import json
import os
import re

# Suppress unnecessary warnings
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import whisperx
import torch


def normalize(word):
    """Strip punctuation and lowercase for fuzzy matching."""
    return re.sub(r'[^\w]', '', word, flags=re.UNICODE).lower()


def align_whisperx_words_to_expected(wx_words, expected_words):
    """
    Map WhisperX-detected words (with timestamps) to expected words
    from the chapter HTML using greedy text matching.

    Returns a list of { "start", "end" } for each expected word.
    Words that couldn't be matched get interpolated timestamps.
    """
    total_exp = len(expected_words)
    total_wx = len(wx_words)
    timestamps = [None] * total_exp

    if not wx_words:
        # No words detected — distribute evenly over audio duration
        return [{"start": 0, "end": 0} for _ in expected_words]

    # Greedy alignment: walk both lists
    wx_idx = 0
    exp_idx = 0

    while exp_idx < total_exp and wx_idx < total_wx:
        exp_norm = normalize(expected_words[exp_idx])
        wx_word = wx_words[wx_idx]
        wx_norm = normalize(wx_word.get("word", ""))

        # Direct match
        if exp_norm == wx_norm or exp_norm.startswith(wx_norm) or wx_norm.startswith(exp_norm):
            timestamps[exp_idx] = {
                "start": wx_word.get("start", 0),
                "end": wx_word.get("end", wx_word.get("start", 0)),
            }
            exp_idx += 1
            wx_idx += 1
            continue

        # Check if expected word spans multiple WX words
        combined = wx_norm
        look_ahead = wx_idx + 1
        matched = False
        while look_ahead < total_wx and len(combined) < len(exp_norm) + 5:
            combined += normalize(wx_words[look_ahead].get("word", ""))
            if combined == exp_norm or combined.startswith(exp_norm):
                timestamps[exp_idx] = {
                    "start": wx_words[wx_idx].get("start", 0),
                    "end": wx_words[look_ahead].get("end", wx_words[look_ahead].get("start", 0)),
                }
                exp_idx += 1
                wx_idx = look_ahead + 1
                matched = True
                break
            look_ahead += 1
        if matched:
            continue

        # Check if WX word spans multiple expected words
        exp_combined = exp_norm
        exp_look = exp_idx + 1
        matched = False
        while exp_look < total_exp and len(exp_combined) < len(wx_norm) + 5:
            exp_combined += normalize(expected_words[exp_look])
            if exp_combined == wx_norm or exp_combined.startswith(wx_norm):
                count = exp_look - exp_idx + 1
                dur = (wx_word.get("end", 0) - wx_word.get("start", 0)) / count
                for k in range(count):
                    timestamps[exp_idx + k] = {
                        "start": round(wx_word.get("start", 0) + k * dur, 3),
                        "end": round(wx_word.get("start", 0) + (k + 1) * dur, 3),
                    }
                exp_idx = exp_look + 1
                wx_idx += 1
                matched = True
                break
            exp_look += 1
        if matched:
            continue

        # No match — assign WX word's timing and advance both
        timestamps[exp_idx] = {
            "start": wx_word.get("start", 0),
            "end": wx_word.get("end", wx_word.get("start", 0)),
        }
        exp_idx += 1
        wx_idx += 1

    # Fill remaining expected words from remaining WX words or interpolation
    while exp_idx < total_exp:
        if wx_idx < total_wx:
            wx_word = wx_words[wx_idx]
            timestamps[exp_idx] = {
                "start": wx_word.get("start", 0),
                "end": wx_word.get("end", wx_word.get("start", 0)),
            }
            wx_idx += 1
        else:
            timestamps[exp_idx] = None  # will be interpolated below
        exp_idx += 1

    # Interpolate any None gaps
    _interpolate_gaps(timestamps)

    return timestamps


def _interpolate_gaps(timestamps):
    """Fill None entries by interpolating between known timestamps."""
    n = len(timestamps)
    # Forward fill: find runs of None and interpolate
    i = 0
    while i < n:
        if timestamps[i] is not None:
            i += 1
            continue
        # Find the run of Nones
        start = i
        while i < n and timestamps[i] is None:
            i += 1
        end = i  # first non-None after the run (or n)

        # Get bounding timestamps
        prev_end = timestamps[start - 1]["end"] if start > 0 and timestamps[start - 1] else 0
        next_start = timestamps[end]["start"] if end < n and timestamps[end] else prev_end + 0.15 * (end - start)

        gap = next_start - prev_end
        count = end - start
        dur = gap / count if count > 0 else 0.15

        for k in range(count):
            timestamps[start + k] = {
                "start": round(prev_end + k * dur, 3),
                "end": round(prev_end + (k + 1) * dur, 3),
            }


def distribute_segments_to_words(segments, expected_words):
    """
    Fallback: distribute segment-level timestamps proportionally
    across expected words (used when word-level alignment fails).
    """
    if not segments or not expected_words:
        return [{"start": round(i * 0.5, 3), "end": round((i + 1) * 0.5, 3)} for i in range(len(expected_words))]

    timeline = []
    seg_word_counts = []
    for seg in segments:
        seg_text = seg.get("text", "").strip()
        seg_words = seg_text.split() if seg_text else []
        timeline.append((seg.get("start", 0), seg.get("end", seg.get("start", 0))))
        seg_word_counts.append(max(len(seg_words), 1))

    total_seg_words = sum(seg_word_counts)
    total_expected = len(expected_words)
    timestamps = []
    exp_idx = 0

    for seg_i, (seg_start, seg_end) in enumerate(timeline):
        if seg_i == len(timeline) - 1:
            n_words = total_expected - exp_idx
        else:
            ratio = seg_word_counts[seg_i] / total_seg_words
            n_words = max(1, round(ratio * total_expected))
            n_words = min(n_words, total_expected - exp_idx)

        if n_words <= 0:
            continue

        # Proportional by character length
        chunk = expected_words[exp_idx:exp_idx + n_words]
        char_counts = [max(len(w), 1) for w in chunk]
        total_chars = sum(char_counts) or 1
        seg_dur = seg_end - seg_start
        cursor = seg_start

        for k in range(n_words):
            word_dur = seg_dur * (char_counts[k] / total_chars)
            timestamps.append({
                "start": round(cursor, 3),
                "end": round(cursor + word_dur, 3),
            })
            cursor += word_dur
            exp_idx += 1

    while exp_idx < total_expected:
        last_end = timestamps[-1]["end"] if timestamps else 0.0
        timestamps.append({"start": round(last_end, 3), "end": round(last_end + 0.3, 3)})
        exp_idx += 1

    return timestamps


def main():
    audio_path = sys.argv[1]
    text_path = sys.argv[2]
    output_path = sys.argv[3]
    language = sys.argv[4] if len(sys.argv) > 4 else "en"
    model_size = sys.argv[5] if len(sys.argv) > 5 else "base"

    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"

    with open(text_path, "r", encoding="utf-8") as f:
        expected_words = [line.strip() for line in f if line.strip()]

    # Step 1: Transcribe
    print(json.dumps({"progress": "loading_model", "message": "Loading WhisperX model..."}), flush=True)
    model = whisperx.load_model(model_size, device, compute_type=compute_type, language=language)
    audio = whisperx.load_audio(audio_path)
    print(json.dumps({"progress": "transcribing", "message": "Transcribing audio..."}), flush=True)
    result = model.transcribe(audio, batch_size=16, language=language)

    segments = result.get("segments", [])
    used_word_align = False

    # Step 2: Try word-level forced alignment via WhisperX align()
    try:
        print(json.dumps({"progress": "aligning", "message": "Loading alignment model..."}), flush=True)
        align_model, align_metadata = whisperx.load_align_model(
            language_code=language, device=device
        )
        print(json.dumps({"progress": "word_aligning", "message": "Running word-level forced alignment..."}), flush=True)
        aligned = whisperx.align(
            segments, align_model, align_metadata, audio, device,
            return_char_alignments=False,
        )

        # Extract word-level timestamps from aligned segments
        wx_words = []
        for seg in aligned.get("segments", []):
            for w in seg.get("words", []):
                if "start" in w and "end" in w:
                    wx_words.append(w)

        if wx_words:
            print(json.dumps({
                "progress": "matching",
                "message": f"Aligning {len(wx_words)} detected words to {len(expected_words)} expected words..."
            }), flush=True)
            timestamps = align_whisperx_words_to_expected(wx_words, expected_words)
            used_word_align = True
        else:
            raise ValueError("No word-level timestamps from alignment")

    except Exception as e:
        # Fallback to segment-level distribution
        print(json.dumps({
            "progress": "fallback",
            "message": f"Word alignment unavailable ({str(e)[:80]}), using segment distribution..."
        }), flush=True)
        timestamps = distribute_segments_to_words(segments, expected_words)

    # Step 3: Build output
    words = []
    for i, expected_word in enumerate(expected_words):
        ts = timestamps[i] if i < len(timestamps) else {"start": 0, "end": 0}
        words.append({
            "id": f"f{str(i + 1).zfill(6)}",
            "word": expected_word,
            "start": ts["start"],
            "end": ts["end"],
        })

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(words, f, indent=2)

    transcribed_count = sum(len(s.get("text", "").split()) for s in segments)
    print(json.dumps({
        "success": True,
        "wordCount": len(words),
        "transcribedWordCount": transcribed_count,
        "usedWordAlign": used_word_align,
        "duration": words[-1]["end"] if words else 0,
    }))


if __name__ == "__main__":
    main()
