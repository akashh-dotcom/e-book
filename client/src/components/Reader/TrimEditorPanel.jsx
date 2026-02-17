import { useState, useRef, useCallback } from 'react';
import { X, Scissors, RotateCcw, Loader, Play, RefreshCw, Type, Clock } from 'lucide-react';
import { formatTime } from '../../utils/timeFormatter';
import api from '../../services/api';

export default function TrimEditorPanel({
  bookId,
  chapterIndex,
  overlay,
  syncData,
  onClose,
  onTrimDone,
  onReSync,
  reSyncing,
}) {
  const [mode, setMode] = useState('direct'); // 'direct' | 'word'
  // Direct trim state
  const [trimStart, setTrimStart] = useState(null);
  const [trimEnd, setTrimEnd] = useState(null);
  // Word trim state
  const [skipSet, setSkipSet] = useState(() => {
    const set = new Set();
    if (syncData) syncData.forEach(e => { if (e.skipped) set.add(e.id); });
    return set;
  });
  const [lastClickedIdx, setLastClickedIdx] = useState(null);
  // Shared state
  const [trimming, setTrimming] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState(null);
  const [dragging, setDragging] = useState(null);
  const barRef = useRef(null);

  const duration = overlay?.duration || 0;
  const currentTime = overlay?.currentTime || 0;
  const pct = (t) => duration ? (t / duration) * 100 : 0;

  // --- Direct trim helpers ---
  const timeFromEvent = useCallback((e) => {
    if (!barRef.current || !duration) return 0;
    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    return (x / rect.width) * duration;
  }, [duration]);

  const handleBarClick = useCallback((e) => {
    if (dragging) return;
    overlay?.seek(timeFromEvent(e));
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

  const canDirectTrim = trimStart !== null && trimEnd !== null && trimEnd > trimStart;

  const handleDirectTrim = async () => {
    if (!canDirectTrim) return;
    setTrimming(true);
    setMessage(null);
    try {
      const res = await api.post(`/audio/${bookId}/${chapterIndex}/trim`, { trimStart, trimEnd });
      setMessage({ type: 'success', text: `Removed ${(trimEnd - trimStart).toFixed(1)}s — click Re-Sync` });
      setTrimStart(null);
      setTrimEnd(null);
      if (onTrimDone) onTrimDone(res.data);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Trim failed' });
    } finally { setTrimming(false); }
  };

  // --- Word trim helpers ---
  const toggleWord = useCallback((id, index, shiftKey) => {
    setSkipSet(prev => {
      const next = new Set(prev);
      if (shiftKey && lastClickedIdx !== null && syncData) {
        const start = Math.min(lastClickedIdx, index);
        const end = Math.max(lastClickedIdx, index);
        const shouldSkip = !prev.has(id);
        for (let i = start; i <= end; i++) {
          const entry = syncData[i];
          if (entry && !entry.skipped && entry.clipBegin !== null) {
            if (shouldSkip) next.add(entry.id);
            else next.delete(entry.id);
          }
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    setLastClickedIdx(index);
  }, [lastClickedIdx, syncData]);

  const newSkipIds = syncData
    ? [...skipSet].filter(id => {
        const entry = syncData.find(e => e.id === id);
        return entry && !entry.skipped;
      })
    : [];

  const handleWordTrim = async () => {
    if (newSkipIds.length === 0) return;
    setTrimming(true);
    setMessage(null);
    try {
      const res = await api.post(`/audio/${bookId}/${chapterIndex}/trim`, { skipWordIds: newSkipIds });
      setMessage({ type: 'success', text: `Trimmed ${newSkipIds.length} words` });
      if (onTrimDone) onTrimDone(res.data);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Trim failed' });
    } finally { setTrimming(false); }
  };

  // --- Shared ---
  const handleRestore = async () => {
    setRestoring(true);
    setMessage(null);
    try {
      await api.post(`/audio/${bookId}/${chapterIndex}/restore`);
      setTrimStart(null);
      setTrimEnd(null);
      setSkipSet(new Set());
      setMessage({ type: 'success', text: 'Audio restored to original' });
      if (onTrimDone) onTrimDone(null);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Restore failed' });
    } finally { setRestoring(false); }
  };

  return (
    <div className="trim-editor-panel">
      <div className="trim-editor-header">
        <span><Scissors size={16} /> Audio Editor</span>
        <button className="icon-btn" onClick={onClose}><X size={18} /></button>
      </div>

      {/* Mode toggle tabs */}
      <div className="trim-mode-tabs">
        <button
          className={`trim-tab ${mode === 'direct' ? 'active' : ''}`}
          onClick={() => setMode('direct')}
        >
          <Clock size={14} /> Direct Trim
        </button>
        <button
          className={`trim-tab ${mode === 'word' ? 'active' : ''}`}
          onClick={() => setMode('word')}
          disabled={!syncData?.length}
          title={!syncData?.length ? 'Sync data required' : ''}
        >
          <Type size={14} /> Word Trim
        </button>
      </div>

      {/* ===== DIRECT TRIM MODE ===== */}
      {mode === 'direct' && (
        <>
          <div className="trim-editor-hint">
            Set start & end points on the timeline, then cut that range.
          </div>

          <div className="trim-timeline-section">
            <div className="trim-time-label">{formatTime(currentTime)} / {formatTime(duration)}</div>
            <div className="trim-timeline" ref={barRef} onClick={handleBarClick}>
              <div className="trim-playhead" style={{ left: `${pct(currentTime)}%` }} />
              {canDirectTrim && (
                <div className="trim-range-highlight" style={{
                  left: `${pct(trimStart)}%`,
                  width: `${pct(trimEnd) - pct(trimStart)}%`,
                }} />
              )}
              {trimStart !== null && (
                <div className="trim-handle trim-handle-start" style={{ left: `${pct(trimStart)}%` }}
                  onMouseDown={(e) => handleMouseDown('start', e)} title={`Start: ${formatTime(trimStart)}`}>
                  <div className="trim-handle-label">S</div>
                </div>
              )}
              {trimEnd !== null && (
                <div className="trim-handle trim-handle-end" style={{ left: `${pct(trimEnd)}%` }}
                  onMouseDown={(e) => handleMouseDown('end', e)} title={`End: ${formatTime(trimEnd)}`}>
                  <div className="trim-handle-label">E</div>
                </div>
              )}
            </div>
          </div>

          <div className="trim-set-buttons">
            <button className="trim-set-btn" onClick={() => setTrimStart(+currentTime.toFixed(2))}>
              Set Start ({formatTime(currentTime)})
            </button>
            <button className="trim-set-btn" onClick={() => setTrimEnd(+currentTime.toFixed(2))}>
              Set End ({formatTime(currentTime)})
            </button>
            {(trimStart !== null || trimEnd !== null) && (
              <button className="trim-set-btn clear" onClick={() => { setTrimStart(null); setTrimEnd(null); setMessage(null); }}>
                Clear
              </button>
            )}
          </div>

          {canDirectTrim && (
            <div className="trim-range-info">
              <span>Removing: {formatTime(trimStart)} — {formatTime(trimEnd)} ({(trimEnd - trimStart).toFixed(1)}s)</span>
              <button className="trim-preview-btn" onClick={() => { overlay?.seek(trimStart); if (!overlay?.isPlaying) overlay?.play(); }}>
                <Play size={14} /> Preview
              </button>
            </div>
          )}

          <div className="trim-editor-actions">
            <button className="trim-action-btn primary" onClick={handleDirectTrim} disabled={trimming || !canDirectTrim}>
              {trimming ? <><Loader size={14} className="spin" /> Trimming...</> : <><Scissors size={14} /> Cut Selected Range</>}
            </button>
          </div>
        </>
      )}

      {/* ===== WORD TRIM MODE ===== */}
      {mode === 'word' && (
        <>
          <div className="trim-editor-hint">
            Click words to skip. Shift+click for range. Skipped words are removed from audio.
          </div>

          <div className="trim-word-list">
            {syncData?.map((entry, idx) => {
              const isAlreadySkipped = entry.skipped;
              const isNewSkip = !isAlreadySkipped && skipSet.has(entry.id);
              const hasNoTiming = entry.clipBegin === null && !isAlreadySkipped;
              return (
                <button
                  key={entry.id}
                  className={
                    'trim-word-chip' +
                    (isAlreadySkipped ? ' skipped' : '') +
                    (isNewSkip ? ' will-skip' : '') +
                    (hasNoTiming ? ' no-timing' : '')
                  }
                  onClick={(e) => {
                    if (isAlreadySkipped) return;
                    toggleWord(entry.id, idx, e.shiftKey);
                  }}
                  disabled={isAlreadySkipped}
                  title={
                    isAlreadySkipped ? 'Already trimmed'
                    : entry.clipBegin !== null ? `${formatTime(entry.clipBegin)} - ${formatTime(entry.clipEnd)}`
                    : 'No timing'
                  }
                >
                  {entry.word}
                </button>
              );
            })}
          </div>

          <div className="trim-editor-actions">
            <button className="trim-action-btn primary" onClick={handleWordTrim} disabled={trimming || newSkipIds.length === 0}>
              {trimming ? <><Loader size={14} className="spin" /> Trimming...</> : <><Scissors size={14} /> Skip Words ({newSkipIds.length})</>}
            </button>
          </div>
        </>
      )}

      {/* ===== SHARED BOTTOM: message, re-sync, restore ===== */}
      {message && (
        <div className={`trim-message ${message.type}`}>{message.text}</div>
      )}

      <div className="trim-editor-bottom">
        {onReSync && (
          <button className="trim-action-btn resync" onClick={onReSync} disabled={reSyncing}>
            {reSyncing ? <><Loader size={14} className="spin" /> Syncing...</> : <><RefreshCw size={14} /> Re-Sync Audio</>}
          </button>
        )}
        <button className="trim-action-btn secondary" onClick={handleRestore} disabled={restoring}>
          {restoring ? <><Loader size={14} className="spin" /> Restoring...</> : <><RotateCcw size={14} /> Restore Original</>}
        </button>
      </div>
    </div>
  );
}
