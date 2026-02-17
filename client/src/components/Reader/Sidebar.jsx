import { useState } from 'react';
import { ChevronRight, ChevronDown, BookOpen } from 'lucide-react';

export default function Sidebar({
  toc, chapters, currentIndex, onSelect, isOpen
}) {
  if (!isOpen) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <BookOpen size={16} />
        <span>Contents</span>
      </div>

      <nav className="toc-list">
        {toc && toc.length > 0 ? (
          toc.map((entry, i) => (
            <TocItem
              key={i}
              entry={entry}
              chapterIndex={i}
              currentIndex={currentIndex}
              onSelect={onSelect}
            />
          ))
        ) : (
          chapters && chapters.map((ch, i) => (
            <button
              key={i}
              className={`toc-entry ${i === currentIndex ? 'active' : ''}`}
              onClick={() => onSelect(i)}
            >
              {ch.title}
            </button>
          ))
        )}
      </nav>

      <div className="sidebar-footer">
        {chapters ? chapters.length : 0} chapters
      </div>
    </aside>
  );
}

function TocItem({ entry, chapterIndex, currentIndex, onSelect }) {
  const [open, setOpen] = useState(false);
  const hasChildren = entry.children && entry.children.length > 0;

  return (
    <div className="toc-group">
      <button
        className={`toc-entry ${chapterIndex === currentIndex ? 'active' : ''}`}
        onClick={() => {
          onSelect(chapterIndex);
          if (hasChildren) setOpen(!open);
        }}
      >
        {hasChildren && (
          <span className="toc-arrow">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
        <span className="toc-title">{entry.title}</span>
      </button>

      {hasChildren && open && (
        <div className="toc-children">
          {entry.children.map((child, j) => (
            <button
              key={j}
              className="toc-entry toc-child"
              onClick={() => onSelect(chapterIndex)}
            >
              {child.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
