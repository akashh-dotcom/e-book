import { useState, useEffect, useRef, useCallback } from 'react';

export function useMediaOverlay(syncData, audioUrl) {
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);  // virtual time
  const [duration, setDuration] = useState(0);
  const [activeWordId, setActiveWordId] = useState(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Always-fresh refs
  const syncDataRef = useRef(syncData);
  syncDataRef.current = syncData;
  const playbackRateRef = useRef(1);
  const activeWordRef = useRef(null);

  // Original sync data — the alignment before any word-edge drags.
  // Resets when word IDs change (e.g. after re-sync from aeneas).
  const originalSyncRef = useRef(null);

  useEffect(() => {
    if (!syncData?.length) return;
    const newIds = syncData.map(w => w.id).join(',');
    const origIds = originalSyncRef.current?.map(w => w.id).join(',');
    if (!originalSyncRef.current || newIds !== origIds) {
      originalSyncRef.current = syncData.map(w => ({
        id: w.id,
        clipBegin: w.clipBegin,
        clipEnd: w.clipEnd,
      }));
    }
  }, [syncData]);

  // ---- Time mapping: audio position <-> virtual timeline ----

  /** Map audio file position → virtual timeline position */
  const audioToVirtual = useCallback((audioTime) => {
    const orig = originalSyncRef.current;
    const cur = syncDataRef.current;
    if (!orig?.length || !cur?.length) return audioTime;
    for (const o of orig) {
      if (o.clipBegin === null || o.clipEnd === null) continue;
      const origDur = o.clipEnd - o.clipBegin;
      if (origDur <= 0) continue;
      if (audioTime >= o.clipBegin && audioTime < o.clipEnd) {
        const c = cur.find(w => w.id === o.id);
        if (!c || c.clipBegin === null) continue;
        const fraction = (audioTime - o.clipBegin) / origDur;
        return c.clipBegin + fraction * (c.clipEnd - c.clipBegin);
      }
    }
    return audioTime; // gap — pass through
  }, []);

  /** Map virtual timeline position → audio file position */
  const virtualToAudio = useCallback((vTime) => {
    const orig = originalSyncRef.current;
    const cur = syncDataRef.current;
    if (!orig?.length || !cur?.length) return vTime;
    for (const c of cur) {
      if (c.clipBegin === null || c.clipEnd === null) continue;
      const newDur = c.clipEnd - c.clipBegin;
      if (newDur <= 0) continue;
      if (vTime >= c.clipBegin && vTime < c.clipEnd) {
        const o = orig.find(w => w.id === c.id);
        if (!o || o.clipBegin === null) continue;
        const fraction = (vTime - c.clipBegin) / newDur;
        return o.clipBegin + fraction * (o.clipEnd - o.clipBegin);
      }
    }
    return vTime;
  }, []);

  /** Per-word playback rate at a given audio position */
  const getRateForAudioPos = useCallback((audioTime) => {
    const orig = originalSyncRef.current;
    const cur = syncDataRef.current;
    if (!orig?.length || !cur?.length) return 1;
    for (const o of orig) {
      if (o.clipBegin === null || o.clipEnd === null) continue;
      if (audioTime >= o.clipBegin && audioTime < o.clipEnd) {
        const c = cur.find(w => w.id === o.id);
        if (!c || c.clipBegin === null) continue;
        const origDur = o.clipEnd - o.clipBegin;
        const newDur = c.clipEnd - c.clipBegin;
        return (origDur > 0 && newDur > 0) ? origDur / newDur : 1;
      }
    }
    return 1;
  }, []);

  // ---- Audio element setup ----

  useEffect(() => {
    // Clear stale highlights from previous audio/sync
    clearHighlights();
    activeWordRef.current = null;
    setActiveWordId(null);
    setCurrentTime(0);
    setIsPlaying(false);

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
      clearHighlights();
      activeWordRef.current = null;
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
    if (timerRef.current) clearInterval(timerRef.current);
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

  // ---- Highlights use virtual time against current sync data ----

  const updateHighlights = useCallback((vt) => {
    const data = syncDataRef.current;
    if (!data?.length) return;
    let newActive = null;
    for (const entry of data) {
      const el = document.getElementById(entry.id);
      if (!el || entry.clipBegin === null) continue;
      if (vt >= entry.clipBegin && vt < entry.clipEnd) {
        newActive = entry.id;
        el.classList.add('-epub-media-overlay-active');
        el.classList.remove('mo-spoken');
      } else if (vt >= entry.clipEnd) {
        el.classList.remove('-epub-media-overlay-active');
        el.classList.add('mo-spoken');
      } else {
        el.classList.remove('-epub-media-overlay-active', 'mo-spoken');
      }
    }
    // Only scroll when the active word changes to avoid jittery 40ms scrolling
    if (newActive !== activeWordRef.current) {
      activeWordRef.current = newActive;
      setActiveWordId(newActive);
      if (newActive) {
        const el = document.getElementById(newActive);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, []);

  const clearHighlights = () => {
    document.querySelectorAll('.-epub-media-overlay-active, .mo-spoken')
      .forEach(el => el.classList.remove('-epub-media-overlay-active', 'mo-spoken'));
  };

  // ---- Playback timer: adjusts rate per word, maps to virtual time ----

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      if (!audioRef.current) return;
      const audioTime = audioRef.current.currentTime;

      // Adjust audio speed for the current word
      const wordRate = getRateForAudioPos(audioTime);
      audioRef.current.playbackRate = wordRate * playbackRateRef.current;

      // Map audio position → virtual timeline position
      const vt = audioToVirtual(audioTime);
      setCurrentTime(vt);
      updateHighlights(vt);
    }, 40);
  }, [updateHighlights, audioToVirtual, getRateForAudioPos]);

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

  // Seek accepts virtual time and converts to audio position
  const seek = useCallback((vt) => {
    if (audioRef.current) {
      const audioTime = virtualToAudio(vt);
      audioRef.current.currentTime = audioTime;
      setCurrentTime(vt);
      updateHighlights(vt);
    }
  }, [updateHighlights, virtualToAudio]);

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
    setPlaybackRate(r);
    // Don't set audio.playbackRate directly — the timer applies
    // wordRate * playbackRateRef.current on the next tick.
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
