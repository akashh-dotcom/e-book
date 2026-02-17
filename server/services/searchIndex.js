const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');

class SearchIndex {

  /**
   * Search within a book's chapters for a query string.
   * Returns matches with surrounding context.
   */
  async search(book, query) {
    if (!query || !query.trim()) return [];

    const results = [];
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    for (const ch of book.chapters) {
      const filePath = path.join(book.storagePath, 'chapters', ch.filename);

      let html;
      try {
        html = await fs.readFile(filePath, 'utf-8');
      } catch {
        continue;
      }

      const $ = cheerio.load(html);
      const text = $('body').text() || html.replace(/<[^>]+>/g, ' ');

      const regex = new RegExp(escapedQuery, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        const start = Math.max(0, match.index - 40);
        const end = Math.min(text.length, match.index + query.length + 40);
        results.push({
          chapterIndex: ch.index,
          chapterTitle: ch.title,
          snippet: '...' + text.slice(start, end) + '...',
          position: match.index,
        });
      }
    }

    return results.slice(0, 50);
  }
}

module.exports = new SearchIndex();
