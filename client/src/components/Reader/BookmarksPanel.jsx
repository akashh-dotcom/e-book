import { Bookmark, Highlighter, X, Trash2 } from 'lucide-react';

export default function BookmarksPanel({ bookmarks, onNavigate, onDelete, onClose }) {
  const bookmarkItems = bookmarks.filter(b => b.type === 'bookmark');
  const highlightItems = bookmarks.filter(b => b.type === 'highlight');

  return (
    <div className="bookmarks-panel">
      <div className="bookmarks-panel-header">
        <span>Bookmarks & Highlights</span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
        >
          <X size={16} />
        </button>
      </div>

      <div className="bookmarks-list">
        {bookmarkItems.length > 0 && (
          <>
            <div style={{ padding: '8px 16px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Bookmarks
            </div>
            {bookmarkItems.map(bm => (
              <div
                key={bm._id}
                className="bookmark-item"
                onClick={() => onNavigate(bm.chapterIndex)}
              >
                <Bookmark size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                <div className="bookmark-item-info">
                  <div className="bookmark-chapter">{bm.label}</div>
                  <div className="bookmark-text">Chapter {bm.chapterIndex + 1}</div>
                </div>
                <button
                  className="bookmark-delete"
                  onClick={(e) => { e.stopPropagation(); onDelete(bm._id); }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </>
        )}

        {highlightItems.length > 0 && (
          <>
            <div style={{ padding: '8px 16px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Highlights
            </div>
            {highlightItems.map(hl => (
              <div
                key={hl._id}
                className="bookmark-item"
                onClick={() => onNavigate(hl.chapterIndex)}
              >
                <Highlighter size={14} style={{ color: hl.highlightColor === 'yellow' ? '#eab308' : hl.highlightColor, flexShrink: 0, marginTop: 2 }} />
                <div className="bookmark-item-info">
                  <div className="bookmark-chapter">Chapter {hl.chapterIndex + 1}</div>
                  <div className="bookmark-text">"{hl.highlightText}"</div>
                </div>
                <button
                  className="bookmark-delete"
                  onClick={(e) => { e.stopPropagation(); onDelete(hl._id); }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </>
        )}

        {bookmarks.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.88rem' }}>
            No bookmarks or highlights yet
          </div>
        )}
      </div>
    </div>
  );
}
