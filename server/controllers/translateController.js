const path = require('path');
const fs = require('fs').promises;
const Book = require('../models/Book');
const wordWrapper = require('../services/wordWrapper');
const translation = require('../services/translationService');

// In-memory progress tracking for active translations
const translationProgress = new Map();

/**
 * Get translation progress.
 * GET /api/translate/:bookId/:chapterIndex/progress
 */
exports.getProgress = (req, res) => {
  const { bookId, chapterIndex } = req.params;
  const key = `${bookId}_${chapterIndex}`;
  const progress = translationProgress.get(key) || { percent: 0, status: 'idle' };
  res.json(progress);
};

/**
 * Translate a chapter to a target language.
 * POST /api/translate/:bookId/:chapterIndex
 * Body: { targetLang: "ja-JP", force: true }
 */
exports.translateChapter = async (req, res) => {
  const { bookId, chapterIndex } = req.params;
  const progressKey = `${bookId}_${chapterIndex}`;

  try {
    const { targetLang, force } = req.body;

    if (!targetLang) {
      return res.status(400).json({ error: 'targetLang is required' });
    }

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const srcLang = book.language || 'en';

    // Check if same language
    if (translation.isSameLanguage(srcLang, targetLang)) {
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

    // Delete old cache if force re-translate requested
    if (force) {
      await fs.unlink(translatedPath).catch(() => {});
    }

    // Check cache
    const cached = !force && await translation.hasTranslation(book.storagePath, chapterIndex, targetLang);
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

    // Set initial progress
    translationProgress.set(progressKey, { percent: 0, current: 0, total: 0, status: 'loading_model' });

    // Read original chapter HTML
    const originalPath = path.join(book.storagePath, 'chapters', `${chapterIndex}.html`);
    const originalHtml = await fs.readFile(originalPath, 'utf-8');

    // Translate with progress callback
    const result = await translation.translateChapterHtml(
      originalHtml, srcLang, targetLang, book.storagePath,
      ({ current, total, percent }) => {
        translationProgress.set(progressKey, { percent, current, total, status: 'translating' });
      }
    );

    // Save translated chapter
    await fs.writeFile(translatedPath, result.html, 'utf-8');

    // Clean up progress
    translationProgress.delete(progressKey);

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
    translationProgress.delete(progressKey);
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
    { code: 'kn', name: 'Kannada' },
    { code: 'ml', name: 'Malayalam' },
    { code: 'mr', name: 'Marathi' },
    { code: 'gu', name: 'Gujarati' },
    { code: 'pa', name: 'Punjabi' },
    { code: 'ur', name: 'Urdu' },
    { code: 'ne', name: 'Nepali' },
    { code: 'si', name: 'Sinhala' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
    { code: 'th', name: 'Thai' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'id', name: 'Indonesian' },
    { code: 'ms', name: 'Malay' },
    { code: 'tl', name: 'Filipino' },
    { code: 'my', name: 'Myanmar' },
    { code: 'km', name: 'Khmer' },
    { code: 'sw', name: 'Swahili' },
    { code: 'af', name: 'Afrikaans' },
    { code: 'am', name: 'Amharic' },
  ];
  res.json(languages);
};
