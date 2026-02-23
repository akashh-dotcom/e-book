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


/**
 * Parse a WebVTT file into an array of cues: { start, end, text }
 */
function parseVtt(vttContent) {
  const cues = [];
  const blocks = vttContent.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    // Find the timestamp line (contains " --> ")
    let tsLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) { tsLineIdx = i; break; }
    }
    if (tsLineIdx < 0) continue;

    const tsMatch = lines[tsLineIdx].match(
      /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/
    );
    if (!tsMatch) continue;

    const start = +tsMatch[1] * 3600 + +tsMatch[2] * 60 + +tsMatch[3] + +tsMatch[4] / 1000;
    const end = +tsMatch[5] * 3600 + +tsMatch[6] * 60 + +tsMatch[7] + +tsMatch[8] / 1000;
    const text = lines.slice(tsLineIdx + 1).join(' ').trim();
    if (text) cues.push({ start, end, text });
  }
  return cues;
}


class WhisperXAligner {

  /**
   * Build sync data from an edge-tts VTT subtitle file.
   * Each VTT cue covers a small phrase with exact TTS timing.
   * We distribute the cue's time range across the words in that cue,
   * then map sequentially to the chapter's word IDs.
   *
   * @param {string} vttPath - Path to the .vtt file
   * @param {string[]} expectedWords - Words from the chapter HTML
   * @param {string[]} wordIds - Corresponding span IDs (w00001, w00002, ...)
   * @returns {Array<{ id, word, clipBegin, clipEnd }>}
   */
  async buildSyncFromVtt(vttPath, expectedWords, wordIds) {
    const vttContent = await fs.readFile(vttPath, 'utf-8');
    const cues = parseVtt(vttContent);

    if (!cues.length) return null;

    // Build flat word-level timestamps from VTT cues
    const vttWords = [];
    for (const cue of cues) {
      const words = cue.text.split(/\s+/).filter(Boolean);
      if (!words.length) continue;
      const wordDur = (cue.end - cue.start) / words.length;
      for (let i = 0; i < words.length; i++) {
        vttWords.push({
          word: words[i],
          start: Math.round((cue.start + i * wordDur) * 1000) / 1000,
          end: Math.round((cue.start + (i + 1) * wordDur) * 1000) / 1000,
        });
      }
    }

    // Map VTT words → expected chapter words sequentially.
    // VTT words come from plainText (HTML stripped), expected words come from
    // the same text but via wordWrapper. They should match 1:1 in order.
    const syncData = [];
    const totalExpected = expectedWords.length;
    const totalVtt = vttWords.length;

    if (totalVtt === totalExpected) {
      // Perfect 1:1 match — use VTT timing directly
      for (let i = 0; i < totalExpected; i++) {
        syncData.push({
          id: wordIds[i] || 'w' + String(i + 1).padStart(5, '0'),
          word: expectedWords[i],
          clipBegin: vttWords[i].start,
          clipEnd: vttWords[i].end,
        });
      }
    } else {
      // Word counts differ — distribute VTT timeline proportionally
      // Build timeline from VTT: total audio span is vttWords[0].start to vttWords[last].end
      // Assign each expected word a proportional slice of the VTT timeline
      const audioStart = vttWords[0].start;
      const audioEnd = vttWords[totalVtt - 1].end;

      // Group VTT words into segments by proximity (gap > 0.3s = new segment)
      const segments = [];
      let seg = { start: vttWords[0].start, end: vttWords[0].end, wordCount: 1 };
      for (let i = 1; i < totalVtt; i++) {
        if (vttWords[i].start - vttWords[i - 1].end > 0.3) {
          segments.push(seg);
          seg = { start: vttWords[i].start, end: vttWords[i].end, wordCount: 1 };
        } else {
          seg.end = vttWords[i].end;
          seg.wordCount++;
        }
      }
      segments.push(seg);

      const totalSegWords = segments.reduce((s, g) => s + g.wordCount, 0);
      let expIdx = 0;

      for (let si = 0; si < segments.length; si++) {
        const s = segments[si];
        let nWords;
        if (si === segments.length - 1) {
          nWords = totalExpected - expIdx;
        } else {
          nWords = Math.max(1, Math.round((s.wordCount / totalSegWords) * totalExpected));
          nWords = Math.min(nWords, totalExpected - expIdx);
        }
        if (nWords <= 0) continue;
        const wDur = (s.end - s.start) / nWords;
        for (let k = 0; k < nWords; k++) {
          syncData.push({
            id: wordIds[expIdx] || 'w' + String(expIdx + 1).padStart(5, '0'),
            word: expectedWords[expIdx],
            clipBegin: Math.round((s.start + k * wDur) * 1000) / 1000,
            clipEnd: Math.round((s.start + (k + 1) * wDur) * 1000) / 1000,
          });
          expIdx++;
        }
      }

      // Fill any remaining
      while (expIdx < totalExpected) {
        const lastEnd = syncData.length ? syncData[syncData.length - 1].clipEnd : 0;
        syncData.push({
          id: wordIds[expIdx] || 'w' + String(expIdx + 1).padStart(5, '0'),
          word: expectedWords[expIdx],
          clipBegin: lastEnd,
          clipEnd: Math.round((lastEnd + 0.3) * 1000) / 1000,
        });
        expIdx++;
      }
    }

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
   * Convert WhisperX timestamps to internal syncData format.
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
