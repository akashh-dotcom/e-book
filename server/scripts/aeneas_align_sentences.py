"""
Sentence-level alignment using Aeneas.

Usage:
  python3 aeneas_align_sentences.py <audio_path> <text_path> <output_json_path> [language]

Input text_path should have one sentence per line.
"""

import sys
import json
from aeneas.executetask import ExecuteTask
from aeneas.task import Task

def main():
    audio_path = sys.argv[1]
    text_path = sys.argv[2]
    output_path = sys.argv[3]
    language = sys.argv[4] if len(sys.argv) > 4 else "eng"

    config_string = (
        f"task_language={language}"
        "|is_text_type=plain"
        "|os_task_file_format=json"
        "|task_adjust_boundary_no_zero=True"
    )

    task = Task(config_string=config_string)
    task.audio_file_path_absolute = audio_path
    task.text_file_path_absolute = text_path
    task.sync_map_file_path_absolute = output_path

    ExecuteTask(task).execute()
    task.output_sync_map_file()

    with open(output_path, "r") as f:
        raw = json.load(f)

    sentences = []
    for frag in raw.get("fragments", []):
        sentences.append({
            "id": frag["id"],
            "text": " ".join(frag["lines"]),
            "start": round(float(frag["begin"]), 3),
            "end": round(float(frag["end"]), 3),
        })

    with open(output_path, "w") as f:
        json.dump(sentences, f, indent=2)

    print(json.dumps({"success": True, "sentenceCount": len(sentences)}))

if __name__ == "__main__":
    main()
