const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  chapterIndex: Number,
  scrollPosition: Number,
  label: String,
  type: {
    type: String,
    enum: ['bookmark', 'highlight'],
    default: 'bookmark',
  },
  highlightText: String,
  highlightColor: {
    type: String,
    default: 'yellow',
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Bookmark', bookmarkSchema);
