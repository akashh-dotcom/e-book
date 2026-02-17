"""
Sentence-level alignment using WhisperX.

Usage:
  python whisperx_align_sentences.py <audio_path> <text_path> <output_json_path> [language] [model_size]

Input text_path should have one sentence per line.

Output (JSON):
  [
    { "id": "s000001", "text": "The quick brown fox.", "start": 0.000, "end": 2.500 },
    ...
  ]
"""

import sys
import json
import re
import os

os.environ["TOKENIZERS_PARALLELISM"] = "false"

import whisperx
import torch


def normalize(text):
    """Normalize text for comparison."""
    return re.sub(r'[^\w\s]', '', text.lower()).strip()


def match_segments_to_sentences(segments, sentences):
    """
    Map WhisperX transcription segments to the expected sentences using
    a greedy word-overlap approach.

    Returns list of { id, text, start, end } for each expected sentence.
    """
    # Build a flat list of (word, segment_idx, start, end) from transcription
    trans_words = []
    for seg_idx, seg in enumerate(segments):
        for w in seg.get("words", []):
            if "start" in w and "end" in w:
                trans_words.append({
                    "word": normalize(w["word"]),
                    "start": w["start"],
                    "end": w["end"],
                })

    # If no word-level timestamps, fall back to segment-level
    if not trans_words:
        for seg in segments:
            words_in_seg = seg.get("text", "").split()
            if not words_in_seg:
                continue
            seg_start = seg.get("start", 0)
            seg_end = seg.get("end", 0)
            dur = (seg_end - seg_start) / len(words_in_seg) if words_in_seg else 0
            for k, w in enumerate(words_in_seg):
                trans_words.append({
                    "word": normalize(w),
                    "start": round(seg_start + k * dur, 3),
                    "end": round(seg_start + (k + 1) * dur, 3),
                })

    # For each expected sentence, find the best matching window in trans_words
    result = []
    trans_ptr = 0  # sliding pointer into transcribed words

    for sent_idx, sentence in enumerate(sentences):
        sent_words = [normalize(w) for w in sentence.split() if w.strip()]
        if not sent_words:
            continue

        # Find the start position: look for first matching word near trans_ptr
        best_start = trans_ptr
        best_score = 0

        search_end = min(trans_ptr + len(sent_words) * 3, len(trans_words))
        for start in range(trans_ptr, min(search_end, len(trans_words))):
            score = 0
            for k, sw in enumerate(sent_words[:5]):  # check first 5 words
                if start + k < len(trans_words) and trans_words[start + k]["word"] == sw:
                    score += 1
            if score > best_score:
                best_score = score
                best_start = start

        # Determine the span covering this sentence's words
        span_end = min(best_start + len(sent_words), len(trans_words))

        start_time = trans_words[best_start]["start"] if best_start < len(trans_words) else 0
        end_time = trans_words[span_end - 1]["end"] if span_end > 0 and span_end <= len(trans_words) else start_time

        result.append({
            "id": f"s{str(sent_idx + 1).zfill(6)}",
            "text": sentence,
            "start": round(start_time, 3),
            "end": round(end_time, 3),
        })

        trans_ptr = span_end

    return result


def main():
    audio_path = sys.argv[1]
    text_path = sys.argv[2]
    output_path = sys.argv[3]
    language = sys.argv[4] if len(sys.argv) > 4 else "en"
    model_size = sys.argv[5] if len(sys.argv) > 5 else "base"

    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if device == "cuda" else "int8"

    # Read expected sentences (one per line)
    with open(text_path, "r", encoding="utf-8") as f:
        sentences = [line.strip() for line in f if line.strip()]

    # Step 1: Transcribe with WhisperX
    model = whisperx.load_model(model_size, device, compute_type=compute_type, language=language)
    audio = whisperx.load_audio(audio_path)
    result = model.transcribe(audio, batch_size=16, language=language)

    # Step 2: Get word-level alignment
    model_a, metadata = whisperx.load_align_model(language_code=language, device=device)
    result = whisperx.align(result["segments"], model_a, metadata, audio, device, return_char_alignments=False)

    segments = result.get("segments", [])

    # Step 3: Map transcription segments to expected sentences
    sentence_timestamps = match_segments_to_sentences(segments, sentences)

    # Write output
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(sentence_timestamps, f, indent=2)

    print(json.dumps({"success": True, "sentenceCount": len(sentence_timestamps)}))


if __name__ == "__main__":
    main()
