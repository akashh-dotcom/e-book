const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Use 'python' on Windows, 'python3' elsewhere
const PYTHON = process.platform === 'win32' ? 'python' : 'python3';

class AeneasAligner {

  /**
   * Perform word-level alignment using Aeneas.
   *
   * @param {string} audioPath - Path to audio file
   * @param {string[]} words - Array of words from the chapter
   * @param {object} options
   * @param {string} options.language - 2-letter code (en, es, fr, etc.)
   * @returns {Array<{ id, word, start, end }>}
   */
  async alignWords(audioPath, words, options = {}) {
    const { language = 'en' } = options;

    const tmpDir = path.join(os.tmpdir(), 'aeneas_' + Date.now());
    await fs.mkdir(tmpDir, { recursive: true });

    // Aeneas expects one word per line for word-level alignment
    const textPath = path.join(tmpDir, 'words.txt');
    await fs.writeFile(textPath, words.join('\n'));

    const outputPath = path.join(tmpDir, 'alignment.json');

    const scriptPath = path.join(
      __dirname, '..', 'scripts', 'aeneas_align_words.py'
    );

    try {
      const stdout = execSync(
        `${PYTHON} "${scriptPath}" "${audioPath}" "${textPath}" "${outputPath}" "${language}"`,
        { timeout: 600000, maxBuffer: 50 * 1024 * 1024 }
      ).toString();

      console.log('Aeneas output:', stdout);

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
   * Alternative: Use Aeneas CLI directly (no Python script needed).
   */
  async alignWordsCLI(audioPath, textPath, outputPath, language = 'eng') {
    const cmd = [
      `${PYTHON} -m aeneas.tools.execute_task`,
      `"${audioPath}"`,
      `"${textPath}"`,
      `"task_language=${language}|is_text_type=plain|os_task_file_format=json|task_adjust_boundary_no_zero=True"`,
      `"${outputPath}"`,
      '--presets-word',
    ].join(' ');

    execSync(cmd, { timeout: 600000 });

    const raw = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
    return raw.fragments.map(f => ({
      id: f.id,
      word: f.lines[0] || '',
      start: parseFloat(f.begin),
      end: parseFloat(f.end),
    }));
  }

  /**
   * Generate SMIL file directly using Aeneas.
   */
  async generateSmil(audioPath, textPath, outputPath, options = {}) {
    const {
      language = 'eng',
      audioRef = 'audio.mp3',
      pageRef = 'content.xhtml',
    } = options;

    const scriptPath = path.join(
      __dirname, '..', 'scripts', 'aeneas_align_smil.py'
    );

    execSync(
      `${PYTHON} "${scriptPath}" "${audioPath}" "${textPath}" "${outputPath}" "${language}" "${audioRef}" "${pageRef}"`,
      { timeout: 600000 }
    );

    return fs.readFile(outputPath, 'utf-8');
  }

  /**
   * Convert Aeneas timestamps to internal syncData format.
   * Maps Aeneas fragment IDs to our word span IDs.
   */
  buildSyncData(aeneasTimestamps, wordIds) {
    return aeneasTimestamps.map((ts, i) => ({
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
    const { language = 'en' } = options;

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

    execSync(
      `${PYTHON} "${scriptPath}" "${audioPath}" "${textPath}" "${outputPath}" "${language}"`,
      { timeout: 600000 }
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

    await fs.rm(tmpDir, { recursive: true, force: true });
    return syncData;
  }
}

module.exports = new AeneasAligner();
