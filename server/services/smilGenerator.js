class SmilGenerator {

  /**
   * Generate EPUB3-compliant SMIL XML from sync data.
   */
  generate(syncData, chapterFile, audioFile) {
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<smil xmlns="http://www.w3.org/ns/SMIL" version="3.0">',
      '  <body>',
      '    <seq id="seq1"',
      '         xmlns:epub="http://www.idpf.org/2007/ops"',
      `         epub:textref="${chapterFile}">`,
    ];

    syncData.forEach((entry, i) => {
      if (entry.clipBegin === null || entry.clipEnd === null) return;
      lines.push('');
      lines.push(`      <par id="par${i + 1}">`);
      lines.push(`        <text src="${chapterFile}#${entry.id}"/>`);
      lines.push(
        `        <audio src="${audioFile}" ` +
        `clipBegin="${this.formatTime(entry.clipBegin)}" ` +
        `clipEnd="${this.formatTime(entry.clipEnd)}"/>`
      );
      lines.push(`      </par>`);
    });

    lines.push('');
    lines.push('    </seq>');
    lines.push('  </body>');
    lines.push('</smil>');
    return lines.join('\n');
  }

  formatTime(seconds) {
    if (!seconds && seconds !== 0) return '0:00:00.000';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${
      s < 10 ? '0' : ''
    }${s.toFixed(3)}`;
  }

  formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}

module.exports = new SmilGenerator();
