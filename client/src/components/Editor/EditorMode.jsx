import { useCallback } from 'react';
import EditorToolbar from './EditorToolbar';
import EditorTimeline from './EditorTimeline';
import EditorSidebar from './EditorSidebar';
import EditorProperties from './EditorProperties';
import ChapterView from '../Reader/ChapterView';

export default function EditorMode({
  reader,
  audio,
  overlay,
  bookId,
  onExitEditor,
  onTrimDone,
  onReSync,
  reSyncing,
}) {
  const hasSync = audio.hasSyncData;

  const handleWordClick = useCallback((wordId) => {
    if (hasSync) overlay.seekToWord(wordId);
  }, [hasSync, overlay]);

  return (
    <div className={`ed-root theme-${reader.theme} ${hasSync ? 'audio-synced' : ''} ${overlay.isPlaying ? 'audio-playing' : ''}`}>
      {/* Top toolbar */}
      <EditorToolbar
        bookTitle={reader.book.title}
        chapterTitle={reader.book.chapters[reader.chapterIndex]?.title || `Chapter ${reader.chapterIndex + 1}`}
        overlay={overlay}
        bookId={bookId}
        hasSyncData={hasSync}
        onExitEditor={onExitEditor}
      />

      {/* Main body: sidebar + canvas + properties */}
      <div className="ed-body">
        <EditorSidebar
          book={reader.book}
          currentIndex={reader.chapterIndex}
          onSelectChapter={reader.goToChapter}
          hasAudio={audio.hasAudio}
          hasSyncData={audio.hasSyncData}
          onUpload={audio.uploadAudio}
          onGenerate={async (voice) => { await audio.generateAudio(voice); }}
          onAutoSync={async (mode) => {
            const result = await audio.runAutoSync(mode);
            reader.reloadChapter();
            return result;
          }}
          bookId={bookId}
        />

        {/* Canvas area - the EPUB content */}
        <main className="ed-canvas" ref={reader.chapterRef}>
          <div className="ed-canvas-inner">
            <ChapterView
              html={reader.chapterHtml}
              fontSize={reader.fontSize}
              lineHeight={reader.lineHeight}
              readingMode="scroll"
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
              onWordClick={hasSync ? handleWordClick : undefined}
            />
          </div>
        </main>

        {hasSync && (
          <EditorProperties
            overlay={overlay}
            syncData={audio.syncData}
            onWordClick={handleWordClick}
          />
        )}
      </div>

      {/* Bottom timeline */}
      {audio.hasAudio && (
        <EditorTimeline
          bookId={bookId}
          chapterIndex={reader.chapterIndex}
          overlay={overlay}
          syncData={audio.syncData}
          onTrimDone={onTrimDone}
          onReSync={onReSync}
          reSyncing={reSyncing}
        />
      )}
    </div>
  );
}
