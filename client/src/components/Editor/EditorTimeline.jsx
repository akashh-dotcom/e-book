import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Scissors, Play, RotateCcw, Loader, RefreshCw, ZoomIn, ZoomOut,
} from 'lucide-react';
import { formatTimeMs, parseTimeMs } from '../../utils/timeFormatter';
import api from '../../services/api';

export default function EditorTimeline({
  bookId,
  chapterIndex,
  overlay,
  syncData,
  onTrimDone,
  onReSync,
  reSyncing,
}) {
  const [trimStart, setTrimStart] = useState(null);
  const [trimEnd, setTrimEnd] = useState(null);
  const [trimStartInput, setTrimStartInput] = useState('');
  const [trimEndInput, setTrimEndInput] = useState('');
  const [trimming, setTrimming] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [scrollLeft, setScrollLeft] = useState(0);
  const trackRef = useRef(null);
  const scrollRef = useRef(null);

  const duration = overlay?.duration || 0;
  const currentTime = overlay?.currentTime || 0;

  // Sync text inputs with trim values
  useEffect(() => {
    if (trimStart !== null) setTrimStartInput(formatTimeMs(trimStart));
    else setTrimStartInput('');
  }, [trimStart]);
  useEffect(() => {
    if (trimEnd !== null) setTrimEndInput(formatTimeMs(trimEnd));
    else setTrimEndInput('');
  }, [trimEnd]);

  // Auto-scroll timeline to keep playhead in view
  useEffect(() => {
    if (!scrollRef.current || !duration) return;
    const container = scrollRef.current;
    const containerWidth = container.clientWidth;
    const totalWidth = containerWidth * zoom;
    const playheadX = (currentTime / duration) * totalWidth;
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + containerWidth;
    if (playheadX < viewLeft + 40 || playheadX > viewRight - 40) {
      container.scrollLeft = playheadX - containerWidth / 2;
    }
  }, [currentTime, duration, zoom]);

  const pct = (t) => duration ? (t / duration) * 100 : 0;

  const timeFromEvent = useCallback((e) => {
    if (!trackRef.current || !duration) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    return (x / rect.width) * duration;
  }, [duration]);

  const handleTrackClick = useCallback((e) => {
    if (dragging) return;
    overlay?.seek(timeFromEvent(e));
  }, [dragging, timeFromEvent, overlay]);

  const handleMouseDown = useCallback((which, e) => {
    e.stopPropagation();
    setDragging(which);
    const onMove = (ev) => {
      const t = +timeFromEvent(ev).toFixed(3);
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

  const canTrim = trimStart !== null && trimEnd !== null && trimEnd > trimStart;

  const handleTrim = async () => {
    if (!canTrim) return;
    setTrimming(true);
    setMessage(null);
    try {
      const res = await api.post(`/audio/${bookId}/${chapterIndex}/trim`, { trimStart, trimEnd });
      setMessage({ type: 'success', text: `Cut ${(trimEnd - trimStart).toFixed(3)}s` });
      setTrimStart(null);
      setTrimEnd(null);
      if (onTrimDone) onTrimDone(res.data);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Trim failed' });
    } finally { setTrimming(false); }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setMessage(null);
    try {
      await api.post(`/audio/${bookId}/${chapterIndex}/restore`);
      setTrimStart(null);
      setTrimEnd(null);
      setMessage({ type: 'success', text: 'Restored original' });
      if (onTrimDone) onTrimDone(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Restore failed' });
    } finally { setRestoring(false); }
  };

  // Build word markers for the timeline
  const wordMarkers = syncData?.filter(e => e.clipBegin !== null && !e.skipped) || [];

  // Generate time ruler ticks
  const ticks = [];
  if (duration > 0) {
    const step = duration <= 30 ? 1 : duration <= 120 ? 5 : duration <= 600 ? 10 : 30;
    for (let t = 0; t <= duration; t += step) {
      ticks.push(t);
    }
  }

  return (
    <div className="ed-timeline">
      {/* Timeline controls bar */}
      <div className="ed-timeline-controls">
        <div className="ed-timeline-left-controls">
          <div className="ed-trim-input-group">
            <label>Start</label>
            <input
              type="text"
              className="ed-trim-time-input"
              placeholder="0:00.000"
              value={trimStartInput}
              onChange={(e) => setTrimStartInput(e.target.value)}
              onBlur={() => {
                const t = parseTimeMs(trimStartInput);
                if (!isNaN(t) && t >= 0 && t <= duration) {
                  setTrimStart(+t.toFixed(3));
                } else if (trimStart !== null) {
                  setTrimStartInput(formatTimeMs(trimStart));
                }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            />
            <button className="ed-use-current-btn" onClick={() => {
              const t = +currentTime.toFixed(3);
              setTrimStart(t);
            }} title="Set start to current time">S</button>
          </div>
          <div className="ed-trim-input-group">
            <label>End</label>
            <input
              type="text"
              className="ed-trim-time-input"
              placeholder="0:00.000"
              value={trimEndInput}
              onChange={(e) => setTrimEndInput(e.target.value)}
              onBlur={() => {
                const t = parseTimeMs(trimEndInput);
                if (!isNaN(t) && t >= 0 && t <= duration) {
                  setTrimEnd(+t.toFixed(3));
                } else if (trimEnd !== null) {
                  setTrimEndInput(formatTimeMs(trimEnd));
                }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            />
            <button className="ed-use-current-btn" onClick={() => {
              const t = +currentTime.toFixed(3);
              setTrimEnd(t);
            }} title="Set end to current time">E</button>
          </div>
          {canTrim && (
            <span className="ed-trim-duration">
              {(trimEnd - trimStart).toFixed(3)}s selected
            </span>
          )}
        </div>

        <div className="ed-timeline-right-controls">
          {message && (
            <span className={`ed-timeline-msg ${message.type}`}>{message.text}</span>
          )}
          <button
            className="ed-timeline-btn ed-trim-btn"
            onClick={handleTrim}
            disabled={trimming || !canTrim}
            title="Cut selected range"
          >
            {trimming ? <Loader size={14} className="spin" /> : <Scissors size={14} />}
            <span>Cut</span>
          </button>
          {canTrim && (
            <button
              className="ed-timeline-btn ed-preview-btn"
              onClick={() => { overlay?.seek(trimStart); if (!overlay?.isPlaying) overlay?.play(); }}
              title="Preview from start point"
            >
              <Play size={14} />
            </button>
          )}
          {(trimStart !== null || trimEnd !== null) && (
            <button
              className="ed-timeline-btn"
              onClick={() => { setTrimStart(null); setTrimEnd(null); setMessage(null); }}
              title="Clear selection"
            >
              Clear
            </button>
          )}
          <div className="ed-timeline-sep" />
          <button
            className="ed-timeline-btn ed-resync-btn"
            onClick={onReSync}
            disabled={reSyncing}
            title="Re-sync audio with text"
          >
            {reSyncing ? <Loader size={14} className="spin" /> : <RefreshCw size={14} />}
            <span>Re-Sync</span>
          </button>
          <button
            className="ed-timeline-btn ed-restore-btn"
            onClick={handleRestore}
            disabled={restoring}
            title="Restore original audio"
          >
            {restoring ? <Loader size={14} className="spin" /> : <RotateCcw size={14} />}
            <span>Restore</span>
          </button>
          <div className="ed-timeline-sep" />
          <button className="ed-timeline-btn" onClick={() => setZoom(z => Math.max(1, z - 0.5))} title="Zoom out">
            <ZoomOut size={14} />
          </button>
          <span className="ed-zoom-label">{zoom.toFixed(1)}x</span>
          <button className="ed-timeline-btn" onClick={() => setZoom(z => Math.min(10, z + 0.5))} title="Zoom in">
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      {/* Scrollable timeline track */}
      <div className="ed-timeline-scroll" ref={scrollRef}>
        <div
          className="ed-timeline-track"
          ref={trackRef}
          style={{ width: `${100 * zoom}%` }}
          onClick={handleTrackClick}
        >
          {/* Time ruler */}
          <div className="ed-ruler">
            {ticks.map(t => (
              <div
                key={t}
                className="ed-ruler-tick"
                style={{ left: `${pct(t)}%` }}
              >
                <span className="ed-ruler-label">{formatTimeMs(t)}</span>
              </div>
            ))}
          </div>

          {/* Word blocks */}
          <div className="ed-word-lane">
            {wordMarkers.map((entry) => {
              const left = pct(entry.clipBegin);
              const width = pct(entry.clipEnd) - left;
              const isActive = overlay?.activeWordId === entry.id;
              return (
                <div
                  key={entry.id}
                  className={`ed-word-block ${isActive ? 'active' : ''}`}
                  style={{ left: `${left}%`, width: `${Math.max(width, 0.15)}%` }}
                  title={`${entry.word} (${formatTimeMs(entry.clipBegin)} - ${formatTimeMs(entry.clipEnd)})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    overlay?.seek(entry.clipBegin);
                  }}
                >
                  <span className="ed-word-text">{entry.word}</span>
                </div>
              );
            })}
          </div>

          {/* Trim selection highlight */}
          {canTrim && (
            <div
              className="ed-trim-highlight"
              style={{
                left: `${pct(trimStart)}%`,
                width: `${pct(trimEnd) - pct(trimStart)}%`,
              }}
            />
          )}

          {/* Trim handles */}
          {trimStart !== null && (
            <div
              className="ed-trim-handle ed-handle-start"
              style={{ left: `${pct(trimStart)}%` }}
              onMouseDown={(e) => handleMouseDown('start', e)}
            >
              <div className="ed-handle-flag">S</div>
            </div>
          )}
          {trimEnd !== null && (
            <div
              className="ed-trim-handle ed-handle-end"
              style={{ left: `${pct(trimEnd)}%` }}
              onMouseDown={(e) => handleMouseDown('end', e)}
            >
              <div className="ed-handle-flag">E</div>
            </div>
          )}

          {/* Playhead */}
          <div className="ed-playhead" style={{ left: `${pct(currentTime)}%` }}>
            <div className="ed-playhead-head" />
          </div>
        </div>
      </div>
    </div>
  );
}
