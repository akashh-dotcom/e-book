import { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Scissors, RefreshCw, Download, Loader } from 'lucide-react';
import { formatTime } from '../../utils/timeFormatter';
import api from '../../services/api';

export default function AudioBar({
  overlay,
  bookId,
  hasSyncData,
  onToggleTrimEditor,
  trimEditorOpen,
  onReSync,
  reSyncing,
}) {
  if (!overlay) return null;

  const [exporting, setExporting] = useState(false);

  const { isPlaying, currentTime, duration, playbackRate, togglePlay, seek, setSpeed } = overlay;
  const progress = duration ? (currentTime / duration) * 100 : 0;

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/books/${bookId}/export-epub`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'book.epub';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // silent
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="audio-bar">
      <div className="audio-controls">
        <button onClick={() => seek(Math.max(0, currentTime - 10))} title="Back 10s">
          <SkipBack size={16} />
        </button>
        <button className="play-btn" onClick={togglePlay}>
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button onClick={() => seek(Math.min(duration, currentTime + 10))} title="Forward 10s">
          <SkipForward size={16} />
        </button>
      </div>

      <div
        className="seek-bar"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          seek(((e.clientX - r.left) / r.width) * duration);
        }}
      >
        <div className="seek-fill" style={{ width: `${progress}%` }} />
      </div>

      <span className="time-display">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>

      <select
        className="speed-select"
        value={playbackRate}
        onChange={e => setSpeed(parseFloat(e.target.value))}
      >
        {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => (
          <option key={r} value={r}>{r}x</option>
        ))}
      </select>

      {onToggleTrimEditor && (
        <button
          className={`icon-btn trim-editor-toggle ${trimEditorOpen ? 'active' : ''}`}
          onClick={onToggleTrimEditor}
          title="Trim Audio"
        >
          <Scissors size={16} />
        </button>
      )}

      {onReSync && (
        <button
          className="icon-btn resync-btn"
          onClick={onReSync}
          disabled={reSyncing}
          title={hasSyncData ? 'Re-Sync Audio' : 'Sync Audio'}
        >
          {reSyncing ? <Loader size={16} className="spin" /> : <RefreshCw size={16} />}
        </button>
      )}

      <button
        className="icon-btn export-btn"
        onClick={handleExport}
        disabled={exporting || !hasSyncData}
        title="Export EPUB 3"
      >
        {exporting ? <Loader size={16} className="spin" /> : <Download size={16} />}
      </button>
    </div>
  );
}
