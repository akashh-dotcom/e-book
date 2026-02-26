const path = require('path');
const fs = require('fs').promises;
const cheerio = require('cheerio');
const Book = require('../models/Book');
const SyncData = require('../models/SyncData');
const wordWrapper = require('../services/wordWrapper');
const whisperxAligner = require('../services/whisperxAligner');
const smilGenerator = require('../services/smilGenerator');

/**
 * Auto-align audio to chapter text (SSE streaming).
 * POST /api/sync/:bookId/:chapterIndex/auto
 * Body: {
 *   mode: "word" | "sentence",
 *   engine: "auto" | "whisperx",
 *   modelSize: "tiny"|"base"|"small"|"medium"|"large-v2",
 *   lang?: string
 * }
 *
 * Engine behaviour:
 *   "auto"      — Use TTS timing if available, else WhisperX word-level
 *   "whisperx"  — Force WhisperX alignment (word-level forced alignment)
 *   "stable-ts" — Use stable-ts (enhanced Whisper timestamps, best for fixing drift)
 */
exports.autoAlign = async (req, res) => {
  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { bookId, chapterIndex } = req.params;
    const { mode = 'word', engine = 'auto', modelSize = 'tiny', lang } = req.body;

    send('progress', { step: 'preparing', message: 'Preparing chapter...' });

    const book = await Book.findById(bookId);
    if (!book) {
      send('error', { error: 'Book not found' });
      return res.end();
    }

    const audioKey = lang ? `${chapterIndex}_${lang}` : String(chapterIndex);
    let audioInfo = book.audioFiles?.get(audioKey);
    if (!audioInfo && lang) audioInfo = book.audioFiles?.get(String(chapterIndex));
    if (!audioInfo) {
      send('error', { error: 'Upload or generate audio for this chapter first' + (lang ? ` (language: ${lang})` : '') });
      return res.end();
    }

    const bookLang = (book.language || 'en').split('-')[0];
    let chapterPath;
    let whisperLang;

    if (lang && lang !== bookLang) {
      chapterPath = path.join(book.storagePath, 'chapters', `${chapterIndex}_${lang}.html`);
      whisperLang = lang;
      try {
        await fs.access(chapterPath);
      } catch {
        send('error', { error: `No ${lang} translation found. Translate the chapter first.` });
        return res.end();
      }
    } else {
      chapterPath = path.join(book.storagePath, 'chapters', `${chapterIndex}.html`);
      whisperLang = book.language || 'en';
    }

    const rawHtml = await fs.readFile(chapterPath, 'utf-8');

    // Strip existing word spans to prevent double-wrapping when the
    // translated chapter was already word-wrapped by the translation service.
    const $ = cheerio.load(rawHtml, { xmlMode: false });
    $('span[id^="w"]').each((_, el) => {
      $(el).replaceWith($(el).text());
    });
    const cleanHtml = $.html();

    const wrapped = wordWrapper.wrap(cleanHtml);

    // Save word-wrapped HTML back
    await fs.writeFile(chapterPath, wrapped.html);

    send('progress', { step: 'wrapping_done', message: 'Text prepared. Starting alignment...' });

    const audioPath = path.join(book.storagePath, 'audio', audioInfo.filename);

    const onProgress = (evt) => {
      send('progress', { step: evt.progress, message: evt.message });
    };

    let syncData;
    let usedEngine = engine;

    // --- TTS timing shortcut (only for "auto" engine) ---
    if (engine === 'auto') {
      const timingPath = audioPath.replace(/\.mp3$/, '_timing.json');
      try {
        await fs.access(timingPath);
        send('progress', { step: 'tts_timing_found', message: 'Using TTS per-word timing...' });
        syncData = await whisperxAligner.buildSyncFromTiming(timingPath, wrapped.words, wrapped.wordIds);
        if (syncData) usedEngine = 'edge-tts-word-boundary';
      } catch {
        // No timing file — continue to WhisperX
      }
    }

    // --- stable-ts alignment ---
    if (!syncData && engine === 'stable-ts') {
      send('progress', { step: 'stable_ts_start', message: 'Starting stable-ts alignment (enhanced timestamps)...' });

      try {
        const timestamps = await whisperxAligner.alignWithStableTs(
          audioPath, wrapped.words,
          { language: whisperLang, modelSize, onProgress }
        );
        syncData = whisperxAligner.buildSyncData(timestamps, wrapped.wordIds);
        usedEngine = 'stable-ts';
      } catch (err) {
        console.error('stable-ts alignment failed:', err.message);
        send('error', { error: 'stable-ts alignment failed: ' + err.message });
        return res.end();
      }
    }

    // --- WhisperX alignment ---
    if (!syncData && (engine === 'auto' || engine === 'whisperx')) {
      send('progress', { step: 'whisperx_start', message: 'Starting WhisperX alignment...' });

      try {
        if (mode === 'sentence') {
          syncData = await whisperxAligner.alignSentencesThenDistribute(
            audioPath, wrapped.plainText, wrapped.wordIds,
            { language: whisperLang, modelSize, onProgress }
          );
        } else {
          const timestamps = await whisperxAligner.alignWords(
            audioPath, wrapped.words,
            { language: whisperLang, modelSize, onProgress }
          );
          syncData = whisperxAligner.buildSyncData(timestamps, wrapped.wordIds);
        }
        usedEngine = `whisperx-${mode}`;
      } catch (err) {
        console.error('WhisperX alignment failed:', err.message);
        send('error', { error: 'WhisperX alignment failed: ' + err.message });
        return res.end();
      }
    }

    if (!syncData) {
      send('error', { error: 'Alignment failed' });
      return res.end();
    }

    send('progress', { step: 'saving', message: 'Saving sync data...' });

    // Generate SMIL file
    const chapterFilename = `${chapterIndex}.html`;
    const audioFilename = `audio/${audioInfo.filename}`;
    const smilXml = smilGenerator.generate(syncData, chapterFilename, audioFilename);

    const smilDir = path.join(book.storagePath, 'smil');
    await fs.mkdir(smilDir, { recursive: true });
    await fs.writeFile(path.join(smilDir, `chapter_${chapterIndex}.smil`), smilXml);

    // Save to database
    const syncLang = (lang && lang !== bookLang) ? lang : null;
    await SyncData.findOneAndUpdate(
      { bookId, chapterIndex: parseInt(chapterIndex), lang: syncLang },
      {
        bookId,
        chapterIndex: parseInt(chapterIndex),
        lang: syncLang,
        syncData,
        engine: usedEngine,
        wordCount: wrapped.wordCount,
        duration: audioInfo.duration,
        status: 'complete',
      },
      { upsert: true, new: true }
    );

    send('done', {
      message: `Alignment complete (${usedEngine})`,
      engine: usedEngine,
      mode,
      wordCount: wrapped.wordCount,
      syncDataCount: syncData.length,
    });
    res.end();
  } catch (err) {
    console.error('Auto-align error:', err);
    send('error', { error: err.message });
    res.end();
  }
};

/**
 * Save manual sync data from frontend editor.
 * POST /api/sync/:bookId/:chapterIndex/manual
 */
exports.saveManualSync = async (req, res) => {
  try {
    const { bookId, chapterIndex } = req.params;
    const { syncData, lang } = req.body;

    if (!syncData?.length) {
      return res.status(400).json({ error: 'No sync data' });
    }

    const book = await Book.findById(bookId);
    const audioKey = lang ? `${chapterIndex}_${lang}` : String(chapterIndex);
    const audioInfo = book?.audioFiles?.get(audioKey);
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

    const syncLang = lang || null;
    await SyncData.findOneAndUpdate(
      { bookId, chapterIndex: parseInt(chapterIndex), lang: syncLang },
      { syncData, lang: syncLang, engine: 'manual', status: 'complete', wordCount: syncData.length },
      { upsert: true }
    );

    res.json({ message: 'Manual sync saved', wordCount: syncData.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSyncData = async (req, res) => {
  try {
    const lang = req.query.lang || null;
    const query = {
      bookId: req.params.bookId,
      chapterIndex: parseInt(req.params.chapterIndex),
    };
    if (lang) query.lang = lang;
    else query.lang = { $in: [null, undefined] };
    let sync = await SyncData.findOne(query);
    // Fallback: if lang-specific sync not found, try without lang
    if (!sync && lang) {
      sync = await SyncData.findOne({
        bookId: req.params.bookId,
        chapterIndex: parseInt(req.params.chapterIndex),
        lang: { $in: [null, undefined] },
      });
    }
    if (!sync) return res.json({ exists: false });
    res.json(sync);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSyncStatus = async (req, res) => {
  try {
    const syncs = await SyncData.find({ bookId: req.params.bookId })
      .select('chapterIndex status engine wordCount');
    res.json(syncs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteSyncData = async (req, res) => {
  try {
    const lang = req.query.lang || null;
    const query = {
      bookId: req.params.bookId,
      chapterIndex: parseInt(req.params.chapterIndex),
    };
    if (lang) query.lang = lang;
    else query.lang = { $in: [null, undefined] };
    await SyncData.deleteOne(query);
    res.json({ message: 'Sync data deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
