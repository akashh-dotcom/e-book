const JSZip = require('jszip');
const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');
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
  async exportWithMediaOverlays(book, { lang } = {}) {
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
  display: inline;
}
.annotation.has-translation {
  border-bottom: 1px dashed #2563eb;
  cursor: default;
}
.annotation.has-translation [data-translation] {
  position: relative;
}
.annotation.has-translation [data-translation]:hover::after,
.annotation.has-translation [data-translation]:active::after {
  content: attr(data-translation);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #1e293b;
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85em;
  white-space: nowrap;
  z-index: 20;
  pointer-events: none;
  box-shadow: 0 2px 6px rgba(0,0,0,0.18);
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
    const shortLang = lang ? lang.split('-')[0] : null;

    for (const ch of book.chapters) {
      let html;

      // Try translated chapter file first when a language is specified
      if (shortLang) {
        const translatedPath = path.join(
          book.storagePath, 'chapters', `${ch.index}_${shortLang}.html`
        );
        try {
          html = await fs.readFile(translatedPath, 'utf-8');
        } catch {
          // translated file doesn't exist for this chapter, fall back to original
        }
      }

      // Fall back to original chapter file
      if (!html) {
        const chapterPath = path.join(book.storagePath, 'chapters', ch.filename);
        try {
          html = await fs.readFile(chapterPath, 'utf-8');
        } catch {
          continue;
        }
      }

      // Apply annotations as inline styled spans
      const chapterAnnotations = annotationMap[ch.index] || [];
      if (chapterAnnotations.length > 0) {
        html = this._applyAnnotations(html, chapterAnnotations);
        html = await this._addWordTranslations(html, chapterAnnotations, book);
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
    <dc:language>${lang || book.language || 'en'}</dc:language>
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
   * Apply annotations to chapter HTML by wrapping annotated word spans
   * in individual styled annotation spans.
   *
   * Previous approach wrapped the entire matched HTML range in a single
   * <span>, but the closing </span> tags from inner word-wrapper spans
   * would prematurely close the annotation span — only the first word
   * got styled.  This version wraps each word span individually so HTML
   * nesting stays valid.
   */
  _applyAnnotations(html, annotations) {
    const $ = cheerio.load(`<div id="_aw">${html}</div>`, { xmlMode: false, decodeEntities: false });
    const root = $('#_aw')[0];

    // Sort by occurrence index descending so later occurrences are processed
    // first and earlier positions stay valid.
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

      // Walk all text nodes to build full text content and position map
      const textNodes = [];
      let fullText = '';
      const walkText = (node) => {
        if (node.type === 'text') {
          textNodes.push({ node, start: fullText.length, length: (node.data || '').length });
          fullText += node.data || '';
        } else if (node.children) {
          for (const c of node.children) walkText(c);
        }
      };
      walkText(root);

      const searchText = ann.selectedText;
      const target = ann.occurrenceIndex || 0;
      let matchStart = -1;
      let matchLength = searchText.length;

      // 1) Exact match
      let count = 0;
      let sf = 0;
      while (sf <= fullText.length - searchText.length) {
        const idx = fullText.indexOf(searchText, sf);
        if (idx === -1) break;
        if (count === target) { matchStart = idx; break; }
        count++;
        sf = idx + 1;
      }

      // 2) Flexible whitespace match
      if (matchStart === -1) {
        const normalized = searchText.replace(/\s+/g, ' ').trim();
        const escaped = normalized.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const pattern = escaped.replace(/ /g, '\\s+');
        const regex = new RegExp(pattern, 'g');
        count = 0;
        let m;
        while ((m = regex.exec(fullText)) !== null) {
          if (count === target) { matchStart = m.index; matchLength = m[0].length; break; }
          count++;
          regex.lastIndex = m.index + 1;
        }
      }

      if (matchStart === -1) continue;
      const matchEnd = matchStart + matchLength;

      // Build inline style
      const styles = [];
      if (ann.backgroundColor) styles.push(`background-color:${ann.backgroundColor}`);
      if (ann.fontColor) styles.push(`color:${ann.fontColor}`);
      const styleStr = styles.join(';');

      // Build annotation class/attributes
      const annClass = hasTranslation ? 'annotation has-translation' : 'annotation';
      const annAttrs = { class: annClass };
      if (hasTranslation) annAttrs['data-translated-lang'] = ann.translatedLang || '';
      if (styleStr) annAttrs.style = styleStr;

      // Find word spans and text nodes overlapping with the match range
      const processedWordSpans = new Set();

      for (const tn of textNodes) {
        const tnEnd = tn.start + tn.length;
        if (tn.start >= matchEnd || tnEnd <= matchStart) continue;

        // Trace up to find parent word span
        let wordSpanNode = null;
        let p = tn.node.parent;
        while (p && p !== root) {
          if (p.type === 'tag' && p.attribs && p.attribs.id && /^w\d/.test(p.attribs.id)) {
            wordSpanNode = p;
            break;
          }
          p = p.parent;
        }

        if (wordSpanNode && !processedWordSpans.has(wordSpanNode)) {
          processedWordSpans.add(wordSpanNode);
          const $wordEl = $(wordSpanNode);
          // Skip if already inside an annotation
          if ($wordEl.closest('.annotation').length > 0) continue;
          $wordEl.wrap($('<span></span>').attr({ ...annAttrs }));
        } else if (!wordSpanNode) {
          // Text not inside a word span — wrap the overlapping portion directly
          const overlapStart = Math.max(0, matchStart - tn.start);
          const overlapEnd = Math.min(tn.length, matchEnd - tn.start);
          const text = tn.node.data || '';
          const matched = text.substring(overlapStart, overlapEnd);
          if (!matched.trim()) continue;

          const before = text.substring(0, overlapStart);
          const after = text.substring(overlapEnd);
          const $annSpan = $('<span></span>').attr({ ...annAttrs }).text(matched);
          let replacement = '';
          if (before) replacement += before;
          replacement += $.html($annSpan);
          if (after) replacement += after;
          $(tn.node).replaceWith(replacement);
        }
      }
    }

    return $('#_aw').html();
  }

  /**
   * Batch-translate individual words inside annotation spans so the exported
   * EPUB supports word-level hover tooltips (CSS-only, no JS needed).
   */
  async _addWordTranslations(html, annotations, book) {
    const translation = require('./translationService');
    const os = require('os');

    const translatedAnns = annotations.filter(a => a.translatedText && a.translatedLang);
    if (translatedAnns.length === 0) return html;

    const $ = cheerio.load(`<div id="_ew">${html}</div>`, { xmlMode: false, decodeEntities: false });

    // Collect unique words per target language
    const wordsByLang = {};

    $('.annotation.has-translation').each((_, annEl) => {
      const $ann = $(annEl);
      const lang = $ann.attr('data-translated-lang');
      if (!lang) return;

      $ann.find('[id^="w"]').each((_, wordEl) => {
        const word = $(wordEl).text().trim();
        if (!word) return;
        if (!wordsByLang[lang]) wordsByLang[lang] = new Set();
        wordsByLang[lang].add(word);
      });
    });

    if (Object.keys(wordsByLang).length === 0) return html;

    const srcLang = book.language || 'en';
    const translationMap = {}; // "word|lang" -> translated

    for (const [lang, wordSet] of Object.entries(wordsByLang)) {
      if (translation.isSameLanguage(srcLang, lang)) continue;

      const words = [...wordSet].slice(0, 500);
      try {
        const results = await translation.translateParagraphs(
          words, srcLang, lang, os.tmpdir()
        );
        words.forEach((word, i) => {
          translationMap[`${word.toLowerCase()}|${lang}`] = results[i] || word;
        });
      } catch (err) {
        console.warn(`NLLB word translation failed for ${lang}, trying web API:`, err.message);
        for (const word of words) {
          try {
            const result = await translation.translateViaWebAPI(word, srcLang, lang);
            translationMap[`${word.toLowerCase()}|${lang}`] = result;
          } catch {
            // skip — title attribute on annotation span is the fallback
          }
        }
      }
    }

    if (Object.keys(translationMap).length === 0) return html;

    // Set data-translation on each word span
    $('.annotation.has-translation').each((_, annEl) => {
      const $ann = $(annEl);
      const lang = $ann.attr('data-translated-lang');
      if (!lang) return;

      $ann.find('[id^="w"]').each((_, wordEl) => {
        const $word = $(wordEl);
        const word = $word.text().trim();
        if (!word) return;
        const key = `${word.toLowerCase()}|${lang}`;
        if (translationMap[key]) {
          $word.attr('data-translation', translationMap[key]);
          $word.attr('title', translationMap[key]);
        }
      });
    });

    return $('#_ew').html();
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
