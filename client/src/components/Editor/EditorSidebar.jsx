import { useState } from 'react';
import {
  BookOpen, Upload, Volume2, Wand2, Mic, Loader, X,
  Music, FileAudio, RefreshCw, Trash2,
} from 'lucide-react';
import VoiceSelector, { DEFAULT_VOICE } from '../VoiceSelector';

export default function EditorSidebar({
  book,
  currentIndex,
  onSelectChapter,
  hasAudio,
  hasSyncData,
  onUpload,
  onGenerate,
  onAutoSync,
  onRegenerate,
  onDeleteAudio,
  onDeleteSync,
  bookId,
  syncProgress,
}) {
  const [activeTab, setActiveTab] = useState('chapters');
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE);
  const [selectedEngine, setSelectedEngine] = useState('stable-ts');
  const [error, setError] = useState('');

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try { await onUpload(file); }
    catch (err) { setError(err.response?.data?.error || 'Upload failed'); }
    setUploading(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try { await onGenerate(selectedVoice); }
    catch (err) { setError(err.response?.data?.error || 'Generation failed'); }
    setGenerating(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    try { await onAutoSync('word', { engine: selectedEngine }); }
    catch (err) { setError(err.response?.data?.error || 'Sync failed'); }
    setSyncing(false);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError('');
    try { await onRegenerate(selectedVoice, { engine: selectedEngine }); }
    catch (err) { setError(err.response?.data?.error || 'Re-generate failed'); }
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

  const isBusy = generating || syncing || regenerating || deleting;
  const chapters = book?.chapters || [];

  /* Shared engine selector */
  const engineSelect = (
    <div className="ed-engine-wrapper">
      <label className="ed-engine-label">Sync Engine</label>
      <select
        className="ed-engine-select"
        value={selectedEngine}
        onChange={e => setSelectedEngine(e.target.value)}
        disabled={isBusy}
      >
        <option value="stable-ts">Stable-TS (Default)</option>
        <option value="whisperx">WhisperX</option>
        <option value="auto">Auto (TTS timing)</option>
      </select>
    </div>
  );

  return (
    <div className="ed-sidebar">
      {/* Tab switcher */}
      <div className="ed-sidebar-tabs">
        <button
          className={`ed-sidebar-tab ${activeTab === 'chapters' ? 'active' : ''}`}
          onClick={() => setActiveTab('chapters')}
        >
          <BookOpen size={14} />
          <span>Chapters</span>
        </button>
        <button
          className={`ed-sidebar-tab ${activeTab === 'audio' ? 'active' : ''}`}
          onClick={() => setActiveTab('audio')}
        >
          <Music size={14} />
          <span>Audio</span>
        </button>
      </div>

      {/* Chapters tab */}
      {activeTab === 'chapters' && (
        <div className="ed-sidebar-content">
          <div className="ed-chapter-list">
            {chapters.map((ch, i) => (
              <button
                key={i}
                className={`ed-chapter-item ${i === currentIndex ? 'active' : ''}`}
                onClick={() => onSelectChapter(i)}
              >
                <span className="ed-chapter-num">{i + 1}</span>
                <span className="ed-chapter-title">{ch.title || `Chapter ${i + 1}`}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Audio tab */}
      {activeTab === 'audio' && (
        <div className="ed-sidebar-content">
          <div className="ed-audio-section">
            {/* Status row */}
            <div className="ed-audio-status">
              <FileAudio size={16} />
              <span>{hasAudio ? 'Audio loaded' : 'No audio'}</span>
              {hasSyncData && <span className="ed-sync-badge">Synced</span>}
            </div>

            {/* ── STATE 1: No audio yet ── */}
            {!hasAudio && (
              <div className="ed-audio-actions">
                <label className="ed-audio-action-btn">
                  {uploading ? <Loader size={14} className="spin" /> : <Upload size={14} />}
                  <span>{uploading ? 'Uploading...' : 'Upload Audio'}</span>
                  <input
                    type="file"
                    accept=".mp3,.wav,.m4a,.ogg,.flac,.aac"
                    style={{ display: 'none' }}
                    onChange={e => handleUpload(e.target.files[0])}
                  />
                </label>

                <div className="ed-divider-label">or generate with TTS</div>

                <VoiceSelector
                  value={selectedVoice}
                  onChange={setSelectedVoice}
                  className="ed-voice-select"
                />
                <button
                  className="ed-audio-action-btn ed-generate-btn"
                  onClick={handleGenerate}
                  disabled={generating}
                >
                  {generating ? <Loader size={14} className="spin" /> : <Volume2 size={14} />}
                  <span>{generating ? 'Generating...' : 'Generate Audio'}</span>
                </button>
              </div>
            )}

            {/* ── STATE 2: Audio loaded, not synced ── */}
            {hasAudio && !hasSyncData && (
              <div className="ed-audio-actions">
                {engineSelect}
                <button
                  className="ed-audio-action-btn ed-sync-action-btn"
                  onClick={handleSync}
                  disabled={isBusy}
                >
                  {syncing ? <Loader size={14} className="spin" /> : <Wand2 size={14} />}
                  <span>{syncing ? 'Syncing...' : 'Auto-Sync'}</span>
                </button>
                <a href={`/sync-editor/${bookId}/${currentIndex}`} className="ed-audio-action-btn">
                  <Mic size={14} />
                  <span>Manual Sync</span>
                </a>

                {/* Remove audio button */}
                <button
                  className="ed-audio-action-btn ed-remove-btn"
                  onClick={handleDeleteAudio}
                  disabled={isBusy}
                  title="Remove audio and start over"
                >
                  {deleting ? <Loader size={14} className="spin" /> : <X size={14} />}
                  <span>Remove Audio</span>
                </button>

                {syncing && syncProgress && (
                  <div className="ed-sync-progress">
                    <Loader size={12} className="spin" />
                    <span>{syncProgress.message}</span>
                  </div>
                )}
              </div>
            )}

            {/* ── STATE 3: Synced ── */}
            {hasAudio && hasSyncData && (
              <div className="ed-audio-ready">
                Audio is synced and ready for editing. Use the timeline below to trim.

                {/* Revert buttons */}
                <div className="ed-revert-row">
                  <button
                    className="ed-revert-btn"
                    onClick={handleDeleteSync}
                    disabled={isBusy}
                    title="Remove sync data only (keep audio)"
                  >
                    <X size={13} />
                    <span>Remove Sync</span>
                  </button>
                  <button
                    className="ed-revert-btn ed-revert-btn-danger"
                    onClick={handleDeleteAudio}
                    disabled={isBusy}
                    title="Remove audio and sync data"
                  >
                    <Trash2 size={13} />
                    <span>Remove Audio</span>
                  </button>
                </div>

                {/* Re-sync / Re-generate */}
                <div className="ed-audio-actions" style={{ marginTop: 10 }}>
                  {engineSelect}

                  <button
                    className="ed-audio-action-btn ed-sync-action-btn"
                    onClick={handleSync}
                    disabled={isBusy}
                  >
                    {syncing ? <Loader size={14} className="spin" /> : <Wand2 size={14} />}
                    <span>{syncing ? 'Re-syncing...' : 'Re-sync'}</span>
                  </button>

                  <div className="ed-divider-label">or regenerate with new voice</div>

                  <VoiceSelector
                    value={selectedVoice}
                    onChange={setSelectedVoice}
                    className="ed-voice-select"
                    disabled={isBusy}
                  />
                  <button
                    className="ed-audio-action-btn ed-generate-btn"
                    onClick={handleRegenerate}
                    disabled={isBusy}
                  >
                    {regenerating ? <Loader size={14} className="spin" /> : <RefreshCw size={14} />}
                    <span>{regenerating ? 'Regenerating...' : 'Regenerate Audio'}</span>
                  </button>
                </div>

                {(syncing || regenerating) && syncProgress && (
                  <div className="ed-sync-progress">
                    <Loader size={12} className="spin" />
                    <span>{syncProgress.message}</span>
                  </div>
                )}
              </div>
            )}

            {error && <div className="ed-audio-error">{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
