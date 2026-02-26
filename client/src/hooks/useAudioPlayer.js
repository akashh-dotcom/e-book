import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

/**
 * Fetch audio stream via authenticated api and return a blob URL.
 * This avoids 401 errors when the <audio> element makes direct requests.
 */
async function fetchAudioBlobUrl(streamPath) {
  // streamPath is like /api/audio/.../stream?lang=hi — strip /api prefix
  const apiPath = streamPath.replace(/^\/api/, '');
  const res = await api.get(apiPath, { responseType: 'blob' });
  return URL.createObjectURL(res.data);
}

/**
 * Hook to manage audio & sync data loading for a chapter.
 * When `lang` is provided, fetches language-specific audio & sync.
 */
export function useAudioPlayer(bookId, chapterIndex, lang) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [syncData, setSyncData] = useState(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [hasSyncData, setHasSyncData] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null); // { step, message }
  const [syncVersion, setSyncVersion] = useState(0); // increments on backend sync loads
  const blobUrlRef = useRef(null);

  const langQuery = lang ? `?lang=${lang}` : '';

  // Revoke previous blob URL to avoid memory leaks
  const setBlobAudioUrl = useCallback((blobUrl) => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = blobUrl;
    setAudioUrl(blobUrl);
  }, []);

  useEffect(() => {
    if (!bookId || chapterIndex === undefined) return;
    setBlobAudioUrl(null);
    setSyncData(null);
    setHasAudio(false);
    setHasSyncData(false);

    let cancelled = false;

    // Check for audio — fetch the stream as a blob
    api.get(`/audio/${bookId}/${chapterIndex}${langQuery}`)
      .then(async (res) => {
        if (cancelled || !res.data?.url) return;
        const blobUrl = await fetchAudioBlobUrl(res.data.url);
        if (cancelled) { URL.revokeObjectURL(blobUrl); return; }
        setBlobAudioUrl(blobUrl);
        setHasAudio(true);
      })
      .catch(() => {});

    // Check for sync data
    api.get(`/sync/${bookId}/${chapterIndex}${langQuery}`)
      .then(res => {
        if (!cancelled && res.data?.syncData) {
          setSyncData(res.data.syncData);
          setSyncVersion(v => v + 1);
          setHasSyncData(true);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [bookId, chapterIndex, lang]);

  const uploadAudio = useCallback(async (file) => {
    const formData = new FormData();
    formData.append('audio', file);
    const res = await api.post(
      `/audio/${bookId}/${chapterIndex}${langQuery}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    const sep = langQuery ? '&' : '?';
    const streamPath = `/api/audio/${bookId}/${chapterIndex}/stream${langQuery}${sep}t=${Date.now()}`;
    const blobUrl = await fetchAudioBlobUrl(streamPath);
    setBlobAudioUrl(blobUrl);
    setHasAudio(true);
    return res.data;
  }, [bookId, chapterIndex, langQuery, setBlobAudioUrl]);

  const runAutoSync = useCallback(async (mode = 'word', { lang: syncLang, engine = 'auto' } = {}) => {
    const effectiveLang = syncLang || lang;
    setSyncProgress({ step: 'starting', message: 'Starting sync...' });

    const token = localStorage.getItem('voxbook_token');

    try {
      const response = await fetch(`/api/sync/${bookId}/${chapterIndex}/auto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ mode, engine, lang: effectiveLang }),
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let error = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from the buffer
        const parts = buffer.split('\n\n');
        buffer = parts.pop(); // keep incomplete part

        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = '';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) eventType = line.slice(7);
            else if (line.startsWith('data: ')) eventData = line.slice(6);
          }

          if (!eventData) continue;

          try {
            const data = JSON.parse(eventData);
            if (eventType === 'progress') {
              setSyncProgress({ step: data.step, message: data.message });
            } else if (eventType === 'error') {
              error = data.error;
            } else if (eventType === 'done') {
              setSyncProgress({ step: 'done', message: data.message });
            }
          } catch {
            // ignore malformed JSON
          }
        }
      }

      if (error) throw new Error(error);

      // Reload sync data
      const lq = effectiveLang ? `?lang=${effectiveLang}` : '';
      const syncRes = await api.get(`/sync/${bookId}/${chapterIndex}${lq}`);
      if (syncRes.data?.syncData) {
        setSyncData(syncRes.data.syncData);
        setSyncVersion(v => v + 1);
        setHasSyncData(true);
      }
    } finally {
      // Clear progress after a short delay so the "done" message is visible
      setTimeout(() => setSyncProgress(null), 2000);
    }
  }, [bookId, chapterIndex, lang]);

  const updateSyncData = useCallback((newSyncData) => {
    setSyncData(newSyncData);
  }, []);

  const reloadSync = useCallback(() => {
    api.get(`/sync/${bookId}/${chapterIndex}${langQuery}`)
      .then(res => {
        setSyncData(res.data.syncData);
        setSyncVersion(v => v + 1);
        setHasSyncData(true);
      })
      .catch(() => {
        setSyncData(null);
        setHasSyncData(false);
      });
  }, [bookId, chapterIndex, langQuery]);

  const reloadAudio = useCallback(async () => {
    const ts = Date.now();
    const sep = langQuery ? '&' : '?';
    const streamPath = `/api/audio/${bookId}/${chapterIndex}/stream${langQuery}${sep}t=${ts}`;
    const blobUrl = await fetchAudioBlobUrl(streamPath);
    setBlobAudioUrl(blobUrl);
  }, [bookId, chapterIndex, langQuery, setBlobAudioUrl]);

  const generateAudio = useCallback(async (voice = 'en-US-AriaNeural', { lang: genLang } = {}) => {
    const effectiveLang = genLang || lang;
    const res = await api.post(`/audio/${bookId}/${chapterIndex}/generate`, { voice, lang: effectiveLang });
    const lq = effectiveLang ? `?lang=${effectiveLang}` : '';
    // Cache-buster forces useMediaOverlay to recreate its Audio element even
    // when the URL was already set (e.g. original audio served via fallback).
    const sep = lq ? '&' : '?';
    const streamPath = `/api/audio/${bookId}/${chapterIndex}/stream${lq}${sep}t=${Date.now()}`;
    const blobUrl = await fetchAudioBlobUrl(streamPath);
    setBlobAudioUrl(blobUrl);
    setHasAudio(true);
    return res.data;
  }, [bookId, chapterIndex, lang, setBlobAudioUrl]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  return {
    audioUrl,
    syncData,
    syncVersion,
    hasAudio,
    hasSyncData,
    syncProgress,
    uploadAudio,
    runAutoSync,
    updateSyncData,
    reloadSync,
    reloadAudio,
    generateAudio,
  };
}
