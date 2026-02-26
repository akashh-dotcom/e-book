import { useState, useRef } from 'react';
import { Upload, Mic, Loader, Wand2, Volume2, RefreshCw } from 'lucide-react';
import VoiceSelector, { DEFAULT_VOICE } from '../VoiceSelector';

export default function ChapterAudioUpload({
  hasAudio,
  hasSyncData,
  onUpload,
  onAutoSync,
  onGenerate,
  onRegenerate,
  bookId,
  chapterIndex,
  translatedLang,
  syncProgress,
  regenProgress,
}) {
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE);
  const [selectedEngine, setSelectedEngine] = useState('auto');
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
      await onRegenerate(selectedVoice);
    } catch (err) {
      setError(err.response?.data?.error || 'Re-generate failed');
    }
    setRegenerating(false);
  };

  const isBusy = regenerating || syncing;

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

          {onGenerate && (
            <div className="audio-generate-row">
              <VoiceSelector
                value={selectedVoice}
                onChange={setSelectedVoice}
                filterLang={translatedLang}
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

      {hasAudio && !hasSyncData && (
        <div className="sync-options">
          <select
            className="engine-select"
            value={selectedEngine}
            onChange={e => setSelectedEngine(e.target.value)}
            disabled={syncing}
          >
            <option value="auto">Auto (TTS/WhisperX)</option>
            <option value="whisperx">WhisperX</option>
            <option value="aeneas">Aeneas (DTW)</option>
            <option value="ensemble">Ensemble (Best)</option>
          </select>
          <button
            className="audio-upload-btn sync"
            onClick={() => handleSync('word')}
            disabled={syncing}
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
          {syncing && syncProgress && (
            <div className="sync-progress-status">
              <Loader size={12} className="spin" />
              <span>{syncProgress.message}</span>
            </div>
          )}
        </div>
      )}

      {hasSyncData && (
        <div className="sync-done-row">
          <span className="sync-ready">Audio synced</span>
          {onRegenerate && (
            <div className="audio-generate-row">
              <VoiceSelector
                value={selectedVoice}
                onChange={setSelectedVoice}
                filterLang={translatedLang}
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
                {regenerating ? 'Re-generating...' : 'Re-generate & Sync'}
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
