const cheerio = require('cheerio');

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
   * @param {string} html - Raw chapter HTML
   * @param {number} startIndex - Starting word index (default 0)
   * @returns {{ html, wordCount, words, wordIds, plainText }}
   */
  wrap(html, startIndex = 0) {
    // Strip any existing word wrapping to prevent double-wrapping
    const cleanHtml = this.unwrap(html);
    const $ = cheerio.load(cleanHtml, { xmlMode: false });
    let wordIndex = startIndex;
    const words = [];
    const wordIds = [];
    const plainTextParts = [];

    const textElements =
      'p, h1, h2, h3, h4, h5, h6, li, td, th, ' +
      'blockquote, figcaption, dt, dd, span, em, strong, a';

    $(textElements).each((_, el) => {
      $(el).contents().each((_, node) => {
        if (node.type !== 'text') return;
        const text = $(node).text();
        if (!text.trim()) return;

        plainTextParts.push(text.trim());

        const parts = text.split(/(\s+)/);
        const wrapped = parts.map(part => {
          if (!part.trim()) return part; // preserve whitespace
          wordIndex++;
          const id = 'w' + String(wordIndex).padStart(5, '0');
          words.push(part);
          wordIds.push(id);
          return `<span id="${id}">${part}</span>`;
        }).join('');

        $(node).replaceWith(wrapped);
      });
    });

    return {
      html: $.html(),
      wordCount: words.length,
      words,
      wordIds,
      plainText: plainTextParts.join(' '),
    };
  }

  /**
   * Get plain text from HTML (same method used by audio generation).
   */
  getPlainText(html) {
    const cleanHtml = this.unwrap(html);
    return cleanHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

module.exports = new WordWrapper();
