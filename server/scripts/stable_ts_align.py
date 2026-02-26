"""
Word-level forced alignment using stable-ts (stabilized Whisper timestamps).

stable-ts modifies Whisper's cross-attention weights to produce much more
accurate word-level timestamps than standard Whisper or edge-TTS timing.
It analyzes the actual audio waveform, so timestamps match what was truly
spoken rather than what the TTS engine estimated.

Usage:
  python stable_ts_align.py <audio_path> <text_path> <output_json_path> [language] [model_size]

Input:
  audio_path       - Path to audio file (MP3, WAV, FLAC, etc.)
  text_path        - Path to text file with ONE WORD PER LINE
  output_json_path - Where to write the JSON timestamps
  language         - 2-letter language code (default: en)
  model_size       - Whisper model size: tiny, base, small, medium, large (default: base)

Output (JSON):
  [
    { "id": "f000001", "word": "The",   "start": 0.000, "end": 0.320 },
    { "id": "f000002", "word": "quick", "start": 0.320, "end": 0.580 },
    ...
  ]
"""

import sys
import json
import re

import stable_whisper


def normalize(word):
    """Strip punctuation and lowercase for fuzzy matching."""
    return re.sub(r'[^\w]', '', word, flags=re.UNICODE).lower()


def align_stable_words_to_expected(st_words, expected_words):
    """
    Map stable-ts detected words (with timestamps) to expected words
    from the chapter HTML using greedy text matching.

    Returns a list of { "start", "end" } for each expected word.
    Words that couldn't be matched get interpolated timestamps.
    """
    total_exp = len(expected_words)
    total_st = len(st_words)
    timestamps = [None] * total_exp

    if not st_words:
        return [{"start": 0, "end": 0} for _ in expected_words]

    st_idx = 0
    exp_idx = 0

    while exp_idx < total_exp and st_idx < total_st:
        exp_norm = normalize(expected_words[exp_idx])
        st_word = st_words[st_idx]
        st_norm = normalize(st_word["word"])

        # Direct match
        if exp_norm == st_norm or exp_norm.startswith(st_norm) or st_norm.startswith(exp_norm):
            timestamps[exp_idx] = {
                "start": st_word["start"],
                "end": st_word["end"],
            }
            exp_idx += 1
            st_idx += 1
            continue

        # Check if expected word spans multiple stable-ts words
        combined = st_norm
        look_ahead = st_idx + 1
        matched = False
        while look_ahead < total_st and len(combined) < len(exp_norm) + 5:
            combined += normalize(st_words[look_ahead]["word"])
            if combined == exp_norm or combined.startswith(exp_norm):
                timestamps[exp_idx] = {
                    "start": st_words[st_idx]["start"],
                    "end": st_words[look_ahead]["end"],
                }
                exp_idx += 1
                st_idx = look_ahead + 1
                matched = True
                break
            look_ahead += 1
        if matched:
            continue

        # Check if stable-ts word spans multiple expected words
        exp_combined = exp_norm
        exp_look = exp_idx + 1
        matched = False
        while exp_look < total_exp and len(exp_combined) < len(st_norm) + 5:
            exp_combined += normalize(expected_words[exp_look])
            if exp_combined == st_norm or exp_combined.startswith(st_norm):
                count = exp_look - exp_idx + 1
                dur = (st_word["end"] - st_word["start"]) / count
                for k in range(count):
                    timestamps[exp_idx + k] = {
                        "start": round(st_word["start"] + k * dur, 3),
                        "end": round(st_word["start"] + (k + 1) * dur, 3),
                    }
                exp_idx = exp_look + 1
                st_idx += 1
                matched = True
                break
            exp_look += 1
        if matched:
            continue

        # No match found — assign timing and advance both
        timestamps[exp_idx] = {
            "start": st_word["start"],
            "end": st_word["end"],
        }
        exp_idx += 1
        st_idx += 1

    # Fill remaining expected words
    while exp_idx < total_exp:
        if st_idx < total_st:
            st_word = st_words[st_idx]
            timestamps[exp_idx] = {
                "start": st_word["start"],
                "end": st_word["end"],
            }
            st_idx += 1
        else:
            timestamps[exp_idx] = None
        exp_idx += 1

    # Interpolate any None gaps
    _interpolate_gaps(timestamps)

    return timestamps


def _interpolate_gaps(timestamps):
    """Fill None entries by interpolating between known timestamps."""
    n = len(timestamps)
    i = 0
    while i < n:
        if timestamps[i] is not None:
            i += 1
            continue
        start = i
        while i < n and timestamps[i] is None:
            i += 1
        end = i

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


def main():
    audio_path = sys.argv[1]
    text_path = sys.argv[2]
    output_path = sys.argv[3]
    language = sys.argv[4] if len(sys.argv) > 4 else "en"
    model_size = sys.argv[5] if len(sys.argv) > 5 else "base"

    with open(text_path, "r", encoding="utf-8") as f:
        expected_words = [line.strip() for line in f if line.strip()]

    # Step 1: Load model
    print(json.dumps({
        "progress": "loading_model",
        "message": f"Loading stable-ts model ({model_size})..."
    }), flush=True)
    model = stable_whisper.load_model(model_size)

    # Step 2: Transcribe with stable timestamps
    print(json.dumps({
        "progress": "transcribing",
        "message": "Transcribing with stable-ts (enhanced timestamps)..."
    }), flush=True)
    result = model.transcribe(audio_path, language=language)

    # Step 3: Extract word-level timestamps
    print(json.dumps({
        "progress": "extracting_words",
        "message": "Extracting word-level timestamps..."
    }), flush=True)

    st_words = []
    for segment in result.segments:
        for word in segment.words:
            st_words.append({
                "word": word.word.strip(),
                "start": round(word.start, 3),
                "end": round(word.end, 3),
            })

    # Step 4: Align to expected words
    print(json.dumps({
        "progress": "matching",
        "message": f"Aligning {len(st_words)} detected words to {len(expected_words)} expected words..."
    }), flush=True)
    timestamps = align_stable_words_to_expected(st_words, expected_words)

    # Step 5: Build output
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
        "detectedWordCount": len(st_words),
        "duration": words[-1]["end"] if words else 0,
    }))


if __name__ == "__main__":
    main()
