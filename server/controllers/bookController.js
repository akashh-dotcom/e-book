const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const epubParser = require('../services/epubParser');
const epubToWeb = require('../services/epubToWeb');
const searchIndex = require('../services/searchIndex');
const Book = require('../models/Book');
const Bookmark = require('../models/Bookmark');

// Upload and parse EPUB
exports.upload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const buffer = req.file.buffer;
    const bookId = new mongoose.Types.ObjectId();
    const outputDir = path.join(__dirname, '..', 'storage', 'books', bookId.toString());

    // Parse EPUB
    const parsed = await epubParser.parse(buffer);

    // Convert to web-ready files
    const bookData = await epubToWeb.convert(parsed, outputDir);

    // Save original
    await fs.writeFile(path.join(outputDir, 'original.epub'), buffer);

    // Save to MongoDB
    const book = await Book.create({
      _id: bookId,
      ...bookData.metadata,
      chapters: bookData.chapters,
      toc: bookData.toc,
      cover: bookData.cover,
      totalChapters: bookData.totalChapters,
      storagePath: outputDir,
    });

    res.status(201).json(book);
  } catch (err) {
    console.error('Upload error:', err.stack || err);
    res.status(500).json({ error: err.message });
  }
};

// Get book metadata
exports.getBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Not found' });
    res.json(book);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get chapter HTML
exports.getChapter = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Not found' });

    const chapterIdx = parseInt(req.params.index, 10);
    if (chapterIdx < 0 || chapterIdx >= book.chapters.length) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    const chapterFile = path.join(
      book.storagePath, 'chapters', `${chapterIdx}.html`
    );

    let html = await fs.readFile(chapterFile, 'utf-8');

    // Replace asset placeholders with real URLs
    const assetBase = `/storage/books/${book._id}/assets`;
    html = html.replace(/__ASSET__/g, assetBase);

    res.json({ html, chapter: book.chapters[chapterIdx] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// List all books
exports.listBooks = async (req, res) => {
  try {
    const books = await Book.find()
      .select('title author cover totalChapters createdAt')
      .sort('-createdAt');
    res.json(books);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Search within book
exports.searchBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Not found' });

    const { q } = req.query;
    if (!q) return res.json([]);

    const results = await searchIndex.search(book, q);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete book
exports.deleteBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ error: 'Not found' });
    await fs.rm(book.storagePath, { recursive: true, force: true });
    await Bookmark.deleteMany({ bookId: req.params.id });
    await Book.deleteOne({ _id: req.params.id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- Bookmark endpoints ---

// Create bookmark or highlight
exports.createBookmark = async (req, res) => {
  try {
    const bookmark = await Bookmark.create(req.body);
    res.status(201).json(bookmark);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get bookmarks for a book
exports.getBookmarks = async (req, res) => {
  try {
    const bookmarks = await Bookmark.find({ bookId: req.params.bookId })
      .sort('-createdAt');
    res.json(bookmarks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete bookmark
exports.deleteBookmark = async (req, res) => {
  try {
    await Bookmark.deleteOne({ _id: req.params.id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
