import { useState, useRef, useCallback } from 'react';
import { X, Scissors, RotateCcw, Loader, Play, Pause } from 'lucide-react';
import { formatTime } from '../../utils/timeFormatter';
import api from '../../services/api';

export default function TrimEditorPanel({
  bookId,
  chapterIndex,
  overlay,
  onClose,
  onTrimDone,
}) {
  const [trimStart, setTrimStart] = useState(null);
  const [trimEnd, setTrimEnd] = useState(null);
  const [trimming, setTrimming] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState(null);
  const [dragging, setDragging] = useState(null); // 'start' | 'end' | null
  const barRef = useRef(null);

  const duration = overlay?.duration || 0;
  const currentTime = overlay?.currentTime || 0;

  const pct = (t) => duration ? (t / duration) * 100 : 0;

  const timeFromEvent = useCallback((e) => {
    if (!barRef.current || !duration) return 0;
    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    return (x / rect.width) * duration;
  }, [duration]);

  const handleBarClick = useCallback((e) => {
    if (dragging) return;
    const t = timeFromEvent(e);
    overlay?.seek(t);
  }, [dragging, timeFromEvent, overlay]);

  const handleMouseDown = useCallback((which, e) => {
    e.stopPropagation();
    setDragging(which);

    const onMove = (ev) => {
      const t = +timeFromEvent(ev).toFixed(2);
      if (which === 'start') setTrimStart(t);
      else setTrimEnd(t);
    };
    const onUp = () => {
      setDragging(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [timeFromEvent]);

  const setStartHere = () => setTrimStart(+currentTime.toFixed(2));
  const setEndHere = () => setTrimEnd(+currentTime.toFixed(2));
  const clearRange = () => { setTrimStart(null); setTrimEnd(null); setMessage(null); };

  const canTrim = trimStart !== null && trimEnd !== null && trimEnd > trimStart;

  const handleTrim = async () => {
    if (!canTrim) return;
    setTrimming(true);
    setMessage(null);
    try {
      const res = await api.post(`/audio/${bookId}/${chapterIndex}/trim`, {
        trimStart,
        trimEnd,
      });
      const removed = (trimEnd - trimStart).toFixed(1);
      setMessage({ type: 'success', text: `Removed ${removed}s — re-sync to update word alignment` });
      setTrimStart(null);
      setTrimEnd(null);
      if (onTrimDone) onTrimDone(res.data.newDuration);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Trim failed' });
    } finally {
      setTrimming(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setMessage(null);
    try {
      await api.post(`/audio/${bookId}/${chapterIndex}/restore`);
      setTrimStart(null);
      setTrimEnd(null);
      setMessage({ type: 'success', text: 'Audio restored to original' });
      if (onTrimDone) onTrimDone(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Restore failed' });
    } finally {
      setRestoring(false);
    }
  };

  // Preview the trimmed range
  const handlePreviewRange = () => {
    if (trimStart !== null) {
      overlay?.seek(trimStart);
      if (!overlay?.isPlaying) overlay?.play();
    }
  };

  return (
    <div className="trim-editor-panel">
      <div className="trim-editor-header">
        <span><Scissors size={16} /> Audio Trim</span>
        <button className="icon-btn" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="trim-editor-hint">
        Set start & end points, then cut the selected range from the audio. Re-sync afterwards.
      </div>

      {/* Timeline / Waveform bar */}
      <div className="trim-timeline-section">
        <div className="trim-time-label">{formatTime(currentTime)} / {formatTime(duration)}</div>
        <div
          className="trim-timeline"
          ref={barRef}
          onClick={handleBarClick}
        >
          {/* Playhead */}
          <div className="trim-playhead" style={{ left: `${pct(currentTime)}%` }} />

          {/* Selected range highlight */}
          {trimStart !== null && trimEnd !== null && trimEnd > trimStart && (
            <div
              className="trim-range-highlight"
              style={{
                left: `${pct(trimStart)}%`,
                width: `${pct(trimEnd) - pct(trimStart)}%`,
              }}
            />
          )}

          {/* Start handle */}
          {trimStart !== null && (
            <div
              className="trim-handle trim-handle-start"
              style={{ left: `${pct(trimStart)}%` }}
              onMouseDown={(e) => handleMouseDown('start', e)}
              title={`Start: ${formatTime(trimStart)}`}
            >
              <div className="trim-handle-label">S</div>
            </div>
          )}

          {/* End handle */}
          {trimEnd !== null && (
            <div
              className="trim-handle trim-handle-end"
              style={{ left: `${pct(trimEnd)}%` }}
              onMouseDown={(e) => handleMouseDown('end', e)}
              title={`End: ${formatTime(trimEnd)}`}
            >
              <div className="trim-handle-label">E</div>
            </div>
          )}
        </div>
      </div>

      {/* Control buttons */}
      <div className="trim-set-buttons">
        <button className="trim-set-btn" onClick={setStartHere}>
          Set Start ({formatTime(currentTime)})
        </button>
        <button className="trim-set-btn" onClick={setEndHere}>
          Set End ({formatTime(currentTime)})
        </button>
        {(trimStart !== null || trimEnd !== null) && (
          <button className="trim-set-btn clear" onClick={clearRange}>
            Clear
          </button>
        )}
      </div>

      {/* Range info */}
      {canTrim && (
        <div className="trim-range-info">
          <span>Removing: {formatTime(trimStart)} — {formatTime(trimEnd)} ({(trimEnd - trimStart).toFixed(1)}s)</span>
          <button className="trim-preview-btn" onClick={handlePreviewRange} title="Preview from start marker">
            <Play size={14} /> Preview
          </button>
        </div>
      )}

      {message && (
        <div className={`trim-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="trim-editor-actions">
        <button
          className="trim-action-btn primary"
          onClick={handleTrim}
          disabled={trimming || !canTrim}
        >
          {trimming ? <><Loader size={14} className="spin" /> Trimming...</> : <><Scissors size={14} /> Cut Selected Range</>}
        </button>

        <button
          className="trim-action-btn secondary"
          onClick={handleRestore}
          disabled={restoring}
        >
          {restoring ? <><Loader size={14} className="spin" /> Restoring...</> : <><RotateCcw size={14} /> Restore Original</>}
        </button>
      </div>
    </div>
  );
}
