import { Play, Pause, SkipBack, SkipForward, Scissors } from 'lucide-react';
import { formatTime } from '../../utils/timeFormatter';

export default function AudioBar({ overlay, onToggleTrimEditor, trimEditorOpen }) {
  if (!overlay) return null;

  const { isPlaying, currentTime, duration, playbackRate, togglePlay, seek, setSpeed } = overlay;
  const progress = duration ? (currentTime / duration) * 100 : 0;

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
          title="Audio Editor & Export"
        >
          <Scissors size={16} />
        </button>
      )}
    </div>
  );
}
