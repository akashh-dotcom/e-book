const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Use PYTHON_PATH from .env, or fall back to platform default
const PYTHON = process.env.PYTHON_PATH
  || (process.platform === 'win32' ? 'python' : 'python3');

/**
 * Run a Python script via spawn, streaming stdout line-by-line.
 * Lines that are valid JSON with a "progress" key trigger onProgress.
 * Returns the final JSON result line (the one with "success" key).
 */
function runPythonWithProgress(args, { timeout = 900000, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, args, { timeout });
    let stdoutBuf = '';
    let stderrBuf = '';
    let lastResult = null;

    proc.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString();
      // Process complete lines
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop(); // keep incomplete line in buffer
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed);
          if (obj.progress && onProgress) {
            onProgress(obj);
          }
          if (obj.success !== undefined) {
            lastResult = obj;
          }
        } catch {
          // Not JSON — log it
          console.log('WhisperX:', trimmed);
        }
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString();
    });

    proc.on('close', (code) => {
      // Process any remaining data in buffer
      if (stdoutBuf.trim()) {
        try {
          const obj = JSON.parse(stdoutBuf.trim());
          if (obj.progress && onProgress) onProgress(obj);
          if (obj.success !== undefined) lastResult = obj;
        } catch {
          console.log('WhisperX:', stdoutBuf.trim());
        }
      }

      if (code !== 0) {
        reject(new Error(`WhisperX exited with code ${code}: ${stderrBuf.slice(-500)}`));
      } else {
        console.log('WhisperX result:', JSON.stringify(lastResult));
        if (stderrBuf.trim()) console.log('WhisperX stderr:', stderrBuf.slice(-300));
        resolve(lastResult);
      }
    });

    proc.on('error', (err) => reject(err));
  });
}


class WhisperXAligner {

  /**
   * Build sync data from edge-tts per-word timing JSON.
   * The timing JSON contains exact WordBoundary events from the TTS engine:
   *   [{ "word": "Hello", "start": 0.05, "end": 0.275 }, ...]
   *
   * These are mapped to the chapter's word IDs. When word counts match,
   * we get a perfect 1:1 mapping. When they differ (HTML splitting
   * differs from TTS word splitting), we use a greedy text-matching
   * alignment to preserve timing accuracy.
   *
   * @param {string} timingPath - Path to the _timing.json file
   * @param {string[]} expectedWords - Words from the chapter HTML
   * @param {string[]} wordIds - Corresponding span IDs (w00001, w00002, ...)
   * @returns {Array<{ id, word, clipBegin, clipEnd }>}
   */
  async buildSyncFromTiming(timingPath, expectedWords, wordIds) {
    const raw = await fs.readFile(timingPath, 'utf-8');
    const ttsWords = JSON.parse(raw);

    if (!ttsWords.length) return null;

    const totalExpected = expectedWords.length;
    const totalTts = ttsWords.length;
    const syncData = [];

    if (totalTts === totalExpected) {
      // Perfect 1:1 match — use TTS timing directly
      for (let i = 0; i < totalExpected; i++) {
        syncData.push({
          id: wordIds[i] || 'w' + String(i + 1).padStart(5, '0'),
          word: expectedWords[i],
          clipBegin: ttsWords[i].start,
          clipEnd: ttsWords[i].end,
        });
      }
      this._closeGaps(syncData);
      return syncData;
    }

    // Word counts differ — align by greedy text matching.
    // Both lists come from the same source text, but may split differently
    // (e.g. "don't" vs ["don", "'t"], or punctuation handling).
    // Walk both lists, consuming TTS words as they match expected words.
    let ttsIdx = 0;
    let expIdx = 0;

    while (expIdx < totalExpected && ttsIdx < totalTts) {
      const expWord = expectedWords[expIdx];
      const ttsWord = ttsWords[ttsIdx];

      // Simple case: words match (possibly with punctuation differences)
      const expNorm = expWord.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
      const ttsNorm = ttsWord.word.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();

      if (expNorm === ttsNorm || expNorm.startsWith(ttsNorm) || ttsNorm.startsWith(expNorm)) {
        // Direct match — use this TTS word's timing
        syncData.push({
          id: wordIds[expIdx] || 'w' + String(expIdx + 1).padStart(5, '0'),
          word: expWord,
          clipBegin: ttsWord.start,
          clipEnd: ttsWord.end,
        });
        expIdx++;
        ttsIdx++;
        continue;
      }

      // Check if the expected word spans multiple TTS words (e.g. expected="don't", tts=["don", "'t"])
      let combined = ttsNorm;
      let lookAhead = ttsIdx + 1;
      let matched = false;
      while (lookAhead < totalTts && combined.length < expNorm.length + 5) {
        combined += ttsWords[lookAhead].word.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
        if (combined === expNorm || combined.startsWith(expNorm)) {
          // Expected word spans ttsIdx..lookAhead
          syncData.push({
            id: wordIds[expIdx] || 'w' + String(expIdx + 1).padStart(5, '0'),
            word: expWord,
            clipBegin: ttsWords[ttsIdx].start,
            clipEnd: ttsWords[lookAhead].end,
          });
          expIdx++;
          ttsIdx = lookAhead + 1;
          matched = true;
          break;
        }
        lookAhead++;
      }
      if (matched) continue;

      // Check if the TTS word spans multiple expected words (e.g. tts="don't", expected=["don", "'t"])
      let expCombined = expNorm;
      let expLookAhead = expIdx + 1;
      matched = false;
      while (expLookAhead < totalExpected && expCombined.length < ttsNorm.length + 5) {
        expCombined += expectedWords[expLookAhead].replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
        if (expCombined === ttsNorm || expCombined.startsWith(ttsNorm)) {
          // TTS word covers expIdx..expLookAhead
          const count = expLookAhead - expIdx + 1;
          const dur = (ttsWord.end - ttsWord.start) / count;
          for (let k = 0; k < count; k++) {
            syncData.push({
              id: wordIds[expIdx + k] || 'w' + String(expIdx + k + 1).padStart(5, '0'),
              word: expectedWords[expIdx + k],
              clipBegin: Math.round((ttsWord.start + k * dur) * 1000) / 1000,
              clipEnd: Math.round((ttsWord.start + (k + 1) * dur) * 1000) / 1000,
            });
          }
          expIdx = expLookAhead + 1;
          ttsIdx++;
          matched = true;
          break;
        }
        expLookAhead++;
      }
      if (matched) continue;

      // No match found — assign this TTS word's timing to the expected word and advance both
      syncData.push({
        id: wordIds[expIdx] || 'w' + String(expIdx + 1).padStart(5, '0'),
        word: expWord,
        clipBegin: ttsWord.start,
        clipEnd: ttsWord.end,
      });
      expIdx++;
      ttsIdx++;
    }

    // Fill any remaining expected words from the last known timestamp
    while (expIdx < totalExpected) {
      const lastEnd = syncData.length ? syncData[syncData.length - 1].clipEnd : 0;
      // If there are remaining TTS words, use them
      if (ttsIdx < totalTts) {
        syncData.push({
          id: wordIds[expIdx] || 'w' + String(expIdx + 1).padStart(5, '0'),
          word: expectedWords[expIdx],
          clipBegin: ttsWords[ttsIdx].start,
          clipEnd: ttsWords[ttsIdx].end,
        });
        ttsIdx++;
      } else {
        syncData.push({
          id: wordIds[expIdx] || 'w' + String(expIdx + 1).padStart(5, '0'),
          word: expectedWords[expIdx],
          clipBegin: lastEnd,
          clipEnd: Math.round((lastEnd + 0.15) * 1000) / 1000,
        });
      }
      expIdx++;
    }

    // Close gaps: extend each word's clipEnd to the next word's clipBegin.
    // Edge-tts WordBoundary durations only cover phonetic pronunciation,
    // leaving gaps between words where no highlight is active. Extending
    // clipEnd ensures continuous karaoke-style highlighting that tracks
    // the actual pace of speech (longer words when voice pauses longer,
    // shorter words when voice speaks quickly).
    this._closeGaps(syncData);

    return syncData;
  }

  /**
   * Perform word-level alignment using WhisperX.
   * Fallback for uploaded (non-TTS) audio where no VTT exists.
   */
  async alignWords(audioPath, words, options = {}) {
    const { language = 'en', modelSize = 'base', onProgress } = options;

    const tmpDir = path.join(os.tmpdir(), 'whisperx_' + Date.now());
    await fs.mkdir(tmpDir, { recursive: true });

    // WhisperX script expects one word per line
    const textPath = path.join(tmpDir, 'words.txt');
    await fs.writeFile(textPath, words.join('\n'));

    const outputPath = path.join(tmpDir, 'alignment.json');

    const scriptPath = path.join(
      __dirname, '..', 'scripts', 'whisperx_align.py'
    );

    try {
      await runPythonWithProgress(
        [scriptPath, audioPath, textPath, outputPath, language, modelSize],
        { timeout: 900000, onProgress }
      );

      const timestamps = JSON.parse(
        await fs.readFile(outputPath, 'utf-8')
      );

      return timestamps;
    } catch (err) {
      console.error('WhisperX alignment failed:', err.message);
      throw new Error('WhisperX forced alignment failed: ' + err.message);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }

  /**
   * Close timing gaps between consecutive words so highlighting is
   * continuous. Each word's clipEnd is extended to the next word's
   * clipBegin (up to 2s max — larger gaps are real pauses).
   */
  _closeGaps(syncData) {
    for (let i = 0; i < syncData.length - 1; i++) {
      if (syncData[i].clipEnd === null || syncData[i + 1].clipBegin === null) continue;
      const gap = syncData[i + 1].clipBegin - syncData[i].clipEnd;
      if (gap > 0 && gap < 2.0) {
        syncData[i].clipEnd = syncData[i + 1].clipBegin;
      }
    }
  }

  /**
   * Convert WhisperX timestamps to internal syncData format.
   */
  buildSyncData(whisperxTimestamps, wordIds) {
    const syncData = whisperxTimestamps.map((ts, i) => ({
      id: wordIds[i] || 'w' + String(i + 1).padStart(5, '0'),
      word: ts.word,
      clipBegin: ts.start,
      clipEnd: ts.end,
    }));
    this._closeGaps(syncData);
    return syncData;
  }

  /**
   * Perform word-level alignment using stable-ts.
   * stable-ts modifies Whisper's cross-attention weights to produce
   * more accurate word timestamps than standard Whisper or edge-TTS timing.
   * Particularly effective for TTS-generated audio where edge-TTS timing drifts.
   */
  async alignWithStableTs(audioPath, words, options = {}) {
    const { language = 'en', modelSize = 'base', onProgress } = options;

    const tmpDir = path.join(os.tmpdir(), 'stable_ts_' + Date.now());
    await fs.mkdir(tmpDir, { recursive: true });

    const textPath = path.join(tmpDir, 'words.txt');
    await fs.writeFile(textPath, words.join('\n'));

    const outputPath = path.join(tmpDir, 'alignment.json');

    const scriptPath = path.join(
      __dirname, '..', 'scripts', 'stable_ts_align.py'
    );

    try {
      await runPythonWithProgress(
        [scriptPath, audioPath, textPath, outputPath, language, modelSize],
        { timeout: 900000, onProgress }
      );

      const timestamps = JSON.parse(
        await fs.readFile(outputPath, 'utf-8')
      );

      return timestamps;
    } catch (err) {
      console.error('stable-ts alignment failed:', err.message);
      throw new Error('stable-ts forced alignment failed: ' + err.message);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }

  /**
   * Sentence-level alignment with even word distribution.
   * Fallback for uploaded (non-TTS) audio.
   */
  async alignSentencesThenDistribute(audioPath, plainText, wordIds, options = {}) {
    const { language = 'en', modelSize = 'base', onProgress } = options;

    const tmpDir = path.join(os.tmpdir(), 'whisperx_sent_' + Date.now());
    await fs.mkdir(tmpDir, { recursive: true });

    const sentences = plainText
      .replace(/([.!?])\s+/g, '$1\n')
      .split('\n')
      .filter(s => s.trim());

    const textPath = path.join(tmpDir, 'sentences.txt');
    await fs.writeFile(textPath, sentences.join('\n'));

    const outputPath = path.join(tmpDir, 'sentences.json');
    const scriptPath = path.join(
      __dirname, '..', 'scripts', 'whisperx_align_sentences.py'
    );

    try {
      await runPythonWithProgress(
        [scriptPath, audioPath, textPath, outputPath, language, modelSize],
        { timeout: 900000, onProgress }
      );

      const sentenceTimestamps = JSON.parse(
        await fs.readFile(outputPath, 'utf-8')
      );

      // Distribute word timestamps proportionally by character length.
      // Longer words take longer to pronounce, so they get more time.
      const syncData = [];
      let globalWordIdx = 0;

      for (const sent of sentenceTimestamps) {
        const sentWords = sent.text.split(/\s+/).filter(Boolean);
        const sentDuration = sent.end - sent.start;
        // Weight by character count (min 1 to avoid zero-length words)
        const charCounts = sentWords.map(w => Math.max(w.length, 1));
        const totalChars = charCounts.reduce((a, b) => a + b, 0) || 1;

        let cursor = sent.start;
        for (let i = 0; i < sentWords.length; i++) {
          const wordDuration = sentDuration * (charCounts[i] / totalChars);
          syncData.push({
            id: wordIds[globalWordIdx] || 'w' + String(globalWordIdx + 1).padStart(5, '0'),
            word: sentWords[i],
            clipBegin: Math.round(cursor * 1000) / 1000,
            clipEnd: Math.round((cursor + wordDuration) * 1000) / 1000,
          });
          cursor += wordDuration;
          globalWordIdx++;
        }
      }

      return syncData;
    } catch (err) {
      console.error('WhisperX sentence alignment failed:', err.message);
      throw new Error('WhisperX sentence alignment failed: ' + err.message);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }
}

module.exports = new WhisperXAligner();
