import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

export default function AudioBar({ audioSrc, syncData }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  // Highlight active sync element
  useEffect(() => {
    if (!syncData || !syncData.length) return;

    // Remove previous highlights
    document.querySelectorAll('.-epub-media-overlay-active').forEach(el => {
      el.classList.remove('-epub-media-overlay-active');
    });

    // Find current sync item
    const current = syncData.find(
      item => currentTime >= item.clipBegin && currentTime < item.clipEnd
    );
    if (current && current.textRef) {
      const el = document.getElementById(current.textRef);
      if (el) {
        el.classList.add('-epub-media-overlay-active');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentTime, syncData]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = parseFloat(e.target.value);
  };

  const cycleSpeed = () => {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const idx = speeds.indexOf(speed);
    const next = speeds[(idx + 1) % speeds.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const formatTime = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!audioSrc) return null;

  return (
    <div className="audio-bar">
      <audio ref={audioRef} src={audioSrc} preload="metadata" />
      <button onClick={togglePlay}>
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <span className="audio-time">{formatTime(currentTime)}</span>
      <input
        type="range"
        min="0"
        max={duration || 0}
        step="0.1"
        value={currentTime}
        onChange={handleSeek}
      />
      <span className="audio-time">{formatTime(duration)}</span>
      <button className="speed-btn" onClick={cycleSpeed}>
        {speed}x
      </button>
    </div>
  );
}
