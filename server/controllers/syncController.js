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
      syncData = await aeneasAligner.alignSentencesThenDistribute(
        audioPath,
        wrapped.plainText,
        wrapped.wordIds,
        { language: book.language || 'en' }
      );
    } else {
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
  try {
    const { bookId, chapterIndex } = req.params;
    const { syncData } = req.body;

    if (!syncData?.length) {
      return res.status(400).json({ error: 'No sync data' });
    }

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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSyncData = async (req, res) => {
  try {
    const sync = await SyncData.findOne({
      bookId: req.params.bookId,
      chapterIndex: parseInt(req.params.chapterIndex),
    });
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
    await SyncData.deleteOne({
      bookId: req.params.bookId,
      chapterIndex: parseInt(req.params.chapterIndex),
    });
    res.json({ message: 'Sync data deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
