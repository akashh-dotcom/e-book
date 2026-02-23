const path = require('path');
const fs = require('fs').promises;
const { execSync } = require('child_process');
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
 * Translate plain text using NLLB via Python script.
 *
 * @param {string} text - Plain text to translate
 * @param {string} srcLang - Source language code (e.g. "en", "en-US")
 * @param {string} tgtLang - Target language code (e.g. "ja", "ja-JP")
 * @param {string} tmpDir - Directory for temp files
 * @returns {string} Translated text
 */
async function translateText(text, srcLang, tgtLang, tmpDir) {
  const ts = Date.now();
  const inputPath = path.join(tmpDir, `_translate_in_${ts}.txt`);
  const outputPath = path.join(tmpDir, `_translate_out_${ts}.txt`);

  await fs.writeFile(inputPath, text, 'utf-8');

  const scriptPath = path.join(__dirname, '..', 'scripts', 'nllb_translate.py');

  try {
    const result = execSync(
      `${getPythonCmd()} "${scriptPath}" --input "${inputPath}" --output "${outputPath}" --src "${srcLang}" --tgt "${tgtLang}"`,
      { timeout: 600000 } // 10 min timeout for large chapters
    ).toString();

    const parsed = JSON.parse(result.trim().split('\n').pop());
    if (parsed.error) throw new Error(parsed.error);

    const translated = await fs.readFile(outputPath, 'utf-8');
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
 * @returns {{ html: string, wordCount: number, words: string[], wordIds: string[], plainText: string }}
 */
async function translateChapterHtml(html, srcLang, tgtLang, tmpDir) {
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

  // Batch all text for translation (joined with newlines as separators)
  const separator = '\n|||PARA|||\n';
  const allText = textNodes.map(n => n.text).join(separator);

  const translatedAll = await translateText(allText, srcLang, tgtLang, tmpDir);

  // Split back into paragraphs
  const translatedParts = translatedAll.split(/\|\|\|PARA\|\|\|/).map(s => s.trim());

  // Replace text in HTML
  textNodes.forEach((node, i) => {
    const translated = translatedParts[i] || node.text;
    // Set the element's text content (preserves child elements like <em>, <strong>)
    // For simplicity, replace entire text content
    const $el = $(node.el);
    // Clear existing children's text and set new
    $el.contents().filter(function() { return this.type === 'text'; }).each(function() {
      // Replace first text node with full translation, remove rest
      if (i < translatedParts.length) {
        $(this).replaceWith(translated);
        i = Infinity; // Only replace once
      }
    });
    if (i !== Infinity) {
      // Fallback: set entire text
      $el.text(translated);
    }
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
  translateText,
  translateChapterHtml,
  getTranslatedChapterPath,
  hasTranslation,
  voiceLocaleToLang,
  shortLang,
  isSameLanguage,
  isCJK,
  isRTL,
};
