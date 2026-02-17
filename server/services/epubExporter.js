const JSZip = require('jszip');
const fs = require('fs').promises;
const path = require('path');
const SyncData = require('../models/SyncData');
const smilGenerator = require('./smilGenerator');

class EpubExporter {

  /**
   * Export book as EPUB3 with Media Overlays.
   * Packages chapters (with word spans), SMIL files, audio files,
   * and OPF with media-overlay attributes.
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

    // Gather sync data for all chapters
    const syncs = await SyncData.find({ bookId: book._id, status: 'complete' });
    const syncMap = {};
    for (const s of syncs) {
      syncMap[s.chapterIndex] = s;
    }

    const manifestItems = [];
    const spineItems = [];
    const durationMetas = [];
    let totalDuration = 0;

    // Add chapters
    for (const ch of book.chapters) {
      const chapterPath = path.join(book.storagePath, 'chapters', ch.filename);
      let html;
      try {
        html = await fs.readFile(chapterPath, 'utf-8');
      } catch {
        continue;
      }

      // Wrap in valid XHTML
      const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${ch.title || ''}</title></head>
<body>
${html}
</body>
</html>`;

      const chId = `ch${ch.index}`;
      oebps.file(`${ch.index}.xhtml`, xhtml);

      const hasOverlay = !!syncMap[ch.index];
      let mediaOverlayAttr = '';

      if (hasOverlay) {
        const moId = `mo_${ch.index}`;
        mediaOverlayAttr = ` media-overlay="${moId}"`;

        // Add SMIL
        const sync = syncMap[ch.index];
        const audioInfo = book.audioFiles?.[ch.index];
        const audioFilename = audioInfo ? `audio/${audioInfo.filename}` : 'audio.mp3';
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

      manifestItems.push(
        `    <item id="${chId}" href="${ch.index}.xhtml" media-type="application/xhtml+xml"${mediaOverlayAttr}/>`
      );
      spineItems.push(`    <itemref idref="${chId}"/>`);
    }

    // Add audio files
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

    // Build OPF
    const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${book._id}</dc:identifier>
    <dc:title>${book.title || 'Untitled'}</dc:title>
    <dc:creator>${book.author || ''}</dc:creator>
    <dc:language>${book.language || 'en'}</dc:language>
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
}

module.exports = new EpubExporter();
