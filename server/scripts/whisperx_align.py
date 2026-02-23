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
import re
import os
import unicodedata

# Suppress unnecessary warnings
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import whisperx
import torch


# Languages that have reliable wav2vec2 alignment models in WhisperX
ALIGN_SUPPORTED_LANGS = {
    "en", "fr", "de", "es", "it", "ja", "zh", "nl", "uk", "pt",
    "ar", "cs", "ru", "pl", "hu", "fi", "fa", "el", "tr", "da",
    "he", "vi", "ko", "ur", "te", "hi", "ca", "ml", "no", "nn",
}


def is_latin_script(text):
    """Check if text is primarily Latin script."""
    latin = 0
    non_latin = 0
    for ch in text:
        if ch.isalpha():
            if unicodedata.category(ch).startswith('L'):
                name = unicodedata.name(ch, '')
                if 'LATIN' in name:
                    latin += 1
                else:
                    non_latin += 1
    return latin > non_latin


def normalize(word):
    """Normalize a word for comparison (lowercase, strip punctuation)."""
    return re.sub(r'[^\w]', '', word.lower())


def align_words_dp(transcribed, expected):
    """
    Use dynamic programming (Needleman-Wunsch style) to align transcribed words
    to expected book words. Returns a list of (expected_idx, transcribed_idx) pairs.
    Unmatched expected words get transcribed_idx = None.

    Uses banded DP for speed — only considers a diagonal band of ±bandwidth.
    """
    n = len(transcribed)
    m = len(expected)

    # Use banded DP for large inputs (O(n * bandwidth) instead of O(n * m))
    bandwidth = min(max(50, m // 4), m)

    GAP_PENALTY = -1
    MATCH_SCORE = 2
    MISMATCH_PENALTY = -1

    dp = [[float('-inf')] * (m + 1) for _ in range(n + 1)]
    backtrack = [[0] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0

    for i in range(1, n + 1):
        dp[i][0] = dp[i - 1][0] + GAP_PENALTY
        backtrack[i][0] = 1

    for j in range(1, m + 1):
        dp[0][j] = dp[0][j - 1] + GAP_PENALTY
        backtrack[0][j] = 2

    for i in range(1, n + 1):
        t_norm = normalize(transcribed[i - 1]["word"])

        # Band: expected indices near the diagonal
        diag_j = int(round(i * m / n)) if n > 0 else i
        j_lo = max(1, diag_j - bandwidth)
        j_hi = min(m, diag_j + bandwidth)

        for j in range(j_lo, j_hi + 1):
            e_norm = normalize(expected[j - 1])

            if t_norm == e_norm:
                score = MATCH_SCORE
            elif t_norm and e_norm and (t_norm in e_norm or e_norm in t_norm):
                score = MATCH_SCORE // 2
            else:
                score = MISMATCH_PENALTY

            diag = dp[i - 1][j - 1] + score if dp[i - 1][j - 1] > float('-inf') else float('-inf')
            up = dp[i - 1][j] + GAP_PENALTY if dp[i - 1][j] > float('-inf') else float('-inf')
            left = dp[i][j - 1] + GAP_PENALTY if dp[i][j - 1] > float('-inf') else float('-inf')

            best = max(diag, up, left)
            dp[i][j] = best

            if best == diag:
                backtrack[i][j] = 0
            elif best == up:
                backtrack[i][j] = 1
            else:
                backtrack[i][j] = 2

    # Backtrack
    alignment = []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0 and backtrack[i][j] == 0:
            alignment.append((j - 1, i - 1))
            i -= 1
            j -= 1
        elif i > 0 and (j == 0 or backtrack[i][j] == 1):
            i -= 1
        else:
            alignment.append((j - 1, None))
            j -= 1

    alignment.reverse()
    return alignment


def interpolate_timestamps(alignment, transcribed, expected_count):
    """
    Given alignment pairs, assign timestamps to all expected words.
    For unmatched words, interpolate from neighboring matched words.
    """
    timestamps = [None] * expected_count

    # First pass: assign timestamps from matched words
    for exp_idx, trans_idx in alignment:
        if trans_idx is not None and exp_idx < expected_count:
            t = transcribed[trans_idx]
            timestamps[exp_idx] = {
                "start": round(t.get("start", 0), 3),
                "end": round(t.get("end", 0), 3),
            }

    # Second pass: interpolate missing timestamps
    i = 0
    while i < expected_count:
        if timestamps[i] is not None:
            i += 1
            continue

        run_start = i
        while i < expected_count and timestamps[i] is None:
            i += 1
        run_end = i

        prev_end = timestamps[run_start - 1]["end"] if run_start > 0 and timestamps[run_start - 1] else 0.0
        next_start = timestamps[run_end]["start"] if run_end < expected_count and timestamps[run_end] else prev_end + 0.1 * (run_end - run_start)

        gap = next_start - prev_end
        count = run_end - run_start
        word_dur = gap / count if count > 0 else 0

        for k in range(count):
            idx = run_start + k
            timestamps[idx] = {
                "start": round(prev_end + k * word_dur, 3),
                "end": round(prev_end + (k + 1) * word_dur, 3),
            }

    return timestamps


def distribute_segments_to_words(segments, expected_words):
    """
    Distribute segment-level timestamps proportionally across expected words.
    This is used for non-Latin languages where DP word alignment is unreliable.

    Concatenates all segment text, splits it into segment-words, then maps
    expected words to time ranges proportionally based on word position.
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

    use_latin_alignment = is_latin_script(" ".join(expected_words[:20]))

    # Step 1: Load model and transcribe
    print(json.dumps({"progress": "loading_model", "message": "Loading WhisperX model..."}), flush=True)
    model = whisperx.load_model(model_size, device, compute_type=compute_type, language=language)
    audio = whisperx.load_audio(audio_path)
    print(json.dumps({"progress": "transcribing", "message": "Transcribing audio..."}), flush=True)
    result = model.transcribe(audio, batch_size=16, language=language)

    segments = result.get("segments", [])

    # --- Non-Latin path: distribute segment timestamps proportionally ---
    if not use_latin_alignment:
        print(json.dumps({"progress": "matching", "message": "Distributing timestamps to words..."}), flush=True)
        timestamps = distribute_segments_to_words(segments, expected_words)

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
        return

    # --- Latin path: word-level alignment via wav2vec2 + DP ---
    print(json.dumps({"progress": "aligning", "message": "Aligning words to audio..."}), flush=True)
    transcribed_words = []

    if language in ALIGN_SUPPORTED_LANGS:
        try:
            model_a, metadata = whisperx.load_align_model(language_code=language, device=device)
            result = whisperx.align(result["segments"], model_a, metadata, audio, device, return_char_alignments=False)

            for seg in result.get("segments", []):
                for w in seg.get("words", []):
                    if "start" in w and "end" in w:
                        transcribed_words.append({
                            "word": w["word"].strip(),
                            "start": w["start"],
                            "end": w["end"],
                        })
        except ValueError as e:
            print(f"Alignment model not available for '{language}': {e}", file=sys.stderr)
            print(f"Falling back to segment-level timestamp distribution.", file=sys.stderr)

    if not transcribed_words:
        # Fallback: use segment-level timestamps, distribute evenly per word
        for seg in segments:
            words_in_seg = seg.get("text", "").split()
            if not words_in_seg:
                continue
            seg_start = seg.get("start", 0)
            seg_end = seg.get("end", 0)
            dur = (seg_end - seg_start) / len(words_in_seg)
            for k, w in enumerate(words_in_seg):
                transcribed_words.append({
                    "word": w.strip(),
                    "start": round(seg_start + k * dur, 3),
                    "end": round(seg_start + (k + 1) * dur, 3),
                })

    # Step 3: Align transcribed words to expected book words
    print(json.dumps({"progress": "matching", "message": "Matching words to text..."}), flush=True)
    alignment = align_words_dp(transcribed_words, expected_words)

    # Step 4: Build timestamps for all expected words
    timestamps = interpolate_timestamps(alignment, transcribed_words, len(expected_words))

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
        "transcribedWordCount": len(transcribed_words),
        "duration": words[-1]["end"] if words else 0,
    }))


if __name__ == "__main__":
    main()
