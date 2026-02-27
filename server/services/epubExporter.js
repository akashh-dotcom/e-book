const JSZip = require('jszip');
const fs = require('fs').promises;
const path = require('path');
const SyncData = require('../models/SyncData');
const Annotation = require('../models/Annotation');
const smilGenerator = require('./smilGenerator');

class EpubExporter {

  /**
   * Safely read audio info from book.audioFiles (handles both Mongoose Map
   * and plain Object).
   */
  _getAudioInfo(book, chapterIndex) {
    const key = String(chapterIndex);
    if (!book.audioFiles) return null;
    if (book.audioFiles instanceof Map) return book.audioFiles.get(key) || null;
    return book.audioFiles[key] || null;
  }

  /**
   * Export book as EPUB3 with Media Overlays.
   * Packages chapters (with word spans), SMIL files, audio files,
   * a nav document, CSS for highlighting, and OPF with media-overlay attrs.
   */
  async exportWithMediaOverlays(book) {
    const zip = new JSZip();

    // mimetype (must be first, uncompressed)
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    // META-INF/container.xml
    zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

    const oebps = zip.folder('OEBPS');

    // ---- CSS for media-overlay active highlight ----
    const hlColor = book.highlightColor || '#ffe082';
    const hlBg = this._lightTint(hlColor, 0.25);
    oebps.file('style.css', `.-epub-media-overlay-active {
  background-color: ${hlBg};
  color: ${hlColor};
}
.annotation {
  border-radius: 2px;
  padding: 0 1px;
}
.annotation-translation {
  font-size: 0.65em;
  color: #2563eb;
  margin-left: 2px;
}
`);

    // ---- Gather sync data for all chapters ----
    const syncs = await SyncData.find({ bookId: book._id, status: 'complete' });
    const syncMap = {};
    for (const s of syncs) {
      syncMap[s.chapterIndex] = s;
    }

    const manifestItems = [];
    const spineItems = [];
    const durationMetas = [];
    let totalDuration = 0;
    const navEntries = [];

    // Style sheet manifest item
    manifestItems.push(
      `    <item id="css" href="style.css" media-type="text/css"/>`
    );

    // ---- Gather annotations for all chapters ----
    const allAnnotations = await Annotation.find({ bookId: book._id });
    const annotationMap = {};
    for (const ann of allAnnotations) {
      if (!annotationMap[ann.chapterIndex]) annotationMap[ann.chapterIndex] = [];
      annotationMap[ann.chapterIndex].push(ann);
    }

    // ---- Add chapters ----
    for (const ch of book.chapters) {
      const chapterPath = path.join(book.storagePath, 'chapters', ch.filename);
      let html;
      try {
        html = await fs.readFile(chapterPath, 'utf-8');
      } catch {
        continue;
      }

      // Apply annotations as inline styled spans
      const chapterAnnotations = annotationMap[ch.index] || [];
      if (chapterAnnotations.length > 0) {
        html = this._applyAnnotations(html, chapterAnnotations);
      }

      const chId = `ch${ch.index}`;
      const hasOverlay = !!syncMap[ch.index];
      const audioInfo = this._getAudioInfo(book, ch.index);
      let mediaOverlayAttr = '';
      let audioFilename = null;

      if (hasOverlay && audioInfo?.filename) {
        const moId = `mo_${ch.index}`;
        mediaOverlayAttr = ` media-overlay="${moId}"`;
        audioFilename = `audio/${audioInfo.filename}`;

        // SMIL
        const sync = syncMap[ch.index];
        const smilXml = smilGenerator.generate(
          sync.syncData, `${ch.index}.xhtml`, audioFilename
        );
        oebps.file(`${ch.index}.smil`, smilXml);
        manifestItems.push(
          `    <item id="${moId}" href="${ch.index}.smil" media-type="application/smil+xml"/>`
        );

        const dur = sync.duration || 0;
        totalDuration += dur;
        durationMetas.push(
          `    <meta property="media:duration" refines="#${moId}">${smilGenerator.formatDuration(dur)}</meta>`
        );
      }

      // Build fallback <audio> element for readers that don't support MO
      let audioTag = '';
      if (audioInfo?.filename) {
        audioTag = `\n<div style="margin:1em 0"><audio controls="controls" src="audio/${audioInfo.filename}">Your reader does not support audio.</audio></div>`;
      }

      // Resolve asset placeholders to EPUB-relative paths
      html = html.replace(/__ASSET__\//g, 'assets/');

      // Convert to valid XHTML (self-close void elements like <br>, <img>, etc.)
      const xhtmlBody = this._toXhtml(html);

      // Wrap in valid XHTML with CSS and epub namespace
      const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${this._escXml(ch.title || '')}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
${xhtmlBody}${audioTag}
</body>
</html>`;

      oebps.file(`${ch.index}.xhtml`, xhtml);
      manifestItems.push(
        `    <item id="${chId}" href="${ch.index}.xhtml" media-type="application/xhtml+xml"${mediaOverlayAttr}/>`
      );
      spineItems.push(`    <itemref idref="${chId}"/>`);
      navEntries.push({ index: ch.index, title: ch.title || `Chapter ${ch.index + 1}` });
    }

    // ---- Add image/font assets ----
    const assetsDir = path.join(book.storagePath, 'assets');
    const assetFiles = await this._collectAssets(assetsDir);
    let assetIdx = 0;
    for (const relPath of assetFiles) {
      const absPath = path.join(assetsDir, relPath);
      try {
        const buf = await fs.readFile(absPath);
        oebps.file(`assets/${relPath}`, buf);
        const mimeType = this._guessMime(relPath);
        manifestItems.push(
          `    <item id="asset_${assetIdx}" href="assets/${relPath}" media-type="${mimeType}"/>`
        );
        assetIdx++;
      } catch {
        // skip missing asset
      }
    }

    // ---- Add audio files ----
    if (book.audioFiles) {
      const audioEntries = book.audioFiles instanceof Map
        ? [...book.audioFiles.entries()]
        : Object.entries(book.audioFiles);

      for (const [idx, info] of audioEntries) {
        if (!info || !info.filename) continue;
        const audioPath = path.join(book.storagePath, 'audio', info.filename);
        try {
          const audioBuffer = await fs.readFile(audioPath);
          oebps.file(`audio/${info.filename}`, audioBuffer);
          manifestItems.push(
            `    <item id="audio_${idx}" href="audio/${info.filename}" media-type="audio/mpeg"/>`
          );
        } catch {
          // skip missing audio
        }
      }
    }

    // ---- Navigation document (required by EPUB3) ----
    const navXhtml = this._buildNav(book.title, navEntries);
    oebps.file('nav.xhtml', navXhtml);
    manifestItems.push(
      `    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`
    );

    // ---- Build OPF ----
    const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${book._id}</dc:identifier>
    <dc:title>${this._escXml(book.title || 'Untitled')}</dc:title>
    <dc:creator>${this._escXml(book.author || '')}</dc:creator>
    <dc:language>${book.language || 'en'}</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
    <meta property="media:active-class">-epub-media-overlay-active</meta>
    <meta property="media:duration">${smilGenerator.formatDuration(totalDuration)}</meta>
${durationMetas.join('\n')}
  </metadata>
  <manifest>
${manifestItems.join('\n')}
  </manifest>
  <spine>
${spineItems.join('\n')}
  </spine>
</package>`;

    oebps.file('content.opf', opf);

    return zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' });
  }

  _buildNav(bookTitle, entries) {
    const items = entries
      .map(e => `      <li><a href="${e.index}.xhtml">${this._escXml(e.title)}</a></li>`)
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>${this._escXml(bookTitle || 'Table of Contents')}</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
${items}
    </ol>
  </nav>
</body>
</html>`;
  }

  /**
   * Convert HTML to valid XHTML by self-closing void elements.
   * Cheerio with xmlMode:false outputs <br>, <hr>, <img …> etc.
   * which are invalid in EPUB3 XHTML and break strict parsers like Thorium.
   */
  _toXhtml(html) {
    const voidTags = 'area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr';
    return html.replace(
      new RegExp(`<(${voidTags})(\\s[^>]*?)?\\s*\\/?>`, 'gi'),
      '<$1$2/>'
    );
  }

  /**
   * Blend a hex color with white at given opacity to produce a light tint.
   * Used for EPUB highlight backgrounds (rgba not supported in all readers).
   */
  _lightTint(hex, opacity = 0.25) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const lr = Math.round(r * opacity + 255 * (1 - opacity));
    const lg = Math.round(g * opacity + 255 * (1 - opacity));
    const lb = Math.round(b * opacity + 255 * (1 - opacity));
    return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
  }

  /**
   * Recursively collect all file paths under a directory (relative to dir).
   */
  async _collectAssets(dir) {
    const results = [];
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return results;
    }
    for (const entry of entries) {
      const rel = entry.name;
      if (entry.isDirectory()) {
        const sub = await this._collectAssets(path.join(dir, rel));
        results.push(...sub.map(s => `${rel}/${s}`));
      } else {
        results.push(rel);
      }
    }
    return results;
  }

  _guessMime(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
      '.css': 'text/css',
      '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff',
      '.woff2': 'font/woff2',
    };
    return map[ext] || 'application/octet-stream';
  }

  /**
   * Apply annotations to chapter HTML by wrapping annotated text in styled spans.
   * Uses inline styles so colors and translations persist in the exported EPUB.
   */
  _applyAnnotations(html, annotations) {
    // Process each annotation: find the text and wrap it in a <span>
    // Sort by occurrence index descending so replacements don't shift positions
    const sorted = [...annotations].sort((a, b) => {
      if (a.selectedText === b.selectedText) {
        return (b.occurrenceIndex || 0) - (a.occurrenceIndex || 0);
      }
      return 0;
    });

    for (const ann of sorted) {
      if (!ann.selectedText) continue;
      const hasStyle = ann.backgroundColor || ann.fontColor;
      const hasTranslation = ann.translatedText;
      if (!hasStyle && !hasTranslation) continue;

      // Build inline style
      const styles = [];
      if (ann.backgroundColor) styles.push(`background-color:${ann.backgroundColor}`);
      if (ann.fontColor) styles.push(`color:${ann.fontColor}`);
      const styleAttr = styles.length > 0 ? ` style="${styles.join(';')}"` : '';

      // Build the replacement span
      const escapedText = this._escXml(ann.selectedText);
      let replacement;
      if (hasTranslation) {
        // Include translation as a tooltip (title attribute) and as a visible ruby-like annotation
        const escapedTranslation = this._escXml(ann.translatedText);
        replacement = `<span class="annotation"${styleAttr} title="${escapedTranslation} (${ann.translatedLang || ''})">${ann.selectedText}<sup class="annotation-translation" style="font-size:0.65em;color:#2563eb;margin-left:2px">[${escapedTranslation}]</sup></span>`;
      } else {
        replacement = `<span class="annotation"${styleAttr}>${ann.selectedText}</span>`;
      }

      // Find and replace the nth occurrence
      const target = ann.occurrenceIndex || 0;
      let count = 0;
      let result = '';
      let searchFrom = 0;

      // We need to search in text content only (not in HTML tags)
      // Simple approach: find occurrence in full HTML string outside of tags
      const text = ann.selectedText;
      while (searchFrom < html.length) {
        const idx = html.indexOf(text, searchFrom);
        if (idx === -1) break;

        // Check that this occurrence is not inside an HTML tag
        const beforeSlice = html.slice(0, idx);
        const lastOpenTag = beforeSlice.lastIndexOf('<');
        const lastCloseTag = beforeSlice.lastIndexOf('>');
        const insideTag = lastOpenTag > lastCloseTag;

        if (insideTag) {
          // Skip this occurrence — it's inside a tag
          searchFrom = idx + 1;
          continue;
        }

        if (count === target) {
          result = html.slice(0, idx) + replacement + html.slice(idx + text.length);
          html = result;
          break;
        }
        count++;
        searchFrom = idx + 1;
      }
    }

    return html;
  }

  _escXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

module.exports = new EpubExporter();
