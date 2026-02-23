const path = require('path');
const fs = require('fs').promises;
const Book = require('../models/Book');
const wordWrapper = require('../services/wordWrapper');
const translation = require('../services/translationService');

/**
 * Translate a chapter to a target language.
 * POST /api/translate/:bookId/:chapterIndex
 * Body: { targetLang: "ja-JP" }
 *
 * Translates the original chapter text, re-wraps words, and stores as a
 * separate file (e.g. 0_ja.html). Original file is never modified.
 */
exports.translateChapter = async (req, res) => {
  try {
    const { bookId, chapterIndex } = req.params;
    const { targetLang } = req.body;

    if (!targetLang) {
      return res.status(400).json({ error: 'targetLang is required' });
    }

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const srcLang = book.language || 'en';

    // Check if same language
    if (translation.isSameLanguage(srcLang, targetLang)) {
      // No translation needed — return original chapter
      const chapterPath = path.join(book.storagePath, 'chapters', `${chapterIndex}.html`);
      const html = await fs.readFile(chapterPath, 'utf-8');
      const assetBase = `/storage/books/${book._id}/assets`;
      const resolvedHtml = html.replace(/__ASSET__/g, assetBase);
      return res.json({
        html: resolvedHtml,
        translated: false,
        language: srcLang,
      });
    }

    const tgtShort = translation.shortLang(targetLang);
    const translatedPath = translation.getTranslatedChapterPath(
      book.storagePath, chapterIndex, targetLang
    );

    // Check cache
    const cached = await translation.hasTranslation(book.storagePath, chapterIndex, targetLang);
    if (cached) {
      let html = await fs.readFile(translatedPath, 'utf-8');
      const assetBase = `/storage/books/${book._id}/assets`;
      html = html.replace(/__ASSET__/g, assetBase);
      return res.json({
        html,
        translated: true,
        language: tgtShort,
        cached: true,
      });
    }

    // Read original chapter HTML
    const originalPath = path.join(book.storagePath, 'chapters', `${chapterIndex}.html`);
    const originalHtml = await fs.readFile(originalPath, 'utf-8');

    // Translate
    const result = await translation.translateChapterHtml(
      originalHtml, srcLang, targetLang, book.storagePath
    );

    // Save translated chapter
    await fs.writeFile(translatedPath, result.html, 'utf-8');

    // Resolve asset paths
    const assetBase = `/storage/books/${book._id}/assets`;
    const resolvedHtml = result.html.replace(/__ASSET__/g, assetBase);

    res.json({
      html: resolvedHtml,
      translated: true,
      language: tgtShort,
      cached: false,
      wordCount: result.wordCount,
    });
  } catch (err) {
    console.error('Translation error:', err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get list of available translations for a chapter.
 * GET /api/translate/:bookId/:chapterIndex/languages
 */
exports.getTranslations = async (req, res) => {
  try {
    const { bookId, chapterIndex } = req.params;
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const chaptersDir = path.join(book.storagePath, 'chapters');
    const files = await fs.readdir(chaptersDir);

    // Find translated chapter files: pattern is {chapterIndex}_{lang}.html
    const prefix = `${chapterIndex}_`;
    const translations = files
      .filter(f => f.startsWith(prefix) && f.endsWith('.html'))
      .map(f => {
        const lang = f.replace(prefix, '').replace('.html', '');
        return lang;
      });

    res.json({
      original: book.language || 'en',
      translations,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Delete a translated chapter.
 * DELETE /api/translate/:bookId/:chapterIndex/:lang
 */
exports.deleteTranslation = async (req, res) => {
  try {
    const { bookId, chapterIndex, lang } = req.params;
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const translatedPath = translation.getTranslatedChapterPath(
      book.storagePath, chapterIndex, lang
    );

    await fs.unlink(translatedPath).catch(() => {});
    res.json({ message: 'Translation deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Get supported languages.
 * GET /api/translate/languages
 */
exports.getSupportedLanguages = async (req, res) => {
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'nl', name: 'Dutch' },
    { code: 'ru', name: 'Russian' },
    { code: 'pl', name: 'Polish' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'cs', name: 'Czech' },
    { code: 'ro', name: 'Romanian' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'sv', name: 'Swedish' },
    { code: 'da', name: 'Danish' },
    { code: 'fi', name: 'Finnish' },
    { code: 'no', name: 'Norwegian' },
    { code: 'el', name: 'Greek' },
    { code: 'tr', name: 'Turkish' },
    { code: 'ar', name: 'Arabic' },
    { code: 'he', name: 'Hebrew' },
    { code: 'fa', name: 'Persian' },
    { code: 'hi', name: 'Hindi' },
    { code: 'bn', name: 'Bengali' },
    { code: 'ta', name: 'Tamil' },
    { code: 'te', name: 'Telugu' },
    { code: 'ur', name: 'Urdu' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
    { code: 'th', name: 'Thai' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'id', name: 'Indonesian' },
    { code: 'ms', name: 'Malay' },
    { code: 'tl', name: 'Filipino' },
    { code: 'sw', name: 'Swahili' },
    { code: 'af', name: 'Afrikaans' },
  ];
  res.json(languages);
};
