const path = require('path');
const fs = require('fs').promises;
const Book = require('../models/Book');
const SyncData = require('../models/SyncData');
const wordWrapper = require('../services/wordWrapper');
const whisperxAligner = require('../services/whisperxAligner');
const smilGenerator = require('../services/smilGenerator');

/**
 * Auto-align audio to chapter text using WhisperX (SSE streaming).
 * POST /api/sync/:bookId/:chapterIndex/auto
 * Body: { mode: "word" | "sentence", modelSize: "tiny"|"base"|"small"|"medium"|"large-v2", lang?: string }
 *
 * Streams progress events as SSE, then closes the connection.
 * When lang is provided (e.g. "kn"), aligns against the translated chapter
 * so that sync data matches the translated word spans.
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
    const { mode = 'word', modelSize = 'tiny', lang } = req.body;

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
    const wrapped = wordWrapper.wrap(rawHtml);
    await fs.writeFile(chapterPath, wrapped.html);

    send('progress', { step: 'wrapping_done', message: 'Text prepared. Starting WhisperX...' });

    const audioPath = path.join(book.storagePath, 'audio', audioInfo.filename);

    const onProgress = (evt) => {
      send('progress', { step: evt.progress, message: evt.message });
    };

    let syncData;

    // Try edge-tts per-word timing JSON first (instant, exact for TTS-generated audio)
    const timingPath = audioPath.replace(/\.mp3$/, '_timing.json');
    let usedTtsTiming = false;
    try {
      await fs.access(timingPath);
      const timingRaw = JSON.parse(await fs.readFile(timingPath, 'utf-8'));
      console.log(`[Sync] Found TTS timing: ${timingRaw.length} TTS words, ${wrapped.words.length} wrapped words`);
      send('progress', { step: 'tts_timing_found', message: `Using TTS per-word timing (${timingRaw.length} TTS words, ${wrapped.words.length} text words)...` });
      syncData = await whisperxAligner.buildSyncFromTiming(timingPath, wrapped.words, wrapped.wordIds);
      if (syncData) {
        usedTtsTiming = true;
        // Log sample of sync data to verify gaps exist at sentence boundaries
        const sample = syncData.slice(0, 10).map(s => `${s.word}:${s.clipBegin}-${s.clipEnd}`).join(', ');
        console.log(`[Sync] TTS sync sample: ${sample}`);
      }
    } catch (timingErr) {
      console.log(`[Sync] No TTS timing file at ${timingPath}: ${timingErr.message}`);
      // No timing file — fall back to WhisperX
    }

    if (!syncData) {
      // Fallback: WhisperX alignment (for uploaded/non-TTS audio)
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
        engine: usedTtsTiming ? 'edge-tts-word-boundary' : `whisperx-${mode}`,
        wordCount: wrapped.wordCount,
        duration: audioInfo.duration,
        status: 'complete',
      },
      { upsert: true, new: true }
    );

    send('done', {
      message: 'WhisperX alignment complete',
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
