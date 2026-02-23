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
import os

os.environ["TOKENIZERS_PARALLELISM"] = "false"

import whisperx
import torch


def distribute_segments_to_sentences(segments, sentences):
    """
    Distribute segment timestamps proportionally across expected sentences.
    Each sentence is weighted by its word count relative to the total.
    """
    if not segments or not sentences:
        return [
            {"id": f"s{str(i + 1).zfill(6)}", "text": s, "start": 0, "end": 0}
            for i, s in enumerate(sentences)
        ]

    # Total audio duration
    audio_start = segments[0].get("start", 0)
    audio_end = segments[-1].get("end", 0)
    total_dur = audio_end - audio_start

    # Weight each sentence by its word count
    sent_word_counts = [max(len(s.split()), 1) for s in sentences]
    total_words = sum(sent_word_counts)

    result = []
    cursor = audio_start

    for i, sentence in enumerate(sentences):
        ratio = sent_word_counts[i] / total_words
        sent_dur = total_dur * ratio
        result.append({
            "id": f"s{str(i + 1).zfill(6)}",
            "text": sentence,
            "start": round(cursor, 3),
            "end": round(cursor + sent_dur, 3),
        })
        cursor += sent_dur

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
    print(json.dumps({"progress": "loading_model", "message": "Loading WhisperX model..."}), flush=True)
    model = whisperx.load_model(model_size, device, compute_type=compute_type, language=language)
    audio = whisperx.load_audio(audio_path)
    print(json.dumps({"progress": "transcribing", "message": "Transcribing audio..."}), flush=True)
    result = model.transcribe(audio, batch_size=16, language=language)

    segments = result.get("segments", [])

    # Step 2: Distribute segment timestamps proportionally across sentences
    print(json.dumps({"progress": "matching", "message": "Distributing timestamps to sentences..."}), flush=True)
    sentence_timestamps = distribute_segments_to_sentences(segments, sentences)

    # Write output
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(sentence_timestamps, f, indent=2)

    print(json.dumps({"success": True, "sentenceCount": len(sentence_timestamps)}))


if __name__ == "__main__":
    main()
