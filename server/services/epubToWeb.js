const cheerio = require('cheerio');
const path = require('path');
const fs = require('fs').promises;

class EpubToWeb {

  async convert(parsedEpub, outputDir) {
    const { chapters, manifest, toc, metadata, coverHref, zip, opfDir }
      = parsedEpub;

    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(path.join(outputDir, 'chapters'), { recursive: true });
    await fs.mkdir(path.join(outputDir, 'assets'), { recursive: true });

    // Process chapters
    const processedChapters = [];

    for (const ch of chapters) {
      try {
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
      } catch (e) {
        console.warn(`Skipping chapter ${ch.index}: ${e.message}`);
      }
    }

    // Extract assets
    for (const [id, item] of Object.entries(manifest)) {
      try {
        if (!item.mediaType) continue;
        const isAsset = item.mediaType.startsWith('image/') ||
          item.mediaType === 'text/css' ||
          item.mediaType.includes('font');
        if (!isAsset) continue;

        const zipFile = zip.file(item.href);
        if (!zipFile) continue;

        const relPath = opfDir && opfDir !== '.'
          ? item.href.replace(opfDir + '/', '')
          : item.href;
        const destPath = path.join(outputDir, 'assets', relPath);
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.writeFile(destPath, await zipFile.async('nodebuffer'));
      } catch (e) {
        console.warn(`Skipping asset ${id}: ${e.message}`);
      }
    }

    // Extract cover
    let coverPath = null;
    if (coverHref) {
      try {
        const coverFile = zip.file(coverHref);
        if (coverFile) {
          const ext = path.extname(coverHref);
          coverPath = `cover${ext}`;
          await fs.writeFile(
            path.join(outputDir, 'assets', coverPath),
            await coverFile.async('nodebuffer')
          );
        }
      } catch (e) {
        console.warn('Cover extraction failed:', e.message);
      }
    }

    // Resolve TOC hrefs to chapter indices
    const resolvedToc = this.resolveToc(toc, chapters, opfDir);

    // Save metadata
    const bookData = {
      metadata,
      chapters: processedChapters,
      toc: resolvedToc,
      cover: coverPath,
      totalChapters: processedChapters.length,
    };

    await fs.writeFile(
      path.join(outputDir, 'metadata.json'),
      JSON.stringify(bookData, null, 2)
    );

    return bookData;
  }

  /**
   * Map TOC hrefs to chapter indices so the sidebar can navigate correctly.
   * TOC hrefs are relative to nav/ncx location; chapter hrefs are full zip paths.
   */
  resolveToc(toc, chapters, opfDir) {
    // Build lookup: relative path (stripped of opfDir) → chapter index
    const hrefToIndex = {};
    for (const ch of chapters) {
      const rel = opfDir && opfDir !== '.'
        ? ch.href.replace(opfDir + '/', '')
        : ch.href;
      hrefToIndex[rel] = ch.index;
      // Also store basename for fuzzy matching
      hrefToIndex[path.posix.basename(ch.href)] = ch.index;
    }

    const resolve = (href) => {
      if (!href) return 0;
      const filePart = href.split('#')[0];
      if (hrefToIndex[filePart] !== undefined) return hrefToIndex[filePart];
      // Try basename
      const base = path.posix.basename(filePart);
      if (hrefToIndex[base] !== undefined) return hrefToIndex[base];
      return 0;
    };

    return toc.map(entry => ({
      title: entry.title,
      href: entry.href,
      chapterIndex: resolve(entry.href),
      children: (entry.children || []).map(child => ({
        title: child.title,
        href: child.href,
        chapterIndex: resolve(child.href),
      })),
    }));
  }

  processChapter(xhtml, chapterHref, opfDir) {
    const $ = cheerio.load(xhtml, { xmlMode: false });

    // Remove scripts
    $('script').remove();

    // Fix image paths
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        const resolved = path.posix.join(
          path.posix.dirname(chapterHref),
          src
        );
        const clean = opfDir && opfDir !== '.'
          ? resolved.replace(opfDir + '/', '')
          : resolved;
        $(el).attr('src', `__ASSET__/${clean}`);
      }
    });

    // Fix SVG image hrefs
    $('image').each((_, el) => {
      const href = $(el).attr('xlink:href') || $(el).attr('href');
      if (href && !href.startsWith('http') && !href.startsWith('data:')) {
        const resolved = path.posix.join(
          path.posix.dirname(chapterHref),
          href
        );
        const clean = opfDir && opfDir !== '.'
          ? resolved.replace(opfDir + '/', '')
          : resolved;
        if ($(el).attr('xlink:href')) {
          $(el).attr('xlink:href', `__ASSET__/${clean}`);
        }
        if ($(el).attr('href')) {
          $(el).attr('href', `__ASSET__/${clean}`);
        }
      }
    });

    // Fix CSS link paths
    $('link[rel="stylesheet"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !href.startsWith('http')) {
        const resolved = path.posix.join(
          path.posix.dirname(chapterHref), href
        );
        const clean = opfDir && opfDir !== '.'
          ? resolved.replace(opfDir + '/', '')
          : resolved;
        $(el).attr('href', `__ASSET__/${clean}`);
      }
    });

    // Extract title
    const title = $('h1, h2, h3, title').first().text().trim() || '';

    // Count words
    const text = $('body').text() || '';
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    // Get body content only
    const bodyHtml = $('body').html() || $.html() || '';

    return { html: bodyHtml, title, wordCount };
  }
}

module.exports = new EpubToWeb();
