import { useState, useRef } from 'react';
import { Upload, Mic, Loader, Wand2 } from 'lucide-react';

export default function ChapterAudioUpload({
  hasAudio,
  hasSyncData,
  onUpload,
  onAutoSync,
  bookId,
  chapterIndex,
}) {
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      await onUpload(file);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    }
    setUploading(false);
  };

  const handleSync = async (mode) => {
    setSyncing(true);
    setError('');
    try {
      await onAutoSync(mode);
    } catch (err) {
      setError(err.response?.data?.error || 'Sync failed');
    }
    setSyncing(false);
  };

  return (
    <div className="audio-upload-bar">
      {!hasAudio && (
        <>
          <button
            className="audio-upload-btn"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader size={14} className="spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading...' : 'Upload Audio'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".mp3,.wav,.m4a,.ogg,.flac,.aac"
            style={{ display: 'none' }}
            onChange={e => handleUpload(e.target.files[0])}
          />
        </>
      )}

      {hasAudio && !hasSyncData && (
        <div className="sync-options">
          <button
            className="audio-upload-btn sync"
            onClick={() => handleSync('word')}
            disabled={syncing}
          >
            {syncing ? <Loader size={14} className="spin" /> : <Wand2 size={14} />}
            {syncing ? 'Syncing...' : 'Auto-Sync (Aeneas)'}
          </button>
          <a
            href={`/sync-editor/${bookId}/${chapterIndex}`}
            className="audio-upload-btn manual"
          >
            <Mic size={14} /> Manual Sync
          </a>
        </div>
      )}

      {hasSyncData && (
        <span className="sync-ready">Audio synced</span>
      )}

      {error && <span className="audio-error">{error}</span>}
    </div>
  );
}
