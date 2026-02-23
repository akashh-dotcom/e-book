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
    const lang = req.query.lang || req.body?.lang || null;
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const audioDir = path.join(book.storagePath, 'audio');
    await fs.mkdir(audioDir, { recursive: true });

    const ext = path.extname(req.file.originalname) || '.mp3';
    const audioKey = lang ? `${chapterIndex}_${lang}` : String(chapterIndex);
    const filename = lang ? `chapter_${chapterIndex}_${lang}${ext}` : `chapter_${chapterIndex}${ext}`;
    const audioPath = path.join(audioDir, filename);

    await fs.writeFile(audioPath, req.file.buffer);

    // Get duration via ffprobe
    const duration = await getAudioDuration(audioPath);

    if (!book.audioFiles) book.audioFiles = new Map();
    book.audioFiles.set(audioKey, {
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
    const lang = req.query.lang || null;
    const book = await Book.findById(bookId);
    const audioKey = lang ? `${chapterIndex}_${lang}` : String(chapterIndex);
    let audioInfo = book?.audioFiles?.get(audioKey);
    // Fallback: if lang-specific audio not found, try the base key
    if (!audioInfo && lang) audioInfo = book?.audioFiles?.get(String(chapterIndex));
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
    const lang = req.query.lang || null;
    const book = await Book.findById(req.params.bookId);
    const audioKey = lang ? `${req.params.chapterIndex}_${lang}` : String(req.params.chapterIndex);
    let audioInfo = book?.audioFiles?.get(audioKey);
    // Fallback: if lang-specific audio not found, try the base key
    if (!audioInfo && lang) audioInfo = book?.audioFiles?.get(String(req.params.chapterIndex));
    if (!audioInfo) return res.json({ exists: false });
    const langQuery = lang ? `?lang=${lang}` : '';
    res.json({
      ...audioInfo,
      url: `/api/audio/${req.params.bookId}/${req.params.chapterIndex}/stream${langQuery}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteChapterAudio = async (req, res) => {
  try {
    const lang = req.query.lang || null;
    const book = await Book.findById(req.params.bookId);
    const chapterKey = lang ? `${req.params.chapterIndex}_${lang}` : String(req.params.chapterIndex);
    const info = book?.audioFiles?.get(chapterKey);
    if (!info) return res.status(404).json({ error: 'Not found' });

    const filePath = path.join(book.storagePath, 'audio', info.filename);
    await fs.unlink(filePath).catch(() => {});
    book.audioFiles.delete(chapterKey);
    book.markModified('audioFiles');
    await book.save();

    const SyncData = require('../models/SyncData');
    const syncQuery = { bookId: req.params.bookId, chapterIndex: parseInt(req.params.chapterIndex) };
    if (lang) syncQuery.lang = lang;
    else syncQuery.lang = { $in: [null, undefined] };
    await SyncData.deleteOne(syncQuery);

    res.json({ message: 'Audio deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Trim audio — supports both direct time-range and word-based trim.
 * POST /api/audio/:bookId/:chapterIndex/trim
 * Body: { trimStart, trimEnd } for direct trim
 *    OR { skipWordIds: [...] } for word-based trim
 */
exports.trimAudio = async (req, res) => {
  try {
    const { bookId, chapterIndex } = req.params;
    const { trimStart, trimEnd, skipWordIds, lang } = req.body;
    const audioKey = lang ? `${chapterIndex}_${lang}` : String(chapterIndex);

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const audioInfo = book.audioFiles?.get(audioKey);
    if (!audioInfo) return res.status(400).json({ error: 'No audio for this chapter' });

    const audioPath = path.join(book.storagePath, 'audio', audioInfo.filename);
    const totalDuration = audioInfo.duration || await getAudioDuration(audioPath);

    // Backup original audio before first trim
    const backupPath = audioPath.replace(/(\.\w+)$/, '_original$1');
    try { await fs.access(backupPath); } catch { await fs.copyFile(audioPath, backupPath); }

    let keepRanges;
    let isWordBased = false;
    const SyncData = require('../models/SyncData');

    if (skipWordIds?.length) {
      // Word-based trim
      isWordBased = true;
      const syncQuery = { bookId, chapterIndex: parseInt(chapterIndex) };
      if (lang) syncQuery.lang = lang;
      else syncQuery.lang = { $in: [null, undefined] };
      const sync = await SyncData.findOne(syncQuery);
      if (!sync) return res.status(400).json({ error: 'No sync data' });

      const skipSet = new Set(skipWordIds);
      const skipRanges = [];
      for (const entry of sync.syncData) {
        if (skipSet.has(entry.id) && !entry.skipped && entry.clipBegin !== null && entry.clipEnd !== null) {
          skipRanges.push({ start: entry.clipBegin, end: entry.clipEnd });
        }
      }
      if (skipRanges.length === 0) return res.status(400).json({ error: 'Selected words have no audio timing' });

      const merged = mergeRanges(skipRanges);
      keepRanges = invertRanges(merged, totalDuration);

      // Recalculate sync timestamps
      const newSyncData = recalculateTimestamps(sync.syncData, skipSet, merged);
      sync.syncData = newSyncData;
      sync.updatedAt = new Date();
      // duration will be updated below after trim
      await sync.save();
    } else if (trimStart !== undefined && trimEnd !== undefined) {
      // Direct time-range trim
      if (trimStart >= trimEnd || trimStart < 0 || trimEnd > totalDuration + 0.1) {
        return res.status(400).json({ error: 'Invalid trim range' });
      }
      keepRanges = invertRanges([{ start: trimStart, end: trimEnd }], totalDuration);
    } else {
      return res.status(400).json({ error: 'Provide trimStart/trimEnd or skipWordIds' });
    }

    if (keepRanges.length === 0) return res.status(400).json({ error: 'Cannot remove all audio' });

    const trimmedPath = audioPath.replace(/(\.\w+)$/, '_trimmed$1');
    await trimWithFfmpeg(audioPath, keepRanges, trimmedPath);
    await fs.unlink(audioPath);
    await fs.rename(trimmedPath, audioPath);

    const newDuration = await getAudioDuration(audioPath);

    // Update book audio duration
    book.audioFiles.set(audioKey, { filename: audioInfo.filename, duration: newDuration, uploadedAt: audioInfo.uploadedAt });
    book.markModified('audioFiles');
    await book.save();

    const trimSyncQuery = { bookId, chapterIndex: parseInt(chapterIndex) };
    if (lang) trimSyncQuery.lang = lang;
    else trimSyncQuery.lang = { $in: [null, undefined] };

    if (isWordBased) {
      // Update sync duration and regenerate SMIL
      const sync = await SyncData.findOne(trimSyncQuery);
      if (sync) {
        sync.duration = newDuration;
        await sync.save();
        const smilGenerator = require('../services/smilGenerator');
        const smilXml = smilGenerator.generate(sync.syncData, `${chapterIndex}.html`, `audio/${audioInfo.filename}`);
        const smilDir = path.join(book.storagePath, 'smil');
        await fs.mkdir(smilDir, { recursive: true });
        await fs.writeFile(path.join(smilDir, `chapter_${chapterIndex}.smil`), smilXml);
      }
    } else {
      // Direct trim — delete old sync data, user must re-sync
      await SyncData.deleteOne(trimSyncQuery);
    }

    const result = { message: 'Audio trimmed successfully', newDuration };
    if (isWordBased) {
      const sync = await SyncData.findOne(trimSyncQuery);
      result.syncData = sync?.syncData;
    }
    res.json(result);
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
    const lang = req.query.lang || req.body?.lang || null;
    const audioKey = lang ? `${chapterIndex}_${lang}` : String(chapterIndex);
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const audioInfo = book.audioFiles?.get(audioKey);
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
    book.audioFiles.set(audioKey, updatedInfo);
    book.markModified('audioFiles');
    await book.save();

    res.json({ message: 'Audio restored to original', newDuration });
  } catch (err) {
    console.error('Restore error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * List available edge-tts voices.
 * GET /api/audio/voices
 */
let voicesCache = null;
exports.listVoices = async (req, res) => {
  try {
    if (voicesCache) return res.json(voicesCache);

    const { execSync } = require('child_process');
    let voices = [];
    try {
      const raw = execSync('edge-tts --list-voices', { timeout: 30000 }).toString();
      // Parse: "Name: en-US-AriaNeural\nGender: Female\n\n..."
      const blocks = raw.split(/\n\n+/).filter(Boolean);
      for (const block of blocks) {
        const nameMatch = block.match(/Name:\s*(\S+)/);
        const genderMatch = block.match(/Gender:\s*(\S+)/);
        if (nameMatch) {
          const name = nameMatch[1];
          const gender = genderMatch ? genderMatch[1] : '';
          const parts = name.split('-');
          const locale = parts.slice(0, 2).join('-');
          voices.push({ name, gender, locale });
        }
      }
    } catch {
      // edge-tts not available — return curated fallback
    }

    if (voices.length === 0) {
      voices = [
        // English
        { name: 'en-US-AriaNeural', gender: 'Female', locale: 'en-US' },
        { name: 'en-US-GuyNeural', gender: 'Male', locale: 'en-US' },
        { name: 'en-US-JennyNeural', gender: 'Female', locale: 'en-US' },
        { name: 'en-US-ChristopherNeural', gender: 'Male', locale: 'en-US' },
        { name: 'en-US-AnaNeural', gender: 'Female', locale: 'en-US' },
        { name: 'en-GB-SoniaNeural', gender: 'Female', locale: 'en-GB' },
        { name: 'en-GB-RyanNeural', gender: 'Male', locale: 'en-GB' },
        { name: 'en-AU-NatashaNeural', gender: 'Female', locale: 'en-AU' },
        { name: 'en-AU-WilliamNeural', gender: 'Male', locale: 'en-AU' },
        { name: 'en-IN-NeerjaNeural', gender: 'Female', locale: 'en-IN' },
        { name: 'en-IN-PrabhatNeural', gender: 'Male', locale: 'en-IN' },
        // European
        { name: 'es-ES-ElviraNeural', gender: 'Female', locale: 'es-ES' },
        { name: 'es-MX-DaliaNeural', gender: 'Female', locale: 'es-MX' },
        { name: 'fr-FR-DeniseNeural', gender: 'Female', locale: 'fr-FR' },
        { name: 'fr-FR-HenriNeural', gender: 'Male', locale: 'fr-FR' },
        { name: 'de-DE-KatjaNeural', gender: 'Female', locale: 'de-DE' },
        { name: 'de-DE-ConradNeural', gender: 'Male', locale: 'de-DE' },
        { name: 'it-IT-ElsaNeural', gender: 'Female', locale: 'it-IT' },
        { name: 'pt-BR-FranciscaNeural', gender: 'Female', locale: 'pt-BR' },
        // Indian languages
        { name: 'hi-IN-SwaraNeural', gender: 'Female', locale: 'hi-IN' },
        { name: 'hi-IN-MadhurNeural', gender: 'Male', locale: 'hi-IN' },
        { name: 'bn-IN-TanishaaNeural', gender: 'Female', locale: 'bn-IN' },
        { name: 'bn-IN-BashkarNeural', gender: 'Male', locale: 'bn-IN' },
        { name: 'ta-IN-PallaviNeural', gender: 'Female', locale: 'ta-IN' },
        { name: 'ta-IN-ValluvarNeural', gender: 'Male', locale: 'ta-IN' },
        { name: 'te-IN-ShrutiNeural', gender: 'Female', locale: 'te-IN' },
        { name: 'te-IN-MohanNeural', gender: 'Male', locale: 'te-IN' },
        { name: 'kn-IN-SapnaNeural', gender: 'Female', locale: 'kn-IN' },
        { name: 'kn-IN-GaganNeural', gender: 'Male', locale: 'kn-IN' },
        { name: 'ml-IN-SobhanaNeural', gender: 'Female', locale: 'ml-IN' },
        { name: 'ml-IN-MidhunNeural', gender: 'Male', locale: 'ml-IN' },
        { name: 'mr-IN-AarohiNeural', gender: 'Female', locale: 'mr-IN' },
        { name: 'mr-IN-ManoharNeural', gender: 'Male', locale: 'mr-IN' },
        { name: 'gu-IN-DhwaniNeural', gender: 'Female', locale: 'gu-IN' },
        { name: 'gu-IN-NiranjanNeural', gender: 'Male', locale: 'gu-IN' },
        { name: 'ur-IN-GulNeural', gender: 'Female', locale: 'ur-IN' },
        { name: 'ur-IN-SalmanNeural', gender: 'Male', locale: 'ur-IN' },
        // East Asian
        { name: 'ja-JP-NanamiNeural', gender: 'Female', locale: 'ja-JP' },
        { name: 'zh-CN-XiaoxiaoNeural', gender: 'Female', locale: 'zh-CN' },
        { name: 'ko-KR-SunHiNeural', gender: 'Female', locale: 'ko-KR' },
        // Other
        { name: 'ar-SA-ZariyahNeural', gender: 'Female', locale: 'ar-SA' },
      ];
    }

    voicesCache = voices;
    res.json(voices);
  } catch (err) {
    console.error('List voices error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Auto-generate audio from chapter text using edge-tts.
 * POST /api/audio/:bookId/:chapterIndex/generate
 * Body: { voice?: string, lang?: string }
 *
 * When lang is provided (e.g. "kn"), reads from the translated chapter file
 * so that the generated audio matches the displayed translation.
 */
exports.generateAudio = async (req, res) => {
  try {
    const { bookId, chapterIndex } = req.params;
    const { voice = 'en-US-AriaNeural', lang } = req.body;

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    // Use translated chapter if lang is provided and translation exists
    let chapterPath;
    const bookLang = (book.language || 'en').split('-')[0];
    if (lang && lang !== bookLang) {
      const translatedPath = path.join(book.storagePath, 'chapters', `${chapterIndex}_${lang}.html`);
      try {
        await fs.access(translatedPath);
        chapterPath = translatedPath;
      } catch {
        return res.status(400).json({ error: `No ${lang} translation found. Translate the chapter first.` });
      }
    } else {
      chapterPath = path.join(book.storagePath, 'chapters', `${chapterIndex}.html`);
    }

    const html = await fs.readFile(chapterPath, 'utf-8');

    // Strip HTML tags to get plain text
    const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!plainText) return res.status(400).json({ error: 'Chapter has no text content' });

    const audioDir = path.join(book.storagePath, 'audio');
    await fs.mkdir(audioDir, { recursive: true });

    const audioKey = lang ? `${chapterIndex}_${lang}` : String(chapterIndex);
    const filename = lang ? `chapter_${chapterIndex}_${lang}.mp3` : `chapter_${chapterIndex}.mp3`;
    const audioPath = path.join(audioDir, filename);

    // Write text to a temp file for edge-tts (avoids shell escaping issues)
    const tmpTextPath = path.join(audioDir, `_tmp_text_${chapterIndex}.txt`);
    await fs.writeFile(tmpTextPath, plainText, 'utf-8');

    // Generate audio AND word-level subtitles from edge-tts
    const vttPath = audioPath.replace(/\.mp3$/, '.vtt');
    const { execSync } = require('child_process');
    execSync(
      `edge-tts --voice "${voice}" --file "${tmpTextPath}" --write-media "${audioPath}" --write-subtitles "${vttPath}"`,
      { timeout: 600000 }
    );

    // Clean up temp file
    await fs.unlink(tmpTextPath).catch(() => {});

    const duration = await getAudioDuration(audioPath);

    if (!book.audioFiles) book.audioFiles = new Map();
    book.audioFiles.set(audioKey, {
      filename,
      duration,
      uploadedAt: new Date(),
    });
    book.markModified('audioFiles');
    await book.save();

    res.json({
      message: 'Audio generated successfully',
      filename,
      duration,
      voice,
      chapterIndex: parseInt(chapterIndex),
    });
  } catch (err) {
    console.error('Audio generate error:', err);
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
