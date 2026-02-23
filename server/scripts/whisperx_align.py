"""
Word-level forced alignment using WhisperX.

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

# Suppress unnecessary warnings
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import whisperx
import torch


def distribute_segments_to_words(segments, expected_words):
    """
    Distribute segment-level timestamps proportionally across expected words.

    Each segment has a text and time range. We assign expected words to segments
    proportionally based on each segment's word count relative to the total,
    then distribute time evenly within each segment.
    """
    if not segments or not expected_words:
        dur_per_word = 0.5
        return [
            {"start": round(i * dur_per_word, 3), "end": round((i + 1) * dur_per_word, 3)}
            for i in range(len(expected_words))
        ]

    # Build a flat timeline from segments
    timeline = []  # list of (start, end) for each segment
    seg_word_counts = []
    for seg in segments:
        seg_text = seg.get("text", "").strip()
        seg_words = seg_text.split() if seg_text else []
        seg_start = seg.get("start", 0)
        seg_end = seg.get("end", seg_start)
        timeline.append((seg_start, seg_end))
        seg_word_counts.append(max(len(seg_words), 1))

    total_seg_words = sum(seg_word_counts)
    total_expected = len(expected_words)

    # Assign expected words to segments proportionally
    timestamps = []
    exp_idx = 0

    for seg_i, (seg_start, seg_end) in enumerate(timeline):
        # How many expected words belong to this segment?
        if seg_i == len(timeline) - 1:
            # Last segment gets all remaining words
            n_words = total_expected - exp_idx
        else:
            ratio = seg_word_counts[seg_i] / total_seg_words
            n_words = max(1, round(ratio * total_expected))
            n_words = min(n_words, total_expected - exp_idx)

        if n_words <= 0:
            continue

        seg_dur = seg_end - seg_start
        word_dur = seg_dur / n_words

        for k in range(n_words):
            timestamps.append({
                "start": round(seg_start + k * word_dur, 3),
                "end": round(seg_start + (k + 1) * word_dur, 3),
            })
            exp_idx += 1

    # If we ran out of segments before expected words, extend from the last timestamp
    while exp_idx < total_expected:
        last_end = timestamps[-1]["end"] if timestamps else 0.0
        timestamps.append({
            "start": round(last_end, 3),
            "end": round(last_end + 0.3, 3),
        })
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

    # Read expected words (one per line)
    with open(text_path, "r", encoding="utf-8") as f:
        expected_words = [line.strip() for line in f if line.strip()]

    # Step 1: Load model and transcribe
    print(json.dumps({"progress": "loading_model", "message": "Loading WhisperX model..."}), flush=True)
    model = whisperx.load_model(model_size, device, compute_type=compute_type, language=language)
    audio = whisperx.load_audio(audio_path)
    print(json.dumps({"progress": "transcribing", "message": "Transcribing audio..."}), flush=True)
    result = model.transcribe(audio, batch_size=16, language=language)

    segments = result.get("segments", [])

    # Step 2: Distribute segment timestamps proportionally across expected words
    print(json.dumps({"progress": "matching", "message": "Distributing timestamps to words..."}), flush=True)
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

    print(json.dumps({
        "success": True,
        "wordCount": len(words),
        "transcribedWordCount": sum(len(s.get("text", "").split()) for s in segments),
        "duration": words[-1]["end"] if words else 0,
    }))


if __name__ == "__main__":
    main()
