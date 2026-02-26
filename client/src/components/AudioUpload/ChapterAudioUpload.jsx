import { useState, useRef } from 'react';
import { Upload, Mic, Loader, Wand2, Volume2, RefreshCw, X, Trash2 } from 'lucide-react';
import VoiceSelector, { DEFAULT_VOICE } from '../VoiceSelector';

export default function ChapterAudioUpload({
  hasAudio,
  hasSyncData,
  onUpload,
  onAutoSync,
  onGenerate,
  onRegenerate,
  onDeleteAudio,
  onDeleteSync,
  bookId,
  chapterIndex,
  bookLanguage,
  translatedLang,
  syncProgress,
  regenProgress,
}) {
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE);
  const [selectedEngine, setSelectedEngine] = useState('stable-ts');
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
      await onAutoSync(mode, { engine: selectedEngine });
    } catch (err) {
      setError(err.response?.data?.error || 'Sync failed');
    }
    setSyncing(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      await onGenerate(selectedVoice);
    } catch (err) {
      setError(err.response?.data?.error || 'Audio generation failed');
    }
    setGenerating(false);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError('');
    try {
      await onRegenerate(selectedVoice, { engine: selectedEngine });
    } catch (err) {
      setError(err.response?.data?.error || 'Re-generate failed');
    }
    setRegenerating(false);
  };

  const handleDeleteAudio = async () => {
    if (!onDeleteAudio) return;
    setDeleting(true);
    setError('');
    try { await onDeleteAudio(); }
    catch (err) { setError(err.response?.data?.error || 'Delete failed'); }
    setDeleting(false);
  };

  const handleDeleteSync = async () => {
    if (!onDeleteSync) return;
    setDeleting(true);
    setError('');
    try { await onDeleteSync(); }
    catch (err) { setError(err.response?.data?.error || 'Delete failed'); }
    setDeleting(false);
  };

  // Filter voices to the active language: translated language takes priority, otherwise book's own language
  const voiceFilterLang = translatedLang || (bookLanguage ? bookLanguage.split('-')[0] : null);

  const isBusy = regenerating || syncing || generating || deleting;

  return (
    <div className="audio-upload-bar">
      {/* ── No audio ── */}
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

          {onGenerate && (
            <div className="audio-generate-row">
              <VoiceSelector
                value={selectedVoice}
                onChange={setSelectedVoice}
                filterLang={voiceFilterLang}
              />

              <button
                className="audio-upload-btn generate"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? <Loader size={14} className="spin" /> : <Volume2 size={14} />}
                {generating ? 'Generating...' : 'Generate'}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Audio loaded, not synced ── */}
      {hasAudio && !hasSyncData && (
        <div className="sync-options">
          <div className="engine-select-wrapper">
            <label className="engine-select-label">Sync Engine</label>
            <select
              className="engine-select"
              value={selectedEngine}
              onChange={e => setSelectedEngine(e.target.value)}
              disabled={isBusy}
            >
              <option value="stable-ts">Stable-TS (Default)</option>
              <option value="whisperx">WhisperX</option>
              <option value="auto">Auto (TTS timing)</option>
            </select>
          </div>
          <button
            className="audio-upload-btn sync"
            onClick={() => handleSync('word')}
            disabled={isBusy}
          >
            {syncing ? <Loader size={14} className="spin" /> : <Wand2 size={14} />}
            {syncing ? 'Syncing...' : 'Auto-Sync'}
          </button>
          <a
            href={`/sync-editor/${bookId}/${chapterIndex}`}
            className="audio-upload-btn manual"
          >
            <Mic size={14} /> Manual Sync
          </a>
          <button
            className="audio-upload-btn remove"
            onClick={handleDeleteAudio}
            disabled={isBusy}
            title="Remove audio and start over"
          >
            {deleting ? <Loader size={14} className="spin" /> : <X size={14} />}
            Remove Audio
          </button>
          {syncing && syncProgress && (
            <div className="sync-progress-status">
              <Loader size={12} className="spin" />
              <span>{syncProgress.message}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Synced ── */}
      {hasSyncData && (
        <div className="sync-done-row">
          <span className="sync-ready">Audio synced</span>

          {/* Revert buttons */}
          <div className="revert-row">
            <button
              className="revert-btn"
              onClick={handleDeleteSync}
              disabled={isBusy}
              title="Remove sync data only (keep audio)"
            >
              <X size={13} />
              <span>Remove Sync</span>
            </button>
            <button
              className="revert-btn revert-btn-danger"
              onClick={handleDeleteAudio}
              disabled={isBusy}
              title="Remove audio and sync data"
            >
              <Trash2 size={13} />
              <span>Remove Audio</span>
            </button>
          </div>

          <div className="resync-row">
            <div className="engine-select-wrapper">
              <label className="engine-select-label">Sync Engine</label>
              <select
                className="engine-select"
                value={selectedEngine}
                onChange={e => setSelectedEngine(e.target.value)}
                disabled={isBusy}
              >
                <option value="stable-ts">Stable-TS (Default)</option>
                <option value="whisperx">WhisperX</option>
                <option value="auto">Auto (TTS timing)</option>
              </select>
            </div>
            <button
              className="audio-upload-btn sync"
              onClick={() => handleSync('word')}
              disabled={isBusy}
            >
              {syncing ? <Loader size={14} className="spin" /> : <Wand2 size={14} />}
              {syncing ? 'Re-syncing...' : 'Re-sync'}
            </button>
          </div>
          {syncing && syncProgress && (
            <div className="sync-progress-status">
              <Loader size={12} className="spin" />
              <span>{syncProgress.message}</span>
            </div>
          )}
          {onRegenerate && (
            <div className="audio-generate-row">
              <VoiceSelector
                value={selectedVoice}
                onChange={setSelectedVoice}
                filterLang={voiceFilterLang}
                disabled={isBusy}
              />
              <button
                className="audio-upload-btn regenerate"
                onClick={handleRegenerate}
                disabled={isBusy}
              >
                {regenerating
                  ? <Loader size={14} className="spin" />
                  : <RefreshCw size={14} />}
                {regenerating ? 'Regenerating...' : 'Regenerate Audio'}
              </button>
            </div>
          )}
          {regenerating && regenProgress && (
            <div className="regen-progress">
              <div className="regen-progress-info">
                <Loader size={12} className="spin" />
                <span>{regenProgress.message}</span>
                <span className="regen-pct">{regenProgress.percent}%</span>
              </div>
              <div className="regen-progress-bar">
                <div
                  className="regen-progress-fill"
                  style={{ width: `${regenProgress.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {error && <span className="audio-error">{error}</span>}
    </div>
  );
}
