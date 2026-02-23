const path = require('path');
const fs = require('fs').promises;
const cheerio = require('cheerio');
const Book = require('../models/Book');
const SyncData = require('../models/SyncData');
const wordWrapper = require('../services/wordWrapper');
const whisperxAligner = require('../services/whisperxAligner');
const smilGenerator = require('../services/smilGenerator');

/**
 * Auto-align audio to chapter text using WhisperX.
 * POST /api/sync/:bookId/:chapterIndex/auto
 * Body: { mode: "word" | "sentence", modelSize: "tiny"|"base"|"small"|"medium"|"large-v2", lang?: string }
 *
 * When lang is provided (e.g. "kn"), aligns against the translated chapter
 * so that sync data matches the translated word spans.
 */
exports.autoAlign = async (req, res) => {
  try {
    const { bookId, chapterIndex } = req.params;
    const { mode = 'word', modelSize = 'base', lang } = req.body;

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const audioKey = lang ? `${chapterIndex}_${lang}` : String(chapterIndex);
    let audioInfo = book.audioFiles?.get(audioKey);
    // Fallback: if lang-specific audio not found, try the base key
    if (!audioInfo && lang) audioInfo = book.audioFiles?.get(String(chapterIndex));
    if (!audioInfo) {
      return res.status(400).json({
        error: 'Upload or generate audio for this chapter first' + (lang ? ` (language: ${lang})` : ''),
      });
    }

    // Step 1: Read chapter HTML and wrap words
    // Use translated chapter if lang is provided
    const bookLang = (book.language || 'en').split('-')[0];
    let chapterPath;
    let whisperLang;

    if (lang && lang !== bookLang) {
      chapterPath = path.join(
        book.storagePath, 'chapters', `${chapterIndex}_${lang}.html`
      );
      whisperLang = lang;
      try {
        await fs.access(chapterPath);
      } catch {
        return res.status(400).json({ error: `No ${lang} translation found. Translate the chapter first.` });
      }
    } else {
      chapterPath = path.join(
        book.storagePath, 'chapters', `${chapterIndex}.html`
      );
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

    // Step 2: Run WhisperX alignment
    const audioPath = path.join(
      book.storagePath, 'audio', audioInfo.filename
    );

    let syncData;

    if (mode === 'sentence') {
      syncData = await whisperxAligner.alignSentencesThenDistribute(
        audioPath,
        wrapped.plainText,
        wrapped.wordIds,
        { language: whisperLang, modelSize }
      );
    } else {
      const timestamps = await whisperxAligner.alignWords(
        audioPath,
        wrapped.words,
        { language: whisperLang, modelSize }
      );
      syncData = whisperxAligner.buildSyncData(timestamps, wrapped.wordIds);
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
    const syncLang = (lang && lang !== bookLang) ? lang : null;
    await SyncData.findOneAndUpdate(
      { bookId, chapterIndex: parseInt(chapterIndex), lang: syncLang },
      {
        bookId,
        chapterIndex: parseInt(chapterIndex),
        lang: syncLang,
        syncData,
        engine: `whisperx-${mode}`,
        wordCount: wrapped.wordCount,
        duration: audioInfo.duration,
        status: 'complete',
      },
      { upsert: true, new: true }
    );

    res.json({
      message: 'WhisperX alignment complete',
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
    if (!sync) return res.status(404).json({ error: 'No sync data' });
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
