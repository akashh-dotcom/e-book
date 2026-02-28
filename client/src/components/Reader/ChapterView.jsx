import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import AnnotationContextMenu from './AnnotationContextMenu';
import api from '../../services/api';

export default function ChapterView({
  html,
  fontSize,
  lineHeight,
  readingMode,
  loading,
  onHighlight,
  onWordClick,
  textAlign,
  bookId,
  chapterIndex,
}) {
  const [highlightPopup, setHighlightPopup] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(null);
  const [wordTooltip, setWordTooltip] = useState(null); // { x, y, word, translation, loading }
  const contentRef = useRef(null);
  const wordTranslationCache = useRef({}); // cache: { "word|lang" -> translation }
  const wordHoverTimer = useRef(null);

  // Load annotations for this chapter
  useEffect(() => {
    if (!bookId || chapterIndex === undefined) return;
    api.get(`/annotations/${bookId}/${chapterIndex}`)
      .then(r => setAnnotations(r.data))
      .catch(() => {});
  }, [bookId, chapterIndex]);

  // Apply annotations to the DOM after HTML renders
  useEffect(() => {
    if (!contentRef.current || annotations.length === 0) return;
    const timer = setTimeout(() => applyAnnotationsToDOM(), 50);
    return () => clearTimeout(timer);
  }, [html, annotations]);

  const applyAnnotationsToDOM = () => {
    const container = contentRef.current;
    if (!container) return;

    annotations.forEach(ann => {
      if (!ann.selectedText) return;

      // Check if already applied
      const existingSpans = container.querySelectorAll(`[data-annotation-id="${ann._id}"]`);
      if (existingSpans.length > 0) {
        existingSpans.forEach(span => {
          span.style.backgroundColor = ann.backgroundColor || '';
          span.style.color = ann.fontColor || '';
          if (ann.translatedText) {
            span.setAttribute('data-translation', ann.translatedText);
            span.setAttribute('data-translated-lang', ann.translatedLang || '');
            span.classList.add('has-translation');
          } else {
            span.removeAttribute('data-translation');
            span.removeAttribute('data-translated-lang');
            span.classList.remove('has-translation');
          }
        });
        return;
      }

      wrapTextWithAnnotation(container, ann);
    });
  };

  const wrapTextWithAnnotation = (container, annotation) => {
    const searchText = annotation.selectedText;
    const occurrenceTarget = annotation.occurrenceIndex || 0;

    // Collect all text nodes with their position in the full concatenated text
    const textNodes = [];
    let fullText = '';
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let tNode;
    while ((tNode = walker.nextNode())) {
      if (tNode.parentElement?.closest('[data-annotation-id]')) continue;
      textNodes.push({ node: tNode, start: fullText.length });
      fullText += tNode.textContent;
    }

    // Find the nth occurrence in the concatenated text
    let matchStart = -1;
    let matchLength = searchText.length;
    let occurrenceCount = 0;
    let searchFrom = 0;
    while (searchFrom <= fullText.length - searchText.length) {
      const idx = fullText.indexOf(searchText, searchFrom);
      if (idx === -1) break;
      if (occurrenceCount === occurrenceTarget) {
        matchStart = idx;
        break;
      }
      occurrenceCount++;
      searchFrom = idx + 1;
    }

    // If exact match fails, try flexible whitespace matching (handles
    // newlines/extra spaces between block elements in cross-paragraph selections)
    if (matchStart === -1) {
      const normalized = searchText.replace(/\s+/g, ' ').trim();
      const escaped = normalized.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const pattern = escaped.replace(/ /g, '\\s+');
      const regex = new RegExp(pattern, 'g');
      occurrenceCount = 0;
      let m;
      while ((m = regex.exec(fullText)) !== null) {
        if (occurrenceCount === occurrenceTarget) {
          matchStart = m.index;
          matchLength = m[0].length;
          break;
        }
        occurrenceCount++;
        regex.lastIndex = m.index + 1;
      }
    }

    if (matchStart === -1) return;
    const matchEnd = matchStart + matchLength;

    // Wrap each text node segment that overlaps with the match.
    // Because we wrap within individual text nodes, surroundContents
    // never crosses element boundaries and cannot fail.
    const makeSpan = () => {
      const span = document.createElement('span');
      span.setAttribute('data-annotation-id', annotation._id);
      span.className = 'annotation-span';
      if (annotation.backgroundColor) span.style.backgroundColor = annotation.backgroundColor;
      if (annotation.fontColor) span.style.color = annotation.fontColor;
      if (annotation.translatedText) {
        span.setAttribute('data-translation', annotation.translatedText);
        span.setAttribute('data-translated-lang', annotation.translatedLang || '');
        span.classList.add('has-translation');
      }
      return span;
    };

    // Process in reverse so earlier node offsets remain valid
    const overlapping = [];
    for (const entry of textNodes) {
      const nodeStart = entry.start;
      const nodeEnd = nodeStart + entry.node.textContent.length;
      if (nodeEnd <= matchStart || nodeStart >= matchEnd) continue;
      const overlapStart = Math.max(0, matchStart - nodeStart);
      const overlapEnd = Math.min(entry.node.textContent.length, matchEnd - nodeStart);
      overlapping.push({ node: entry.node, overlapStart, overlapEnd });
    }

    for (let i = overlapping.length - 1; i >= 0; i--) {
      const { node, overlapStart, overlapEnd } = overlapping[i];
      // Skip whitespace-only segments
      if (!node.textContent.slice(overlapStart, overlapEnd).trim()) continue;
      const range = document.createRange();
      range.setStart(node, overlapStart);
      range.setEnd(node, overlapEnd);
      range.surroundContents(makeSpan());
    }
  };

  // Word-level hover translation
  const handleWordHover = useCallback((e) => {
    const target = e.target;
    const annotationSpan = target.closest('.annotation-span.has-translation');
    if (!annotationSpan) {
      if (wordTooltip) setWordTooltip(null);
      clearTimeout(wordHoverTimer.current);
      return;
    }

    // Get the word span element (each word is wrapped in <span id="wXXXXX">)
    const wordEl = target.id?.startsWith('w') ? target : target.closest('[id^="w"]');
    if (!wordEl) return;

    const wordText = wordEl.textContent.trim();
    if (!wordText) return;

    const lang = annotationSpan.getAttribute('data-translated-lang');
    if (!lang) return;

    const cacheKey = `${wordText.toLowerCase()}|${lang}`;
    const rect = wordEl.getBoundingClientRect();
    const tooltipX = rect.left + rect.width / 2;
    const tooltipY = rect.top - 6;

    // If cached, show immediately
    if (wordTranslationCache.current[cacheKey]) {
      setWordTooltip({
        x: tooltipX, y: tooltipY,
        word: wordText,
        translation: wordTranslationCache.current[cacheKey],
      });
      return;
    }

    // Fetch translation in background — only show tooltip once result arrives
    clearTimeout(wordHoverTimer.current);
    wordHoverTimer.current = setTimeout(async () => {
      try {
        const res = await api.post('/annotations/translate-text', {
          text: wordText,
          targetLang: lang,
          bookId,
        });
        const translated = res.data.translatedText;
        wordTranslationCache.current[cacheKey] = translated;
        // Only show if still hovering over this word
        setWordTooltip(prev => {
          // If tooltip was cleared (mouse left), don't show
          // If user moved to a different word, don't show either
          if (prev === null) return null;
          if (prev && prev.word !== wordText) return prev;
          return {
            x: tooltipX, y: tooltipY,
            word: wordText,
            translation: translated,
          };
        });
      } catch {
        // Silently fail — no tooltip shown
      }
    }, 300);

    // Set a placeholder state (no tooltip visible yet) so we can track which word is hovered
    setWordTooltip({ x: tooltipX, y: tooltipY, word: wordText, translation: null });
  }, [wordTooltip, bookId]);

  const handleWordLeave = useCallback((e) => {
    const related = e.relatedTarget;
    if (related && related.closest?.('.annotation-span.has-translation')) return;
    clearTimeout(wordHoverTimer.current);
    setWordTooltip(null);
  }, []);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setHighlightPopup(null);
      return;
    }

    const text = selection.toString().replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) {
      setHighlightPopup(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setHighlightPopup({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
  }, []);

  const handleHighlight = (color) => {
    if (highlightPopup && onHighlight) {
      onHighlight(highlightPopup.text, color);
    }
    setHighlightPopup(null);
    window.getSelection()?.removeAllRanges();
  };

  // Right-click context menu
  const handleContextMenu = useCallback((e) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return;

    e.preventDefault();
    setHighlightPopup(null);

    // Calculate occurrence index
    const container = contentRef.current;
    let occurrenceIndex = 0;
    if (container) {
      const range = selection.getRangeAt(0);
      const preRange = document.createRange();
      preRange.setStart(container, 0);
      preRange.setEnd(range.startContainer, range.startOffset);
      const textBefore = preRange.toString();

      let searchPos = 0;
      while (true) {
        const found = textBefore.indexOf(text, searchPos);
        if (found === -1) break;
        occurrenceIndex++;
        searchPos = found + 1;
      }
    }

    const existingAnnotation = annotations.find(
      a => a.selectedText === text && a.occurrenceIndex === occurrenceIndex
    );

    // Check if the right-click target is inside a translated annotation
    // to show its full translation in the context menu
    let fullTranslation = null;
    const annotationSpan = e.target.closest?.('.annotation-span.has-translation');
    if (annotationSpan) {
      fullTranslation = annotationSpan.getAttribute('data-translation');
    }
    // Also check the existing annotation for translation
    if (!fullTranslation && existingAnnotation?.translatedText) {
      fullTranslation = existingAnnotation.translatedText;
    }

    // Hide word tooltip when context menu opens
    clearTimeout(wordHoverTimer.current);
    setWordTooltip(null);

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      text,
      occurrenceIndex,
      existingAnnotation,
      fullTranslation,
    });
  }, [annotations]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e) => {
      if (!e.target.closest('.annotation-context-menu')) {
        closeContextMenu();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu, closeContextMenu]);

  const saveAnnotation = async (data) => {
    try {
      const res = await api.post('/annotations', {
        bookId,
        chapterIndex,
        ...data,
      });
      setAnnotations(prev => {
        const idx = prev.findIndex(a => a._id === res.data._id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = res.data;
          return updated;
        }
        return [...prev, res.data];
      });
      return res.data;
    } catch (err) {
      console.error('Failed to save annotation:', err);
      return null;
    }
  };

  const handleApplyBgColor = async (color) => {
    if (!contextMenu) return;
    const existing = contextMenu.existingAnnotation;
    await saveAnnotation({
      selectedText: contextMenu.text,
      occurrenceIndex: contextMenu.occurrenceIndex,
      backgroundColor: color,
      fontColor: existing?.fontColor || '',
      translatedText: existing?.translatedText || '',
      translatedLang: existing?.translatedLang || '',
    });
    window.getSelection()?.removeAllRanges();
  };

  const handleApplyFontColor = async (color) => {
    if (!contextMenu) return;
    const existing = contextMenu.existingAnnotation;
    await saveAnnotation({
      selectedText: contextMenu.text,
      occurrenceIndex: contextMenu.occurrenceIndex,
      backgroundColor: existing?.backgroundColor || '',
      fontColor: color,
      translatedText: existing?.translatedText || '',
      translatedLang: existing?.translatedLang || '',
    });
    window.getSelection()?.removeAllRanges();
  };

  const handleTranslateSelection = async (targetLang) => {
    if (!contextMenu) return;
    setTranslating(true);
    setTranslateError(null);
    try {
      const res = await api.post('/annotations/translate-text', {
        text: contextMenu.text,
        targetLang,
        bookId,
      });

      const translatedText = res.data.translatedText;
      const existing = contextMenu.existingAnnotation;

      await saveAnnotation({
        selectedText: contextMenu.text,
        occurrenceIndex: contextMenu.occurrenceIndex,
        backgroundColor: existing?.backgroundColor || '',
        fontColor: existing?.fontColor || '',
        translatedText,
        translatedLang: targetLang,
      });

      closeContextMenu();
      window.getSelection()?.removeAllRanges();
    } catch (err) {
      console.error('Translation failed:', err);
      const msg = err.response?.data?.error || err.message || 'Translation failed';
      setTranslateError(msg);
    } finally {
      setTranslating(false);
    }
  };

  const handleRemoveAnnotation = async () => {
    if (!contextMenu?.existingAnnotation) return;
    try {
      await api.delete(`/annotations/${contextMenu.existingAnnotation._id}`);
      setAnnotations(prev => prev.filter(a => a._id !== contextMenu.existingAnnotation._id));
      const span = contentRef.current?.querySelector(
        `[data-annotation-id="${contextMenu.existingAnnotation._id}"]`
      );
      if (span) {
        const parent = span.parentNode;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.removeChild(span);
      }
    } catch (err) {
      console.error('Failed to delete annotation:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div className="loading-spinner" />
        Loading chapter...
      </div>
    );
  }

  const highlightColors = [
    { name: 'yellow', color: '#fef08a' },
    { name: 'green', color: '#86efac' },
    { name: 'blue', color: '#93c5fd' },
    { name: 'pink', color: '#fda4af' },
  ];

  return (
    <>
      <div
        ref={contentRef}
        className={`chapter-content ${readingMode === 'paginated' ? 'paginated' : ''}${textAlign ? ` text-align-${textAlign}` : ''}`}
        style={{ fontSize: `${fontSize}px`, lineHeight }}
        dangerouslySetInnerHTML={{ __html: html }}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        onMouseOver={handleWordHover}
        onMouseOut={handleWordLeave}
        onClick={(e) => {
          if (onWordClick && e.target.id && e.target.id.startsWith('w')) {
            onWordClick(e.target.id);
          }
        }}
      />

      {/* Word-level translation tooltip — rendered via portal to body to avoid parent CSS interference */}
      {wordTooltip && wordTooltip.translation && createPortal(
        <div
          className="word-translation-tooltip"
          style={{
            left: `${wordTooltip.x}px`,
            top: `${wordTooltip.y}px`,
          }}
        >
          {wordTooltip.translation}
        </div>,
        document.body
      )}

      {highlightPopup && (
        <div
          className="highlight-popup"
          style={{
            left: highlightPopup.x,
            top: highlightPopup.y,
          }}
        >
          {highlightColors.map(c => (
            <button
              key={c.name}
              className="highlight-color-btn"
              style={{ background: c.color }}
              onClick={() => handleHighlight(c.name)}
              title={`Highlight ${c.name}`}
            />
          ))}
        </div>
      )}

      {contextMenu && (
        <AnnotationContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectedText={contextMenu.text}
          existingAnnotation={contextMenu.existingAnnotation}
          fullTranslation={contextMenu.fullTranslation}
          translating={translating}
          translateError={translateError}
          onApplyBgColor={handleApplyBgColor}
          onApplyFontColor={handleApplyFontColor}
          onTranslateSelection={handleTranslateSelection}
          onRemoveAnnotation={handleRemoveAnnotation}
          onClose={closeContextMenu}
        />
      )}
    </>
  );
}
