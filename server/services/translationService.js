const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const { execSync, spawn } = require('child_process');
const cheerio = require('cheerio');
const wordWrapper = require('./wordWrapper');

/**
 * Detect the correct Python command for the current OS.
 * Windows uses "python", Linux/macOS use "python3".
 */
let _pythonCmd = null;
function getPythonCmd() {
  if (_pythonCmd) return _pythonCmd;
  const candidates = process.platform === 'win32'
    ? ['python', 'python3', 'py']
    : ['python3', 'python'];
  for (const cmd of candidates) {
    try {
      execSync(`${cmd} --version`, { stdio: 'pipe', timeout: 5000 });
      _pythonCmd = cmd;
      return cmd;
    } catch {
      // try next
    }
  }
  throw new Error('Python not found. Install Python 3 and ensure it is in your PATH.');
}

/**
 * Map Edge-TTS voice locale (e.g. "ja-JP") to language code for NLLB.
 */
function voiceLocaleToLang(voiceName) {
  // "ja-JP-NanamiNeural" → "ja-JP" → "ja"
  const parts = voiceName.split('-');
  return parts.length >= 2 ? `${parts[0]}-${parts[1]}` : parts[0];
}

/**
 * Extract the short 2-letter lang from a locale like "ja-JP" → "ja".
 */
function shortLang(locale) {
  return locale.split('-')[0];
}

/**
 * Check if two language codes represent the same language.
 */
function isSameLanguage(lang1, lang2) {
  return shortLang(lang1) === shortLang(lang2);
}

/**
 * Determine if CJK language (no spaces between words).
 */
function isCJK(lang) {
  const cjk = ['ja', 'zh', 'ko', 'th', 'my', 'km', 'lo'];
  return cjk.includes(shortLang(lang));
}

/**
 * Determine text direction for a language.
 */
function isRTL(lang) {
  const rtl = ['ar', 'he', 'fa', 'ur'];
  return rtl.includes(shortLang(lang));
}

/**
 * Translate an array of paragraphs using NLLB via Python script (JSON mode).
 * Loads the model ONCE and translates all paragraphs in a single process.
 *
 * @param {string[]} paragraphs - Array of plain text paragraphs
 * @param {string} srcLang - Source language code (e.g. "en", "en-US")
 * @param {string} tgtLang - Target language code (e.g. "ja", "ja-JP")
 * @param {string} tmpDir - Directory for temp files
 * @param {function} [onProgress] - Optional callback: onProgress({ current, total, percent })
 * @returns {string[]} Array of translated paragraphs
 */
async function translateParagraphs(paragraphs, srcLang, tgtLang, tmpDir, onProgress) {
  const ts = Date.now();
  const tempBase = os.tmpdir();
  const inputPath = path.join(tempBase, `_translate_in_${ts}.json`);
  const outputPath = path.join(tempBase, `_translate_out_${ts}.json`);

  await fs.writeFile(inputPath, JSON.stringify(paragraphs), 'utf-8');

  const scriptPath = path.join(__dirname, '..', 'scripts', 'nllb_translate.py');

  try {
    const result = await new Promise((resolve, reject) => {
      const proc = spawn(getPythonCmd(), [
        scriptPath,
        '--input', inputPath,
        '--output', outputPath,
        '--src', srcLang,
        '--tgt', tgtLang,
        '--json',
      ], {
        env: {
          ...process.env,
          OMP_NUM_THREADS: '1',
          MKL_NUM_THREADS: '1',
          TOKENIZERS_PARALLELISM: 'false',
          KMP_DUPLICATE_LIB_OK: 'TRUE',
        },
      });

      let stdout = '';
      let stderrBuf = '';
      let stderrFull = '';
      let timedOut = false;

      // 10 minute timeout for large chapters
      const timeout = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');
        reject(new Error('Translation timed out after 10 minutes'));
      }, 600000);

      proc.stdout.on('data', (data) => { stdout += data.toString(); });

      proc.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderrBuf += chunk;
        stderrFull += chunk;
        // Parse progress lines: PROGRESS:current/total/percent
        const lines = stderrBuf.split('\n');
        stderrBuf = lines.pop(); // keep incomplete line in buffer
        for (const line of lines) {
          const match = line.match(/PROGRESS:(\d+)\/(\d+)\/(\d+)/);
          if (match && onProgress) {
            onProgress({
              current: parseInt(match[1]),
              total: parseInt(match[2]),
              percent: parseInt(match[3]),
            });
          }
        }
      });

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (timedOut) return;
        if (code !== 0) {
          // Check for common crash codes
          const isSegfault = code === 3221225477 || code === 139 || code === -11;
          const hint = isSegfault
            ? ' (memory crash — try closing other applications or ensure sufficient RAM for the NLLB model)'
            : '';
          reject(new Error(`Translation script exited with code ${code}${hint}. stderr: ${stderrFull.slice(-500)}`));
        } else {
          resolve(stdout);
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    const parsed = JSON.parse(result.trim().split('\n').pop());
    if (parsed.error) throw new Error(parsed.error);

    const translated = JSON.parse(await fs.readFile(outputPath, 'utf-8'));
    return translated;
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}

/**
 * Translate a chapter's HTML content.
 * Preserves HTML structure, translates only the text content.
 *
 * @param {string} html - Chapter HTML
 * @param {string} srcLang - Source language code
 * @param {string} tgtLang - Target language code
 * @param {string} tmpDir - Temp directory for files
 * @param {function} [onProgress] - Optional callback: onProgress({ current, total, percent })
 * @returns {{ html: string, wordCount: number, words: string[], wordIds: string[], plainText: string }}
 */
async function translateChapterHtml(html, srcLang, tgtLang, tmpDir, onProgress) {
  const $ = cheerio.load(html, { xmlMode: false });

  // Remove existing word spans — unwrap them back to plain text
  $('span[id^="w"]').each((_, el) => {
    $(el).replaceWith($(el).text());
  });

  // Collect text nodes to translate
  const textElements =
    'p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, dt, dd';

  const textNodes = [];
  $(textElements).each((_, el) => {
    const text = $(el).text().trim();
    if (text) textNodes.push({ el, text });
  });

  if (textNodes.length === 0) {
    // No translatable content, just re-wrap
    return wordWrapper.wrap($.html());
  }

  // Collect all paragraph texts and translate in one Python process
  const paragraphTexts = textNodes.map(n => n.text);
  const translatedParts = await translateParagraphs(
    paragraphTexts, srcLang, tgtLang, tmpDir, onProgress
  );

  // Replace text in HTML
  textNodes.forEach((node, i) => {
    const translated = translatedParts[i] || node.text;
    $(node.el).text(translated);
  });

  // Add RTL direction if needed
  if (isRTL(tgtLang)) {
    $('body').attr('dir', 'rtl');
  }

  // Now wrap words in the translated HTML
  const translatedHtml = $.html();
  return wordWrapper.wrap(translatedHtml);
}

/**
 * Get the path for a translated chapter file.
 */
function getTranslatedChapterPath(storagePath, chapterIndex, targetLang) {
  const lang = shortLang(targetLang);
  return path.join(storagePath, 'chapters', `${chapterIndex}_${lang}.html`);
}

/**
 * Check if a translation already exists.
 */
async function hasTranslation(storagePath, chapterIndex, targetLang) {
  const filePath = getTranslatedChapterPath(storagePath, chapterIndex, targetLang);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  translateParagraphs,
  translateChapterHtml,
  getTranslatedChapterPath,
  hasTranslation,
  voiceLocaleToLang,
  shortLang,
  isSameLanguage,
  isCJK,
  isRTL,
};
