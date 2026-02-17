import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * Hook to manage audio & sync data loading for a chapter.
 */
export function useAudioPlayer(bookId, chapterIndex) {
  const [audioUrl, setAudioUrl] = useState(null);
  const [syncData, setSyncData] = useState(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [hasSyncData, setHasSyncData] = useState(false);

  useEffect(() => {
    if (!bookId || chapterIndex === undefined) return;
    setAudioUrl(null);
    setSyncData(null);
    setHasAudio(false);
    setHasSyncData(false);

    // Check for audio
    api.get(`/audio/${bookId}/${chapterIndex}`)
      .then(res => {
        setAudioUrl(res.data.url);
        setHasAudio(true);
      })
      .catch(() => {});

    // Check for sync data
    api.get(`/sync/${bookId}/${chapterIndex}`)
      .then(res => {
        setSyncData(res.data.syncData);
        setHasSyncData(true);
      })
      .catch(() => {});
  }, [bookId, chapterIndex]);

  const uploadAudio = useCallback(async (file) => {
    const formData = new FormData();
    formData.append('audio', file);
    const res = await api.post(
      `/audio/${bookId}/${chapterIndex}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    setAudioUrl(`/api/audio/${bookId}/${chapterIndex}/stream`);
    setHasAudio(true);
    return res.data;
  }, [bookId, chapterIndex]);

  const runAutoSync = useCallback(async (mode = 'word') => {
    const res = await api.post(`/sync/${bookId}/${chapterIndex}/auto`, { mode });
    // Reload sync data
    const syncRes = await api.get(`/sync/${bookId}/${chapterIndex}`);
    setSyncData(syncRes.data.syncData);
    setHasSyncData(true);
    return res.data;
  }, [bookId, chapterIndex]);

  const updateSyncData = useCallback((newSyncData) => {
    setSyncData(newSyncData);
  }, []);

  const reloadSync = useCallback(() => {
    api.get(`/sync/${bookId}/${chapterIndex}`)
      .then(res => {
        setSyncData(res.data.syncData);
        setHasSyncData(true);
      })
      .catch(() => {});
  }, [bookId, chapterIndex]);

  return {
    audioUrl,
    syncData,
    hasAudio,
    hasSyncData,
    uploadAudio,
    runAutoSync,
    updateSyncData,
    reloadSync,
  };
}
