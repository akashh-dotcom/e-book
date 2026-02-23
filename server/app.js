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

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve book assets (CSS, images, fonts)
app.use('/storage', express.static(path.join(__dirname, 'storage')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/translate', translateRoutes);

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
