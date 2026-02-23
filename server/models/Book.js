const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
  index: Number,
  title: String,
  wordCount: Number,
  filename: String,
}, { _id: false });

const tocEntrySchema = new mongoose.Schema({
  title: String,
  href: String,
  children: [{
    title: String,
    href: String,
  }],
}, { _id: false });

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: String,
  language: String,
  publisher: String,
  description: String,
  cover: String,
  chapters: [chapterSchema],
  toc: [tocEntrySchema],
  totalChapters: Number,
  storagePath: String,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Book', bookSchema);
