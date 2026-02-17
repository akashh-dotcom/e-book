import { useState, useEffect, useRef, useCallback } from 'react';

export function useMediaOverlay(syncData, audioUrl) {
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeWordId, setActiveWordId] = useState(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      clearHighlights();
    });
    if (audioUrl) audio.src = audioUrl;
    return () => {
      audio.pause();
      audio.src = '';
      stopTimer();
    };
  }, [audioUrl]);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const updateHighlights = useCallback((t) => {
    if (!syncData?.length) return;
    let newActive = null;
    for (const entry of syncData) {
      const el = document.getElementById(entry.id);
      if (!el || entry.clipBegin === null) continue;
      if (t >= entry.clipBegin && t < entry.clipEnd) {
        newActive = entry.id;
        el.classList.add('-epub-media-overlay-active');
        el.classList.remove('mo-spoken');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (t >= entry.clipEnd) {
        el.classList.remove('-epub-media-overlay-active');
        el.classList.add('mo-spoken');
      } else {
        el.classList.remove('-epub-media-overlay-active', 'mo-spoken');
      }
    }
    setActiveWordId(newActive);
  }, [syncData]);

  const clearHighlights = () => {
    document.querySelectorAll('.-epub-media-overlay-active, .mo-spoken')
      .forEach(el => el.classList.remove('-epub-media-overlay-active', 'mo-spoken'));
  };

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      if (!audioRef.current) return;
      const t = audioRef.current.currentTime;
      setCurrentTime(t);
      updateHighlights(t);
    }, 40);
  }, [updateHighlights]);

  const play = useCallback(() => {
    audioRef.current?.play();
    setIsPlaying(true);
    startTimer();
  }, [startTimer]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    stopTimer();
  }, []);

  const togglePlay = useCallback(() => {
    isPlaying ? pause() : play();
  }, [isPlaying, play, pause]);

  const seek = useCallback((t) => {
    if (audioRef.current) {
      audioRef.current.currentTime = t;
      updateHighlights(t);
    }
  }, [updateHighlights]);

  const seekToWord = useCallback((wordId) => {
    const entry = syncData?.find(d => d.id === wordId);
    if (entry?.clipBegin !== null && entry?.clipBegin !== undefined) {
      seek(entry.clipBegin);
      if (!isPlaying) play();
    }
  }, [syncData, seek, isPlaying, play]);

  const setSpeed = useCallback((r) => {
    if (audioRef.current) audioRef.current.playbackRate = r;
    setPlaybackRate(r);
  }, []);

  return {
    isPlaying,
    currentTime,
    duration,
    activeWordId,
    playbackRate,
    play,
    pause,
    togglePlay,
    seek,
    seekToWord,
    setSpeed,
    clearHighlights,
  };
}
