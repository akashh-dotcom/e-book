import { useState, useEffect, useRef, useCallback } from 'react';

export function useMediaOverlay(syncData, audioUrl) {
  const audioRef = useRef(null);
  const rafRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeWordId, setActiveWordId] = useState(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Always-fresh refs
  const syncDataRef = useRef(syncData);
  syncDataRef.current = syncData;
  const playbackRateRef = useRef(1);

  // Tracking refs for efficient updates
  const activeWordRef = useRef(null);       // last highlighted word id
  const activeIndexRef = useRef(-1);        // last highlighted word index
  const lastTimeUpdate = useRef(0);         // performance.now() for throttled state update

  // Original sync data — always kept in sync with the latest server data.
  // Previously this only reset when word IDs changed, which caused a critical
  // bug: after re-syncing (same IDs, new timestamps), originalSyncRef retained
  // stale timestamps.
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
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
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

  // ---- Highlights: only touch DOM when active word changes ----

  const updateHighlights = useCallback((audioTime) => {
    const data = syncDataRef.current;
    if (!data?.length) return;

    // Find the active word using probe-from-last-index (O(1) amortised).
    // During normal playback the next word is either the same or the next index.
    let activeIdx = -1;
    const hint = activeIndexRef.current;
    const len = data.length;

    // Fast path: check current and next index first
    if (hint >= 0 && hint < len) {
      const h = data[hint];
      if (h.clipBegin !== null && audioTime >= h.clipBegin && audioTime < h.clipEnd) {
        activeIdx = hint;
      } else {
        const next = hint + 1;
        if (next < len) {
          const n = data[next];
          if (n.clipBegin !== null && audioTime >= n.clipBegin && audioTime < n.clipEnd) {
            activeIdx = next;
          }
        }
      }
    }

    // Slow path: full scan (only on seek or first play)
    if (activeIdx === -1) {
      for (let i = 0; i < len; i++) {
        const entry = data[i];
        if (entry.clipBegin === null || entry.clipEnd === null) continue;
        if (audioTime >= entry.clipBegin && audioTime < entry.clipEnd) {
          activeIdx = i;
          break;
        }
        if (audioTime >= entry.clipEnd) {
          // Keep the last word highlighted during gaps (sentence/paragraph pauses)
          const next = data.slice(i + 1).find(e => e.clipBegin !== null);
          if (!next || audioTime < next.clipBegin) {
            activeIdx = i;
          }
        }
      }
    }

    const newId = activeIdx >= 0 ? data[activeIdx].id : null;

    // Nothing changed — skip all DOM work
    if (newId === activeWordRef.current) return;

    // Remove active class from previous word
    if (activeWordRef.current) {
      const prevEl = document.getElementById(activeWordRef.current);
      if (prevEl) {
        prevEl.classList.remove('-epub-media-overlay-active');
        prevEl.classList.add('mo-spoken');
      }
    }

    // Add active class to new word and scroll into view
    if (newId) {
      const newEl = document.getElementById(newId);
      if (newEl) {
        newEl.classList.add('-epub-media-overlay-active');
        newEl.classList.remove('mo-spoken');
        newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    // On first highlight or after seek, mark all preceding words as spoken
    if (activeIdx >= 0 && activeWordRef.current === null) {
      for (let i = 0; i < activeIdx; i++) {
        const entry = data[i];
        if (entry.clipBegin === null) continue;
        const el = document.getElementById(entry.id);
        if (el) {
          el.classList.remove('-epub-media-overlay-active');
          el.classList.add('mo-spoken');
        }
      }
    }

    activeWordRef.current = newId;
    activeIndexRef.current = activeIdx;
    setActiveWordId(newId);
  }, []);

  const clearHighlights = () => {
    document.querySelectorAll('.-epub-media-overlay-active, .mo-spoken')
      .forEach(el => el.classList.remove('-epub-media-overlay-active', 'mo-spoken'));
    activeWordRef.current = null;
    activeIndexRef.current = -1;
  };

  // ---- Playback loop using requestAnimationFrame ----
  // rAF fires in sync with the browser's repaint (~60fps), giving tighter
  // coupling between audio.currentTime reads and the visual highlight update.
  // Directly reads audio.currentTime and matches against sync data.
  // No virtual time mapping — TTS per-word timing in the sync data already
  // matches the actual audio exactly.

  const startTimer = useCallback(() => {
    stopTimer();
    lastTimeUpdate.current = 0;
    const tick = () => {
      if (!audioRef.current) return;
      const audioTime = audioRef.current.currentTime;

      updateHighlights(audioTime);

      // Throttle React state update for seek bar to ~5 Hz (every 200ms).
      // The highlight updates above are direct DOM mutations and don't need
      // React — only the seek bar position needs the state, and 5 Hz is smooth
      // enough for that while avoiding 60 re-renders/second.
      const now = performance.now();
      if (now - lastTimeUpdate.current > 200) {
        setCurrentTime(audioTime);
        lastTimeUpdate.current = now;
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
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
    // Final accurate time update
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const togglePlay = useCallback(() => {
    isPlaying ? pause() : play();
  }, [isPlaying, play, pause]);

  const seek = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      // Reset tracking so updateHighlights does a full mark-up of spoken words
      activeWordRef.current = null;
      activeIndexRef.current = -1;
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
