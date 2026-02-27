const mongoose = require('mongoose');

const annotationSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  chapterIndex: { type: Number, required: true },
  // The original selected text (used to locate it in the chapter HTML)
  selectedText: { type: String, required: true },
  // Styling
  backgroundColor: { type: String, default: '' },
  fontColor: { type: String, default: '' },
  // Translation
  translatedText: { type: String, default: '' },
  translatedLang: { type: String, default: '' },
  // Positional hint: occurrence index (0-based) when the same text appears multiple times
  occurrenceIndex: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

annotationSchema.index({ bookId: 1, chapterIndex: 1 });

module.exports = mongoose.model('Annotation', annotationSchema);
