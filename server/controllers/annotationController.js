const Annotation = require('../models/Annotation');

// Create or update an annotation
exports.upsertAnnotation = async (req, res) => {
  try {
    const { bookId, chapterIndex, selectedText, backgroundColor, fontColor,
            translatedText, translatedLang, occurrenceIndex } = req.body;

    if (!bookId || chapterIndex === undefined || !selectedText) {
      return res.status(400).json({ error: 'bookId, chapterIndex, and selectedText are required' });
    }

    // Check if annotation for this exact text+occurrence already exists
    let annotation = await Annotation.findOne({
      bookId,
      chapterIndex,
      selectedText,
      occurrenceIndex: occurrenceIndex || 0,
    });

    if (annotation) {
      // Update existing
      if (backgroundColor !== undefined) annotation.backgroundColor = backgroundColor;
      if (fontColor !== undefined) annotation.fontColor = fontColor;
      if (translatedText !== undefined) annotation.translatedText = translatedText;
      if (translatedLang !== undefined) annotation.translatedLang = translatedLang;
      await annotation.save();
    } else {
      // Create new
      annotation = await Annotation.create({
        bookId,
        chapterIndex,
        selectedText,
        backgroundColor: backgroundColor || '',
        fontColor: fontColor || '',
        translatedText: translatedText || '',
        translatedLang: translatedLang || '',
        occurrenceIndex: occurrenceIndex || 0,
      });
    }

    res.status(200).json(annotation);
  } catch (err) {
    console.error('Annotation upsert error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get all annotations for a chapter
exports.getAnnotations = async (req, res) => {
  try {
    const { bookId, chapterIndex } = req.params;
    const annotations = await Annotation.find({
      bookId,
      chapterIndex: parseInt(chapterIndex, 10),
    }).sort('createdAt');
    res.json(annotations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all annotations for a book (used by export)
exports.getBookAnnotations = async (req, res) => {
  try {
    const { bookId } = req.params;
    const annotations = await Annotation.find({ bookId }).sort('chapterIndex createdAt');
    res.json(annotations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete an annotation
exports.deleteAnnotation = async (req, res) => {
  try {
    await Annotation.deleteOne({ _id: req.params.id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Batch translate multiple words in a single model load
exports.translateBatch = async (req, res) => {
  try {
    const { words, targetLang, bookId } = req.body;

    if (!words || !Array.isArray(words) || words.length === 0 || !targetLang) {
      return res.status(400).json({ error: 'words (array) and targetLang are required' });
    }

    // Cap at 200 words to avoid abuse
    const uniqueWords = [...new Set(words.map(w => w.trim()).filter(Boolean))].slice(0, 200);

    const Book = require('../models/Book');
    const translation = require('../services/translationService');

    let srcLang = 'en';
    if (bookId) {
      const book = await Book.findById(bookId);
      if (book?.language) srcLang = book.language;
    }

    if (translation.isSameLanguage(srcLang, targetLang)) {
      const translations = {};
      uniqueWords.forEach(w => { translations[w.toLowerCase()] = w; });
      return res.json({ translations });
    }

    const os = require('os');
    let translatedArr;

    try {
      translatedArr = await translation.translateParagraphs(
        uniqueWords, srcLang, targetLang, os.tmpdir()
      );
    } catch (nllbErr) {
      console.warn('NLLB batch failed, falling back to web API:', nllbErr.message);
      // Fall back to web API one-by-one (still faster than N separate model loads)
      translatedArr = [];
      for (const word of uniqueWords) {
        try {
          const result = await translation.translateViaWebAPI(word, srcLang, targetLang);
          translatedArr.push(result);
        } catch {
          translatedArr.push(word); // keep original on failure
        }
      }
    }

    const translations = {};
    uniqueWords.forEach((word, i) => {
      translations[word.toLowerCase()] = translatedArr[i] || word;
    });

    res.json({ translations });
  } catch (err) {
    console.error('Batch translation error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Translate a short text selection (with retry for Windows memory crashes)
exports.translateText = async (req, res) => {
  try {
    const { text, targetLang, bookId } = req.body;

    if (!text || !targetLang) {
      return res.status(400).json({ error: 'text and targetLang are required' });
    }

    const Book = require('../models/Book');
    const translation = require('../services/translationService');

    // Get the book's source language
    let srcLang = 'en';
    if (bookId) {
      const book = await Book.findById(bookId);
      if (book?.language) srcLang = book.language;
    }

    if (translation.isSameLanguage(srcLang, targetLang)) {
      return res.json({ translatedText: text, language: srcLang });
    }

    // Try local NLLB model first, fall back to free web API on crash
    const os = require('os');
    let translated;
    let usedWebAPI = false;

    try {
      translated = await translation.translateParagraphs(
        [text], srcLang, targetLang, os.tmpdir()
      );
    } catch (nllbErr) {
      console.warn('NLLB translation failed, falling back to web API:', nllbErr.message);
      // Fall back to web API for any NLLB failure
      try {
        const webResult = await translation.translateViaWebAPI(text, srcLang, targetLang);
        translated = [webResult];
        usedWebAPI = true;
      } catch (webErr) {
        // Both methods failed — throw the original NLLB error with web API context
        throw new Error(`NLLB failed: ${nllbErr.message}. Web API fallback also failed: ${webErr.message}`);
      }
    }

    res.json({
      translatedText: translated[0] || text,
      language: translation.shortLang(targetLang),
      source: usedWebAPI ? 'web-api' : 'nllb',
    });
  } catch (err) {
    console.error('Text translation error:', err);
    const isMemoryCrash = err.message && (
      err.message.includes('3221225477') || err.message.includes('memory crash') ||
      err.message.includes('code 139') || err.message.includes('code -11')
    );
    const userMessage = isMemoryCrash
      ? 'Translation failed due to insufficient memory. Close other applications and try again, or ensure your system has enough RAM for the NLLB model (~2GB).'
      : `Translation failed: ${err.message}`;
    res.status(500).json({ error: userMessage });
  }
};
