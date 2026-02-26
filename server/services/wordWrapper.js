const cheerio = require('cheerio');

// Content elements whose text nodes should be wrapped / extracted.
// Must match between wrap() and getPlainText() so TTS audio and
// sync highlighting use the exact same word list in the same order.
// NOTE: h1-h3 are excluded — they are chapter/section titles that
// are typically not narrated in audiobooks and would misalign sync.
const CONTENT_TAGS = new Set([
  // Block elements
  'p', 'h4', 'h5', 'h6', 'li', 'td', 'th',
  'blockquote', 'figcaption', 'dt', 'dd', 'div', 'section', 'article',
  'caption', 'label', 'pre',
  // Inline elements
  'span', 'em', 'strong', 'a', 'b', 'i', 'u', 's',
  'sub', 'sup', 'small', 'mark', 'cite', 'q',
  'abbr', 'dfn', 'time',
]);

// Elements that should never have their text extracted.
const SKIP_TAGS = new Set([
  'script', 'style', 'noscript',
  'nav', 'header', 'footer', 'aside',
  'head', 'title', 'meta', 'link',
  'audio', 'video', 'svg', 'canvas',
]);

/**
 * A syncable word must contain at least one letter or digit.
 * Filters out emojis (🌕), decorative symbols (✦ ✧ ★ • —), and
 * other non-text tokens that would misalign audio sync.
 */
function isWordToken(token) {
  return /[\p{L}\p{N}]/u.test(token);
}

/**
 * Check whether a node is inside at least one content element.
 */
function isInsideContentElement(node) {
  let ancestor = node.parent;
  while (ancestor) {
    if (ancestor.type === 'tag') {
      if (SKIP_TAGS.has(ancestor.name)) return false;
      if (CONTENT_TAGS.has(ancestor.name)) return true;
    }
    ancestor = ancestor.parent;
  }
  return false;
}

class WordWrapper {

  /**
   * Strip existing word-wrap spans (id="wXXXXX") from HTML,
   * restoring the original unwrapped text.
   */
  unwrap(html) {
    return html.replace(/<span id="w\d+">(.*?)<\/span>/g, '$1');
  }

  /**
   * Wrap each word in chapter HTML with <span id="wXXXXX">.
   *
   * Uses a depth-first DOM walk so that words are numbered in
   * document reading order — critical for correct TTS ↔ highlight
   * synchronisation even when inline elements (em, strong, a …)
   * are nested inside block elements (p, h1, li …).
   *
   * @param {string} html - Raw chapter HTML
   * @param {number} startIndex - Starting word index (default 0)
   * @returns {{ html, wordCount, words, wordIds, plainText }}
   */
  wrap(html, startIndex = 0) {
    const cleanHtml = this.unwrap(html);
    const $ = cheerio.load(cleanHtml, { xmlMode: false });
    let wordIndex = startIndex;
    const words = [];
    const wordIds = [];
    const plainTextParts = [];

    const processNode = (node) => {
      if (node.type === 'text') {
        if (!isInsideContentElement(node)) return;
        const text = node.data;
        if (!text || !text.trim()) return;

        const parts = text.split(/(\s+)/);
        const wrapped = parts.map(part => {
          if (!part.trim()) return part; // preserve whitespace
          if (!isWordToken(part)) return part; // keep in HTML but don't wrap
          wordIndex++;
          const id = 'w' + String(wordIndex).padStart(5, '0');
          words.push(part);
          wordIds.push(id);
          plainTextParts.push(part);
          return `<span id="${id}">${part}</span>`;
        }).join('');

        $(node).replaceWith(wrapped);
        return;
      }

      // Skip non-content container tags
      if (node.type === 'tag' && SKIP_TAGS.has(node.name)) return;

      // Recurse into children in document order.
      // Copy the children array because replaceWith mutates it.
      if (node.children) {
        const children = [...node.children];
        for (const child of children) {
          processNode(child);
        }
      }
    };

    processNode($.root()[0]);

    return {
      html: $.html(),
      wordCount: words.length,
      words,
      wordIds,
      plainText: plainTextParts.join(' '),
    };
  }

  /**
   * Get plain text from HTML — extracts words from the same content
   * elements in the same document order as wrap(), so the text sent
   * to TTS matches exactly what will be word-wrapped for highlighting.
   */
  getPlainText(html) {
    const cleanHtml = this.unwrap(html);
    const $ = cheerio.load(cleanHtml, { xmlMode: false });
    const parts = [];

    const collectText = (node) => {
      if (node.type === 'text') {
        if (!isInsideContentElement(node)) return;
        const text = node.data?.trim();
        if (!text) return;
        // Filter out non-word tokens (emojis, symbols) to match wrap()
        const filtered = text.split(/\s+/).filter(w => w && isWordToken(w)).join(' ');
        if (filtered) parts.push(filtered);
        return;
      }
      if (node.type === 'tag' && SKIP_TAGS.has(node.name)) return;
      if (node.children) {
        for (const child of node.children) {
          collectText(child);
        }
      }
    };

    collectText($.root()[0]);
    return parts.join(' ');
  }
}

module.exports = new WordWrapper();
