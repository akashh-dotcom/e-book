# Audio Read-Aloud Feature Guide (Aeneas Edition)

## Add SMIL-Based Text-Audio Sync to the EPUB Web eBook Reader

> This guide extends the **EPUB → Web eBook Reader** project with synchronized audio narration. Upload pre-recorded audio per chapter, auto-align words to timestamps using **Aeneas** — the purpose-built Python/C library for ebook audio synchronization — and deliver a karaoke-style read-aloud experience with word-level highlighting, all following the EPUB3 Media Overlay (SMIL) standard.

---

## Table of Contents

1. [Overview & Architecture](#1-overview--architecture)
2. [What is Aeneas](#2-what-is-aeneas)
3. [What is SMIL and Why Use It](#3-what-is-smil-and-why-use-it)
4. [Dependencies & Installation](#4-dependencies--installation)
5. [Updated Folder Structure](#5-updated-folder-structure)
6. [Phase A — Word Wrapping Service](#6-phase-a--word-wrapping-service)
7. [Phase B — Audio Upload & Storage](#7-phase-b--audio-upload--storage)
8. [Phase C — Aeneas Forced Alignment](#8-phase-c--aeneas-forced-alignment)
9. [Phase D — SMIL Generator](#9-phase-d--smil-generator)
10. [Phase E — Manual Sync Editor (Frontend)](#10-phase-e--manual-sync-editor-frontend)
11. [Phase F — Highlight Engine (Frontend)](#11-phase-f--highlight-engine-frontend)
12. [Phase G — Audio Player Controls (Frontend)](#12-phase-g--audio-player-controls-frontend)
13. [Phase H — Integration with Reader UI](#13-phase-h--integration-with-reader-ui)
14. [Phase I — EPUB3 Export with Media Overlays](#14-phase-i--epub3-export-with-media-overlays)
15. [Database Schema (Audio Related)](#15-database-schema-audio-related)
16. [API Reference (Audio Related)](#16-api-reference-audio-related)
17. [Audio Scenarios & Edge Cases](#17-audio-scenarios--edge-cases)
18. [Aeneas Configuration Reference](#18-aeneas-configuration-reference)
19. [SMIL Format Quick Reference](#19-smil-format-quick-reference)
20. [Complete Data Flow](#20-complete-data-flow)
21. [Troubleshooting Aeneas](#21-troubleshooting-aeneas)
22. [Setup & Run](#22-setup--run)

---

## 1. Overview & Architecture

### What This Adds

```
Existing eBook Reader (from base guide)
  │
  ├── Upload EPUB ✓
  ├── Parse & render chapters ✓
  ├── Sidebar TOC ✓
  ├── Search, bookmarks ✓
  │
  │   + THIS GUIDE ADDS:
  │
  ├── Upload pre-recorded audio per chapter     ← NEW
  ├── Auto-align audio to text (Aeneas)         ← NEW
  ├── Manual sync editor (Space bar tapping)    ← NEW
  ├── Word-level karaoke highlighting           ← NEW
  ├── Audio player controls                     ← NEW
  ├── Click-word-to-seek                        ← NEW
  └── Export EPUB3 with Media Overlays          ← NEW
```

### Audio Pipeline

```
Chapter XHTML              Pre-recorded Audio (.mp3/.wav)
     │                            │
     ▼                            ▼
Wrap each word               Store audio file
in <span id="wXXXXX">       per chapter
     │                            │
     └────────────┬───────────────┘
                  ▼
   ┌──────────────────────────┐
   │        AENEAS            │
   │  (Python/C library)      │
   │                          │
   │  1. Synthesize text      │
   │     via eSpeak TTS       │
   │  2. Compute MFCCs for    │
   │     both real & synth    │
   │  3. DTW alignment        │
   │  4. Map timestamps back  │
   │     to real audio domain │
   └──────────────┬───────────┘
                  ▼
       Word-level timestamps
  [{ id:"w00001", word:"The", clipBegin:0.0, clipEnd:0.32 }]
                  │
          ┌───────┴───────┐
          ▼               ▼
    Generate SMIL    Save to MongoDB
    (.smil file)     (for web player)
          │               │
          ▼               ▼
    EPUB3 Export     Web Reader
    with Media       word-by-word
    Overlays         highlighting
```

---

## 2. What is Aeneas

Aeneas is a Python/C library created by ReadBeyond specifically for synchronizing ebook audio with text. It is the most widely used open-source tool for generating EPUB3 Media Overlays.

### How Aeneas Works Internally

```
1. Takes your real audio (narrator recording)
2. Takes your text (the book content)
3. Synthesizes the text using eSpeak TTS engine
   → Creates a "synthetic" audio version
4. Computes MFCC (Mel-frequency cepstral coefficients)
   for BOTH the real audio and the synthetic audio
5. Uses DTW (Dynamic Time Warping) to align
   the two MFCC sequences
6. Maps the alignment back to the real audio timeline
7. Outputs a sync map: each text fragment → [start, end] time
```

### Key Strengths

- Purpose-built for ebook audio synchronization
- Can output SMIL, JSON, SRT, CSV, and 15+ other formats directly
- Works with 38+ languages (uses eSpeak for synthesis)
- Robust against mild mispronunciations, background noise, local word rearrangements
- Fast: C extensions for MFCC/DTW computation (minutes of audio → seconds of processing)
- No internet or API key required — runs entirely offline
- AGPL-3.0 licensed

### Key Limitations

- Word-level alignment is approximate (designed for sentence/paragraph level)
- Uses `--presets-word` flag and MFCC masking to improve word-level results
- Quality depends on eSpeak TTS quality for the given language
- For very high precision word-level sync, the Manual Sync Editor is the fallback

---

## 3. What is SMIL and Why Use It

SMIL (Synchronized Multimedia Integration Language, pronounced "smile") is a W3C standard. EPUB3 uses a subset called **Media Overlays** to sync audio with text.

### A Simple SMIL File

```xml
<?xml version="1.0" encoding="UTF-8"?>
<smil xmlns="http://www.w3.org/ns/SMIL" version="3.0">
  <body>
    <seq id="seq1"
         xmlns:epub="http://www.idpf.org/2007/ops"
         epub:textref="chapter1.xhtml">

      <par id="par1">
        <text src="chapter1.xhtml#w00001"/>
        <audio src="audio/chapter1.mp3"
               clipBegin="0:00:00.000"
               clipEnd="0:00:00.320"/>
      </par>

      <par id="par2">
        <text src="chapter1.xhtml#w00002"/>
        <audio src="audio/chapter1.mp3"
               clipBegin="0:00:00.320"
               clipEnd="0:00:00.580"/>
      </par>

    </seq>
  </body>
</smil>
```

Each `<par>` pairs a text `<span>` ID with an audio clip range. EPUB readers (Apple Books, Thorium, Readium) play them simultaneously, highlighting the word while the clip plays.

### Why SMIL

- Official EPUB3 standard — exported books work in Apple Books, Thorium, Calibre, etc.
- Aeneas can output SMIL directly — zero conversion code needed
- Separates *timing* (SMIL) from *content* (XHTML) from *style* (CSS)

---

## 4. Dependencies & Installation

### System Dependencies

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install -y python3 python3-pip python3-dev \
    ffmpeg espeak-ng espeak-ng-data \
    build-essential libxml2-dev libxslt1-dev zlib1g-dev

# Install numpy first (Aeneas C extensions depend on it)
pip3 install numpy --break-system-packages

# Install Aeneas
pip3 install aeneas --break-system-packages

# Verify installation
python3 -m aeneas.diagnostics
```

The diagnostics command will output:

```
[INFO] aeneas         OK
[INFO] aeneas.cdtw    OK  (C extension)
[INFO] aeneas.cmfcc   OK  (C extension)
[INFO] aeneas.cew     OK  (C extension for eSpeak)
[INFO] espeak         OK
[INFO] ffmpeg         OK
[INFO] ffprobe        OK
```

If the C extensions show `COMPILED WITH FALLBACK` it will still work, just slower.

### macOS

```bash
brew install ffmpeg espeak
pip3 install numpy aeneas
```

### Windows

Use the all-in-one installer from [aeneas releases](https://github.com/readbeyond/aeneas/releases) or run inside WSL/Docker.

### Backend Node.js Packages (add to existing server)

```bash
cd server
npm install fluent-ffmpeg
```

### Frontend Packages (add to existing client)

```bash
cd client
npm install wavesurfer.js
```

---

## 5. Updated Folder Structure

New files marked with `← NEW`:

```
epub-reader/
├── server/
│   ├── controllers/
│   │   ├── bookController.js
│   │   ├── audioController.js            ← NEW
│   │   └── syncController.js             ← NEW
│   ├── models/
│   │   ├── Book.js
│   │   ├── Bookmark.js
│   │   └── SyncData.js                   ← NEW
│   ├── services/
│   │   ├── epubParser.js
│   │   ├── epubToWeb.js
│   │   ├── wordWrapper.js                ← NEW
│   │   ├── aeneasAligner.js              ← NEW (core: calls Aeneas)
│   │   ├── smilGenerator.js              ← NEW
│   │   ├── audioProcessor.js             ← NEW
│   │   └── epubExporter.js               ← NEW
│   ├── scripts/
│   │   ├── aeneas_align_words.py         ← NEW (word-level)
│   │   ├── aeneas_align_sentences.py     ← NEW (sentence-level)
│   │   └── aeneas_align_smil.py          ← NEW (direct SMIL output)
│   ├── routes/
│   │   ├── bookRoutes.js
│   │   ├── audioRoutes.js                ← NEW
│   │   └── syncRoutes.js                 ← NEW
│   ├── storage/
│   │   └── books/
│   │       └── {bookId}/
│   │           ├── chapters/
│   │           ├── assets/
│   │           ├── audio/                 ← NEW
│   │           │   ├── chapter_0.mp3
│   │           │   └── chapter_1.mp3
│   │           └── smil/                  ← NEW
│   │               ├── chapter_0.smil
│   │               └── chapter_1.smil
│   └── app.js
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Reader/
│   │   │   │   ├── ReaderPage.jsx
│   │   │   │   ├── ChapterView.jsx
│   │   │   │   ├── AudioBar.jsx           ← NEW
│   │   │   │   └── HighlightEngine.js     ← NEW
│   │   │   ├── SyncEditor/                ← NEW (entire folder)
│   │   │   │   ├── SyncEditorPage.jsx
│   │   │   │   ├── WordMarker.jsx
│   │   │   │   └── SmilPreview.jsx
│   │   │   └── AudioUpload/               ← NEW
│   │   │       └── ChapterAudioUpload.jsx
│   │   ├── hooks/
│   │   │   ├── useMediaOverlay.js         ← NEW
│   │   │   └── useAudioPlayer.js          ← NEW
│   │   └── utils/
│   │       └── timeFormatter.js           ← NEW
```

---

## 6. Phase A — Word Wrapping Service

Every word in the chapter HTML needs a unique `<span id="wXXXXX">` so that SMIL `<text>` elements can reference them.

### Before Wrapping

```html
<p>The quick brown fox jumps over the lazy dog.</p>
```

### After Wrapping

```html
<p>
  <span id="w00001">The</span>
  <span id="w00002">quick</span>
  <span id="w00003">brown</span>
  <span id="w00004">fox</span>
  <span id="w00005">jumps</span>
  <span id="w00006">over</span>
  <span id="w00007">the</span>
  <span id="w00008">lazy</span>
  <span id="w00009">dog.</span>
</p>
```

### Word Wrapper Service

**server/services/wordWrapper.js**

```javascript
const cheerio = require('cheerio');

class WordWrapper {

  /**
   * Wrap each word in chapter HTML with <span id="wXXXXX">.
   *
   * @param {string} html - Raw chapter HTML
   * @param {number} startIndex - Starting word index (default 0)
   * @returns {{ html, wordCount, words, wordIds, plainText }}
   */
  wrap(html, startIndex = 0) {
    const $ = cheerio.load(html, { xmlMode: false });
    let wordIndex = startIndex;
    const words = [];
    const wordIds = [];
    const plainTextParts = [];

    const textElements =
      'p, h1, h2, h3, h4, h5, h6, li, td, th, ' +
      'blockquote, figcaption, dt, dd, span, em, strong, a';

    $(textElements).each((_, el) => {
      $(el).contents().each((_, node) => {
        if (node.type !== 'text') return;
        const text = $(node).text();
        if (!text.trim()) return;

        plainTextParts.push(text.trim());

        const parts = text.split(/(\s+)/);
        const wrapped = parts.map(part => {
          if (!part.trim()) return part; // preserve whitespace
          wordIndex++;
          const id = 'w' + String(wordIndex).padStart(5, '0');
          words.push(part);
          wordIds.push(id);
          return `<span id="${id}">${part}</span>`;
        }).join('');

        $(node).replaceWith(wrapped);
      });
    });

    return {
      html: $.html(),
      wordCount: words.length,
      words,
      wordIds,
      plainText: plainTextParts.join(' '),
    };
  }

  /**
   * Prepare plain text file for Aeneas.
   *
   * For WORD-LEVEL alignment: one word per line.
   * Aeneas treats each line as a text fragment to align.
   */
  toAeneasWordFile(plainText) {
    return plainText.split(/\s+/).filter(Boolean).join('\n');
  }

  /**
   * Prepare plain text file for Aeneas.
   *
   * For SENTENCE-LEVEL alignment: one sentence per line.
   */
  toAeneasSentenceFile(plainText) {
    return plainText
      .replace(/([.!?])\s+/g, '$1\n')
      .trim();
  }
}

module.exports = new WordWrapper();
```

---

## 7. Phase B — Audio Upload & Storage

**server/controllers/audioController.js**

```javascript
const path = require('path');
const fs = require('fs').promises;
const Book = require('../models/Book');

/**
 * Upload audio file for a specific chapter.
 * POST /api/audio/:bookId/:chapterIndex
 */
exports.uploadChapterAudio = async (req, res) => {
  try {
    const { bookId, chapterIndex } = req.params;
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const audioDir = path.join(book.storagePath, 'audio');
    await fs.mkdir(audioDir, { recursive: true });

    const ext = path.extname(req.file.originalname) || '.mp3';
    const filename = `chapter_${chapterIndex}${ext}`;
    const audioPath = path.join(audioDir, filename);

    await fs.writeFile(audioPath, req.file.buffer);

    // Get duration via ffprobe
    const duration = await getAudioDuration(audioPath);

    if (!book.audioFiles) book.audioFiles = {};
    book.audioFiles[chapterIndex] = {
      filename,
      duration,
      uploadedAt: new Date(),
    };
    book.markModified('audioFiles');
    await book.save();

    res.json({
      message: 'Audio uploaded',
      filename,
      duration,
      chapterIndex: parseInt(chapterIndex),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Stream audio with range request support.
 * GET /api/audio/:bookId/:chapterIndex/stream
 */
exports.streamAudio = async (req, res) => {
  const { bookId, chapterIndex } = req.params;
  const book = await Book.findById(bookId);
  const audioInfo = book.audioFiles?.[chapterIndex];
  if (!audioInfo) return res.status(404).end();

  const audioPath = path.join(
    book.storagePath, 'audio', audioInfo.filename
  );
  const stat = await fs.stat(audioPath);
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': 'audio/mpeg',
    });
    require('fs').createReadStream(audioPath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': 'audio/mpeg',
    });
    require('fs').createReadStream(audioPath).pipe(res);
  }
};

exports.getChapterAudio = async (req, res) => {
  const book = await Book.findById(req.params.bookId);
  const audioInfo = book?.audioFiles?.[req.params.chapterIndex];
  if (!audioInfo) return res.status(404).json({ error: 'No audio' });
  res.json({
    ...audioInfo,
    url: `/api/audio/${req.params.bookId}/${req.params.chapterIndex}/stream`,
  });
};

exports.deleteChapterAudio = async (req, res) => {
  const book = await Book.findById(req.params.bookId);
  const info = book?.audioFiles?.[req.params.chapterIndex];
  if (!info) return res.status(404).json({ error: 'Not found' });

  const filePath = path.join(book.storagePath, 'audio', info.filename);
  await fs.unlink(filePath).catch(() => {});
  delete book.audioFiles[req.params.chapterIndex];
  book.markModified('audioFiles');
  await book.save();

  const SyncData = require('../models/SyncData');
  await SyncData.deleteOne({
    bookId: req.params.bookId,
    chapterIndex: parseInt(req.params.chapterIndex),
  });

  res.json({ message: 'Audio deleted' });
};

async function getAudioDuration(filePath) {
  const { execSync } = require('child_process');
  try {
    const out = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`
    ).toString().trim();
    return parseFloat(out) || 0;
  } catch { return 0; }
}
```

**server/routes/audioRoutes.js**

```javascript
const router = require('express').Router();
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    cb(null, allowed.includes(ext));
  },
});
const ctrl = require('../controllers/audioController');

router.post('/:bookId/:chapterIndex', upload.single('audio'), ctrl.uploadChapterAudio);
router.get('/:bookId/:chapterIndex', ctrl.getChapterAudio);
router.get('/:bookId/:chapterIndex/stream', ctrl.streamAudio);
router.delete('/:bookId/:chapterIndex', ctrl.deleteChapterAudio);

module.exports = router;
```

---

## 8. Phase C — Aeneas Forced Alignment

This is the core of the audio feature. Aeneas takes your pre-recorded audio + the chapter text and produces timestamps for every word.

### 8.1 Aeneas Python Scripts

#### Word-Level Alignment (JSON output)

**server/scripts/aeneas_align_words.py**

```python
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

Note: Uses --presets-word equivalent settings (MFCC masking)
for improved word-level accuracy.
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

    # Aeneas uses 3-letter ISO 639-3 language codes
    LANG_MAP = {
        "en": "eng", "es": "spa", "fr": "fra", "de": "deu",
        "it": "ita", "pt": "por", "nl": "nld", "ru": "rus",
        "ja": "jpn", "zh": "cmn", "ko": "kor", "ar": "ara",
        "hi": "hin", "sv": "swe", "da": "dan", "fi": "fin",
        "no": "nor", "pl": "pol", "tr": "tur", "uk": "ukr",
    }
    lang = LANG_MAP.get(language, language)

    # Build config string for word-level alignment.
    # is_text_type=plain  →  each line in text file = one fragment
    # os_task_file_format=json  →  output as JSON
    config_string = (
        f"task_language={lang}"
        "|is_text_type=plain"
        "|os_task_file_format=json"
        "|task_adjust_boundary_no_zero=True"
    )

    # Create task
    task = Task(config_string=config_string)
    task.audio_file_path_absolute = audio_path
    task.text_file_path_absolute = text_path
    task.sync_map_file_path_absolute = output_path

    # Runtime config: enable MFCC nonspeech masking
    # This is the equivalent of --presets-word on the CLI.
    # It improves word-level accuracy by masking non-speech
    # regions in the MFCC matrix.
    rconf = RuntimeConfiguration()
    rconf[RuntimeConfiguration.MFCC_MASK_NONSPEECH] = True
    rconf[RuntimeConfiguration.MFCC_MASK_NONSPEECH_L3] = True

    # Optional: enable TTS cache for speed (same words reuse synth)
    rconf[RuntimeConfiguration.TTS_CACHE] = True

    # Execute alignment
    ExecuteTask(task, rconf=rconf).execute()

    # Write sync map to file
    task.output_sync_map_file()

    # Also read back and convert to simpler format
    with open(output_path, "r") as f:
        aeneas_output = json.load(f)

    # Read the original text file to get the words
    with open(text_path, "r") as f:
        text_lines = [line.strip() for line in f if line.strip()]

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

    # Overwrite with our clean format
    with open(output_path, "w") as f:
        json.dump(words, f, indent=2)

    # Print summary for Node.js to capture
    print(json.dumps({
        "success": True,
        "wordCount": len(words),
        "duration": words[-1]["end"] if words else 0,
    }))

if __name__ == "__main__":
    main()
```

#### Direct SMIL Output (for EPUB3 export)

**server/scripts/aeneas_align_smil.py**

```python
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

    # For SMIL output, Aeneas needs:
    # os_task_file_smil_audio_ref  →  audio filename in SMIL
    # os_task_file_smil_page_ref   →  XHTML filename in SMIL
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

    # Enable word-level presets
    rconf = RuntimeConfiguration()
    rconf[RuntimeConfiguration.MFCC_MASK_NONSPEECH] = True
    rconf[RuntimeConfiguration.MFCC_MASK_NONSPEECH_L3] = True
    rconf[RuntimeConfiguration.TTS_CACHE] = True

    ExecuteTask(task, rconf=rconf).execute()
    task.output_sync_map_file()

    print(f'{{"success": true, "output": "{output_path}"}}')

if __name__ == "__main__":
    main()
```

#### Sentence-Level Alignment (higher accuracy, then split)

**server/scripts/aeneas_align_sentences.py**

```python
"""
Sentence-level alignment using Aeneas.
More accurate than word-level — use this when you need reliable results
and can subdivide sentence timestamps into word timestamps on the server.

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

    # Parse and simplify output
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
```

### 8.2 Aeneas Aligner Service (Node.js)

**server/services/aeneasAligner.js**

```javascript
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class AeneasAligner {

  /**
   * Perform word-level alignment using Aeneas.
   *
   * @param {string} audioPath - Path to audio file
   * @param {string[]} words - Array of words from the chapter
   * @param {object} options
   * @param {string} options.language - 2-letter code (en, es, fr, etc.)
   * @returns {Array<{ id, word, start, end }>}
   */
  async alignWords(audioPath, words, options = {}) {
    const { language = 'en' } = options;

    const tmpDir = path.join('/tmp', 'aeneas_' + Date.now());
    await fs.mkdir(tmpDir, { recursive: true });

    // Aeneas expects one word per line for word-level alignment
    const textPath = path.join(tmpDir, 'words.txt');
    await fs.writeFile(textPath, words.join('\n'));

    const outputPath = path.join(tmpDir, 'alignment.json');

    const scriptPath = path.join(
      __dirname, '..', 'scripts', 'aeneas_align_words.py'
    );

    try {
      const stdout = execSync(
        `python3 "${scriptPath}" "${audioPath}" "${textPath}" "${outputPath}" "${language}"`,
        { timeout: 600000, maxBuffer: 50 * 1024 * 1024 }
      ).toString();

      console.log('Aeneas output:', stdout);

      const timestamps = JSON.parse(
        await fs.readFile(outputPath, 'utf-8')
      );

      return timestamps;
    } catch (err) {
      console.error('Aeneas alignment failed:', err.message);
      throw new Error('Aeneas forced alignment failed: ' + err.message);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }

  /**
   * Alternative: Use Aeneas CLI directly (no Python script needed).
   * Useful for quick integration or debugging.
   */
  async alignWordsCLI(audioPath, textPath, outputPath, language = 'eng') {
    const cmd = [
      'python3 -m aeneas.tools.execute_task',
      `"${audioPath}"`,
      `"${textPath}"`,
      `"task_language=${language}|is_text_type=plain|os_task_file_format=json|task_adjust_boundary_no_zero=True"`,
      `"${outputPath}"`,
      '--presets-word',  // Enable MFCC masking for word-level
    ].join(' ');

    execSync(cmd, { timeout: 600000 });

    const raw = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
    return raw.fragments.map(f => ({
      id: f.id,
      word: f.lines[0] || '',
      start: parseFloat(f.begin),
      end: parseFloat(f.end),
    }));
  }

  /**
   * Generate SMIL file directly using Aeneas.
   */
  async generateSmil(audioPath, textPath, outputPath, options = {}) {
    const {
      language = 'eng',
      audioRef = 'audio.mp3',
      pageRef = 'content.xhtml',
    } = options;

    const scriptPath = path.join(
      __dirname, '..', 'scripts', 'aeneas_align_smil.py'
    );

    execSync(
      `python3 "${scriptPath}" "${audioPath}" "${textPath}" "${outputPath}" "${language}" "${audioRef}" "${pageRef}"`,
      { timeout: 600000 }
    );

    return fs.readFile(outputPath, 'utf-8');
  }

  /**
   * Convert Aeneas timestamps to internal syncData format.
   * Maps Aeneas fragment IDs to our word span IDs.
   */
  buildSyncData(aeneasTimestamps, wordIds) {
    return aeneasTimestamps.map((ts, i) => ({
      id: wordIds[i] || 'w' + String(i + 1).padStart(5, '0'),
      word: ts.word,
      clipBegin: ts.start,
      clipEnd: ts.end,
    }));
  }

  /**
   * Sentence-level alignment with even word distribution.
   * Aligns sentences first (more accurate), then distributes
   * timestamps evenly across words within each sentence.
   */
  async alignSentencesThenDistribute(audioPath, plainText, wordIds, options = {}) {
    const { language = 'en' } = options;

    const tmpDir = path.join('/tmp', 'aeneas_sent_' + Date.now());
    await fs.mkdir(tmpDir, { recursive: true });

    // Split text into sentences
    const sentences = plainText
      .replace(/([.!?])\s+/g, '$1\n')
      .split('\n')
      .filter(s => s.trim());

    const textPath = path.join(tmpDir, 'sentences.txt');
    await fs.writeFile(textPath, sentences.join('\n'));

    const outputPath = path.join(tmpDir, 'sentences.json');
    const scriptPath = path.join(
      __dirname, '..', 'scripts', 'aeneas_align_sentences.py'
    );

    execSync(
      `python3 "${scriptPath}" "${audioPath}" "${textPath}" "${outputPath}" "${language}"`,
      { timeout: 600000 }
    );

    const sentenceTimestamps = JSON.parse(
      await fs.readFile(outputPath, 'utf-8')
    );

    // Distribute word timestamps evenly within each sentence
    const allWords = plainText.split(/\s+/).filter(Boolean);
    const syncData = [];
    let globalWordIdx = 0;

    for (const sent of sentenceTimestamps) {
      const sentWords = sent.text.split(/\s+/).filter(Boolean);
      const sentDuration = sent.end - sent.start;
      const wordDuration = sentWords.length > 0
        ? sentDuration / sentWords.length
        : 0;

      for (let i = 0; i < sentWords.length; i++) {
        syncData.push({
          id: wordIds[globalWordIdx] || 'w' + String(globalWordIdx + 1).padStart(5, '0'),
          word: sentWords[i],
          clipBegin: Math.round((sent.start + i * wordDuration) * 1000) / 1000,
          clipEnd: Math.round((sent.start + (i + 1) * wordDuration) * 1000) / 1000,
        });
        globalWordIdx++;
      }
    }

    await fs.rm(tmpDir, { recursive: true, force: true });
    return syncData;
  }
}

module.exports = new AeneasAligner();
```

### 8.3 Sync Controller

**server/controllers/syncController.js**

```javascript
const path = require('path');
const fs = require('fs').promises;
const Book = require('../models/Book');
const SyncData = require('../models/SyncData');
const wordWrapper = require('../services/wordWrapper');
const aeneasAligner = require('../services/aeneasAligner');
const smilGenerator = require('../services/smilGenerator');

/**
 * Auto-align audio to chapter text using Aeneas.
 * POST /api/sync/:bookId/:chapterIndex/auto
 * Body: { mode: "word" | "sentence" }
 *
 * mode: "word"     → Aeneas aligns each word individually (--presets-word)
 * mode: "sentence" → Aeneas aligns sentences, then evenly distributes
 *                     timestamps to words within each sentence.
 *                     More reliable but less precise at word boundaries.
 */
exports.autoAlign = async (req, res) => {
  try {
    const { bookId, chapterIndex } = req.params;
    const { mode = 'word' } = req.body;

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const audioInfo = book.audioFiles?.[chapterIndex];
    if (!audioInfo) {
      return res.status(400).json({
        error: 'Upload audio for this chapter first',
      });
    }

    // Step 1: Read chapter HTML and wrap words
    const chapterPath = path.join(
      book.storagePath, 'chapters', `${chapterIndex}.html`
    );
    const rawHtml = await fs.readFile(chapterPath, 'utf-8');
    const wrapped = wordWrapper.wrap(rawHtml);

    // Save word-wrapped HTML back
    await fs.writeFile(chapterPath, wrapped.html);

    // Step 2: Run Aeneas alignment
    const audioPath = path.join(
      book.storagePath, 'audio', audioInfo.filename
    );

    let syncData;

    if (mode === 'sentence') {
      // Sentence-level alignment → even word distribution
      syncData = await aeneasAligner.alignSentencesThenDistribute(
        audioPath,
        wrapped.plainText,
        wrapped.wordIds,
        { language: book.language || 'en' }
      );
    } else {
      // Word-level alignment (uses MFCC masking / --presets-word)
      const timestamps = await aeneasAligner.alignWords(
        audioPath,
        wrapped.words,
        { language: book.language || 'en' }
      );
      syncData = aeneasAligner.buildSyncData(timestamps, wrapped.wordIds);
    }

    // Step 3: Generate SMIL file
    const chapterFilename = `${chapterIndex}.html`;
    const audioFilename = `audio/${audioInfo.filename}`;
    const smilXml = smilGenerator.generate(
      syncData, chapterFilename, audioFilename
    );

    const smilDir = path.join(book.storagePath, 'smil');
    await fs.mkdir(smilDir, { recursive: true });
    await fs.writeFile(
      path.join(smilDir, `chapter_${chapterIndex}.smil`),
      smilXml
    );

    // Step 4: Save to database
    await SyncData.findOneAndUpdate(
      { bookId, chapterIndex: parseInt(chapterIndex) },
      {
        bookId,
        chapterIndex: parseInt(chapterIndex),
        syncData,
        engine: `aeneas-${mode}`,
        wordCount: wrapped.wordCount,
        duration: audioInfo.duration,
        status: 'complete',
      },
      { upsert: true, new: true }
    );

    res.json({
      message: 'Aeneas alignment complete',
      mode,
      wordCount: wrapped.wordCount,
      syncDataCount: syncData.length,
    });
  } catch (err) {
    console.error('Auto-align error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Save manual sync data from frontend editor.
 * POST /api/sync/:bookId/:chapterIndex/manual
 */
exports.saveManualSync = async (req, res) => {
  const { bookId, chapterIndex } = req.params;
  const { syncData } = req.body;

  if (!syncData?.length) {
    return res.status(400).json({ error: 'No sync data' });
  }

  // Generate SMIL
  const book = await Book.findById(bookId);
  const audioInfo = book?.audioFiles?.[chapterIndex];
  if (audioInfo) {
    const smilXml = smilGenerator.generate(
      syncData,
      `${chapterIndex}.html`,
      `audio/${audioInfo.filename}`
    );
    const smilDir = path.join(book.storagePath, 'smil');
    await fs.mkdir(smilDir, { recursive: true });
    await fs.writeFile(
      path.join(smilDir, `chapter_${chapterIndex}.smil`),
      smilXml
    );
  }

  await SyncData.findOneAndUpdate(
    { bookId, chapterIndex: parseInt(chapterIndex) },
    { syncData, engine: 'manual', status: 'complete', wordCount: syncData.length },
    { upsert: true }
  );

  res.json({ message: 'Manual sync saved', wordCount: syncData.length });
};

exports.getSyncData = async (req, res) => {
  const sync = await SyncData.findOne({
    bookId: req.params.bookId,
    chapterIndex: parseInt(req.params.chapterIndex),
  });
  if (!sync) return res.status(404).json({ error: 'No sync data' });
  res.json(sync);
};

exports.getSyncStatus = async (req, res) => {
  const syncs = await SyncData.find({ bookId: req.params.bookId })
    .select('chapterIndex status engine wordCount');
  res.json(syncs);
};

exports.deleteSyncData = async (req, res) => {
  await SyncData.deleteOne({
    bookId: req.params.bookId,
    chapterIndex: parseInt(req.params.chapterIndex),
  });
  res.json({ message: 'Sync data deleted' });
};
```

**server/routes/syncRoutes.js**

```javascript
const router = require('express').Router();
const ctrl = require('../controllers/syncController');

router.post('/:bookId/:chapterIndex/auto', ctrl.autoAlign);
router.post('/:bookId/:chapterIndex/manual', ctrl.saveManualSync);
router.get('/:bookId/:chapterIndex', ctrl.getSyncData);
router.get('/:bookId/status', ctrl.getSyncStatus);
router.delete('/:bookId/:chapterIndex', ctrl.deleteSyncData);

module.exports = router;
```

---

## 9. Phase D — SMIL Generator

**server/services/smilGenerator.js**

```javascript
class SmilGenerator {

  /**
   * Generate EPUB3-compliant SMIL XML from sync data.
   */
  generate(syncData, chapterFile, audioFile) {
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<smil xmlns="http://www.w3.org/ns/SMIL" version="3.0">',
      '  <body>',
      '    <seq id="seq1"',
      '         xmlns:epub="http://www.idpf.org/2007/ops"',
      `         epub:textref="${chapterFile}">`,
    ];

    syncData.forEach((entry, i) => {
      if (entry.clipBegin === null || entry.clipEnd === null) return;
      lines.push('');
      lines.push(`      <par id="par${i + 1}">`);
      lines.push(`        <text src="${chapterFile}#${entry.id}"/>`);
      lines.push(
        `        <audio src="${audioFile}" ` +
        `clipBegin="${this.formatTime(entry.clipBegin)}" ` +
        `clipEnd="${this.formatTime(entry.clipEnd)}"/>`
      );
      lines.push(`      </par>`);
    });

    lines.push('');
    lines.push('    </seq>');
    lines.push('  </body>');
    lines.push('</smil>');
    return lines.join('\n');
  }

  formatTime(seconds) {
    if (!seconds && seconds !== 0) return '0:00:00.000';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${
      s < 10 ? '0' : ''
    }${s.toFixed(3)}`;
  }

  formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}

module.exports = new SmilGenerator();
```

---

## 10. Phase E — Manual Sync Editor (Frontend)

For fine-tuning or when Aeneas results need correction.

**client/src/components/SyncEditor/SyncEditorPage.jsx**

```jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pause, RotateCcw, Check } from 'lucide-react';
import api from '../../services/api';

export default function SyncEditorPage() {
  const { bookId, chapterIndex } = useParams();
  const navigate = useNavigate();
  const audioRef = useRef(new Audio());

  const [words, setWords] = useState([]);
  const [wordIds, setWordIds] = useState([]);
  const [syncData, setSyncData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  // Load chapter + audio
  useEffect(() => {
    api.get(`/books/${bookId}/chapters/${chapterIndex}`).then(res => {
      const div = document.createElement('div');
      div.innerHTML = res.data.html;
      const spans = div.querySelectorAll('span[id^="w"]');
      const w = [], ids = [];
      spans.forEach(s => { w.push(s.textContent.trim()); ids.push(s.id); });
      setWords(w);
      setWordIds(ids);
      setSyncData(w.map((word, i) => ({
        id: ids[i], word, clipBegin: null, clipEnd: null,
      })));
    });

    api.get(`/audio/${bookId}/${chapterIndex}`).then(res => {
      audioRef.current.src = res.data.url;
      audioRef.current.oncanplay = () => setAudioReady(true);
    });

    return () => audioRef.current.pause();
  }, [bookId, chapterIndex]);

  const togglePlay = () => {
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play(); setIsPlaying(true); }
  };

  // Space bar: mark current word timestamp
  const markWord = useCallback(() => {
    if (currentIndex >= words.length) return;
    const t = Math.round(audioRef.current.currentTime * 1000) / 1000;

    setSyncData(prev => {
      const updated = [...prev];
      if (currentIndex > 0 && updated[currentIndex - 1].clipEnd === null)
        updated[currentIndex - 1].clipEnd = t;
      updated[currentIndex].clipBegin = t;
      if (currentIndex === words.length - 1)
        updated[currentIndex].clipEnd = t + 0.5;
      return updated;
    });
    setCurrentIndex(prev => prev + 1);
  }, [currentIndex, words.length]);

  const undoMark = () => {
    if (currentIndex <= 0) return;
    setSyncData(prev => {
      const u = [...prev];
      u[currentIndex - 1].clipBegin = null;
      u[currentIndex - 1].clipEnd = null;
      if (currentIndex > 1) u[currentIndex - 2].clipEnd = null;
      return u;
    });
    setCurrentIndex(prev => prev - 1);
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.code === 'Space') { e.preventDefault(); markWord(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [markWord]);

  const handleSave = async () => {
    await api.post(`/sync/${bookId}/${chapterIndex}/manual`, { syncData });
    navigate(`/read/${bookId}`);
  };

  const isComplete = currentIndex >= words.length;
  const progress = words.length ? Math.round((currentIndex / words.length) * 100) : 0;

  return (
    <div className="sync-editor">
      <header className="sync-header">
        <h1>Manual Sync Editor</h1>
        <p>Chapter {parseInt(chapterIndex) + 1}</p>
      </header>

      <div className="sync-instructions">
        <p>1. Press Play → 2. Tap <strong>Space</strong> when each word is spoken → 3. Save</p>
      </div>

      <div className="sync-controls">
        <button onClick={togglePlay} disabled={!audioReady}>
          {isPlaying ? <Pause size={20}/> : <Play size={20}/>}
        </button>

        <div className="current-word">
          {isComplete ? '✓ Done!' : words[currentIndex]}
        </div>

        <div className="progress-text">
          {currentIndex} / {words.length} ({progress}%)
        </div>
      </div>

      <div className="sync-actions">
        <button onClick={markWord} disabled={isComplete}>Mark (Space)</button>
        <button onClick={undoMark} disabled={currentIndex === 0}>
          <RotateCcw size={14}/> Undo
        </button>
        <button onClick={handleSave} disabled={!isComplete}>
          <Check size={14}/> Save
        </button>
      </div>

      <div className="word-chips">
        {words.map((w, i) => (
          <span key={i} className={`chip ${
            i < currentIndex ? 'done' : i === currentIndex ? 'active' : ''
          }`}>{w}</span>
        ))}
      </div>
    </div>
  );
}
```

---

## 11. Phase F — Highlight Engine (Frontend)

**client/src/hooks/useMediaOverlay.js**

```javascript
import { useState, useEffect, useRef, useCallback } from 'react';

export function useMediaOverlay(syncData, audioUrl) {
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeWordId, setActiveWordId] = useState(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('ended', () => { setIsPlaying(false); clearHighlights(); });
    if (audioUrl) audio.src = audioUrl;
    return () => { audio.pause(); audio.src = ''; stopTimer(); };
  }, [audioUrl]);

  const stopTimer = () => { if (timerRef.current) clearInterval(timerRef.current); };

  const updateHighlights = useCallback((t) => {
    if (!syncData?.length) return;
    let newActive = null;
    for (const entry of syncData) {
      const el = document.getElementById(entry.id);
      if (!el || entry.clipBegin === null) continue;
      if (t >= entry.clipBegin && t < entry.clipEnd) {
        newActive = entry.id;
        el.classList.add('-epub-media-overlay-active');
        el.classList.remove('mo-spoken');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (t >= entry.clipEnd) {
        el.classList.remove('-epub-media-overlay-active');
        el.classList.add('mo-spoken');
      } else {
        el.classList.remove('-epub-media-overlay-active', 'mo-spoken');
      }
    }
    setActiveWordId(newActive);
  }, [syncData]);

  const clearHighlights = () => {
    document.querySelectorAll('.-epub-media-overlay-active, .mo-spoken')
      .forEach(el => el.classList.remove('-epub-media-overlay-active', 'mo-spoken'));
  };

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      if (!audioRef.current) return;
      const t = audioRef.current.currentTime;
      setCurrentTime(t);
      updateHighlights(t);
    }, 40);
  }, [updateHighlights]);

  const play = useCallback(() => {
    audioRef.current?.play();
    setIsPlaying(true);
    startTimer();
  }, [startTimer]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    stopTimer();
  }, []);

  const togglePlay = useCallback(() => { isPlaying ? pause() : play(); }, [isPlaying, play, pause]);
  const seek = useCallback((t) => { if (audioRef.current) { audioRef.current.currentTime = t; updateHighlights(t); } }, [updateHighlights]);

  const seekToWord = useCallback((wordId) => {
    const entry = syncData?.find(d => d.id === wordId);
    if (entry?.clipBegin !== null) { seek(entry.clipBegin); if (!isPlaying) play(); }
  }, [syncData, seek, isPlaying, play]);

  const setSpeed = useCallback((r) => { if (audioRef.current) audioRef.current.playbackRate = r; setPlaybackRate(r); }, []);

  return { isPlaying, currentTime, duration, activeWordId, playbackRate, play, pause, togglePlay, seek, seekToWord, setSpeed, clearHighlights };
}
```

### Highlight CSS

```css
.-epub-media-overlay-active {
  color: #c0392b !important;
  background: rgba(192, 57, 43, 0.12) !important;
  font-weight: 600;
  border-radius: 3px;
  padding: 1px 2px;
  transition: color 0.08s ease, background 0.08s ease;
}
.mo-spoken { color: var(--text) !important; }
.audio-playing .chapter-content span[id^="w"] {
  color: var(--text-dim);
  transition: color 0.1s ease;
}
.theme-sepia .-epub-media-overlay-active { color: #8b5e34 !important; background: rgba(139,94,52,0.12) !important; }
.theme-dark .-epub-media-overlay-active { color: #f7c948 !important; background: rgba(247,201,72,0.15) !important; }
```

---

## 12. Phase G — Audio Player Controls (Frontend)

**client/src/components/Reader/AudioBar.jsx**

```jsx
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

export default function AudioBar({ overlay }) {
  const { isPlaying, currentTime, duration, playbackRate, togglePlay, seek, setSpeed } = overlay;
  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="audio-bar">
      <div className="audio-controls">
        <button onClick={() => seek(Math.max(0, currentTime - 10))}><SkipBack size={16}/></button>
        <button className="play-btn" onClick={togglePlay}>
          {isPlaying ? <Pause size={20}/> : <Play size={20}/>}
        </button>
        <button onClick={() => seek(Math.min(duration, currentTime + 10))}><SkipForward size={16}/></button>
      </div>
      <div className="seek-bar" onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        seek(((e.clientX - r.left) / r.width) * duration);
      }}>
        <div className="seek-fill" style={{ width: `${progress}%` }}/>
      </div>
      <span className="time-display">{fmt(currentTime)} / {fmt(duration)}</span>
      <select value={playbackRate} onChange={e => setSpeed(parseFloat(e.target.value))}>
        {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => (
          <option key={r} value={r}>{r}×</option>
        ))}
      </select>
    </div>
  );
}

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
}
```

---

## 13. Phase H — Integration with Reader UI

Add audio support to the existing `ReaderPage.jsx`. The key additions:

- Load sync data when a chapter has been aligned
- Show AudioBar when sync is available
- Show upload/sync prompts when not yet configured
- Add `audio-playing` CSS class when audio is active
- Handle word clicks → seek audio

See the full `ReaderPage.jsx` integration code in the previous guide. The sync controller endpoints remain the same — just the engine is now always Aeneas.

---

## 14. Phase I — EPUB3 Export with Media Overlays

**server/services/epubExporter.js** — same as previous guide, packages chapters (with word spans), SMIL files, audio files, and OPF with `media-overlay` attributes into a valid `.epub` ZIP.

Key OPF entries Aeneas + our pipeline produces:

```xml
<item id="ch0" href="0.html"
      media-type="application/xhtml+xml"
      media-overlay="mo_0"/>

<item id="mo_0" href="chapter_0.smil"
      media-type="application/smil+xml"/>

<item id="audio_0" href="audio/chapter_0.mp3"
      media-type="audio/mpeg"/>

<meta property="media:active-class">-epub-media-overlay-active</meta>
<meta property="media:duration" refines="#mo_0">0:05:23.000</meta>
```

---

## 15. Database Schema (Audio Related)

**server/models/SyncData.js**

```javascript
const mongoose = require('mongoose');

const syncEntrySchema = new mongoose.Schema({
  id: String,           // "w00001" — matches <span id> in HTML
  word: String,         // "The"
  clipBegin: Number,    // 0.000 (seconds)
  clipEnd: Number,      // 0.320 (seconds)
}, { _id: false });

const syncDataSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  chapterIndex: { type: Number, required: true },
  syncData: [syncEntrySchema],
  engine: {
    type: String,
    enum: ['aeneas-word', 'aeneas-sentence', 'manual'],
    default: 'aeneas-word',
  },
  wordCount: Number,
  duration: Number,
  status: { type: String, enum: ['pending', 'processing', 'complete', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

syncDataSchema.index({ bookId: 1, chapterIndex: 1 }, { unique: true });

module.exports = mongoose.model('SyncData', syncDataSchema);
```

Add to existing **Book** model:

```javascript
audioFiles: {
  type: Map,
  of: { filename: String, duration: Number, uploadedAt: Date },
  default: {},
},
```

---

## 16. API Reference (Audio Related)

### Audio

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/audio/:bookId/:chIdx` | Upload audio for chapter |
| `GET` | `/api/audio/:bookId/:chIdx` | Get audio info |
| `GET` | `/api/audio/:bookId/:chIdx/stream` | Stream audio (range support) |
| `DELETE` | `/api/audio/:bookId/:chIdx` | Delete chapter audio |

### Sync

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/api/sync/:bookId/:chIdx/auto` | `{ mode: "word" \| "sentence" }` | Run Aeneas alignment |
| `POST` | `/api/sync/:bookId/:chIdx/manual` | `{ syncData: [...] }` | Save manual sync |
| `GET` | `/api/sync/:bookId/:chIdx` | — | Get sync data |
| `GET` | `/api/sync/:bookId/status` | — | Sync status for all chapters |
| `DELETE` | `/api/sync/:bookId/:chIdx` | — | Delete sync data |

### Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/books/:id/export-epub` | Download EPUB3 with Media Overlays |

---

## 17. Audio Scenarios & Edge Cases

### One audio file per chapter (ideal)

Upload directly. Run Aeneas. Done.

### One big audio file for entire book

Split by silence detection:

```javascript
// server/services/audioProcessor.js
function detectSilence(audioPath) {
  const output = execSync(
    `ffmpeg -i "${audioPath}" -af silencedetect=n=-40dB:d=2 -f null - 2>&1`
  ).toString();
  const silences = [];
  const re = /silence_end: ([\d.]+)/g;
  let m;
  while ((m = re.exec(output))) silences.push(parseFloat(m[1]));
  return silences;
}
```

### Aeneas word-level accuracy is insufficient

Use the **sentence mode** (`mode: "sentence"` in the API call). Aeneas excels at sentence-level alignment. Words within each sentence get evenly distributed timestamps. Then use the Manual Sync Editor to fine-tune individual words.

### Audio doesn't match text exactly

Aeneas is robust against mild mismatches. For major differences, edit the text file or use manual sync.

---

## 18. Aeneas Configuration Reference

### Config String Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| `task_language` | `eng`, `spa`, `fra`, `deu`, etc. | 3-letter ISO code |
| `is_text_type` | `plain`, `parsed`, `unparsed`, `mplain`, `munparsed`, `subtitles` | Text format |
| `os_task_file_format` | `json`, `smil`, `srt`, `csv`, `tsv`, `vtt`, `xml`, `aud`, etc. | Output format |
| `os_task_file_smil_audio_ref` | e.g. `audio.mp3` | Audio filename in SMIL |
| `os_task_file_smil_page_ref` | e.g. `content.xhtml` | XHTML filename in SMIL |
| `task_adjust_boundary_no_zero` | `True` | No zero-duration fragments |

### Text File Formats for Aeneas

| Type | Description | Example |
|------|-------------|---------|
| `plain` | One fragment per line | `The\nquick\nbrown\nfox` |
| `parsed` | `id\|text` per line | `w00001\|The\nw00002\|quick` |
| `mplain` | Multilevel: blank lines separate levels | Paragraphs → sentences → words |
| `unparsed` | XML/HTML, extract via regex | XHTML with custom IDs |

### CLI Usage

```bash
# Word-level JSON with presets
python3 -m aeneas.tools.execute_task \
  audio.mp3 \
  words.txt \
  "task_language=eng|is_text_type=plain|os_task_file_format=json" \
  output.json \
  --presets-word

# SMIL output (for EPUB3)
python3 -m aeneas.tools.execute_task \
  audio.mp3 \
  words.txt \
  "task_language=eng|is_text_type=plain|os_task_file_format=smil|os_task_file_smil_audio_ref=audio/ch1.mp3|os_task_file_smil_page_ref=chapter1.xhtml" \
  chapter1.smil \
  --presets-word

# Sentence-level SRT
python3 -m aeneas.tools.execute_task \
  audio.mp3 \
  sentences.txt \
  "task_language=eng|is_text_type=plain|os_task_file_format=srt" \
  output.srt
```

### Supported Languages (38+)

AFR, ARA, BUL, CAT, CYM, CES, DAN, DEU, ELL, **ENG**, EPO, EST, FAS, FIN, **FRA**, GLE, GRC, HRV, HUN, ISL, **ITA**, JPN, LAT, LAV, LIT, NLD, NOR, RON, RUS, POL, **POR**, SLK, **SPA**, SRP, SWA, SWE, TUR, UKR

---

## 19. SMIL Format Quick Reference

### Time Formats

| Format | Example |
|--------|---------|
| Full | `0:01:23.456` |
| Seconds | `83.456s` |
| Milliseconds | `83456ms` |

### OPF Metadata

```xml
<meta property="media:active-class">-epub-media-overlay-active</meta>
<meta property="media:duration" refines="#mo_0">0:05:23.000</meta>
<meta property="media:duration">0:45:10.000</meta>
```

---

## 20. Complete Data Flow

```
User uploads EPUB → Parse → Chapters stored on disk
  │
  │  User uploads audio for Chapter 3
  │  → Saved to /storage/books/{id}/audio/chapter_3.mp3
  │
  │  User clicks "Auto-Sync (Aeneas)"
  │
  ├── Chapter HTML loaded
  ├── Words wrapped: <span id="w00001">The</span> ...
  ├── Plain text extracted, one word per line → words.txt
  ├── Aeneas runs:
  │     python3 -m aeneas.tools.execute_task \
  │       chapter_3.mp3 words.txt \
  │       "task_language=eng|is_text_type=plain|os_task_file_format=json" \
  │       alignment.json --presets-word
  ├── Timestamps parsed → syncData array
  ├── SMIL file generated → chapter_3.smil
  ├── SyncData saved to MongoDB
  │
  │  User reads with audio
  │
  ├── Audio plays via HTML5 <audio>
  ├── Highlight engine polls every 40ms
  ├── Words light up one by one
  ├── Click any word → audio seeks to that point
  │
  │  User clicks "Export EPUB3"
  │
  └── Chapters + SMIL + audio + OPF → valid .epub
      Works in Apple Books, Thorium, Calibre, Readium
```

---

## 21. Troubleshooting Aeneas

| Issue | Solution |
|-------|----------|
| `espeak not found` | `sudo apt install espeak-ng` |
| `ffmpeg not found` | `sudo apt install ffmpeg` |
| C extensions not compiled | Ensure `python3-dev` and `build-essential` are installed, reinstall `pip install aeneas` |
| Alignment is poor for a language | Check that the eSpeak voice for that language is installed: `espeak-ng --voices` |
| Very long audio causes memory issues | Split audio into chapters first. Rule of thumb: 4GB RAM → max 2h audio |
| Word-level alignment not precise enough | Use `mode: "sentence"` first, then fine-tune with Manual Sync Editor |
| Aeneas produces zero-length fragments | Add `task_adjust_boundary_no_zero=True` to config string |
| Timestamps seem shifted | Audio may have silence at start. Use `is_audio_file_head_length=X.XXX` to skip |

---

## 22. Setup & Run

### Install Everything

```bash
# System deps
sudo apt install -y python3 python3-pip python3-dev ffmpeg espeak-ng build-essential

# Aeneas
pip3 install numpy --break-system-packages
pip3 install aeneas --break-system-packages

# Verify
python3 -m aeneas.diagnostics

# Node.js deps
cd server && npm install fluent-ffmpeg
cd ../client && npm install wavesurfer.js
```

### Register Routes (server/app.js)

```javascript
const audioRoutes = require('./routes/audioRoutes');
const syncRoutes = require('./routes/syncRoutes');

app.use('/api/audio', audioRoutes);
app.use('/api/sync', syncRoutes);
```

### Test Full Flow

```bash
# 1. Start MongoDB
mongod

# 2. Backend
cd server && npx nodemon app.js

# 3. Frontend
cd client && npm run dev

# 4. Test:
#    a. Upload EPUB → opens in reader
#    b. Upload audio for a chapter
#    c. Click "Auto-Sync" (uses Aeneas)
#    d. Press Play → words highlight as narrator speaks
#    e. Click any word → audio jumps there
#    f. Export EPUB3 with Media Overlays
```

---

*Powered by Aeneas — the purpose-built Python/C library for ebook audio synchronization, created by ReadBeyond.*
