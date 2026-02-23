const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
// Try .env from repo root first, then from server/ directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config(); // fallback: .env in cwd

const bookRoutes = require('./routes/bookRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// Serve book assets (CSS, images, fonts)
app.use('/storage', express.static(path.join(__dirname, 'storage')));

// Routes
app.use('/api/books', bookRoutes);

// MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
