const cheerio = require('cheerio');

class WordWrapper {

  /**
   * Wrap each word in chapter HTML with <span id="wXXXXX">.
   *
   * @param {string} html - Raw chapter HTML
   * @param {number} startIndex - Starting word index (default 0)
   * @returns {{ html, wordCount, words, wordIds, plainText }}
   */
  wrap(html, startIndex = 0) {
    const $ = cheerio.load(html, { xmlMode: false });
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
   * Prepare plain text file for Aeneas.
   * For WORD-LEVEL alignment: one word per line.
   */
  toAeneasWordFile(plainText) {
    return plainText.split(/\s+/).filter(Boolean).join('\n');
  }

  /**
   * Prepare plain text file for Aeneas.
   * For SENTENCE-LEVEL alignment: one sentence per line.
   */
  toAeneasSentenceFile(plainText) {
    return plainText
      .replace(/([.!?])\s+/g, '$1\n')
      .trim();
  }
}

module.exports = new WordWrapper();
