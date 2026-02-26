const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Use PYTHON_PATH from .env, or fall back to platform default
const PYTHON = process.env.PYTHON_PATH
  || (process.platform === 'win32' ? 'python' : 'python3');

/**
 * Run a Python script via spawn with optional progress callback.
 */
function runPython(args, { timeout = 600000, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, args, { timeout });
    let stdoutBuf = '';
    let stderrBuf = '';
    let lastResult = null;

    proc.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString();
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed);
          if (obj.progress && onProgress) onProgress(obj);
          if (obj.success !== undefined) lastResult = obj;
        } catch {
          console.log('Aeneas:', trimmed);
        }
      }
    });

    proc.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString();
    });

    proc.on('close', (code) => {
      if (stdoutBuf.trim()) {
        try {
          const obj = JSON.parse(stdoutBuf.trim());
          if (obj.progress && onProgress) onProgress(obj);
          if (obj.success !== undefined) lastResult = obj;
        } catch {
          console.log('Aeneas:', stdoutBuf.trim());
        }
      }
      if (code !== 0) {
        reject(new Error(`Aeneas exited with code ${code}: ${stderrBuf.slice(-500)}`));
      } else {
        console.log('Aeneas result:', JSON.stringify(lastResult));
        if (stderrBuf.trim()) console.log('Aeneas stderr:', stderrBuf.slice(-300));
        resolve(lastResult);
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

class AeneasAligner {

  /**
   * Perform word-level alignment using Aeneas.
   *
   * @param {string} audioPath - Path to audio file
   * @param {string[]} words - Array of words from the chapter
   * @param {object} options
   * @param {string} options.language - 2-letter code (en, es, fr, etc.)
   * @param {function} options.onProgress - Progress callback
   * @returns {Array<{ id, word, start, end }>}
   */
  async alignWords(audioPath, words, options = {}) {
    const { language = 'en', onProgress } = options;

    const tmpDir = path.join(os.tmpdir(), 'aeneas_' + Date.now());
    await fs.mkdir(tmpDir, { recursive: true });

    const textPath = path.join(tmpDir, 'words.txt');
    await fs.writeFile(textPath, words.join('\n'));

    const outputPath = path.join(tmpDir, 'alignment.json');
    const scriptPath = path.join(
      __dirname, '..', 'scripts', 'aeneas_align_words.py'
    );

    try {
      await runPython(
        [scriptPath, audioPath, textPath, outputPath, language],
        { timeout: 600000, onProgress }
      );

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
   * Convert Aeneas timestamps to internal syncData format.
   * Maps Aeneas fragment IDs to our word span IDs.
   */
  buildSyncData(aeneasTimestamps, wordIds) {
    const syncData = aeneasTimestamps.map((ts, i) => ({
      id: wordIds[i] || 'w' + String(i + 1).padStart(5, '0'),
      word: ts.word,
      clipBegin: ts.start,
      clipEnd: ts.end,
    }));
    this._closeGaps(syncData);
    return syncData;
  }

  /**
   * Sentence-level alignment with proportional word distribution.
   */
  async alignSentencesThenDistribute(audioPath, plainText, wordIds, options = {}) {
    const { language = 'en', onProgress } = options;

    const tmpDir = path.join(os.tmpdir(), 'aeneas_sent_' + Date.now());
    await fs.mkdir(tmpDir, { recursive: true });

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

    try {
      await runPython(
        [scriptPath, audioPath, textPath, outputPath, language],
        { timeout: 600000, onProgress }
      );

      const sentenceTimestamps = JSON.parse(
        await fs.readFile(outputPath, 'utf-8')
      );

      // Distribute word timestamps proportionally by character length
      const syncData = [];
      let globalWordIdx = 0;

      for (const sent of sentenceTimestamps) {
        const sentWords = sent.text.split(/\s+/).filter(Boolean);
        const sentDuration = sent.end - sent.start;
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

      this._closeGaps(syncData);
      return syncData;
    } catch (err) {
      console.error('Aeneas sentence alignment failed:', err.message);
      throw new Error('Aeneas sentence alignment failed: ' + err.message);
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
}

module.exports = new AeneasAligner();
