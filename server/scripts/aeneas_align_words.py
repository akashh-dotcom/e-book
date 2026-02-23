"""
Word-level forced alignment using Aeneas.

Usage:
  python3 aeneas_align_words.py <audio_path> <text_path> <output_json_path> [language]

Input:
  audio_path       - Path to audio file (MP3, WAV, FLAC, etc.)
  text_path        - Path to text file with ONE WORD PER LINE
  output_json_path - Where to write the JSON timestamps

Output (JSON):
  [
    { "id": "f000001", "word": "The",   "start": 0.000, "end": 0.320 },
    { "id": "f000002", "word": "quick", "start": 0.320, "end": 0.580 },
    ...
  ]
"""

import sys
import json
from aeneas.executetask import ExecuteTask
from aeneas.task import Task
from aeneas.runtimeconfiguration import RuntimeConfiguration

def main():
    audio_path = sys.argv[1]
    text_path = sys.argv[2]
    output_path = sys.argv[3]
    language = sys.argv[4] if len(sys.argv) > 4 else "eng"

    LANG_MAP = {
        "en": "eng", "es": "spa", "fr": "fra", "de": "deu",
        "it": "ita", "pt": "por", "nl": "nld", "ru": "rus",
        "ja": "jpn", "zh": "cmn", "ko": "kor", "ar": "ara",
        "hi": "hin", "sv": "swe", "da": "dan", "fi": "fin",
        "no": "nor", "pl": "pol", "tr": "tur", "uk": "ukr",
    }
    lang = LANG_MAP.get(language, language)

    config_string = (
        f"task_language={lang}"
        "|is_text_type=plain"
        "|os_task_file_format=json"
        "|task_adjust_boundary_no_zero=True"
    )

    task = Task(config_string=config_string)
    task.audio_file_path_absolute = audio_path
    task.text_file_path_absolute = text_path
    task.sync_map_file_path_absolute = output_path

    rconf = RuntimeConfiguration()
    rconf[RuntimeConfiguration.MFCC_MASK_NONSPEECH] = True
    rconf[RuntimeConfiguration.MFCC_MASK_NONSPEECH_L3] = True
    rconf[RuntimeConfiguration.TTS_CACHE] = True

    ExecuteTask(task, rconf=rconf).execute()
    task.output_sync_map_file()

    with open(output_path, "r") as f:
        aeneas_output = json.load(f)

    words = []
    for fragment in aeneas_output.get("fragments", []):
        frag_id = fragment["id"]
        frag_text = fragment["lines"][0] if fragment["lines"] else ""
        frag_begin = round(float(fragment["begin"]), 3)
        frag_end = round(float(fragment["end"]), 3)

        words.append({
            "id": frag_id,
            "word": frag_text,
            "start": frag_begin,
            "end": frag_end,
        })

    with open(output_path, "w") as f:
        json.dump(words, f, indent=2)

    print(json.dumps({
        "success": True,
        "wordCount": len(words),
        "duration": words[-1]["end"] if words else 0,
    }))

if __name__ == "__main__":
    main()
