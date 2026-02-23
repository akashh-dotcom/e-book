"""
Generate audio with edge-tts and capture per-word timing.

Usage:
  python edge_tts_generate.py <text_path> <audio_path> <timing_json_path> [voice]

This uses the edge-tts Python API directly (not CLI) to capture
WordBoundary events — giving exact per-word start/end times from
the TTS engine itself.

Output timing JSON:
  [
    { "word": "The",   "start": 0.050, "end": 0.275 },
    { "word": "quick", "start": 0.275, "end": 0.537 },
    ...
  ]
"""

import sys
import json
import asyncio
import edge_tts


async def generate(text, voice, audio_path, timing_path):
    communicate = edge_tts.Communicate(text, voice, boundary="WordBoundary")

    word_timings = []

    with open(audio_path, "wb") as audio_file:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_file.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                # offset and duration are in 100-nanosecond ticks
                start_sec = chunk["offset"] / 10_000_000
                duration_sec = chunk["duration"] / 10_000_000
                word_timings.append({
                    "word": chunk["text"],
                    "start": round(start_sec, 3),
                    "end": round(start_sec + duration_sec, 3),
                })

    with open(timing_path, "w", encoding="utf-8") as f:
        json.dump(word_timings, f, indent=2, ensure_ascii=False)

    print(json.dumps({
        "success": True,
        "wordCount": len(word_timings),
        "audioDuration": word_timings[-1]["end"] if word_timings else 0,
    }))


def main():
    text_path = sys.argv[1]
    audio_path = sys.argv[2]
    timing_path = sys.argv[3]
    voice = sys.argv[4] if len(sys.argv) > 4 else "en-US-AriaNeural"

    with open(text_path, "r", encoding="utf-8") as f:
        text = f.read().strip()

    if not text:
        print(json.dumps({"success": False, "error": "Empty text"}))
        sys.exit(1)

    asyncio.run(generate(text, voice, audio_path, timing_path))


if __name__ == "__main__":
    main()
