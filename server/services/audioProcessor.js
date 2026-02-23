const { execSync } = require('child_process');

/**
 * Audio processing utilities.
 */
class AudioProcessor {

  /**
   * Detect silence points in an audio file (for splitting whole-book audio).
   */
  detectSilence(audioPath) {
    const output = execSync(
      `ffmpeg -i "${audioPath}" -af silencedetect=n=-40dB:d=2 -f null - 2>&1`
    ).toString();
    const silences = [];
    const re = /silence_end: ([\d.]+)/g;
    let m;
    while ((m = re.exec(output))) silences.push(parseFloat(m[1]));
    return silences;
  }

  /**
   * Split audio at given timestamps using ffmpeg.
   */
  async splitAudio(audioPath, splitPoints, outputDir) {
    const fs = require('fs').promises;
    await fs.mkdir(outputDir, { recursive: true });

    const segments = [];
    const points = [0, ...splitPoints];

    for (let i = 0; i < points.length; i++) {
      const start = points[i];
      const end = points[i + 1];
      const outFile = require('path').join(outputDir, `chapter_${i}.mp3`);

      let cmd = `ffmpeg -y -i "${audioPath}" -ss ${start}`;
      if (end) cmd += ` -to ${end}`;
      cmd += ` -c copy "${outFile}"`;

      execSync(cmd, { timeout: 300000 });
      segments.push({ index: i, filename: `chapter_${i}.mp3`, start, end });
    }

    return segments;
  }

  /**
   * Get audio duration via ffprobe.
   */
  getDuration(audioPath) {
    try {
      const out = execSync(
        `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioPath}"`
      ).toString().trim();
      return parseFloat(out) || 0;
    } catch {
      return 0;
    }
  }
}

module.exports = new AudioProcessor();
