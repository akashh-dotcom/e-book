"""
Generate EPUB3-compatible SMIL file directly from Aeneas.

Usage:
  python3 aeneas_align_smil.py <audio_path> <text_path> <output_smil_path> \
    [language] [audio_ref] [page_ref]

Output: A valid EPUB3 Media Overlay SMIL file.
"""

import sys
from aeneas.executetask import ExecuteTask
from aeneas.task import Task
from aeneas.runtimeconfiguration import RuntimeConfiguration

def main():
    audio_path = sys.argv[1]
    text_path = sys.argv[2]
    output_path = sys.argv[3]
    language = sys.argv[4] if len(sys.argv) > 4 else "eng"
    audio_ref = sys.argv[5] if len(sys.argv) > 5 else "audio.mp3"
    page_ref = sys.argv[6] if len(sys.argv) > 6 else "content.xhtml"

    config_string = (
        f"task_language={language}"
        "|is_text_type=plain"
        "|os_task_file_format=smil"
        f"|os_task_file_smil_audio_ref={audio_ref}"
        f"|os_task_file_smil_page_ref={page_ref}"
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

    print(f'{{"success": true, "output": "{output_path}"}}')

if __name__ == "__main__":
    main()
