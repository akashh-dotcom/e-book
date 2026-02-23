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
   * Perform word-level alignment using WhisperX.
   *
   * @param {string} audioPath - Path to audio file
   * @param {string[]} words - Array of words from the chapter
   * @param {object} options
   * @param {string} options.language - 2-letter code (en, es, fr, etc.)
   * @param {string} options.modelSize - Whisper model: tiny, base, small, medium, large-v2
   * @param {function} options.onProgress - Callback for progress events
   * @returns {Array<{ id, word, start, end }>}
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
   * Convert WhisperX timestamps to internal syncData format.
   * Maps WhisperX fragment IDs to our word span IDs.
   */
  buildSyncData(whisperxTimestamps, wordIds) {
    return whisperxTimestamps.map((ts, i) => ({
      id: wordIds[i] || 'w' + String(i + 1).padStart(5, '0'),
      word: ts.word,
      clipBegin: ts.start,
      clipEnd: ts.end,
    }));
  }

  /**
   * Sentence-level alignment with even word distribution.
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

      // Distribute word timestamps evenly within each sentence
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
