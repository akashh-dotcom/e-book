const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Use 'python' on Windows, 'python3' elsewhere
const PYTHON = process.platform === 'win32' ? 'python' : 'python3';

class WhisperXAligner {

  /**
   * Perform word-level alignment using WhisperX.
   *
   * @param {string} audioPath - Path to audio file
   * @param {string[]} words - Array of words from the chapter
   * @param {object} options
   * @param {string} options.language - 2-letter code (en, es, fr, etc.)
   * @param {string} options.modelSize - Whisper model: tiny, base, small, medium, large-v2
   * @returns {Array<{ id, word, start, end }>}
   */
  async alignWords(audioPath, words, options = {}) {
    const { language = 'en', modelSize = 'base' } = options;

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
      const stdout = execSync(
        `${PYTHON} "${scriptPath}" "${audioPath}" "${textPath}" "${outputPath}" "${language}" "${modelSize}"`,
        { timeout: 900000, maxBuffer: 50 * 1024 * 1024 }
      ).toString();

      console.log('WhisperX output:', stdout);

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
    const { language = 'en', modelSize = 'base' } = options;

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
      execSync(
        `${PYTHON} "${scriptPath}" "${audioPath}" "${textPath}" "${outputPath}" "${language}" "${modelSize}"`,
        { timeout: 900000, maxBuffer: 50 * 1024 * 1024 }
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
