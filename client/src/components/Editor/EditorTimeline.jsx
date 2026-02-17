import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  Scissors, Play, RotateCcw, Loader, RefreshCw, ZoomIn, ZoomOut,
} from 'lucide-react';
import { formatTimeMs, formatRulerLabel, parseTimeMs } from '../../utils/timeFormatter';
import api from '../../services/api';

// ---- Zoom constants ----
const MIN_ZOOM = 1;
const MAX_ZOOM = 200;       // enough precision for hours-long audio
const WHEEL_ZOOM_FACTOR = 1.15; // 15% per scroll tick
const BTN_ZOOM_FACTOR = 1.5;    // 50% per button click

// ---- Ruler step table (seconds) — picks the best step so ticks aren't too dense ----
const STEP_TABLE = [
  0.01, 0.02, 0.05, 0.1, 0.2, 0.5,
  1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600,
];

/** Pick a ruler step so there are roughly 8–20 ticks visible */
function pickRulerStep(visibleDuration) {
  const idealCount = 12;
  const idealStep = visibleDuration / idealCount;
  for (const s of STEP_TABLE) {
    if (s >= idealStep) return s;
  }
  return STEP_TABLE[STEP_TABLE.length - 1];
}

export default function EditorTimeline({
  bookId,
  chapterIndex,
  overlay,
  syncData,
  onTrimDone,
  onReSync,
  reSyncing,
}) {
  // Clip edges: the "keep" region (Canva-style drag from edges)
  const [clipLeft, setClipLeft] = useState(0);
  const [clipRight, setClipRight] = useState(null); // null = full duration
  // Manual S/E inputs (linked to clip edges)
  const [trimStartInput, setTrimStartInput] = useState('');
  const [trimEndInput, setTrimEndInput] = useState('');
  const [trimming, setTrimming] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState(null);
  const [dragging, setDragging] = useState(null); // 'playhead' | 'clipLeft' | 'clipRight'
  const [zoom, setZoom] = useState(1);
  const trackRef = useRef(null);
  const scrollRef = useRef(null);
  // Ref to store the desired scroll position during zoom — applied in useLayoutEffect
  const pendingScrollRef = useRef(null);
  const prevZoomRef = useRef(1);

  const duration = overlay?.duration || 0;
  const currentTime = overlay?.currentTime || 0;
  const effectiveRight = clipRight !== null ? clipRight : duration;

  // Sync inputs with clip edges
  useEffect(() => {
    if (clipLeft > 0) setTrimStartInput(formatTimeMs(clipLeft));
    else setTrimStartInput('');
  }, [clipLeft]);
  useEffect(() => {
    if (clipRight !== null && clipRight < duration) setTrimEndInput(formatTimeMs(clipRight));
    else setTrimEndInput('');
  }, [clipRight, duration]);

  // Reset clip edges when duration changes (new audio loaded)
  useEffect(() => {
    setClipLeft(0);
    setClipRight(null);
  }, [duration]);

  // Apply pending scroll position synchronously after DOM update (before paint).
  // This runs BEFORE useEffect, so it wins over auto-scroll.
  useLayoutEffect(() => {
    if (pendingScrollRef.current !== null && scrollRef.current) {
      scrollRef.current.scrollLeft = pendingScrollRef.current;
      pendingScrollRef.current = null;
    }
    prevZoomRef.current = zoom;
  }, [zoom]);

  // Auto-scroll timeline to keep playhead in view during playback.
  // Skip when zoom just changed (prevZoomRef handles that via useLayoutEffect above).
  useEffect(() => {
    if (!scrollRef.current || !duration) return;
    // Don't fight zoom scroll — only auto-scroll on time changes
    if (prevZoomRef.current !== zoom) return;
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

  // Has the user moved the edges? i.e. something to trim
  const hasTrim = clipLeft > 0.01 || (clipRight !== null && clipRight < duration - 0.01);

  // Compute what to cut
  const trimRanges = [];
  if (clipLeft > 0.01) trimRanges.push({ start: 0, end: clipLeft });
  if (clipRight !== null && clipRight < duration - 0.01) trimRanges.push({ start: clipRight, end: duration });

  // ---- Ctrl/Cmd + Scroll-wheel zoom (centered on cursor) ----
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const scrollBefore = container.scrollLeft;
      const cursorWorldX = cursorX + scrollBefore;
      const oldZoom = zoom;

      const factor = e.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * factor));

      // Store desired scroll — useLayoutEffect applies it before paint
      const scale = newZoom / oldZoom;
      pendingScrollRef.current = cursorWorldX * scale - cursorX;
      setZoom(newZoom);
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [zoom]);

  // ---- Zoom button handlers (centered on current scroll center) ----
  const zoomBy = useCallback((factor) => {
    const container = scrollRef.current;
    if (!container) return;
    const oldZoom = zoom;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * factor));
    const containerWidth = container.clientWidth;
    const centerX = container.scrollLeft + containerWidth / 2;

    const scale = newZoom / oldZoom;
    pendingScrollRef.current = centerX * scale - containerWidth / 2;
    setZoom(newZoom);
  }, [zoom]);

  // ---- Zoom-aware ruler ticks ----
  const ticks = useMemo(() => {
    if (!duration || !scrollRef.current) return [];
    const containerWidth = scrollRef.current?.clientWidth || 800;
    const visibleDuration = duration / zoom;
    const step = pickRulerStep(visibleDuration);
    const result = [];
    // Generate ticks for the full duration
    const count = Math.ceil(duration / step);
    // Cap at 500 ticks to avoid perf issues on extreme zoom
    const safeStep = count > 500 ? (duration / 500) : step;
    for (let t = 0; t <= duration + safeStep * 0.01; t += safeStep) {
      result.push({ time: +t.toFixed(4), step: safeStep });
    }
    return result;
  }, [duration, zoom]);

  // --- Drag handlers ---

  // Click on track = seek + drag-to-scrub
  const handleTrackMouseDown = useCallback((e) => {
    if (dragging) return;
    const t = timeFromEvent(e);
    overlay?.seek(t);
    setDragging('playhead');
    const onMove = (ev) => overlay?.seek(timeFromEvent(ev));
    const onUp = () => {
      setDragging(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [dragging, timeFromEvent, overlay]);

  // Drag playhead
  const handlePlayheadMouseDown = useCallback((e) => {
    e.stopPropagation();
    setDragging('playhead');
    const onMove = (ev) => overlay?.seek(timeFromEvent(ev));
    const onUp = () => {
      setDragging(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [timeFromEvent, overlay]);

  // Drag clip LEFT edge (trim from beginning)
  const handleClipLeftMouseDown = useCallback((e) => {
    e.stopPropagation();
    setDragging('clipLeft');
    const onMove = (ev) => {
      const t = Math.max(0, Math.min(timeFromEvent(ev), effectiveRight - 0.1));
      setClipLeft(+t.toFixed(3));
    };
    const onUp = () => {
      setDragging(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [timeFromEvent, effectiveRight]);

  // Drag clip RIGHT edge (trim from end)
  const handleClipRightMouseDown = useCallback((e) => {
    e.stopPropagation();
    setDragging('clipRight');
    const onMove = (ev) => {
      const t = Math.min(duration, Math.max(timeFromEvent(ev), clipLeft + 0.1));
      setClipRight(+t.toFixed(3));
    };
    const onUp = () => {
      setDragging(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [timeFromEvent, duration, clipLeft]);

  // --- Trim actions ---

  const handleTrim = async () => {
    if (!hasTrim) return;
    setTrimming(true);
    setMessage(null);
    try {
      if (clipRight !== null && clipRight < duration - 0.01) {
        const res = await api.post(`/audio/${bookId}/${chapterIndex}/trim`, {
          trimStart: clipRight,
          trimEnd: duration,
        });
        if (onTrimDone) onTrimDone(res.data);
      }
      if (clipLeft > 0.01) {
        const res = await api.post(`/audio/${bookId}/${chapterIndex}/trim`, {
          trimStart: 0,
          trimEnd: clipLeft,
        });
        if (onTrimDone) onTrimDone(res.data);
      }
      const removedTotal = clipLeft + (duration - effectiveRight);
      setMessage({ type: 'success', text: `Trimmed ${removedTotal.toFixed(3)}s` });
      setClipLeft(0);
      setClipRight(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Trim failed' });
    } finally { setTrimming(false); }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setMessage(null);
    try {
      await api.post(`/audio/${bookId}/${chapterIndex}/restore`);
      setClipLeft(0);
      setClipRight(null);
      setMessage({ type: 'success', text: 'Restored original' });
      if (onTrimDone) onTrimDone(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Restore failed' });
    } finally { setRestoring(false); }
  };

  // Build word markers for the timeline
  const wordMarkers = syncData?.filter(e => e.clipBegin !== null && !e.skipped) || [];

  // Format zoom label nicely
  const zoomLabel = zoom >= 100 ? `${Math.round(zoom)}x`
    : zoom >= 10 ? `${zoom.toFixed(1)}x`
    : `${zoom.toFixed(1)}x`;

  return (
    <div className="ed-timeline">
      {/* Timeline controls bar */}
      <div className="ed-timeline-controls">
        <div className="ed-timeline-left-controls">
          <div className="ed-trim-input-group">
            <label>Keep from</label>
            <input
              type="text"
              className="ed-trim-time-input"
              placeholder="0:00.000"
              value={trimStartInput}
              onChange={(e) => setTrimStartInput(e.target.value)}
              onBlur={() => {
                const t = parseTimeMs(trimStartInput);
                if (!isNaN(t) && t >= 0 && t < effectiveRight) {
                  setClipLeft(+t.toFixed(3));
                } else {
                  setTrimStartInput(clipLeft > 0 ? formatTimeMs(clipLeft) : '');
                }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            />
          </div>
          <div className="ed-trim-input-group">
            <label>to</label>
            <input
              type="text"
              className="ed-trim-time-input"
              placeholder={formatTimeMs(duration)}
              value={trimEndInput}
              onChange={(e) => setTrimEndInput(e.target.value)}
              onBlur={() => {
                const t = parseTimeMs(trimEndInput);
                if (!isNaN(t) && t > clipLeft && t <= duration) {
                  setClipRight(+t.toFixed(3));
                } else {
                  setTrimEndInput(clipRight !== null && clipRight < duration ? formatTimeMs(clipRight) : '');
                }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            />
          </div>
          {hasTrim && (
            <span className="ed-trim-duration">
              Removing {(clipLeft + (duration - effectiveRight)).toFixed(3)}s
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
            disabled={trimming || !hasTrim}
            title="Apply trim"
          >
            {trimming ? <Loader size={14} className="spin" /> : <Scissors size={14} />}
            <span>Apply Trim</span>
          </button>
          {hasTrim && (
            <>
              <button
                className="ed-timeline-btn ed-preview-btn"
                onClick={() => { overlay?.seek(clipLeft); if (!overlay?.isPlaying) overlay?.play(); }}
                title="Preview from clip start"
              >
                <Play size={14} />
              </button>
              <button
                className="ed-timeline-btn"
                onClick={() => { setClipLeft(0); setClipRight(null); setMessage(null); }}
                title="Reset clip edges"
              >
                Reset
              </button>
            </>
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
          <button className="ed-timeline-btn" onClick={() => zoomBy(1 / BTN_ZOOM_FACTOR)} title="Zoom out (or Ctrl+scroll)">
            <ZoomOut size={14} />
          </button>
          <span className="ed-zoom-label">{zoomLabel}</span>
          <button className="ed-timeline-btn" onClick={() => zoomBy(BTN_ZOOM_FACTOR)} title="Zoom in (or Ctrl+scroll)">
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
          onMouseDown={handleTrackMouseDown}
        >
          {/* Time ruler — zoom-aware ticks */}
          <div className="ed-ruler">
            {ticks.map(({ time, step }) => (
              <div
                key={time}
                className="ed-ruler-tick"
                style={{ left: `${pct(time)}%` }}
              >
                <span className="ed-ruler-label">{formatRulerLabel(time, step)}</span>
              </div>
            ))}
          </div>

          {/* === AUDIO CLIP BAR (Canva-style) === */}
          <div className="ed-clip-lane">
            {/* Dimmed-out left region (will be trimmed) */}
            {clipLeft > 0.01 && (
              <div
                className="ed-clip-dimmed"
                style={{ left: 0, width: `${pct(clipLeft)}%` }}
              />
            )}

            {/* Dimmed-out right region (will be trimmed) */}
            {clipRight !== null && clipRight < duration - 0.01 && (
              <div
                className="ed-clip-dimmed"
                style={{ left: `${pct(clipRight)}%`, width: `${100 - pct(clipRight)}%` }}
              />
            )}

            {/* Active clip region (just visual, word blocks inside) */}
            <div
              className="ed-clip-active"
              style={{
                left: `${pct(clipLeft)}%`,
                width: `${pct(effectiveRight) - pct(clipLeft)}%`,
              }}
            >
              {wordMarkers.map((entry) => {
                const clipSpan = effectiveRight - clipLeft;
                if (!clipSpan || entry.clipEnd < clipLeft || entry.clipBegin > effectiveRight) return null;
                const blockLeft = ((entry.clipBegin - clipLeft) / clipSpan) * 100;
                const blockWidth = ((entry.clipEnd - entry.clipBegin) / clipSpan) * 100;
                const isActive = overlay?.activeWordId === entry.id;
                return (
                  <div
                    key={entry.id}
                    className={`ed-word-block ${isActive ? 'active' : ''}`}
                    style={{
                      left: `${Math.max(0, blockLeft)}%`,
                      width: `${Math.max(blockWidth, 0.3)}%`,
                    }}
                    title={`${entry.word} (${formatTimeMs(entry.clipBegin)} - ${formatTimeMs(entry.clipEnd)})`}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      overlay?.seek(entry.clipBegin);
                    }}
                  >
                    <span className="ed-word-text">{entry.word}</span>
                  </div>
                );
              })}
            </div>

            {/* LEFT edge handle */}
            <div
              className="ed-clip-edge ed-clip-edge-left"
              style={{ left: `${pct(clipLeft)}%` }}
              onMouseDown={handleClipLeftMouseDown}
              title={`Drag to trim start (${formatTimeMs(clipLeft)})`}
            >
              <div className="ed-clip-edge-grip">
                <span /><span /><span />
              </div>
            </div>

            {/* RIGHT edge handle */}
            <div
              className="ed-clip-edge ed-clip-edge-right"
              style={{ left: `${pct(effectiveRight)}%` }}
              onMouseDown={handleClipRightMouseDown}
              title={`Drag to trim end (${formatTimeMs(effectiveRight)})`}
            >
              <div className="ed-clip-edge-grip">
                <span /><span /><span />
              </div>
            </div>
          </div>

          {/* Playhead */}
          <div
            className={`ed-playhead ${dragging === 'playhead' ? 'dragging' : ''}`}
            style={{ left: `${pct(currentTime)}%` }}
            onMouseDown={handlePlayheadMouseDown}
          >
            <div className="ed-playhead-tooltip">{formatTimeMs(currentTime)}</div>
            <div className="ed-playhead-head" />
          </div>
        </div>
      </div>
    </div>
  );
}
