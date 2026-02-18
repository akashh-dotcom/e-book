import { useState } from 'react';
import {
  BookOpen, Upload, Volume2, Wand2, Mic, Loader, ChevronRight, ChevronDown,
  Music, FileAudio,
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
  bookId,
}) {
  const [activeTab, setActiveTab] = useState('chapters');
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE);
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
    try { await onAutoSync('word'); }
    catch (err) { setError(err.response?.data?.error || 'Sync failed'); }
    setSyncing(false);
  };

  const chapters = book?.chapters || [];

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
            <div className="ed-audio-status">
              <FileAudio size={16} />
              <span>{hasAudio ? 'Audio loaded' : 'No audio'}</span>
              {hasSyncData && <span className="ed-sync-badge">Synced</span>}
            </div>

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
                  <span>{generating ? 'Generating...' : 'Generate (TTS)'}</span>
                </button>
              </div>
            )}

            {hasAudio && !hasSyncData && (
              <div className="ed-audio-actions">
                <button
                  className="ed-audio-action-btn ed-sync-action-btn"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? <Loader size={14} className="spin" /> : <Wand2 size={14} />}
                  <span>{syncing ? 'Syncing...' : 'Auto-Sync (WhisperX)'}</span>
                </button>
                <a href={`/sync-editor/${bookId}/${currentIndex}`} className="ed-audio-action-btn">
                  <Mic size={14} />
                  <span>Manual Sync</span>
                </a>
              </div>
            )}

            {hasAudio && hasSyncData && (
              <div className="ed-audio-ready">
                Audio is synced and ready for editing. Use the timeline below to trim.
              </div>
            )}

            {error && <div className="ed-audio-error">{error}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
