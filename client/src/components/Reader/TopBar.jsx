import { Menu, Search, Settings, Bookmark, BookOpen } from 'lucide-react';

export default function TopBar({
  title,
  onToggleSidebar,
  onToggleSearch,
  onToggleSettings,
  onToggleBookmarks,
  onAddBookmark,
}) {
  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <button className="icon-btn" onClick={onToggleSidebar} title="Toggle contents">
          <Menu size={18} />
        </button>
        <span className="top-bar-title">{title}</span>
      </div>

      <div className="top-bar-right">
        <button className="icon-btn" onClick={onToggleSearch} title="Search">
          <Search size={18} />
        </button>
        <button className="icon-btn" onClick={onToggleSettings} title="Settings">
          <Settings size={18} />
        </button>
        <button className="icon-btn" onClick={onAddBookmark} title="Bookmark this page">
          <Bookmark size={18} />
        </button>
        <button className="icon-btn" onClick={onToggleBookmarks} title="View bookmarks">
          <BookOpen size={18} />
        </button>
      </div>
    </div>
  );
}
