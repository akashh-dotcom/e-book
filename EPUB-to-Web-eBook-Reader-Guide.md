# EPUB → Web eBook Reader

## Build a ServiceNow/Inkling-Style Online Book Reader with MERN

> Convert EPUB files into a clean, professional web-based ebook reading experience — with a collapsible table of contents sidebar, paginated/scrollable reading, search, highlighting, bookmarks, and responsive design. No user auth needed.

---

## Table of Contents

1. [Goal & Design Reference](#1-goal--design-reference)
2. [Tech Stack](#2-tech-stack)
3. [Folder Structure](#3-folder-structure)
4. [Phase 1 — Backend: EPUB Parser & API](#4-phase-1--backend-epub-parser--api)
5. [Phase 2 — Frontend: Book Reader UI](#5-phase-2--frontend-book-reader-ui)
6. [Phase 3 — Table of Contents Sidebar](#6-phase-3--table-of-contents-sidebar)
7. [Phase 4 — Pagination & Scroll Modes](#7-phase-4--pagination--scroll-modes)
8. [Phase 5 — Search Within Book](#8-phase-5--search-within-book)
9. [Phase 6 — Bookmarks & Highlights](#9-phase-6--bookmarks--highlights)
10. [Phase 7 — Reading Settings](#10-phase-7--reading-settings)
11. [Phase 8 — Audio Sync (SMIL Integration)](#11-phase-8--audio-sync-smil-integration)
12. [Database Schema](#12-database-schema)
13. [API Reference](#13-api-reference)
14. [How EPUB Extraction Works](#14-how-epub-extraction-works)
15. [Run the Project](#15-run-the-project)

---

## 1. Goal & Design Reference

### What We're Building

A web application that:

- Accepts an EPUB file upload
- Parses and extracts the book content (XHTML, CSS, images, TOC)
- Serves it through a clean, professional web-based reader
- Looks and feels like the **ServiceNow/Inkling** ebook reader

### Target UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ☰  Book Title                          🔍  ⚙  🔖  📖    │  ← Top Bar
├────────────────┬────────────────────────────────────────────┤
│                │                                            │
│  TABLE OF      │                                            │
│  CONTENTS      │     Chapter content rendered here          │
│                │                                            │
│  ▸ Chapter 1   │     Clean serif typography                 │
│  ▾ Chapter 2   │     Proper spacing and margins             │
│    2.1 Section │     Images rendered inline                 │
│    2.2 Section │     Code blocks styled                     │
│  ▸ Chapter 3   │                                            │
│  ▸ Chapter 4   │                                            │
│  ▸ Chapter 5   │                                            │
│                │                                            │
│                │                                            │
│                ├────────────────────────────────────────────┤
│                │     ◀  Page 3 of 12  ▶    │ 25% ████░░░  │  ← Bottom Bar
└────────────────┴────────────────────────────────────────────┘
```

### Design Principles (ServiceNow/Inkling Style)

- **Clean white background** with generous margins
- **Serif font** for body text (Georgia, Merriweather, or Source Serif)
- **Sans-serif** for UI elements (Inter, system font)
- **Collapsible sidebar** with nested TOC and active chapter highlight
- **Minimal chrome** — the content is the hero
- **Subtle transitions** — nothing flashy
- **Responsive** — works on desktop, tablet, mobile
- **Reading progress** bar at bottom or top
- **Keyboard navigation** — arrow keys for page turns

---

## 2. Tech Stack

### Backend

| Package | Purpose |
|---------|---------|
| `express` | Server framework |
| `jszip` | Unzip EPUB files (EPUB = ZIP) |
| `xml2js` | Parse OPF, container.xml |
| `cheerio` | Parse/transform XHTML chapter content |
| `multer` | Handle file uploads |
| `mongoose` | MongoDB ODM |
| `cors` | Cross-origin requests |
| `dotenv` | Environment config |

### Frontend

| Package | Purpose |
|---------|---------|
| `react` + `vite` | UI framework |
| `react-router-dom` | Routing |
| `zustand` | Lightweight state management |
| `axios` | API calls |
| `lucide-react` | Icons |
| `tailwindcss` | Styling |

### Install Commands

```bash
# Backend
cd server
npm install express mongoose multer cors dotenv jszip xml2js cheerio

# Frontend
cd client
npm create vite@latest . -- --template react
npm install axios react-router-dom zustand lucide-react
npx tailwindcss init -p
```

---

## 3. Folder Structure

```
epub-reader/
│
├── server/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   └── bookController.js
│   ├── models/
│   │   ├── Book.js
│   │   └── Bookmark.js
│   ├── services/
│   │   ├── epubParser.js          ← Core: unzip + parse EPUB
│   │   ├── epubToWeb.js           ← Core: convert chapters to web-ready HTML
│   │   └── searchIndex.js         ← Full-text search within book
│   ├── routes/
│   │   └── bookRoutes.js
│   ├── storage/
│   │   └── books/
│   │       └── {bookId}/
│   │           ├── original.epub
│   │           ├── metadata.json
│   │           ├── chapters/
│   │           │   ├── 0.html
│   │           │   ├── 1.html
│   │           │   └── ...
│   │           ├── assets/
│   │           │   ├── style.css
│   │           │   ├── images/
│   │           │   └── fonts/
│   │           └── toc.json
│   ├── uploads/                    ← Temp upload dir
│   ├── app.js
│   └── package.json
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── UploadPage.jsx
│   │   │   ├── Reader/
│   │   │   │   ├── ReaderPage.jsx        ← Main reader layout
│   │   │   │   ├── Sidebar.jsx           ← TOC sidebar
│   │   │   │   ├── ChapterView.jsx       ← Renders chapter HTML
│   │   │   │   ├── TopBar.jsx            ← Book title, controls
│   │   │   │   ├── BottomBar.jsx         ← Page nav, progress
│   │   │   │   ├── SearchPanel.jsx       ← In-book search
│   │   │   │   └── SettingsPanel.jsx     ← Font size, theme, etc.
│   │   │   └── Library.jsx               ← List of uploaded books
│   │   ├── hooks/
│   │   │   └── useReader.js              ← Reader state management
│   │   ├── store/
│   │   │   └── bookStore.js
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── .env
├── .gitignore
└── README.md
```

---

## 4. Phase 1 — Backend: EPUB Parser & API

### 4.1 What's Inside an EPUB

An EPUB is a ZIP file. When extracted:

```
book.epub (unzipped)/
├── mimetype                      ← "application/epub+zip"
├── META-INF/
│   └── container.xml             ← Points to the OPF file
├── OEBPS/
│   ├── content.opf               ← Manifest + spine + metadata
│   ├── toc.ncx                   ← Table of contents (EPUB2)
│   ├── nav.xhtml                 ← Table of contents (EPUB3)
│   ├── chapter1.xhtml            ← Book content (it's just HTML!)
│   ├── chapter2.xhtml
│   ├── styles/
│   │   └── book.css
│   └── images/
│       ├── cover.jpg
│       └── figure1.png
```

The conversion pipeline:

```
EPUB (ZIP)
  → Unzip with JSZip
  → Read container.xml → find OPF path
  → Parse OPF → get metadata + manifest + spine (reading order)
  → Extract XHTML chapters in spine order
  → Fix relative asset paths (images, CSS)
  → Extract TOC from nav.xhtml or toc.ncx
  → Save everything to /storage/books/{id}/
  → Serve via API
```

### 4.2 Express Server

**server/app.js**

```javascript
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

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
  .catch(err => console.error(err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));
```

### 4.3 EPUB Parser Service

**server/services/epubParser.js**

```javascript
const JSZip = require('jszip');
const xml2js = require('xml2js');
const path = require('path');

class EpubParser {

  async parse(epubBuffer) {
    const zip = await JSZip.loadAsync(epubBuffer);

    // 1. container.xml → find OPF path
    const containerXml = await zip
      .file('META-INF/container.xml').async('string');
    const container = await xml2js.parseStringPromise(containerXml);
    const opfPath = container.container
      .rootfiles[0].rootfile[0].$['full-path'];
    const opfDir = path.dirname(opfPath);

    // 2. Parse OPF → metadata, manifest, spine
    const opfXml = await zip.file(opfPath).async('string');
    const opf = await xml2js.parseStringPromise(opfXml);
    const pkg = opf.package;

    const metadata = this.parseMetadata(pkg.metadata[0]);
    const manifest = this.parseManifest(pkg.manifest[0], opfDir);
    const spine = pkg.spine[0].itemref.map(ref => ref.$.idref);

    // 3. Extract chapters in reading order
    const chapters = [];
    for (let i = 0; i < spine.length; i++) {
      const item = manifest[spine[i]];
      if (!item) continue;
      if (item.mediaType !== 'application/xhtml+xml') continue;

      const xhtml = await zip.file(item.href).async('string');
      chapters.push({
        index: i,
        id: spine[i],
        href: item.href,
        content: xhtml,
      });
    }

    // 4. Extract TOC
    const toc = await this.extractToc(zip, manifest, opfDir);

    // 5. Extract cover image
    const coverHref = this.findCover(pkg, manifest);

    return { metadata, manifest, spine, chapters, toc, coverHref, zip, opfDir };
  }

  parseMetadata(meta) {
    const get = (arr) => {
      if (!arr || !arr[0]) return '';
      return typeof arr[0] === 'string' ? arr[0] : arr[0]._ || '';
    };
    return {
      title: get(meta['dc:title']),
      author: get(meta['dc:creator']),
      language: get(meta['dc:language']),
      publisher: get(meta['dc:publisher']),
      description: get(meta['dc:description']),
      date: get(meta['dc:date']),
    };
  }

  parseManifest(manifestNode, opfDir) {
    const manifest = {};
    manifestNode.item.forEach(item => {
      const a = item.$;
      manifest[a.id] = {
        href: opfDir ? path.join(opfDir, a.href) : a.href,
        mediaType: a['media-type'],
        properties: a.properties || '',
      };
    });
    return manifest;
  }

  async extractToc(zip, manifest, opfDir) {
    // Try EPUB3 nav.xhtml
    const navItem = Object.values(manifest).find(
      i => i.properties && i.properties.includes('nav')
    );
    if (navItem) {
      const navXhtml = await zip.file(navItem.href)?.async('string');
      if (navXhtml) return this.parseNavXhtml(navXhtml);
    }

    // Fallback: EPUB2 toc.ncx
    const ncxItem = Object.values(manifest).find(
      i => i.mediaType === 'application/x-dtbncx+xml'
    );
    if (ncxItem) {
      const ncxXml = await zip.file(ncxItem.href)?.async('string');
      if (ncxXml) return this.parseNcx(ncxXml);
    }

    return [];
  }

  parseNavXhtml(navXhtml) {
    const cheerio = require('cheerio');
    const $ = cheerio.load(navXhtml, { xmlMode: true });
    const toc = [];

    // EPUB3 nav element
    $('nav ol li').each((_, li) => {
      const a = $(li).children('a').first();
      const entry = {
        title: a.text().trim(),
        href: a.attr('href') || '',
        children: [],
      };

      // Nested items
      $(li).children('ol').find('> li > a').each((_, childA) => {
        entry.children.push({
          title: $(childA).text().trim(),
          href: $(childA).attr('href') || '',
        });
      });

      if (entry.title) toc.push(entry);
    });

    return toc;
  }

  parseNcx(ncxXml) {
    // Parse toc.ncx navPoints into structured TOC
    // Returns same format: [{ title, href, children }]
  }

  findCover(pkg, manifest) {
    // Look for cover in metadata or manifest
    const meta = pkg.metadata?.[0]?.meta;
    if (meta) {
      const coverMeta = meta.find(
        m => m.$.name === 'cover'
      );
      if (coverMeta) {
        const coverId = coverMeta.$.content;
        return manifest[coverId]?.href || null;
      }
    }
    return null;
  }
}

module.exports = new EpubParser();
```

### 4.4 EPUB to Web Converter

This takes the parsed EPUB and produces web-ready chapters.

**server/services/epubToWeb.js**

```javascript
const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs').promises;

class EpubToWeb {

  /**
   * Convert parsed EPUB to web-ready file structure.
   *
   * For each chapter:
   * - Extract <body> content from XHTML
   * - Fix relative paths for images/CSS
   * - Sanitize (remove scripts)
   * - Save clean HTML
   *
   * Also extracts all assets (CSS, images, fonts).
   */
  async convert(parsedEpub, outputDir) {
    const { chapters, manifest, toc, metadata, coverHref, zip, opfDir }
      = parsedEpub;

    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(path.join(outputDir, 'chapters'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'assets'), { recursive: true });

    // Process chapters
    const processedChapters = [];

    for (const ch of chapters) {
      const processed = this.processChapter(ch.content, ch.href, opfDir);

      await fs.writeFile(
        path.join(outputDir, 'chapters', `${ch.index}.html`),
        processed.html
      );

      processedChapters.push({
        index: ch.index,
        title: processed.title || `Chapter ${ch.index + 1}`,
        wordCount: processed.wordCount,
        filename: `${ch.index}.html`,
      });
    }

    // Extract assets
    for (const [id, item] of Object.entries(manifest)) {
      const isAsset = item.mediaType.startsWith('image/') ||
        item.mediaType === 'text/css' ||
        item.mediaType.includes('font');
      if (!isAsset) continue;

      const zipFile = zip.file(item.href);
      if (!zipFile) continue;

      const relPath = item.href.replace(
        opfDir ? opfDir + '/' : '', ''
      );
      const destPath = path.join(outputDir, 'assets', relPath);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.writeFile(destPath, await zipFile.async('nodebuffer'));
    }

    // Extract cover
    let coverPath = null;
    if (coverHref) {
      const coverFile = zip.file(coverHref);
      if (coverFile) {
        const ext = path.extname(coverHref);
        coverPath = `cover${ext}`;
        await fs.writeFile(
          path.join(outputDir, 'assets', coverPath),
          await coverFile.async('nodebuffer')
        );
      }
    }

    // Save metadata
    const bookData = {
      metadata,
      chapters: processedChapters,
      toc,
      cover: coverPath,
      totalChapters: processedChapters.length,
    };

    await fs.writeFile(
      path.join(outputDir, 'metadata.json'),
      JSON.stringify(bookData, null, 2)
    );

    return bookData;
  }

  processChapter(xhtml, chapterHref, opfDir) {
    const $ = cheerio.load(xhtml, { xmlMode: false });

    // Remove scripts
    $('script').remove();

    // Fix image paths → /storage/books/{id}/assets/...
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        const resolved = path.posix.join(
          path.posix.dirname(chapterHref),
          src
        );
        const clean = resolved.replace(
          opfDir ? opfDir + '/' : '', ''
        );
        // Will be replaced at serve time with full URL
        $(el).attr('src', `__ASSET__/${clean}`);
      }
    });

    // Fix CSS link paths
    $('link[rel="stylesheet"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !href.startsWith('http')) {
        const resolved = path.posix.join(
          path.posix.dirname(chapterHref), href
        );
        const clean = resolved.replace(
          opfDir ? opfDir + '/' : '', ''
        );
        $(el).attr('href', `__ASSET__/${clean}`);
      }
    });

    // Extract title
    const title = $('h1, h2, h3, title').first().text().trim();

    // Count words
    const text = $('body').text() || '';
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    // Get body content only
    const bodyHtml = $('body').html() || $.html();

    return { html: bodyHtml, title, wordCount };
  }
}

module.exports = new EpubToWeb();
```

### 4.5 Book Controller

**server/controllers/bookController.js**

```javascript
const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const epubParser = require('../services/epubParser');
const epubToWeb = require('../services/epubToWeb');
const Book = require('../models/Book');

// Upload and parse EPUB
exports.upload = async (req, res) => {
  try {
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
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Get book metadata
exports.getBook = async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  res.json(book);
};

// Get chapter HTML
exports.getChapter = async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });

  const chapterFile = path.join(
    book.storagePath, 'chapters', `${req.params.index}.html`
  );

  let html = await fs.readFile(chapterFile, 'utf-8');

  // Replace asset placeholders with real URLs
  const assetBase = `/storage/books/${book._id}/assets`;
  html = html.replace(/__ASSET__/g, assetBase);

  res.json({ html, chapter: book.chapters[req.params.index] });
};

// List all books
exports.listBooks = async (req, res) => {
  const books = await Book.find()
    .select('title author cover totalChapters createdAt')
    .sort('-createdAt');
  res.json(books);
};

// Search within book
exports.searchBook = async (req, res) => {
  const book = await Book.findById(req.params.id);
  const { q } = req.query;
  if (!q) return res.json([]);

  const results = [];
  for (const ch of book.chapters) {
    const filePath = path.join(
      book.storagePath, 'chapters', ch.filename
    );
    const html = await fs.readFile(filePath, 'utf-8');
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    const text = $('body').text() || html;

    const regex = new RegExp(q, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(0, match.index - 40);
      const end = Math.min(text.length, match.index + q.length + 40);
      results.push({
        chapterIndex: ch.index,
        chapterTitle: ch.title,
        snippet: '...' + text.slice(start, end) + '...',
        position: match.index,
      });
    }
  }

  res.json(results.slice(0, 50)); // limit results
};

// Delete book
exports.deleteBook = async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json({ error: 'Not found' });
  await fs.rm(book.storagePath, { recursive: true, force: true });
  await Book.deleteOne({ _id: req.params.id });
  res.json({ message: 'Deleted' });
};
```

### 4.6 Routes

**server/routes/bookRoutes.js**

```javascript
const router = require('express').Router();
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.epub')) cb(null, true);
    else cb(new Error('Only .epub files allowed'));
  },
});
const ctrl = require('../controllers/bookController');

router.post('/upload', upload.single('epub'), ctrl.upload);
router.get('/', ctrl.listBooks);
router.get('/:id', ctrl.getBook);
router.get('/:id/chapters/:index', ctrl.getChapter);
router.get('/:id/search', ctrl.searchBook);
router.delete('/:id', ctrl.deleteBook);

module.exports = router;
```

---

## 5. Phase 2 — Frontend: Book Reader UI

### 5.1 Main Reader Page Layout

This is the core layout — mimics the ServiceNow/Inkling reader.

**client/src/components/Reader/ReaderPage.jsx**

```jsx
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ChapterView from './ChapterView';
import BottomBar from './BottomBar';

export default function ReaderPage() {
  const { bookId } = useParams();
  const [book, setBook] = useState(null);
  const [chapterHtml, setChapterHtml] = useState('');
  const [chapterIndex, setChapterIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [fontSize, setFontSize] = useState(18);
  const [theme, setTheme] = useState('light'); // light | sepia | dark

  useEffect(() => {
    api.get(`/books/${bookId}`).then(r => setBook(r.data));
  }, [bookId]);

  useEffect(() => {
    if (!book) return;
    api.get(`/books/${bookId}/chapters/${chapterIndex}`)
      .then(r => setChapterHtml(r.data.html));
  }, [book, bookId, chapterIndex]);

  const goNext = () => {
    if (chapterIndex < book.totalChapters - 1)
      setChapterIndex(i => i + 1);
  };

  const goPrev = () => {
    if (chapterIndex > 0) setChapterIndex(i => i - 1);
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (!book) return <div className="loading">Loading...</div>;

  return (
    <div className={`reader-root theme-${theme}`}>
      <TopBar
        title={book.title}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onSearch={() => {/* open search panel */}}
        fontSize={fontSize}
        setFontSize={setFontSize}
        theme={theme}
        setTheme={setTheme}
      />

      <div className="reader-body">
        <Sidebar
          toc={book.toc}
          chapters={book.chapters}
          currentIndex={chapterIndex}
          onSelect={setChapterIndex}
          isOpen={sidebarOpen}
        />

        <main className="reader-content">
          <ChapterView
            html={chapterHtml}
            fontSize={fontSize}
          />
        </main>
      </div>

      <BottomBar
        current={chapterIndex}
        total={book.totalChapters}
        chapterTitle={book.chapters[chapterIndex]?.title}
        onPrev={goPrev}
        onNext={goNext}
      />
    </div>
  );
}
```

### 5.2 Reader CSS Theme System

```css
/* === THEMES === */

.theme-light {
  --bg: #ffffff;
  --bg-alt: #f8f8f8;
  --text: #1a1a1a;
  --text-dim: #6b6b6b;
  --border: #e5e5e5;
  --sidebar-bg: #f5f5f0;
  --accent: #2563eb;
  --highlight: #fef08a;
}

.theme-sepia {
  --bg: #f9f3e8;
  --bg-alt: #f0e8d8;
  --text: #3d2e1a;
  --text-dim: #7a6b5a;
  --border: #d8cfc0;
  --sidebar-bg: #ede5d5;
  --accent: #8b5e34;
  --highlight: #f5d98a;
}

.theme-dark {
  --bg: #1a1a2e;
  --bg-alt: #16213e;
  --text: #e0e0e0;
  --text-dim: #8888a0;
  --border: #2a2a4a;
  --sidebar-bg: #12122a;
  --accent: #4ea8de;
  --highlight: #3a3a1a;
}

/* === LAYOUT === */

.reader-root {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
  color: var(--text);
}

.reader-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.reader-content {
  flex: 1;
  overflow-y: auto;
  padding: 40px 60px;
  max-width: 800px;
  margin: 0 auto;
}

/* === TYPOGRAPHY (ServiceNow/Inkling style) === */

.chapter-content {
  font-family: 'Georgia', 'Source Serif 4', serif;
  line-height: 1.8;
  letter-spacing: 0.01em;
}

.chapter-content h1 {
  font-family: -apple-system, 'Segoe UI', sans-serif;
  font-size: 2em;
  font-weight: 700;
  margin: 0.5em 0 0.8em;
  color: var(--text);
  border-bottom: 2px solid var(--border);
  padding-bottom: 0.3em;
}

.chapter-content h2 {
  font-size: 1.5em;
  font-weight: 600;
  margin: 1.5em 0 0.5em;
  color: var(--text);
}

.chapter-content p {
  margin: 0 0 1.2em;
  text-align: justify;
}

.chapter-content img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 1em 0;
}

.chapter-content pre,
.chapter-content code {
  font-family: 'SFMono-Regular', 'Consolas', monospace;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.chapter-content pre {
  padding: 16px;
  overflow-x: auto;
  font-size: 0.88em;
  line-height: 1.5;
}

.chapter-content code {
  padding: 2px 6px;
  font-size: 0.9em;
}

.chapter-content blockquote {
  border-left: 3px solid var(--accent);
  padding-left: 16px;
  margin: 1em 0;
  color: var(--text-dim);
  font-style: italic;
}

.chapter-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
}

.chapter-content th,
.chapter-content td {
  border: 1px solid var(--border);
  padding: 8px 12px;
  text-align: left;
}

.chapter-content th {
  background: var(--bg-alt);
  font-weight: 600;
}
```

---

## 6. Phase 3 — Table of Contents Sidebar

**client/src/components/Reader/Sidebar.jsx**

```jsx
import { useState } from 'react';
import { ChevronRight, ChevronDown, BookOpen } from 'lucide-react';

export default function Sidebar({
  toc, chapters, currentIndex, onSelect, isOpen
}) {
  if (!isOpen) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <BookOpen size={16} />
        <span>Contents</span>
      </div>

      <nav className="toc-list">
        {toc.length > 0 ? (
          toc.map((entry, i) => (
            <TocItem
              key={i}
              entry={entry}
              chapterIndex={i}
              currentIndex={currentIndex}
              onSelect={onSelect}
            />
          ))
        ) : (
          chapters.map((ch, i) => (
            <button
              key={i}
              className={`toc-entry ${i === currentIndex ? 'active' : ''}`}
              onClick={() => onSelect(i)}
            >
              {ch.title}
            </button>
          ))
        )}
      </nav>

      <div className="sidebar-footer">
        {chapters.length} chapters
      </div>
    </aside>
  );
}

function TocItem({ entry, chapterIndex, currentIndex, onSelect }) {
  const [open, setOpen] = useState(false);
  const hasChildren = entry.children && entry.children.length > 0;

  return (
    <div className="toc-group">
      <button
        className={`toc-entry ${chapterIndex === currentIndex ? 'active' : ''}`}
        onClick={() => {
          onSelect(chapterIndex);
          if (hasChildren) setOpen(!open);
        }}
      >
        {hasChildren && (
          <span className="toc-arrow">
            {open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
          </span>
        )}
        <span className="toc-title">{entry.title}</span>
      </button>

      {hasChildren && open && (
        <div className="toc-children">
          {entry.children.map((child, j) => (
            <button
              key={j}
              className="toc-entry toc-child"
              onClick={() => onSelect(chapterIndex)}
            >
              {child.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

Sidebar CSS:

```css
.sidebar {
  width: 280px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
  transition: width 0.2s ease;
}

.sidebar-header {
  padding: 16px 20px;
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-dim);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 8px;
}

.toc-entry {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 10px 20px;
  border: none;
  background: none;
  text-align: left;
  font-size: 0.88rem;
  color: var(--text);
  cursor: pointer;
  transition: background 0.1s;
}

.toc-entry:hover {
  background: rgba(0,0,0,0.04);
}

.toc-entry.active {
  background: rgba(37, 99, 235, 0.08);
  color: var(--accent);
  font-weight: 600;
  border-left: 3px solid var(--accent);
}

.toc-child {
  padding-left: 40px;
  font-size: 0.84rem;
}

/* Mobile: sidebar as overlay */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 48px;
    bottom: 0;
    z-index: 100;
    box-shadow: 4px 0 20px rgba(0,0,0,0.1);
  }
}
```

---

## 7. Phase 4 — Pagination & Scroll Modes

Two reading modes that users can toggle:

### Scroll Mode (default)

Content flows continuously. User scrolls through the chapter.

### Paginated Mode

Content is divided into viewport-sized pages using CSS columns.

```css
/* Paginated mode using CSS multi-column */
.chapter-content.paginated {
  column-width: 100%;
  column-gap: 60px;
  height: calc(100vh - 120px);  /* minus top/bottom bars */
  overflow: hidden;
}
```

```jsx
// Page navigation in paginated mode
function handlePageTurn(direction) {
  const container = chapterRef.current;
  const pageWidth = container.clientWidth + 60; // column gap
  const currentScroll = container.scrollLeft;

  container.scrollTo({
    left: currentScroll + (direction * pageWidth),
    behavior: 'smooth',
  });
}
```

---

## 8. Phase 5 — Search Within Book

**client/src/components/Reader/SearchPanel.jsx**

```jsx
import { useState } from 'react';
import { Search, X } from 'lucide-react';
import api from '../../services/api';

export default function SearchPanel({ bookId, onNavigate, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    const res = await api.get(
      `/books/${bookId}/search?q=${encodeURIComponent(query)}`
    );
    setResults(res.data);
    setLoading(false);
  };

  return (
    <div className="search-panel">
      <div className="search-input-row">
        <Search size={16} />
        <input
          type="text"
          placeholder="Search in this book..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          autoFocus
        />
        <button onClick={onClose}><X size={16} /></button>
      </div>

      <div className="search-results">
        {loading && <p>Searching...</p>}
        {results.map((r, i) => (
          <button
            key={i}
            className="search-result"
            onClick={() => onNavigate(r.chapterIndex)}
          >
            <span className="result-chapter">{r.chapterTitle}</span>
            <span className="result-snippet"
              dangerouslySetInnerHTML={{
                __html: r.snippet.replace(
                  new RegExp(query, 'gi'),
                  '<mark>$&</mark>'
                )
              }}
            />
          </button>
        ))}
        {!loading && results.length === 0 && query && (
          <p className="no-results">No results found</p>
        )}
      </div>
    </div>
  );
}
```

---

## 9. Phase 6 — Bookmarks & Highlights

### Bookmark Model

**server/models/Bookmark.js**

```javascript
const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
  chapterIndex: Number,
  scrollPosition: Number,          // scroll Y position
  label: String,                   // user label (optional)
  type: {
    type: String,
    enum: ['bookmark', 'highlight'],
    default: 'bookmark',
  },
  highlightText: String,           // for highlights
  highlightColor: {
    type: String,
    default: 'yellow',
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Bookmark', bookmarkSchema);
```

### Highlight Interaction (Frontend)

```jsx
// Capture text selection for highlighting
function handleTextSelection() {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;

  const text = selection.toString().trim();
  if (!text) return;

  // Show highlight toolbar
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  setHighlightPopup({
    text,
    x: rect.left + rect.width / 2,
    y: rect.top - 10,
  });
}
```

---

## 10. Phase 7 — Reading Settings

**client/src/components/Reader/SettingsPanel.jsx**

```jsx
export default function SettingsPanel({
  fontSize, setFontSize,
  theme, setTheme,
  lineHeight, setLineHeight,
}) {
  return (
    <div className="settings-panel">
      <h3>Reading Settings</h3>

      {/* Font size */}
      <div className="setting-row">
        <label>Font Size</label>
        <div className="size-controls">
          <button onClick={() => setFontSize(s => s - 2)}>A-</button>
          <span>{fontSize}px</span>
          <button onClick={() => setFontSize(s => s + 2)}>A+</button>
        </div>
      </div>

      {/* Theme */}
      <div className="setting-row">
        <label>Theme</label>
        <div className="theme-options">
          <button
            className={`theme-btn light ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
          >Light</button>
          <button
            className={`theme-btn sepia ${theme === 'sepia' ? 'active' : ''}`}
            onClick={() => setTheme('sepia')}
          >Sepia</button>
          <button
            className={`theme-btn dark ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
          >Dark</button>
        </div>
      </div>

      {/* Line height */}
      <div className="setting-row">
        <label>Line Spacing</label>
        <input
          type="range"
          min="1.4" max="2.4" step="0.1"
          value={lineHeight}
          onChange={e => setLineHeight(e.target.value)}
        />
      </div>
    </div>
  );
}
```

---

## 11. Phase 8 — Audio Sync (SMIL Integration)

This connects to the SyncRead SMIL project from earlier. Add audio overlay support to the reader.

### Additional Components Needed

```
Reader/
  ├── AudioBar.jsx            ← Play/pause, seek, speed
  └── HighlightEngine.js      ← Apply -epub-media-overlay-active class
```

### Integration Point

```jsx
// In ReaderPage.jsx — add after loading chapter HTML

const [syncData, setSyncData] = useState(null);

useEffect(() => {
  // Try to load sync data for this chapter
  api.get(`/sync/${bookId}/${chapterIndex}`)
    .then(r => setSyncData(r.data))
    .catch(() => setSyncData(null));
}, [bookId, chapterIndex]);

// If syncData exists, show AudioBar and enable highlighting
{syncData && (
  <AudioBar
    audioSrc={`/storage/books/${bookId}/audio/chapter_${chapterIndex}.mp3`}
    syncData={syncData.syncData}
  />
)}
```

Refer to the **SyncRead SMIL project guide** for full SMIL sync implementation details.

---

## 12. Database Schema

### Book

**server/models/Book.js**

```javascript
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
  cover: String,                          // relative path to cover image
  chapters: [chapterSchema],
  toc: [tocEntrySchema],
  totalChapters: Number,
  storagePath: String,                    // absolute path on disk
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Book', bookSchema);
```

---

## 13. API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/books/upload` | Upload EPUB file, parse, store |
| `GET` | `/api/books` | List all books in library |
| `GET` | `/api/books/:id` | Get book metadata + TOC |
| `GET` | `/api/books/:id/chapters/:index` | Get chapter HTML content |
| `GET` | `/api/books/:id/search?q=term` | Full-text search within book |
| `DELETE` | `/api/books/:id` | Delete book and files |
| `POST` | `/api/bookmarks` | Create bookmark or highlight |
| `GET` | `/api/bookmarks/:bookId` | Get bookmarks for a book |
| `DELETE` | `/api/bookmarks/:id` | Delete bookmark |

---

## 14. How EPUB Extraction Works

Step-by-step of what happens when a user uploads `book.epub`:

```
1. User uploads book.epub
   ↓
2. Multer receives file buffer in memory
   ↓
3. JSZip opens it (EPUB = ZIP file)
   ↓
4. Read META-INF/container.xml
   → Find: full-path="OEBPS/content.opf"
   ↓
5. Parse content.opf
   → metadata:  { title, author, language, ... }
   → manifest:  { id → { href, mediaType } } (all files in EPUB)
   → spine:     ["ch1", "ch2", "ch3"] (reading order)
   ↓
6. For each spine item (reading order):
   → Read the .xhtml file
   → Extract <body> content
   → Fix relative image/CSS paths
   → Remove <script> tags
   → Save as /storage/books/{id}/chapters/0.html, 1.html, ...
   ↓
7. Extract assets:
   → CSS files  → /storage/books/{id}/assets/styles/
   → Images     → /storage/books/{id}/assets/images/
   → Fonts      → /storage/books/{id}/assets/fonts/
   ↓
8. Extract Table of Contents:
   → EPUB3: parse nav.xhtml <nav epub:type="toc">
   → EPUB2: parse toc.ncx <navPoint> elements
   → Build structured JSON: [{ title, href, children }]
   ↓
9. Save metadata.json + book record in MongoDB
   ↓
10. API serves chapters as HTML + assets as static files
    → Frontend renders in the reader UI
```

---

## 15. Run the Project

### Prerequisites

- Node.js 18+
- MongoDB running locally or Atlas URI

### Setup

```bash
# Clone
git clone <your-repo>
cd epub-reader

# Backend
cd server
npm install
cp .env.example .env  # edit MONGO_URI

# Frontend
cd ../client
npm install
```

### Environment Variables

**.env**

```env
MONGO_URI=mongodb://localhost:27017/epub-reader
PORT=5000
```

### Start Development

```bash
# Terminal 1: MongoDB (if local)
mongod

# Terminal 2: Backend
cd server
npx nodemon app.js

# Terminal 3: Frontend
cd client
npm run dev
```

### Usage

1. Open `http://localhost:5173`
2. Upload any `.epub` file
3. Click the book to open the reader
4. Browse chapters using the sidebar
5. Use arrow keys to navigate
6. Toggle light / sepia / dark themes
7. Search within the book
8. Adjust font size and line spacing

---

*EPUB is just HTML in a ZIP file. The web is the natural home for ebooks.*
