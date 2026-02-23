import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * Hook to manage audio & sync data loading for a chapter.
 * When `lang` is provided, fetches language-specific audio & sync.
 */
export function useAudioPlayer(bookId, chapterIndex, lang) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [syncData, setSyncData] = useState(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [hasSyncData, setHasSyncData] = useState(false);

  const langQuery = lang ? `?lang=${lang}` : '';

  useEffect(() => {
    if (!bookId || chapterIndex === undefined) return;
    setAudioUrl(null);
    setSyncData(null);
    setHasAudio(false);
    setHasSyncData(false);

    // Check for audio
    api.get(`/audio/${bookId}/${chapterIndex}${langQuery}`)
      .then(res => {
        setAudioUrl(res.data.url);
        setHasAudio(true);
      })
      .catch(() => {});

    // Check for sync data
    api.get(`/sync/${bookId}/${chapterIndex}${langQuery}`)
      .then(res => {
        setSyncData(res.data.syncData);
        setHasSyncData(true);
      })
      .catch(() => {});
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
    setAudioUrl(`/api/audio/${bookId}/${chapterIndex}/stream${langQuery}${sep}t=${Date.now()}`);
    setHasAudio(true);
    return res.data;
  }, [bookId, chapterIndex, langQuery]);

  const runAutoSync = useCallback(async (mode = 'word', { lang: syncLang } = {}) => {
    const effectiveLang = syncLang || lang;
    const res = await api.post(`/sync/${bookId}/${chapterIndex}/auto`, { mode, lang: effectiveLang });
    // Reload sync data
    const lq = effectiveLang ? `?lang=${effectiveLang}` : '';
    const syncRes = await api.get(`/sync/${bookId}/${chapterIndex}${lq}`);
    setSyncData(syncRes.data.syncData);
    setHasSyncData(true);
    return res.data;
  }, [bookId, chapterIndex, lang]);

  const updateSyncData = useCallback((newSyncData) => {
    setSyncData(newSyncData);
  }, []);

  const reloadSync = useCallback(() => {
    api.get(`/sync/${bookId}/${chapterIndex}${langQuery}`)
      .then(res => {
        setSyncData(res.data.syncData);
        setHasSyncData(true);
      })
      .catch(() => {
        setSyncData(null);
        setHasSyncData(false);
      });
  }, [bookId, chapterIndex, langQuery]);

  const reloadAudio = useCallback(() => {
    // Force audio element to reload by appending cache-buster
    const ts = Date.now();
    const sep = langQuery ? '&' : '?';
    setAudioUrl(`/api/audio/${bookId}/${chapterIndex}/stream${langQuery}${sep}t=${ts}`);
  }, [bookId, chapterIndex, langQuery]);

  const generateAudio = useCallback(async (voice = 'en-US-AriaNeural', { lang: genLang } = {}) => {
    const effectiveLang = genLang || lang;
    const res = await api.post(`/audio/${bookId}/${chapterIndex}/generate`, { voice, lang: effectiveLang });
    const lq = effectiveLang ? `?lang=${effectiveLang}` : '';
    // Cache-buster forces useMediaOverlay to recreate its Audio element even
    // when the URL was already set (e.g. original audio served via fallback).
    const sep = lq ? '&' : '?';
    setAudioUrl(`/api/audio/${bookId}/${chapterIndex}/stream${lq}${sep}t=${Date.now()}`);
    setHasAudio(true);
    return res.data;
  }, [bookId, chapterIndex, lang]);

  return {
    audioUrl,
    syncData,
    hasAudio,
    hasSyncData,
    uploadAudio,
    runAutoSync,
    updateSyncData,
    reloadSync,
    reloadAudio,
    generateAudio,
  };
}
