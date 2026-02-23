import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Languages, X, Loader } from 'lucide-react';
import useReader from '../../hooks/useReader';
import { useAudioPlayer } from '../../hooks/useAudioPlayer';
import { useMediaOverlay } from '../../hooks/useMediaOverlay';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ChapterView from './ChapterView';
import BottomBar from './BottomBar';
import SearchPanel from './SearchPanel';
import SettingsPanel from './SettingsPanel';
import BookmarksPanel from './BookmarksPanel';
import AudioBar from './AudioBar';
import ChapterAudioUpload from '../AudioUpload/ChapterAudioUpload';
import EditorMode from '../Editor/EditorMode';

export default function ReaderPage() {
  const { bookId } = useParams();
  const reader = useReader(bookId);

  // Audio & sync data
  const audio = useAudioPlayer(bookId, reader.chapterIndex);
  const overlay = useMediaOverlay(audio.syncData, audio.audioUrl);
  const [reSyncing, setReSyncing] = useState(false);
  const [editorMode, setEditorMode] = useState(false);

  const handleReSync = useCallback(async () => {
    setReSyncing(true);
    try {
      await audio.runAutoSync('word');
      reader.reloadChapter();
    } catch {
      // error handled by runAutoSync
    } finally {
      setReSyncing(false);
    }
  }, [audio, reader]);

  const handleTrimDone = useCallback((result) => {
    if (result?.syncData) {
      // Word-based trim — update sync data in place
      audio.updateSyncData(result.syncData);
      reader.reloadChapter();
    } else {
      // Direct trim or restore — reload everything
      audio.reloadAudio();
      audio.reloadSync();
    }
  }, [audio, reader]);

  if (reader.loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        Loading book...
      </div>
    );
  }

  if (!reader.book) {
    return (
      <div className="loading">
        Book not found
      </div>
    );
  }

  const hasSync = audio.hasSyncData;

  // === EDITOR MODE ===
  if (editorMode) {
    return (
      <EditorMode
        reader={reader}
        audio={audio}
        overlay={overlay}
        bookId={bookId}
        onExitEditor={() => setEditorMode(false)}
        onTrimDone={handleTrimDone}
        onReSync={handleReSync}
        reSyncing={reSyncing}
      />
    );
  }

  // === READER MODE ===
  return (
    <div className={`reader-root theme-${reader.theme} ${hasSync ? 'audio-synced' : ''} ${overlay.isPlaying ? 'audio-playing' : ''}`}>
      <TopBar
        title={reader.book.title}
        onToggleEditor={() => setEditorMode(true)}
        onToggleSidebar={() => reader.setSidebarOpen(!reader.sidebarOpen)}
        onToggleSearch={() => {
          reader.setSearchOpen(!reader.searchOpen);
          reader.setSettingsOpen(false);
          reader.setBookmarksOpen(false);
        }}
        onToggleSettings={() => {
          reader.setSettingsOpen(!reader.settingsOpen);
          reader.setSearchOpen(false);
          reader.setBookmarksOpen(false);
        }}
        onToggleBookmarks={() => {
          reader.setBookmarksOpen(!reader.bookmarksOpen);
          reader.setSearchOpen(false);
          reader.setSettingsOpen(false);
        }}
        onAddBookmark={() => {
          reader.addBookmark({
            type: 'bookmark',
            label: reader.book.chapters[reader.chapterIndex]?.title || `Chapter ${reader.chapterIndex + 1}`,
            scrollPosition: reader.chapterRef.current?.scrollTop || 0,
          });
        }}
      />

      <div className="reader-body">
        <Sidebar
          toc={reader.book.toc}
          chapters={reader.book.chapters}
          currentIndex={reader.chapterIndex}
          onSelect={reader.goToChapter}
          isOpen={reader.sidebarOpen}
        />

        <main className="reader-content" ref={reader.chapterRef}>
          <div className="reader-content-inner">
            <ChapterAudioUpload
              hasAudio={audio.hasAudio}
              hasSyncData={audio.hasSyncData}
              onUpload={audio.uploadAudio}
              onAutoSync={async (mode) => {
                const result = await audio.runAutoSync(mode);
                reader.reloadChapter();
                return result;
              }}
              onGenerate={async (voice, opts) => {
                await audio.generateAudio(voice, opts);
              }}
              bookId={bookId}
              chapterIndex={reader.chapterIndex}
              bookLanguage={reader.book.language}
              onTranslate={reader.translateTo}
            />

            {/* Translation indicator bar */}
            {reader.translatedLang && (
              <div className="translation-bar">
                <Languages size={14} />
                <span>
                  Translated to <strong>{reader.translatedLang.toUpperCase()}</strong>
                </span>
                <button
                  className="translation-bar-btn"
                  onClick={reader.showOriginal}
                  title="Show original text"
                >
                  <X size={12} /> Original
                </button>
              </div>
            )}

            {reader.translating && (
              <div className="translation-bar translating">
                <Loader size={14} className="spin" />
                <span>Translating chapter...</span>
              </div>
            )}

            <ChapterView
              html={reader.chapterHtml}
              fontSize={reader.fontSize}
              lineHeight={reader.lineHeight}
              readingMode={reader.readingMode}
              loading={reader.chapterLoading}
              bookId={bookId}
              chapterIndex={reader.chapterIndex}
              onHighlight={(text, color) => {
                reader.addBookmark({
                  type: 'highlight',
                  highlightText: text,
                  highlightColor: color,
                });
              }}
              onWordClick={hasSync ? overlay.seekToWord : undefined}
            />
          </div>
        </main>

        {reader.searchOpen && (
          <SearchPanel
            bookId={bookId}
            onNavigate={reader.goToChapter}
            onClose={() => reader.setSearchOpen(false)}
          />
        )}

        {reader.settingsOpen && (
          <SettingsPanel
            fontSize={reader.fontSize}
            setFontSize={reader.setFontSize}
            theme={reader.theme}
            setTheme={reader.setTheme}
            lineHeight={reader.lineHeight}
            setLineHeight={reader.setLineHeight}
            readingMode={reader.readingMode}
            setReadingMode={reader.setReadingMode}
          />
        )}

        {reader.bookmarksOpen && (
          <BookmarksPanel
            bookmarks={reader.bookmarks}
            onNavigate={(chapterIdx) => {
              reader.goToChapter(chapterIdx);
              reader.setBookmarksOpen(false);
            }}
            onDelete={reader.removeBookmark}
            onClose={() => reader.setBookmarksOpen(false)}
          />
        )}

      </div>

      {audio.hasAudio && (
        <AudioBar
          overlay={overlay}
          bookId={bookId}
          hasSyncData={hasSync}
        />
      )}

      <BottomBar
        current={reader.chapterIndex}
        total={reader.book.totalChapters}
        chapterTitle={reader.book.chapters[reader.chapterIndex]?.title}
        onPrev={reader.goPrev}
        onNext={reader.goNext}
      />
    </div>
  );
}
