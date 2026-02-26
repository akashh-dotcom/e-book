const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
// Try .env from repo root first, then from server/ directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config(); // fallback: .env in cwd

const bookRoutes = require('./routes/bookRoutes');
const audioRoutes = require('./routes/audioRoutes');
const syncRoutes = require('./routes/syncRoutes');
const authRoutes = require('./routes/authRoutes');
const translateRoutes = require('./routes/translateRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const { handleWebhook } = require('./controllers/paymentController');

const app = express();
app.use(cors({ exposedHeaders: ['Content-Disposition'] }));

// Stripe webhook needs the raw body — must be before express.json()
app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), handleWebhook);

app.use(express.json({ limit: '50mb' }));

// Serve book assets (CSS, images, fonts)
app.use('/storage', express.static(path.join(__dirname, 'storage')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/translate', translateRoutes);
app.use('/api/payment', paymentRoutes);

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected');
    // Drop stale 2-field unique index if it exists (replaced by 3-field index including lang)
    try {
      const col = mongoose.connection.collection('syncdatas');
      const indexes = await col.indexes();
      const stale = indexes.find(i => i.name === 'bookId_1_chapterIndex_1');
      if (stale) {
        await col.dropIndex('bookId_1_chapterIndex_1');
        console.log('Dropped stale index bookId_1_chapterIndex_1');
      }
    } catch (_) { /* index may not exist */ }
  })
  .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
// Allow long-running translation requests (10 minutes)
server.timeout = 600000;
server.keepAliveTimeout = 600000;
