import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
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
import TrimEditorPanel from './TrimEditorPanel';
import ChapterAudioUpload from '../AudioUpload/ChapterAudioUpload';

export default function ReaderPage() {
  const { bookId } = useParams();
  const reader = useReader(bookId);

  // Audio & sync data
  const audio = useAudioPlayer(bookId, reader.chapterIndex);
  const overlay = useMediaOverlay(audio.syncData, audio.audioUrl);
  const [trimEditorOpen, setTrimEditorOpen] = useState(false);
  const [reSyncing, setReSyncing] = useState(false);

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

  const handleTrimDone = useCallback((newDuration) => {
    // After trim, sync data is deleted — reload audio and sync state
    audio.reloadAudio();
    audio.reloadSync();
  }, [audio]);

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

  return (
    <div className={`reader-root theme-${reader.theme} ${hasSync ? 'audio-synced' : ''} ${overlay.isPlaying ? 'audio-playing' : ''}`}>
      <TopBar
        title={reader.book.title}
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
              bookId={bookId}
              chapterIndex={reader.chapterIndex}
            />

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

        {trimEditorOpen && audio.hasAudio && (
          <TrimEditorPanel
            bookId={bookId}
            chapterIndex={reader.chapterIndex}
            overlay={overlay}
            onClose={() => setTrimEditorOpen(false)}
            onTrimDone={handleTrimDone}
          />
        )}
      </div>

      {audio.hasAudio && (
        <AudioBar
          overlay={overlay}
          bookId={bookId}
          hasSyncData={hasSync}
          onToggleTrimEditor={() => setTrimEditorOpen(!trimEditorOpen)}
          trimEditorOpen={trimEditorOpen}
          onReSync={handleReSync}
          reSyncing={reSyncing}
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
