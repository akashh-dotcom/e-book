const mongoose = require('mongoose');

const syncEntrySchema = new mongoose.Schema({
  id: String,           // "w00001" — matches <span id> in HTML
  word: String,         // "The"
  clipBegin: Number,    // 0.000 (seconds)
  clipEnd: Number,      // 0.320 (seconds)
  skipped: { type: Boolean, default: false },
}, { _id: false });

const syncDataSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  chapterIndex: { type: Number, required: true },
  syncData: [syncEntrySchema],
  engine: {
    type: String,
    enum: ['whisperx-word', 'whisperx-sentence', 'aeneas-word', 'aeneas-sentence', 'manual'],
    default: 'whisperx-word',
  },
  wordCount: Number,
  duration: Number,
  status: { type: String, enum: ['pending', 'processing', 'complete', 'failed'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

syncDataSchema.index({ bookId: 1, chapterIndex: 1 }, { unique: true });

module.exports = mongoose.model('SyncData', syncDataSchema);
