import { useState, useEffect, useRef, useCallback } from 'react';

export function useMediaOverlay(syncData, audioUrl) {
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeWordId, setActiveWordId] = useState(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Always-fresh refs
  const syncDataRef = useRef(syncData);
  syncDataRef.current = syncData;
  const playbackRateRef = useRef(1);

  // Original sync data — always kept in sync with the latest server data.
  // Previously this only reset when word IDs changed, which caused a critical
  // bug: after re-syncing (same IDs, new timestamps), originalSyncRef retained
  // stale timestamps, making getRateForAudioPos() return wrong values and
  // modifying audio playback speed incorrectly.
  const originalSyncRef = useRef(null);

  useEffect(() => {
    if (!syncData?.length) {
      originalSyncRef.current = null;
      return;
    }
    // Always update to match current sync data
    originalSyncRef.current = syncData.map(w => ({
      id: w.id,
      clipBegin: w.clipBegin,
      clipEnd: w.clipEnd,
    }));
  }, [syncData]);

  // ---- Audio element setup ----

  useEffect(() => {
    if (!audioUrl) {
      audioRef.current = null;
      return;
    }
    const audio = new Audio();
    audio.preload = 'metadata';
    audioRef.current = audio;
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      stopTimer();
      clearHighlights();
    });
    audio.src = audioUrl;
    audio.load();
    return () => {
      audio.pause();
      audio.src = '';
      stopTimer();
    };
  }, [audioUrl]);

  const stopTimer = () => {
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }
  };

  // Mark skipped words in the DOM
  useEffect(() => {
    if (!syncData?.length) return;
    for (const entry of syncData) {
      const el = document.getElementById(entry.id);
      if (!el) continue;
      if (entry.skipped) el.classList.add('word-skipped');
      else el.classList.remove('word-skipped');
    }
  }, [syncData]);

  // ---- Highlights: directly match audio.currentTime to sync data ----

  const updateHighlights = useCallback((audioTime) => {
    const data = syncDataRef.current;
    if (!data?.length) return;

    // Find the active word: the word whose [clipBegin, clipEnd) contains audioTime,
    // OR the last word whose clipEnd <= audioTime but the NEXT word hasn't started yet
    // (this keeps the last word highlighted during sentence/paragraph pauses).
    let activeIdx = -1;
    for (let i = 0; i < data.length; i++) {
      const entry = data[i];
      if (entry.clipBegin === null || entry.clipEnd === null) continue;
      if (audioTime >= entry.clipBegin && audioTime < entry.clipEnd) {
        activeIdx = i;
        break;
      }
      if (audioTime >= entry.clipEnd) {
        // Check if we're in a gap before the next word
        const next = data.slice(i + 1).find(e => e.clipBegin !== null);
        if (!next || audioTime < next.clipBegin) {
          activeIdx = i; // Stay on this word during the gap
        }
      }
    }

    const activeId = activeIdx >= 0 ? data[activeIdx].id : null;

    for (let i = 0; i < data.length; i++) {
      const entry = data[i];
      const el = document.getElementById(entry.id);
      if (!el || entry.clipBegin === null) continue;

      if (i === activeIdx) {
        el.classList.add('-epub-media-overlay-active');
        el.classList.remove('mo-spoken');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (activeIdx >= 0 && i < activeIdx) {
        el.classList.remove('-epub-media-overlay-active');
        el.classList.add('mo-spoken');
      } else {
        el.classList.remove('-epub-media-overlay-active', 'mo-spoken');
      }
    }
    setActiveWordId(activeId);
  }, []);

  const clearHighlights = () => {
    document.querySelectorAll('.-epub-media-overlay-active, .mo-spoken')
      .forEach(el => el.classList.remove('-epub-media-overlay-active', 'mo-spoken'));
  };

  // ---- Playback timer: uses requestAnimationFrame for smooth updates ----
  // Directly reads audio.currentTime and matches against sync data.
  // No virtual time mapping or rate adjustment — the TTS per-word timing
  // in the sync data already matches the actual audio exactly.

  const startTimer = useCallback(() => {
    stopTimer();
    const tick = () => {
      if (!audioRef.current) return;
      const audioTime = audioRef.current.currentTime;
      setCurrentTime(audioTime);
      updateHighlights(audioTime);
      timerRef.current = requestAnimationFrame(tick);
    };
    timerRef.current = requestAnimationFrame(tick);
  }, [updateHighlights]);

  const play = useCallback(() => {
    const p = audioRef.current?.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        setIsPlaying(true);
        startTimer();
      }).catch((err) => {
        console.error('Audio play failed:', err.message);
        setIsPlaying(false);
      });
    } else {
      setIsPlaying(true);
      startTimer();
    }
  }, [startTimer]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    stopTimer();
  }, []);

  const togglePlay = useCallback(() => {
    isPlaying ? pause() : play();
  }, [isPlaying, play, pause]);

  const seek = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      updateHighlights(time);
    }
  }, [updateHighlights]);

  const seekToWord = useCallback((wordId) => {
    const data = syncDataRef.current;
    const entry = data?.find(d => d.id === wordId);
    if (entry?.clipBegin !== null && entry?.clipBegin !== undefined) {
      seek(entry.clipBegin);
      if (!isPlaying) play();
    }
  }, [seek, isPlaying, play]);

  const setSpeed = useCallback((r) => {
    playbackRateRef.current = r;
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
