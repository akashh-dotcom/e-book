import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Binary search for the word whose [clipBegin, clipEnd) contains `time`.
 * Assumes `data` is sorted by clipBegin (ascending).
 *
 * When `time` falls in a gap between two words (e.g. word A ends at 2.5s,
 * word B starts at 2.8s, time=2.6s), returns the LAST word whose clipBegin
 * is <= time.  This keeps the highlight on the previous word during gaps
 * instead of flashing to no-highlight, which produces much smoother karaoke.
 *
 * Returns -1 only when `time` is before the very first word.
 */
function findActiveIndex(data, time) {
  let lo = 0;
  let hi = data.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const entry = data[mid];
    // Skip entries with null timing (skipped words)
    if (entry.clipBegin === null || entry.clipEnd === null) {
      // Search both sides from this null entry
      for (let j = mid - 1; j >= lo; j--) {
        if (data[j].clipBegin !== null && time >= data[j].clipBegin && time < data[j].clipEnd) return j;
        if (data[j].clipEnd !== null && data[j].clipEnd <= time) break;
      }
      for (let j = mid + 1; j <= hi; j++) {
        if (data[j].clipBegin !== null && time >= data[j].clipBegin && time < data[j].clipEnd) return j;
        if (data[j].clipBegin !== null && data[j].clipBegin > time) break;
      }
      break; // no exact match around null zone — fall through to gap handler
    }
    if (time < entry.clipBegin) {
      hi = mid - 1;
    } else if (time >= entry.clipEnd) {
      lo = mid + 1;
    } else {
      return mid; // time is within [clipBegin, clipEnd)
    }
  }

  // No exact [clipBegin, clipEnd) match — we're in a gap between words.
  // Find the last word whose clipBegin <= time (keeps previous word lit).
  lo = 0;
  hi = data.length - 1;
  let best = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const entry = data[mid];
    if (entry.clipBegin !== null && entry.clipBegin <= time) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

export function useMediaOverlay(syncData, audioUrl, syncVersion = 0) {
  const audioRef = useRef(null);
  const rafRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);  // virtual time
  const [duration, setDuration] = useState(0);
  const [activeWordId, setActiveWordId] = useState(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Always-fresh refs
  const syncDataRef = useRef(syncData);
  syncDataRef.current = syncData;
  const playbackRateRef = useRef(1);
  const lastActiveIdxRef = useRef(-1);

  // Original sync data — the alignment before any word-edge drags.
  // Resets when syncVersion changes (backend re-sync / initial load) or
  // when word IDs change (different chapter / re-wrapped text).
  // Word-edge drags update syncData but NOT syncVersion, so the original
  // timing is preserved and the playback rate adjusts to match.
  const originalSyncRef = useRef(null);
  const prevSyncVersionRef = useRef(syncVersion);

  useEffect(() => {
    if (!syncData?.length) return;
    const versionChanged = syncVersion !== prevSyncVersionRef.current;
    const newIds = syncData.map(w => w.id).join(',');
    const origIds = originalSyncRef.current?.map(w => w.id).join(',');
    if (!originalSyncRef.current || newIds !== origIds || versionChanged) {
      originalSyncRef.current = syncData.map(w => ({
        id: w.id,
        clipBegin: w.clipBegin,
        clipEnd: w.clipEnd,
      }));
      prevSyncVersionRef.current = syncVersion;
    }
  }, [syncData, syncVersion]);

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
    lastActiveIdxRef.current = -1;
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
      // Mark all words as spoken at the end
      const data = syncDataRef.current;
      if (data?.length) {
        for (const entry of data) {
          const el = document.getElementById(entry.id);
          if (el) {
            el.classList.remove('-epub-media-overlay-active');
            el.classList.add('mo-spoken');
          }
        }
      }
      lastActiveIdxRef.current = -1;
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
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
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

  // ---- Highlights: binary search + incremental DOM updates ----

  const updateHighlights = useCallback((vt) => {
    const data = syncDataRef.current;
    if (!data?.length) return;

    const newIdx = findActiveIndex(data, vt);
    const prevIdx = lastActiveIdxRef.current;

    if (newIdx === prevIdx) return; // same word — nothing to do

    // Remove highlight from previous active word
    if (prevIdx >= 0 && prevIdx < data.length) {
      const el = document.getElementById(data[prevIdx].id);
      if (el) {
        el.classList.remove('-epub-media-overlay-active');
        el.classList.add('mo-spoken');
      }
    }

    if (newIdx > prevIdx) {
      // Moving forward — mark words between prevIdx+1 and newIdx-1 as spoken
      const start = Math.max(0, prevIdx + 1);
      for (let i = start; i < newIdx; i++) {
        const el = document.getElementById(data[i].id);
        if (el) {
          el.classList.remove('-epub-media-overlay-active');
          el.classList.add('mo-spoken');
        }
      }
    } else if (newIdx < prevIdx) {
      // Seeking backward — remove 'mo-spoken' from words after new position
      const start = Math.max(0, newIdx + 1);
      const end = Math.min(data.length, prevIdx + 1);
      for (let i = start; i < end; i++) {
        const el = document.getElementById(data[i].id);
        if (el) el.classList.remove('-epub-media-overlay-active', 'mo-spoken');
      }
    }

    // Add highlight to the new active word
    if (newIdx >= 0) {
      const entry = data[newIdx];
      const el = document.getElementById(entry.id);
      if (el) {
        el.classList.add('-epub-media-overlay-active');
        el.classList.remove('mo-spoken');
        // Scroll only when the active word changes
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setActiveWordId(entry.id);
    }

    lastActiveIdxRef.current = newIdx;
  }, []);

  const clearHighlights = () => {
    document.querySelectorAll('.-epub-media-overlay-active, .mo-spoken')
      .forEach(el => el.classList.remove('-epub-media-overlay-active', 'mo-spoken'));
    lastActiveIdxRef.current = -1;
  };

  // ---- Playback loop using requestAnimationFrame for smooth sync ----

  const startTimer = useCallback(() => {
    stopTimer();
    let lastUpdate = 0;

    const tick = (timestamp) => {
      if (!audioRef.current) return;

      // Update every frame (~16ms / 60fps) for precise word highlighting
      if (timestamp - lastUpdate >= 16) {
        // Skip updates while the audio is actively seeking — currentTime
        // is stale and would flash the highlight to the wrong word.
        if (audioRef.current.seeking) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        lastUpdate = timestamp;
        const audioTime = audioRef.current.currentTime;

        // Adjust audio speed for the current word
        const wordRate = getRateForAudioPos(audioTime);
        audioRef.current.playbackRate = wordRate * playbackRateRef.current;

        // Map audio position → virtual timeline position
        const vt = audioToVirtual(audioTime);
        setCurrentTime(vt);
        updateHighlights(vt);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
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
      // Full clear + re-highlight on seek for correctness
      clearHighlights();
      const data = syncDataRef.current;
      if (data?.length) {
        const idx = findActiveIndex(data, vt);
        // Mark all words before the seek position as spoken
        for (let i = 0; i < (idx >= 0 ? idx : data.length); i++) {
          const el = document.getElementById(data[i].id);
          if (el && data[i].clipEnd !== null && vt >= data[i].clipEnd) {
            el.classList.add('mo-spoken');
          }
        }
        if (idx >= 0) {
          const el = document.getElementById(data[idx].id);
          if (el) {
            el.classList.add('-epub-media-overlay-active');
            el.classList.remove('mo-spoken');
          }
          setActiveWordId(data[idx].id);
          lastActiveIdxRef.current = idx;
        }
      }
    }
  }, [virtualToAudio]);

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
