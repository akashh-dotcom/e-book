import { useState, useCallback, useEffect, useRef } from 'react';
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
  const contentRef = useRef(null);

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
    let occurrenceCount = 0;

    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest('[data-annotation-id]')) continue;

      const text = node.textContent;
      const idx = text.indexOf(searchText);
      if (idx === -1) continue;

      if (occurrenceCount < occurrenceTarget) {
        occurrenceCount++;
        continue;
      }

      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + searchText.length);

      const span = document.createElement('span');
      span.setAttribute('data-annotation-id', annotation._id);
      span.className = 'annotation-span';
      if (annotation.backgroundColor) {
        span.style.backgroundColor = annotation.backgroundColor;
      }
      if (annotation.fontColor) {
        span.style.color = annotation.fontColor;
      }
      if (annotation.translatedText) {
        span.setAttribute('data-translation', annotation.translatedText);
        span.setAttribute('data-translated-lang', annotation.translatedLang || '');
        span.classList.add('has-translation');
      }

      try {
        range.surroundContents(span);
      } catch {
        // surroundContents can fail if range crosses element boundaries
      }
      break;
    }
  };

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setHighlightPopup(null);
      return;
    }

    const text = selection.toString().trim();
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

    const text = selection.toString().trim();
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

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      text,
      occurrenceIndex,
      existingAnnotation,
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
        onClick={(e) => {
          if (onWordClick && e.target.id && e.target.id.startsWith('w')) {
            onWordClick(e.target.id);
          }
        }}
      />

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
          translating={translating}
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
