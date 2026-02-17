import { useState } from 'react';
import {
  ArrowLeft, Play, Pause, SkipBack, SkipForward,
  Download, Loader, Undo2, Redo2, ZoomIn, ZoomOut,
  Volume2, VolumeX,
} from 'lucide-react';
import { formatTimeMs } from '../../utils/timeFormatter';
import api from '../../services/api';

export default function EditorToolbar({
  bookTitle,
  chapterTitle,
  overlay,
  bookId,
  hasSyncData,
  onExitEditor,
}) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/books/${bookId}/export-epub`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bookTitle || 'book'}.epub`;
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

  const isPlaying = overlay?.isPlaying;
  const currentTime = overlay?.currentTime || 0;
  const duration = overlay?.duration || 0;

  return (
    <div className="ed-toolbar">
      <div className="ed-toolbar-left">
        <button className="ed-toolbar-back" onClick={onExitEditor} title="Back to Reader">
          <ArrowLeft size={18} />
        </button>
        <div className="ed-toolbar-title">
          <span className="ed-toolbar-book">{bookTitle}</span>
          <span className="ed-toolbar-chapter">{chapterTitle}</span>
        </div>
      </div>

      <div className="ed-toolbar-center">
        <button
          className="ed-transport-btn"
          onClick={() => overlay?.seek(Math.max(0, currentTime - 5))}
          title="Back 5s"
        >
          <SkipBack size={16} />
        </button>
        <button
          className="ed-transport-btn ed-play-btn"
          onClick={() => overlay?.togglePlay()}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button
          className="ed-transport-btn"
          onClick={() => overlay?.seek(Math.min(duration, currentTime + 5))}
          title="Forward 5s"
        >
          <SkipForward size={16} />
        </button>
        <span className="ed-time-display">
          {formatTimeMs(currentTime)} <span className="ed-time-sep">/</span> {formatTimeMs(duration)}
        </span>
        <select
          className="ed-speed-select"
          value={overlay?.playbackRate || 1}
          onChange={e => overlay?.setSpeed(parseFloat(e.target.value))}
        >
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => (
            <option key={r} value={r}>{r}x</option>
          ))}
        </select>
      </div>

      <div className="ed-toolbar-right">
        <button
          className="ed-toolbar-btn ed-export-btn"
          onClick={handleExport}
          disabled={exporting || !hasSyncData}
          title="Export EPUB 3"
        >
          {exporting ? <Loader size={15} className="spin" /> : <Download size={15} />}
          <span>Export</span>
        </button>
      </div>
    </div>
  );
}
