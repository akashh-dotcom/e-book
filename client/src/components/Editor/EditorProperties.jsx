import { useState, useEffect } from 'react';
import {
  Type, Clock, MousePointer, Scissors, Info,
} from 'lucide-react';
import { formatTimeMs } from '../../utils/timeFormatter';

export default function EditorProperties({
  overlay,
  syncData,
  onWordClick,
}) {
  const [selectedWord, setSelectedWord] = useState(null);
  const activeWordId = overlay?.activeWordId;

  // Track active word from playback
  useEffect(() => {
    if (activeWordId && syncData) {
      const entry = syncData.find(e => e.id === activeWordId);
      if (entry) setSelectedWord(entry);
    }
  }, [activeWordId, syncData]);

  const totalWords = syncData?.length || 0;
  const syncedWords = syncData?.filter(e => e.clipBegin !== null).length || 0;
  const skippedWords = syncData?.filter(e => e.skipped).length || 0;

  return (
    <div className="ed-properties">
      <div className="ed-props-header">
        <Info size={14} />
        <span>Properties</span>
      </div>

      {/* Stats */}
      <div className="ed-props-section">
        <div className="ed-props-label">Statistics</div>
        <div className="ed-stats-grid">
          <div className="ed-stat">
            <span className="ed-stat-val">{totalWords}</span>
            <span className="ed-stat-label">Words</span>
          </div>
          <div className="ed-stat">
            <span className="ed-stat-val">{syncedWords}</span>
            <span className="ed-stat-label">Synced</span>
          </div>
          <div className="ed-stat">
            <span className="ed-stat-val">{skippedWords}</span>
            <span className="ed-stat-label">Skipped</span>
          </div>
          <div className="ed-stat">
            <span className="ed-stat-val">{formatTimeMs(overlay?.duration || 0)}</span>
            <span className="ed-stat-label">Duration</span>
          </div>
        </div>
      </div>

      {/* Selected word details */}
      {selectedWord && (
        <div className="ed-props-section">
          <div className="ed-props-label">
            <MousePointer size={12} /> Active Word
          </div>
          <div className="ed-word-detail">
            <div className="ed-word-detail-word">{selectedWord.word}</div>
            <div className="ed-word-detail-row">
              <span className="ed-detail-key">ID</span>
              <span className="ed-detail-val">{selectedWord.id}</span>
            </div>
            {selectedWord.clipBegin !== null && (
              <>
                <div className="ed-word-detail-row">
                  <span className="ed-detail-key">Start</span>
                  <span className="ed-detail-val mono">{formatTimeMs(selectedWord.clipBegin)}</span>
                </div>
                <div className="ed-word-detail-row">
                  <span className="ed-detail-key">End</span>
                  <span className="ed-detail-val mono">{formatTimeMs(selectedWord.clipEnd)}</span>
                </div>
                <div className="ed-word-detail-row">
                  <span className="ed-detail-key">Duration</span>
                  <span className="ed-detail-val mono">
                    {((selectedWord.clipEnd - selectedWord.clipBegin) * 1000).toFixed(0)}ms
                  </span>
                </div>
              </>
            )}
            {selectedWord.skipped && (
              <div className="ed-word-badge skipped">Skipped</div>
            )}
          </div>
        </div>
      )}

      {/* Word list (scrollable) */}
      {syncData && syncData.length > 0 && (
        <div className="ed-props-section ed-word-list-section">
          <div className="ed-props-label">
            <Type size={12} /> Word Timeline
          </div>
          <div className="ed-word-list">
            {syncData.map((entry) => {
              const isActive = entry.id === activeWordId;
              return (
                <button
                  key={entry.id}
                  className={
                    'ed-word-item' +
                    (isActive ? ' active' : '') +
                    (entry.skipped ? ' skipped' : '') +
                    (entry.clipBegin === null && !entry.skipped ? ' no-timing' : '')
                  }
                  onClick={() => {
                    setSelectedWord(entry);
                    if (entry.clipBegin !== null && onWordClick) {
                      onWordClick(entry.id);
                    }
                  }}
                >
                  <span className="ed-word-item-text">{entry.word}</span>
                  {entry.clipBegin !== null && (
                    <span className="ed-word-item-time">{formatTimeMs(entry.clipBegin)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
