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
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
  audioFiles: {
    type: Map,
    of: { filename: String, duration: Number, uploadedAt: Date },
    default: {},
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Book', bookSchema);
