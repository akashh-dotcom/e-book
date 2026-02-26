# VoxBook — Complete User Guide

A full pin-to-pin guide for setting up, running, and using the VoxBook EPUB Web Reader.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Environment Configuration](#3-environment-configuration)
4. [Running the Application](#4-running-the-application)
5. [Creating an Admin Account](#5-creating-an-admin-account)
6. [User Authentication](#6-user-authentication)
7. [Uploading an EPUB](#7-uploading-an-epub)
8. [Dashboard — Your Library](#8-dashboard--your-library)
9. [Reading a Book](#9-reading-a-book)
10. [Bookmarks & Highlights](#10-bookmarks--highlights)
11. [Search](#11-search)
12. [Reading Settings](#12-reading-settings)
13. [Audio — Read Aloud](#13-audio--read-aloud)
14. [Audio-Text Sync (Karaoke Highlighting)](#14-audio-text-sync-karaoke-highlighting)
15. [Manual Sync Editor](#15-manual-sync-editor)
16. [Audio Trimming](#16-audio-trimming)
17. [Translation (44+ Languages)](#17-translation-44-languages)
18. [EPUB3 Export with Media Overlays](#18-epub3-export-with-media-overlays)
19. [Profile Management](#19-profile-management)
20. [Subscription & Payments (Stripe)](#20-subscription--payments-stripe)
21. [Admin Panel](#21-admin-panel)
22. [Storage Structure](#22-storage-structure)
23. [API Reference (Quick)](#23-api-reference-quick)
24. [Troubleshooting](#24-troubleshooting)

---

## 1. Prerequisites

Install the following before you begin:

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | 16+ | Server & client runtime |
| **npm** | 8+ | Package management |
| **MongoDB** | 4.4+ | Database |
| **Python** | 3.8+ | TTS, translation, audio alignment |
| **ffmpeg** | any | Audio processing & trimming |
| **ffprobe** | any | Audio duration detection |
| **Git** | any | Clone the repository |

### Verify installations

```bash
node -v          # should print v16+
npm -v           # should print 8+
mongod --version # should print 4.4+
python3 --version # should print 3.8+
ffmpeg -version  # should print version info
ffprobe -version # should print version info
```

---

## 2. Installation

### 2.1 Clone the repository

```bash
git clone <your-repo-url> e-book
cd e-book
```

### 2.2 Install server dependencies

```bash
cd server
npm install
```

### 2.3 Install client dependencies

```bash
cd ../client
npm install
```

### 2.4 Install Python dependencies

Create a virtual environment (recommended) and install:

```bash
# From the project root (e-book/)
python3 -m venv venv
source venv/bin/activate        # Linux/Mac
# venv\Scripts\activate          # Windows

pip install -r requirements.txt
```

This installs:
- **WhisperX** — forced audio-text alignment
- **torch / torchaudio** — ML backend for WhisperX

### 2.5 Install additional Python packages (for full feature set)

```bash
pip install edge-tts            # Text-to-speech generation
pip install transformers sentencepiece  # NLLB translation model
pip install stable-ts           # (optional) enhanced alignment
```

---

## 3. Environment Configuration

Create a `.env` file in the **project root** (`e-book/.env`):

```env
# ─── Database ────────────────────────────────────
MONGO_URI=mongodb://localhost:27017/epub-reader

# ─── Server ──────────────────────────────────────
PORT=5000

# ─── Python Path ─────────────────────────────────
# Point to the Python binary inside your virtual environment
# Linux/Mac:
PYTHON_PATH=/absolute/path/to/e-book/venv/bin/python3
# Windows:
# PYTHON_PATH=C:\Users\YOU\e-book\venv\Scripts\python.exe

# ─── Authentication ──────────────────────────────
JWT_SECRET=your-secret-key-here

# ─── Stripe Payments (optional) ─────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
STRIPE_ENTERPRISE_MONTHLY_PRICE_ID=price_...
STRIPE_ENTERPRISE_ANNUAL_PRICE_ID=price_...
CLIENT_URL=http://localhost:5173
```

> **Important:** `PYTHON_PATH` must be an absolute path. If left empty, TTS generation, translation, and audio alignment features will not work.

---

## 4. Running the Application

### 4.1 Start MongoDB

```bash
# If installed locally:
mongod

# Or if using systemd:
sudo systemctl start mongod
```

### 4.2 Start the backend server

```bash
cd server
npm run dev
```

This starts the Express server on `http://localhost:5000` with nodemon (auto-restarts on file changes).

For production:

```bash
cd server
npm start
```

### 4.3 Start the frontend dev server

Open a **second terminal**:

```bash
cd client
npm run dev
```

This starts the Vite dev server on `http://localhost:5173`. API calls are proxied to `localhost:5000` automatically.

### 4.4 Build for production

```bash
cd client
npm run build
npm run preview   # preview the production build locally
```

### Quick start summary

```bash
# Terminal 1 — Database
mongod

# Terminal 2 — Backend
cd server && npm run dev

# Terminal 3 — Frontend
cd client && npm run dev
```

Open your browser at **http://localhost:5173**.

---

## 5. Creating an Admin Account

Run the interactive CLI script:

```bash
cd server
node scripts/createAdmin.js
```

It will prompt you for:

```
  VoxBook — Create Admin
  ─────────────────────

  Username : admin
  Email    : admin@example.com
  Phone    : 1234567890
  Password : ********

  ✓ Admin created successfully!
```

---

## 6. User Authentication

### Sign Up

1. Open the app at `http://localhost:5173`
2. Click **Sign Up**
3. Enter username, email, phone, and password
4. You are automatically logged in after registration

### Log In (User)

1. Go to `/login`
2. Enter email and password
3. Click **Log In**

### Log In (Admin)

1. Go to `/admin/login`
2. Enter admin email and password
3. You are redirected to the Admin Dashboard

> Tokens are stored in `localStorage` as `voxbook_token` and expire after **7 days**.

---

## 7. Uploading an EPUB

### From the Landing Page

1. Click **Upload EPUB** on the home page
2. Select a `.epub` file (max 100MB)
3. Wait for the upload progress bar to complete
4. You are redirected to the reader

### From the Dashboard

1. Go to `/dashboard`
2. Click the **Upload EPUB** button
3. Select your `.epub` file
4. The book appears in your library once uploaded

> The server parses the EPUB, extracts chapters, TOC, cover art, and metadata, then converts everything into web-ready HTML.

---

## 8. Dashboard — Your Library

Navigate to `/dashboard` to see all your uploaded books.

Each book card shows:
- Cover image
- Title and author
- Total chapters

Actions:
- **Click a book** to open it in the reader
- **Delete** a book via the delete button on the card

---

## 9. Reading a Book

Open a book from the dashboard to enter the reader at `/read/:bookId`.

### Layout

| Area | Description |
|------|-------------|
| **Top Bar** | Book title, navigation, panel toggles, editor mode switch |
| **Sidebar** (left) | Collapsible Table of Contents — click any chapter to jump |
| **Chapter View** (center) | The chapter content rendered as HTML |
| **Audio Bar** (bottom) | Appears when audio is loaded — playback controls |

### Navigation

- Use the **left/right arrows** in the top bar to go to previous/next chapter
- Click any chapter in the **sidebar TOC** to jump directly
- The TOC supports **nested/hierarchical** structures

---

## 10. Bookmarks & Highlights

### Create a Bookmark

1. Open the **Bookmarks panel** from the top bar
2. Click **Add Bookmark** — saves your current scroll position in the chapter
3. Optionally add a label

### Create a Highlight

1. **Select text** in the chapter view
2. A highlight option appears
3. Choose a highlight color
4. The highlight is saved and visible in the bookmarks panel

### Navigate to a Bookmark/Highlight

1. Open the **Bookmarks panel**
2. Click any bookmark or highlight entry
3. The reader jumps to that location

### Delete

- Click the delete icon next to any bookmark/highlight entry

---

## 11. Search

1. Click the **Search icon** in the top bar
2. Type your search query
3. Results appear with **context snippets** (40 characters before and after the match)
4. Click a result to jump to that chapter and location
5. Up to **50 results** are returned across all chapters

---

## 12. Reading Settings

Click the **Settings icon** in the top bar to open the settings panel.

| Setting | Options |
|---------|---------|
| **Theme** | Light, Dark, Sepia |
| **Font Family** | Serif (Georgia / Source Serif 4), Sans-serif (Inter) |
| **Font Size** | Adjustable range |
| **Line Height** | Adjustable range |
| **Text Alignment** | Left, Center, Justify |

Settings are applied in real-time to the chapter view.

---

## 13. Audio — Read Aloud

VoxBook supports two ways to add audio narration to chapters:

### Option A: Upload Pre-Recorded Audio

1. Open a book in the reader
2. Switch to **Editor Mode** (toggle in the top bar)
3. Use the **Upload Audio** button in the editor toolbar
4. Select an audio file (MP3, WAV, etc.)
5. The audio is attached to the current chapter

### Option B: Generate TTS Audio

1. Open a book in the reader
2. Switch to **Editor Mode**
3. Click **Generate Audio**
4. Select a **voice** from 140+ edge-tts voices (e.g., `en-US-AriaNeural`, `en-GB-SoniaNeural`)
5. Wait for generation to complete
6. The generated audio is attached to the current chapter

> TTS generation also captures per-word timing data (via edge-tts WordBoundary events), enabling immediate karaoke-style sync without needing a separate alignment step.

### Playback

Once audio is loaded, the **Audio Bar** appears at the bottom:

| Control | Description |
|---------|-------------|
| **Play/Pause** | Toggle playback |
| **Timeline** | Click/drag to seek |
| **Playback Speed** | Adjust rate (0.5x–2x) |
| **Export** | Download as EPUB3 with media overlays |

---

## 14. Audio-Text Sync (Karaoke Highlighting)

When audio is paired with sync data, words are highlighted in real-time as the audio plays — karaoke style.

### How Sync Works

There are **three alignment engines** available:

| Engine | How | Best For |
|--------|-----|----------|
| **edge-tts WordBoundary** | Timing captured during TTS generation | TTS-generated audio (automatic, no extra step) |
| **WhisperX** | Forced alignment via Python ML model | Pre-recorded/uploaded audio |
| **stable-ts** | Enhanced Whisper timestamps | Pre-recorded audio (alternative to WhisperX) |

### Auto-Sync (for uploaded audio)

1. Upload or record audio for a chapter
2. In **Editor Mode**, click **Auto-Sync**
3. The server runs WhisperX forced alignment
4. Progress is streamed in real-time (SSE)
5. Once complete, word highlighting becomes active

### What You See During Playback

- The **currently spoken word** is highlighted
- The page **auto-scrolls** to keep the active word in view
- Highlighting runs at **60fps** for smooth animation
- Works with variable playback speeds

---

## 15. Manual Sync Editor

For fine-tuning word-level timing, use the dedicated sync editor.

### Access

1. Open a book in the reader
2. Switch to **Editor Mode**
3. Click the **Sync Editor** button
4. You are taken to `/sync-editor/:bookId/:chapterIndex`

### Features

- **Visual timeline** — each word is a block on the timeline
- **Drag edges** — resize word blocks to adjust start/end times
- **Playback preview** — play back a section to check alignment
- **Save** — saves the adjusted sync data back to the server

---

## 16. Audio Trimming

Trim audio to match the text content.

### Time-Based Trimming

1. In **Editor Mode**, click **Trim Audio**
2. Specify a **start time** and **end time**
3. The audio is trimmed and sync timestamps are recalculated

### Word-Based Trimming

1. In **Editor Mode**, select words to **skip/remove**
2. The audio is trimmed to exclude those segments
3. Timestamps are automatically adjusted

### Restore Original

If you trimmed too aggressively, click **Restore Original** to revert to the pre-trim audio (the server keeps a backup copy).

---

## 17. Translation (44+ Languages)

VoxBook uses **Meta's NLLB-200** model (1.2GB, downloaded on first use) for offline neural machine translation.

### How to Translate

1. Open a book in the reader
2. Click the **Translate icon** in the top bar
3. Select a **target language** from the dropdown
4. Click **Translate**
5. Progress is shown in real-time
6. The chapter content switches to the translated version

### Supported Languages (47)

| | | | |
|---|---|---|---|
| English | Spanish | French | German |
| Italian | Portuguese | Dutch | Russian |
| Polish | Ukrainian | Czech | Romanian |
| Hungarian | Swedish | Danish | Finnish |
| Norwegian | Greek | Turkish | Arabic |
| Hebrew | Persian | Hindi | Bengali |
| Tamil | Telugu | Kannada | Malayalam |
| Marathi | Gujarati | Punjabi | Urdu |
| Nepali | Sinhala | Japanese | Korean |
| Chinese | Thai | Vietnamese | Indonesian |
| Malay | Filipino | Myanmar | Khmer |
| Swahili | Afrikaans | Amharic | |

### RTL Support

Arabic, Hebrew, Persian, and Urdu are rendered right-to-left automatically.

### Generate TTS in Translated Language

After translating a chapter, you can generate TTS audio in the target language and sync it — enabling karaoke-style read-aloud in any supported language.

### Delete a Translation

Open the translate panel and click the **delete** button next to a cached translation to remove it.

---

## 18. EPUB3 Export with Media Overlays

Export your book as a standard EPUB3 file with embedded audio and word-level sync.

### How to Export

**From the Reader (Audio Bar):**
1. Click the **Export** button on the audio bar

**From the Editor:**
1. Switch to **Editor Mode**
2. Click **Export EPUB** in the toolbar

### What's Included

- All chapters (HTML, converted to XHTML for EPUB3 compliance)
- Cover image and metadata
- Audio files (MP3) for chapters that have audio
- **SMIL files** — EPUB3 Media Overlay markup mapping words to audio timestamps
- OPF manifest and nav document
- CSS styles

### Compatibility

The exported EPUB3 works with readers that support Media Overlays:
- **Thorium Reader** (recommended)
- Apple Books
- Readium-based readers

> The downloaded file uses the **original uploaded filename**. If the book was uploaded as `MyNovel.epub`, the export downloads as `MyNovel.epub`.

---

## 19. Profile Management

Click your avatar or profile icon to access profile settings.

| Action | How |
|--------|-----|
| **Update username/email/phone** | Edit fields and save |
| **Change password** | Enter current password + new password |
| **Upload avatar** | Click the avatar area to upload an image |
| **Remove avatar** | Click the remove button on your avatar |
| **Delete account** | Permanently deletes your account and all books |

---

## 20. Subscription & Payments (Stripe)

> Requires `STRIPE_SECRET_KEY` and related env vars to be configured.

### Plans

| Plan | Features |
|------|----------|
| **Starter** | Free tier |
| **Pro** | Monthly or Annual billing |
| **Enterprise** | Monthly or Annual billing |

### Subscribe

1. Go to your profile or a subscription prompt
2. Select a plan
3. You are redirected to **Stripe Checkout**
4. Complete payment
5. Your plan is upgraded immediately

### Manage Subscription

1. Click **Manage Subscription** in your profile
2. You are redirected to the **Stripe Billing Portal**
3. Update payment method, switch plans, or cancel

### Webhook Events

The server automatically handles:
- Subscription created/updated
- Payment succeeded/failed
- Subscription cancelled
- Trial period management (7-day trials)

---

## 21. Admin Panel

Accessible at `/admin` after logging in with an admin account.

### Features

| Feature | Description |
|---------|-------------|
| **View all users** | See every registered user |
| **Delete users** | Remove a user and their data |
| **View all books** | See every book across all users |

---

## 22. Storage Structure

All uploaded content is stored on the server filesystem:

```
server/storage/
├── books/
│   └── {bookId}/
│       ├── original.epub              # Uploaded EPUB
│       ├── metadata.json              # Parsed metadata
│       ├── chapters/
│       │   ├── 0.html                 # Chapter 0 (web HTML)
│       │   ├── 1.html                 # Chapter 1
│       │   ├── 0_ja.html             # Chapter 0 translated to Japanese
│       │   └── ...
│       ├── assets/
│       │   ├── images/                # Extracted images
│       │   ├── styles/                # Extracted CSS
│       │   └── fonts/                 # Extracted fonts
│       ├── audio/
│       │   ├── chapter_0.mp3          # Audio for chapter 0
│       │   ├── chapter_0_original.mp3 # Backup (before trimming)
│       │   ├── chapter_0_timing.json  # TTS word-boundary timing
│       │   ├── chapter_0_ja.mp3       # Japanese TTS audio
│       │   └── ...
│       └── smil/
│           ├── chapter_0.smil         # EPUB3 media overlay
│           └── ...
└── avatars/
    └── {userId}-{timestamp}.jpg       # User profile pictures
```

---

## 23. API Reference (Quick)

All API endpoints are prefixed with `/api`. Protected routes require `Authorization: Bearer <token>`.

### Auth (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/signup` | Register a new user |
| POST | `/login` | Log in |
| POST | `/admin/login` | Admin log in |
| GET | `/me` | Get current user info |
| PUT | `/profile` | Update profile |
| PUT | `/profile/password` | Change password |
| POST | `/profile/avatar` | Upload avatar |
| DELETE | `/profile/avatar` | Remove avatar |
| DELETE | `/profile` | Delete account |
| GET | `/admin/users` | List all users (admin) |
| DELETE | `/admin/users/:id` | Delete a user (admin) |

### Books (`/api/books`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/upload` | Upload an EPUB file |
| GET | `/` | List your books |
| GET | `/:id` | Get book metadata |
| GET | `/:id/chapters/:index` | Get chapter HTML content |
| GET | `/:id/search?q=term` | Full-text search in a book |
| GET | `/:id/export-epub` | Export as EPUB3 with media overlays |
| PATCH | `/:id/settings` | Update book settings (highlight color) |
| DELETE | `/:id` | Delete a book |
| POST | `/bookmarks` | Create a bookmark or highlight |
| GET | `/bookmarks/:bookId` | Get bookmarks for a book |
| DELETE | `/bookmarks/item/:id` | Delete a bookmark |

### Audio (`/api/audio`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/voices` | List available TTS voices |
| POST | `/:bookId/:chapterIndex` | Upload audio for a chapter |
| GET | `/:bookId/:chapterIndex` | Get audio info |
| GET | `/:bookId/:chapterIndex/stream` | Stream audio (supports range requests) |
| POST | `/:bookId/:chapterIndex/generate` | Generate TTS audio |
| POST | `/:bookId/:chapterIndex/trim` | Trim audio |
| POST | `/:bookId/:chapterIndex/restore` | Restore original audio |
| DELETE | `/:bookId/:chapterIndex` | Delete audio |

### Sync (`/api/sync`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/:bookId/:chapterIndex/auto` | Auto-align audio to text (SSE) |
| POST | `/:bookId/:chapterIndex/manual` | Save manual sync data |
| GET | `/:bookId/:chapterIndex` | Get sync data |
| GET | `/:bookId/status` | Get sync status for all chapters |
| DELETE | `/:bookId/:chapterIndex` | Delete sync data |

### Translation (`/api/translate`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/languages` | List supported languages |
| POST | `/:bookId/:chapterIndex` | Translate a chapter |
| GET | `/:bookId/:chapterIndex/progress` | Get translation progress |
| GET | `/:bookId/:chapterIndex/languages` | List available translations |
| DELETE | `/:bookId/:chapterIndex/:lang` | Delete a translation |

### Payments (`/api/payment`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/create-checkout-session` | Start Stripe checkout |
| POST | `/create-portal-session` | Open billing portal |
| GET | `/subscription` | Get subscription info |
| POST | `/webhook` | Stripe webhook receiver |

---

## 24. Troubleshooting

### "Cannot connect to MongoDB"

```bash
# Check if MongoDB is running
mongod --version
sudo systemctl status mongod

# Start it
sudo systemctl start mongod
# or
mongod --dbpath /path/to/data
```

### TTS / Translation / Sync not working

1. Check that `PYTHON_PATH` in `.env` is set to an absolute path
2. Verify the Python environment has the required packages:

```bash
source venv/bin/activate
python3 -c "import edge_tts; print('edge-tts OK')"
python3 -c "import whisperx; print('whisperx OK')"
python3 -c "import transformers; print('transformers OK')"
```

3. Check that `ffmpeg` and `ffprobe` are installed and in your PATH:

```bash
ffmpeg -version
ffprobe -version
```

### "NLLB model download" takes long on first translation

The NLLB-200 model (~1.2GB) is downloaded automatically on the first translation request. This is a one-time download. Ensure you have a stable internet connection.

### EPUB upload fails

- Ensure the file is a valid `.epub` file
- Maximum file size is **100MB**
- The server needs write permissions to `server/storage/`

### Audio upload fails

- Maximum audio file size is **500MB**
- Supported formats: MP3, WAV, and other formats ffmpeg can process

### Export downloads as wrong filename

Make sure the server's CORS config exposes the `Content-Disposition` header (already configured). If using a reverse proxy (Nginx/Apache), ensure it forwards this header.

### Port already in use

```bash
# Find what's using port 5000
lsof -i :5000
# Kill it or change PORT in .env
```

### Vite proxy errors

If the frontend can't reach the backend, ensure:
1. The backend is running on the port specified in `.env` (default 5000)
2. The Vite config proxy points to the correct backend URL

---

## Run Commands — Cheat Sheet

```bash
# ─── First-time setup ───────────────────────────
cd server && npm install                          # Install server deps
cd ../client && npm install                       # Install client deps
python3 -m venv venv && source venv/bin/activate  # Create Python venv
pip install -r requirements.txt                   # Install Python deps
pip install edge-tts transformers sentencepiece   # Extra Python deps
cd server && node scripts/createAdmin.js          # Create admin user

# ─── Run (development) ──────────────────────────
mongod                                            # Start MongoDB
cd server && npm run dev                          # Start backend  (port 5000)
cd client && npm run dev                          # Start frontend (port 5173)

# ─── Run (production) ───────────────────────────
cd client && npm run build                        # Build frontend
cd server && npm start                            # Start backend (serves API)

# ─── Utilities ──────────────────────────────────
cd server && node scripts/createAdmin.js          # Create admin user
```
