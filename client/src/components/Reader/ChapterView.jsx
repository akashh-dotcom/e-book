import { useState, useCallback } from 'react';

export default function ChapterView({
  html,
  fontSize,
  lineHeight,
  readingMode,
  loading,
  onHighlight,
  onWordClick,
  textAlign,
}) {
  const [highlightPopup, setHighlightPopup] = useState(null);

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
        className={`chapter-content ${readingMode === 'paginated' ? 'paginated' : ''}${textAlign ? ` text-align-${textAlign}` : ''}`}
        style={{ fontSize: `${fontSize}px`, lineHeight }}
        dangerouslySetInnerHTML={{ __html: html }}
        onMouseUp={handleMouseUp}
        onClick={(e) => {
          // Click-word-to-seek: if user clicks a word span
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
    </>
  );
}
