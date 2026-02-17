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

    if (!book.audioFiles) book.audioFiles = new Map();
    book.audioFiles.set(String(chapterIndex), {
      filename,
      duration,
      uploadedAt: new Date(),
    });
    book.markModified('audioFiles');
    await book.save();

    res.json({
      message: 'Audio uploaded',
      filename,
      duration,
      chapterIndex: parseInt(chapterIndex),
    });
  } catch (err) {
    console.error('Audio upload error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Stream audio with range request support.
 * GET /api/audio/:bookId/:chapterIndex/stream
 */
exports.streamAudio = async (req, res) => {
  try {
    const { bookId, chapterIndex } = req.params;
    const book = await Book.findById(bookId);
    const audioInfo = book?.audioFiles?.get(String(chapterIndex));
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getChapterAudio = async (req, res) => {
  try {
    const book = await Book.findById(req.params.bookId);
    const audioInfo = book?.audioFiles?.get(String(req.params.chapterIndex));
    if (!audioInfo) return res.status(404).json({ error: 'No audio' });
    res.json({
      ...audioInfo,
      url: `/api/audio/${req.params.bookId}/${req.params.chapterIndex}/stream`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteChapterAudio = async (req, res) => {
  try {
    const book = await Book.findById(req.params.bookId);
    const chapterKey = String(req.params.chapterIndex);
    const info = book?.audioFiles?.get(chapterKey);
    if (!info) return res.status(404).json({ error: 'Not found' });

    const filePath = path.join(book.storagePath, 'audio', info.filename);
    await fs.unlink(filePath).catch(() => {});
    book.audioFiles.delete(chapterKey);
    book.markModified('audioFiles');
    await book.save();

    const SyncData = require('../models/SyncData');
    await SyncData.deleteOne({
      bookId: req.params.bookId,
      chapterIndex: parseInt(req.params.chapterIndex),
    });

    res.json({ message: 'Audio deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
