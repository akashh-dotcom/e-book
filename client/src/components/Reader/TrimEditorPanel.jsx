import { useState, useCallback } from 'react';
import { X, Scissors, RotateCcw, Download, Loader } from 'lucide-react';
import { formatTime } from '../../utils/timeFormatter';
import api from '../../services/api';

export default function TrimEditorPanel({
  bookId,
  chapterIndex,
  syncData,
  onClose,
  onTrimComplete,
  onSyncReload,
}) {
  const [skipSet, setSkipSet] = useState(() => {
    const set = new Set();
    if (syncData) {
      syncData.forEach(e => { if (e.skipped) set.add(e.id); });
    }
    return set;
  });
  const [lastClickedIdx, setLastClickedIdx] = useState(null);
  const [trimming, setTrimming] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState(null);

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

  const handleTrim = async () => {
    if (newSkipIds.length === 0) {
      setMessage({ type: 'error', text: 'No new words selected to skip' });
      return;
    }

    setTrimming(true);
    setMessage(null);
    try {
      const res = await api.post(`/audio/${bookId}/${chapterIndex}/trim`, {
        skipWordIds: newSkipIds,
      });
      setMessage({ type: 'success', text: `Trimmed ${res.data.skippedWords} words` });
      if (onTrimComplete) onTrimComplete(res.data.syncData);
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
      setSkipSet(new Set());
      setMessage({ type: 'success', text: 'Audio restored — please re-run sync' });
      if (onSyncReload) onSyncReload();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Restore failed' });
    } finally {
      setRestoring(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);
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
      setMessage({ type: 'success', text: 'EPUB 3 exported!' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Export failed' });
    } finally {
      setExporting(false);
    }
  };

  if (!syncData?.length) {
    return (
      <div className="trim-editor-panel">
        <div className="trim-editor-header">
          <span>Audio Editor</span>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="trim-editor-empty">No sync data available</div>
      </div>
    );
  }

  return (
    <div className="trim-editor-panel">
      <div className="trim-editor-header">
        <span><Scissors size={16} /> Audio Editor</span>
        <button className="icon-btn" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="trim-editor-hint">
        Click words to skip them. Shift+click for range. Skipped words will be removed from audio.
      </div>

      <div className="trim-word-list">
        {syncData.map((entry, idx) => {
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
                isAlreadySkipped
                  ? 'Already trimmed'
                  : entry.clipBegin !== null
                  ? `${formatTime(entry.clipBegin)} - ${formatTime(entry.clipEnd)}`
                  : 'No timing'
              }
            >
              {entry.word}
            </button>
          );
        })}
      </div>

      {message && (
        <div className={`trim-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="trim-editor-actions">
        <button
          className="trim-action-btn primary"
          onClick={handleTrim}
          disabled={trimming || newSkipIds.length === 0}
        >
          {trimming ? <><Loader size={14} className="spin" /> Trimming...</> : <><Scissors size={14} /> Apply Trim ({newSkipIds.length})</>}
        </button>

        <button
          className="trim-action-btn secondary"
          onClick={handleRestore}
          disabled={restoring}
        >
          {restoring ? <><Loader size={14} className="spin" /> Restoring...</> : <><RotateCcw size={14} /> Restore Original</>}
        </button>

        <button
          className="trim-action-btn export"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? <><Loader size={14} className="spin" /> Exporting...</> : <><Download size={14} /> Export EPUB 3</>}
        </button>
      </div>
    </div>
  );
}
