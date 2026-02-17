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

/**
 * Trim audio by removing a time range directly.
 * POST /api/audio/:bookId/:chapterIndex/trim
 * Body: { trimStart: seconds, trimEnd: seconds }
 */
exports.trimAudio = async (req, res) => {
  try {
    const { bookId, chapterIndex } = req.params;
    const { trimStart, trimEnd } = req.body;

    if (trimStart === undefined || trimEnd === undefined) {
      return res.status(400).json({ error: 'Provide trimStart and trimEnd' });
    }

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const audioInfo = book.audioFiles?.get(String(chapterIndex));
    if (!audioInfo) return res.status(400).json({ error: 'No audio for this chapter' });

    const audioPath = path.join(book.storagePath, 'audio', audioInfo.filename);
    const totalDuration = audioInfo.duration || await getAudioDuration(audioPath);

    if (trimStart >= trimEnd || trimStart < 0 || trimEnd > totalDuration + 0.1) {
      return res.status(400).json({ error: 'Invalid trim range' });
    }

    // Backup original audio before first trim
    const backupPath = audioPath.replace(/(\.\w+)$/, '_original$1');
    try {
      await fs.access(backupPath);
    } catch {
      await fs.copyFile(audioPath, backupPath);
    }

    // Compute keep ranges (everything except the trimmed section)
    const keepRanges = invertRanges([{ start: trimStart, end: trimEnd }], totalDuration);

    if (keepRanges.length === 0) {
      return res.status(400).json({ error: 'Cannot remove all audio' });
    }

    // Use FFmpeg to create trimmed audio
    const trimmedPath = audioPath.replace(/(\.\w+)$/, '_trimmed$1');
    await trimWithFfmpeg(audioPath, keepRanges, trimmedPath);

    // Replace current with trimmed
    await fs.unlink(audioPath);
    await fs.rename(trimmedPath, audioPath);

    const newDuration = await getAudioDuration(audioPath);

    // Update book audio duration
    const updatedInfo = { filename: audioInfo.filename, duration: newDuration, uploadedAt: audioInfo.uploadedAt };
    book.audioFiles.set(String(chapterIndex), updatedInfo);
    book.markModified('audioFiles');
    await book.save();

    // Delete old sync data — user must re-sync after trimming
    const SyncData = require('../models/SyncData');
    await SyncData.deleteOne({ bookId, chapterIndex: parseInt(chapterIndex) });

    res.json({
      message: 'Audio trimmed successfully',
      removedRange: { start: trimStart, end: trimEnd },
      newDuration,
    });
  } catch (err) {
    console.error('Trim error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Restore original audio (undo all trims).
 * POST /api/audio/:bookId/:chapterIndex/restore
 */
exports.restoreAudio = async (req, res) => {
  try {
    const { bookId, chapterIndex } = req.params;
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const audioInfo = book.audioFiles?.get(String(chapterIndex));
    if (!audioInfo) return res.status(400).json({ error: 'No audio' });

    const audioPath = path.join(book.storagePath, 'audio', audioInfo.filename);
    const backupPath = audioPath.replace(/(\.\w+)$/, '_original$1');

    try {
      await fs.access(backupPath);
    } catch {
      return res.status(400).json({ error: 'No backup found — audio was never trimmed' });
    }

    await fs.copyFile(backupPath, audioPath);
    const newDuration = await getAudioDuration(audioPath);

    const updatedInfo = { filename: audioInfo.filename, duration: newDuration, uploadedAt: audioInfo.uploadedAt };
    book.audioFiles.set(String(chapterIndex), updatedInfo);
    book.markModified('audioFiles');
    await book.save();

    res.json({ message: 'Audio restored to original', newDuration });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: err.message });
  }
};

// --- Helper functions ---

function mergeRanges(ranges) {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end + 0.001) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push({ ...sorted[i] });
    }
  }
  return merged;
}

function invertRanges(skipRanges, totalDuration) {
  const keep = [];
  let cursor = 0;
  for (const range of skipRanges) {
    if (cursor < range.start) {
      keep.push({ start: cursor, end: range.start });
    }
    cursor = range.end;
  }
  if (cursor < totalDuration) {
    keep.push({ start: cursor, end: totalDuration });
  }
  return keep;
}

function recalculateTimestamps(syncData, skipSet, mergedSkipRanges) {
  return syncData.map(entry => {
    if (skipSet.has(entry.id)) {
      return { id: entry.id, word: entry.word, clipBegin: null, clipEnd: null, skipped: true };
    }
    if (entry.clipBegin === null || entry.skipped) {
      return { ...entry.toObject ? entry.toObject() : entry };
    }

    let removedTime = 0;
    for (const range of mergedSkipRanges) {
      if (range.end <= entry.clipBegin) {
        removedTime += range.end - range.start;
      }
    }

    return {
      id: entry.id,
      word: entry.word,
      clipBegin: Math.max(0, +(entry.clipBegin - removedTime).toFixed(3)),
      clipEnd: Math.max(0, +(entry.clipEnd - removedTime).toFixed(3)),
      skipped: false,
    };
  });
}

async function trimWithFfmpeg(inputPath, keepRanges, outputPath) {
  const { execSync } = require('child_process');

  if (keepRanges.length === 1) {
    const r = keepRanges[0];
    execSync(
      `ffmpeg -y -i "${inputPath}" -ss ${r.start} -to ${r.end} -c:a libmp3lame -q:a 2 "${outputPath}"`,
      { timeout: 300000 }
    );
    return;
  }

  const filters = [];
  const labels = [];
  keepRanges.forEach((r, i) => {
    const label = `a${i}`;
    filters.push(`[0:a]atrim=start=${r.start}:end=${r.end},asetpts=PTS-STARTPTS[${label}]`);
    labels.push(`[${label}]`);
  });

  const filterComplex = filters.join(';') +
    `;${labels.join('')}concat=n=${keepRanges.length}:v=0:a=1[out]`;

  execSync(
    `ffmpeg -y -i "${inputPath}" -filter_complex "${filterComplex}" -map "[out]" -c:a libmp3lame -q:a 2 "${outputPath}"`,
    { timeout: 300000 }
  );
}

async function getAudioDuration(filePath) {
  const { execSync } = require('child_process');
  try {
    const out = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`
    ).toString().trim();
    return parseFloat(out) || 0;
  } catch { return 0; }
}
