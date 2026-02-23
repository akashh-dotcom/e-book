const JSZip = require('jszip');
const fs = require('fs').promises;
const path = require('path');
const SyncData = require('../models/SyncData');
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
    oebps.file('style.css', `.-epub-media-overlay-active {
  background-color: #ffe082;
  color: #000;
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

    // ---- Add chapters ----
    for (const ch of book.chapters) {
      const chapterPath = path.join(book.storagePath, 'chapters', ch.filename);
      let html;
      try {
        html = await fs.readFile(chapterPath, 'utf-8');
      } catch {
        continue;
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

      // Wrap in valid XHTML with CSS and epub namespace
      const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${this._escXml(ch.title || '')}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
${html}${audioTag}
</body>
</html>`;

      oebps.file(`${ch.index}.xhtml`, xhtml);
      manifestItems.push(
        `    <item id="${chId}" href="${ch.index}.xhtml" media-type="application/xhtml+xml"${mediaOverlayAttr}/>`
      );
      spineItems.push(`    <itemref idref="${chId}"/>`);
      navEntries.push({ index: ch.index, title: ch.title || `Chapter ${ch.index + 1}` });
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

  _escXml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

module.exports = new EpubExporter();
