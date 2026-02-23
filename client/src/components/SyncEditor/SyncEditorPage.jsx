import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Pause, RotateCcw, Check, ArrowLeft } from 'lucide-react';
import api from '../../services/api';
import { formatTime } from '../../utils/timeFormatter';

export default function SyncEditorPage() {
  const { bookId, chapterIndex } = useParams();
  const navigate = useNavigate();
  const audioRef = useRef(new Audio());

  const [words, setWords] = useState([]);
  const [wordIds, setWordIds] = useState([]);
  const [syncData, setSyncData] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [saving, setSaving] = useState(false);

  // Load chapter + audio
  useEffect(() => {
    api.get(`/books/${bookId}/chapters/${chapterIndex}`).then(res => {
      const div = document.createElement('div');
      div.innerHTML = res.data.html;
      const spans = div.querySelectorAll('span[id^="w"]');
      const w = [], ids = [];
      spans.forEach(s => { w.push(s.textContent.trim()); ids.push(s.id); });
      setWords(w);
      setWordIds(ids);
      setSyncData(w.map((word, i) => ({
        id: ids[i], word, clipBegin: null, clipEnd: null,
      })));
    });

    api.get(`/audio/${bookId}/${chapterIndex}`).then(res => {
      audioRef.current.src = res.data.url;
      audioRef.current.oncanplay = () => setAudioReady(true);
    });

    const timer = setInterval(() => {
      if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
    }, 100);

    return () => {
      audioRef.current.pause();
      clearInterval(timer);
    };
  }, [bookId, chapterIndex]);

  const togglePlay = () => {
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.play(); setIsPlaying(true); }
  };

  const markWord = useCallback(() => {
    if (currentIndex >= words.length) return;
    const t = Math.round(audioRef.current.currentTime * 1000) / 1000;

    setSyncData(prev => {
      const updated = [...prev];
      if (currentIndex > 0 && updated[currentIndex - 1].clipEnd === null)
        updated[currentIndex - 1].clipEnd = t;
      updated[currentIndex].clipBegin = t;
      if (currentIndex === words.length - 1)
        updated[currentIndex].clipEnd = t + 0.5;
      return updated;
    });
    setCurrentIndex(prev => prev + 1);
  }, [currentIndex, words.length]);

  const undoMark = () => {
    if (currentIndex <= 0) return;
    setSyncData(prev => {
      const u = [...prev];
      u[currentIndex - 1].clipBegin = null;
      u[currentIndex - 1].clipEnd = null;
      if (currentIndex > 1) u[currentIndex - 2].clipEnd = null;
      return u;
    });
    setCurrentIndex(prev => prev - 1);
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.code === 'Space') { e.preventDefault(); markWord(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [markWord]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(`/sync/${bookId}/${chapterIndex}/manual`, { syncData });
      navigate(`/read/${bookId}`);
    } catch (err) {
      alert('Save failed: ' + (err.response?.data?.error || err.message));
    }
    setSaving(false);
  };

  const isComplete = currentIndex >= words.length;
  const progress = words.length ? Math.round((currentIndex / words.length) * 100) : 0;

  return (
    <div className="sync-editor">
      <header className="sync-header">
        <button className="icon-btn" onClick={() => navigate(`/read/${bookId}`)}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1>Manual Sync Editor</h1>
          <p>Chapter {parseInt(chapterIndex) + 1}</p>
        </div>
      </header>

      <div className="sync-instructions">
        <p>1. Press Play  2. Tap <strong>Space</strong> when each word is spoken  3. Save</p>
      </div>

      <div className="sync-controls">
        <button className="sync-play-btn" onClick={togglePlay} disabled={!audioReady}>
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>

        <div className="sync-time">{formatTime(currentTime)}</div>

        <div className="current-word">
          {isComplete ? 'Done!' : words[currentIndex]}
        </div>

        <div className="progress-text">
          {currentIndex} / {words.length} ({progress}%)
        </div>
      </div>

      <div className="sync-progress-bar">
        <div className="sync-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="sync-actions">
        <button className="sync-action-btn" onClick={markWord} disabled={isComplete}>
          Mark (Space)
        </button>
        <button className="sync-action-btn secondary" onClick={undoMark} disabled={currentIndex === 0}>
          <RotateCcw size={14} /> Undo
        </button>
        <button
          className="sync-action-btn primary"
          onClick={handleSave}
          disabled={!isComplete || saving}
        >
          <Check size={14} /> {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="word-chips">
        {words.map((w, i) => (
          <span key={i} className={`chip ${
            i < currentIndex ? 'done' : i === currentIndex ? 'active' : ''
          }`}>{w}</span>
        ))}
      </div>
    </div>
  );
}
