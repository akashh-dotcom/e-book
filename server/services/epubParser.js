const JSZip = require('jszip');
const xml2js = require('xml2js');
const path = require('path');
const cheerio = require('cheerio');

class EpubParser {

  async parse(epubBuffer) {
    const zip = await JSZip.loadAsync(epubBuffer);

    // 1. container.xml -> find OPF path
    const containerXml = await zip
      .file('META-INF/container.xml').async('string');
    const container = await xml2js.parseStringPromise(containerXml);
    const opfPath = container.container
      .rootfiles[0].rootfile[0].$['full-path'];
    const opfDir = path.dirname(opfPath);

    // 2. Parse OPF -> metadata, manifest, spine
    const opfXml = await zip.file(opfPath).async('string');
    const opf = await xml2js.parseStringPromise(opfXml);
    const pkg = opf.package;

    const metadata = this.parseMetadata(pkg.metadata[0]);
    const manifest = this.parseManifest(pkg.manifest[0], opfDir);
    const spineRefs = pkg.spine[0].itemref;
    const spine = spineRefs ? spineRefs.map(ref => ref.$.idref) : [];

    // 3. Extract chapters in reading order
    const chapters = [];
    let chapterIdx = 0;
    for (let i = 0; i < spine.length; i++) {
      const item = manifest[spine[i]];
      if (!item) continue;
      if (item.mediaType !== 'application/xhtml+xml') continue;

      const zipFile = zip.file(item.href);
      if (!zipFile) continue;

      const xhtml = await zipFile.async('string');
      chapters.push({
        index: chapterIdx,
        id: spine[i],
        href: item.href,
        content: xhtml,
      });
      chapterIdx++;
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
    if (!manifestNode || !manifestNode.item) return manifest;
    manifestNode.item.forEach(item => {
      const a = item.$;
      manifest[a.id] = {
        href: opfDir && opfDir !== '.' ? path.posix.join(opfDir, a.href) : a.href,
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
      const navFile = zip.file(navItem.href);
      if (navFile) {
        const navXhtml = await navFile.async('string');
        if (navXhtml) return this.parseNavXhtml(navXhtml);
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

    // EPUB3 nav element
    const navEl = $('nav[*|type="toc"], nav[epub\\:type="toc"], nav').first();
    const topOl = navEl.find('> ol').first();
    if (!topOl.length) {
      // Fallback: find any ol
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
    const toc = [];

    const navMap = parsed.ncx?.navMap?.[0];
    if (!navMap || !navMap.navPoint) return toc;

    const processNavPoints = (navPoints) => {
      return navPoints.map(np => {
        const title = np.navLabel?.[0]?.text?.[0] || '';
        const href = np.content?.[0]?.$?.src || '';
        const children = np.navPoint ? processNavPoints(np.navPoint) : [];
        return { title, href, children };
      }).filter(entry => entry.title);
    };

    return processNavPoints(navMap.navPoint);
  }

  findCover(pkg, manifest) {
    // Look for cover in metadata
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

    // Look for cover-image property in manifest
    const coverItem = Object.values(manifest).find(
      i => i.properties && i.properties.includes('cover-image')
    );
    if (coverItem) return coverItem.href;

    // Heuristic: look for item with 'cover' in id
    const coverById = Object.entries(manifest).find(
      ([id]) => id.toLowerCase().includes('cover')
    );
    if (coverById && coverById[1].mediaType?.startsWith('image/')) {
      return coverById[1].href;
    }

    return null;
  }
}

module.exports = new EpubParser();
