const JSZip = require('jszip');
const xml2js = require('xml2js');
const path = require('path');
const cheerio = require('cheerio');

class EpubParser {

  async parse(epubBuffer) {
    const zip = await JSZip.loadAsync(epubBuffer);

    // 1. container.xml -> find OPF path
    const containerFile = zip.file('META-INF/container.xml');
    if (!containerFile) {
      throw new Error('Invalid EPUB: missing META-INF/container.xml');
    }
    const containerXml = await containerFile.async('string');
    const container = await xml2js.parseStringPromise(containerXml);
    const opfPath = container?.container
      ?.rootfiles?.[0]?.rootfile?.[0]?.$?.['full-path'];
    if (!opfPath) {
      throw new Error('Invalid EPUB: cannot find OPF path in container.xml');
    }
    const opfDir = path.dirname(opfPath);

    // 2. Parse OPF -> metadata, manifest, spine
    const opfFile = zip.file(opfPath);
    if (!opfFile) {
      throw new Error(`Invalid EPUB: missing OPF file at ${opfPath}`);
    }
    const opfXml = await opfFile.async('string');
    const opf = await xml2js.parseStringPromise(opfXml);
    const pkg = opf.package || opf['opf:package'] || opf[Object.keys(opf)[0]];
    if (!pkg) {
      throw new Error('Invalid EPUB: cannot parse OPF package');
    }

    const metadataNode = pkg.metadata?.[0] || pkg['opf:metadata']?.[0] || {};
    const metadata = this.parseMetadata(metadataNode);

    const manifestNode = pkg.manifest?.[0] || pkg['opf:manifest']?.[0];
    const manifest = this.parseManifest(manifestNode, opfDir);

    const spineNode = pkg.spine?.[0] || pkg['opf:spine']?.[0];
    const spineRefs = spineNode?.itemref;
    const spine = spineRefs ? spineRefs.map(ref => ref.$?.idref).filter(Boolean) : [];

    // 3. Extract chapters in reading order
    const chapters = [];
    let chapterIdx = 0;
    for (let i = 0; i < spine.length; i++) {
      const item = manifest[spine[i]];
      if (!item) continue;
      if (!item.mediaType || !item.mediaType.includes('xhtml')) continue;

      const zipFile = zip.file(item.href);
      if (!zipFile) continue;

      try {
        const xhtml = await zipFile.async('string');
        chapters.push({
          index: chapterIdx,
          id: spine[i],
          href: item.href,
          content: xhtml,
        });
        chapterIdx++;
      } catch (e) {
        console.warn(`Skipping chapter ${spine[i]}: ${e.message}`);
      }
    }

    // 4. Extract TOC
    let toc = [];
    try {
      toc = await this.extractToc(zip, manifest, opfDir);
    } catch (e) {
      console.warn('TOC extraction failed, using empty TOC:', e.message);
    }

    // 5. Split chapters that contain multiple TOC fragments
    const splitChapters = this.splitChaptersByToc(chapters, toc, opfDir);

    // 6. Extract cover image
    const coverHref = this.findCover(pkg, manifest);

    return { metadata, manifest, spine, chapters: splitChapters, toc, coverHref, zip, opfDir };
  }

  parseMetadata(meta) {
    if (!meta) return { title: 'Untitled', author: '', language: '', publisher: '', description: '', date: '' };
    const get = (arr) => {
      if (!arr || !arr[0]) return '';
      return typeof arr[0] === 'string' ? arr[0] : arr[0]._ || arr[0]?.['#text'] || '';
    };
    return {
      title: get(meta['dc:title']) || 'Untitled',
      author: get(meta['dc:creator']),
      language: get(meta['dc:language']),
      publisher: get(meta['dc:publisher']),
      description: get(meta['dc:description']),
      date: get(meta['dc:date']),
    };
  }

  parseManifest(manifestNode, opfDir) {
    const manifest = {};
    if (!manifestNode || !manifestNode.item) return manifest;
    manifestNode.item.forEach(item => {
      const a = item?.$;
      if (!a || !a.id || !a.href) return;
      manifest[a.id] = {
        href: opfDir && opfDir !== '.' ? path.posix.join(opfDir, a.href) : a.href,
        mediaType: a['media-type'] || '',
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
      const navFile = zip.file(navItem.href);
      if (navFile) {
        const navXhtml = await navFile.async('string');
        if (navXhtml) {
          const toc = this.parseNavXhtml(navXhtml);
          if (toc.length > 0) return toc;
        }
      }
    }

    // Fallback: EPUB2 toc.ncx
    const ncxItem = Object.values(manifest).find(
      i => i.mediaType === 'application/x-dtbncx+xml'
    );
    if (ncxItem) {
      const ncxFile = zip.file(ncxItem.href);
      if (ncxFile) {
        const ncxXml = await ncxFile.async('string');
        if (ncxXml) return this.parseNcx(ncxXml);
      }
    }

    return [];
  }

  parseNavXhtml(navXhtml) {
    const $ = cheerio.load(navXhtml, { xmlMode: true });
    const toc = [];

    // Avoid namespaced selectors (css-select doesn't support them)
    // Instead, find nav by filtering on the attribute value manually
    let navEl = $('nav').filter((_, el) => {
      const type = $(el).attr('epub:type') || $(el).attr('type') || '';
      return type === 'toc';
    }).first();
    if (!navEl.length) {
      navEl = $('nav').first();
    }
    const topOl = navEl.find('> ol').first();
    if (!topOl.length) {
      $('nav ol > li').each((_, li) => {
        const a = $(li).children('a').first();
        const entry = {
          title: a.text().trim(),
          href: a.attr('href') || '',
          children: [],
        };

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

    topOl.children('li').each((_, li) => {
      const a = $(li).children('a').first();
      const entry = {
        title: a.text().trim(),
        href: a.attr('href') || '',
        children: [],
      };

      $(li).children('ol').children('li').each((_, childLi) => {
        const childA = $(childLi).children('a').first();
        entry.children.push({
          title: childA.text().trim(),
          href: childA.attr('href') || '',
        });
      });

      if (entry.title) toc.push(entry);
    });

    return toc;
  }

  async parseNcx(ncxXml) {
    const parsed = await xml2js.parseStringPromise(ncxXml);

    const navMap = parsed.ncx?.navMap?.[0];
    if (!navMap || !navMap.navPoint) return [];

    const processNavPoints = (navPoints) => {
      if (!Array.isArray(navPoints)) return [];
      return navPoints.map(np => {
        const title = np.navLabel?.[0]?.text?.[0] || '';
        const href = np.content?.[0]?.$?.src || '';
        const children = np.navPoint ? processNavPoints(np.navPoint) : [];
        return { title, href, children };
      }).filter(entry => entry.title);
    };

    return processNavPoints(navMap.navPoint);
  }

  /**
   * Split spine files that contain multiple TOC-referenced sections into
   * separate chapters so each TOC entry becomes its own chapter.
   */
  splitChaptersByToc(chapters, toc, opfDir) {
    // Collect all TOC entries with fragment anchors, grouped by file
    const tocByFile = {};
    const collectEntries = (entries) => {
      for (const entry of entries) {
        if (entry.href) {
          const hashIdx = entry.href.indexOf('#');
          if (hashIdx > -1) {
            const filePart = entry.href.substring(0, hashIdx);
            const anchor = entry.href.substring(hashIdx + 1);
            if (anchor) {
              if (!tocByFile[filePart]) tocByFile[filePart] = [];
              // Avoid duplicate anchors
              if (!tocByFile[filePart].some(a => a.anchor === anchor)) {
                tocByFile[filePart].push({ title: entry.title, anchor });
              }
            }
          }
        }
        if (entry.children) collectEntries(entry.children);
      }
    };
    collectEntries(toc);

    // If no file has multiple fragment anchors, return as-is
    const hasMultiAnchor = Object.values(tocByFile).some(arr => arr.length > 1);
    if (!hasMultiAnchor) return chapters;

    const result = [];
    let newIndex = 0;

    for (const ch of chapters) {
      const relHref = opfDir && opfDir !== '.'
        ? ch.href.replace(opfDir + '/', '')
        : ch.href;

      const anchors = tocByFile[relHref]
        || tocByFile[path.posix.basename(ch.href)];

      if (!anchors || anchors.length <= 1) {
        result.push({ ...ch, index: newIndex++ });
        continue;
      }

      // This chapter has multiple TOC fragments — split it
      const $ = cheerio.load(ch.content, { xmlMode: false });
      const body = $('body');
      if (!body.length) {
        result.push({ ...ch, index: newIndex++ });
        continue;
      }

      const bodyChildren = body.contents().toArray();

      // Find DOM positions of each anchor element
      const anchorPositions = [];
      for (const a of anchors) {
        const el = $(`[id="${a.anchor}"]`).first();
        if (!el.length) continue;

        // Walk up to the top-level body child
        let topLevel = el[0];
        while (topLevel.parentNode && topLevel.parentNode !== body[0]) {
          topLevel = topLevel.parentNode;
        }

        const idx = bodyChildren.indexOf(topLevel);
        if (idx >= 0) {
          anchorPositions.push({ ...a, domIndex: idx });
        }
      }

      if (anchorPositions.length <= 1) {
        result.push({ ...ch, index: newIndex++ });
        continue;
      }

      // Sort by DOM position
      anchorPositions.sort((a, b) => a.domIndex - b.domIndex);

      // Preserve <head> for stylesheets
      const headHtml = $('head').html() || '';

      for (let i = 0; i < anchorPositions.length; i++) {
        // Include pre-anchor content in the first split
        const start = i === 0 ? 0 : anchorPositions[i].domIndex;
        const end = i + 1 < anchorPositions.length
          ? anchorPositions[i + 1].domIndex
          : bodyChildren.length;

        let sectionHtml = '';
        for (let j = start; j < end; j++) {
          sectionHtml += $.html(bodyChildren[j]);
        }

        const fullContent = `<!DOCTYPE html><html><head>${headHtml}</head><body>${sectionHtml}</body></html>`;

        result.push({
          index: newIndex++,
          id: `${ch.id}_part${i}`,
          href: ch.href,
          anchor: anchorPositions[i].anchor,
          content: fullContent,
          tocTitle: anchorPositions[i].title,
        });
      }
    }

    return result;
  }

  findCover(pkg, manifest) {
    try {
      const meta = pkg.metadata?.[0]?.meta;
      if (meta) {
        const coverMeta = Array.isArray(meta) ? meta.find(
          m => m.$ && m.$.name === 'cover'
        ) : null;
        if (coverMeta) {
          const coverId = coverMeta.$.content;
          return manifest[coverId]?.href || null;
        }
      }

      const coverItem = Object.values(manifest).find(
        i => i.properties && i.properties.includes('cover-image')
      );
      if (coverItem) return coverItem.href;

      const coverById = Object.entries(manifest).find(
        ([id]) => id.toLowerCase().includes('cover')
      );
      if (coverById && coverById[1].mediaType?.startsWith('image/')) {
        return coverById[1].href;
      }
    } catch {
      // cover is optional
    }
    return null;
  }
}

module.exports = new EpubParser();
