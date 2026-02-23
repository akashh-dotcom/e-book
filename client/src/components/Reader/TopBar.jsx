import { useNavigate } from 'react-router-dom';
import { Menu, Search, Settings, Bookmark, BookOpen, PenTool, ArrowLeft } from 'lucide-react';

export default function TopBar({
  title,
  onToggleEditor,
  onToggleSidebar,
  onToggleSearch,
  onToggleSettings,
  onToggleBookmarks,
  onAddBookmark,
}) {
  const navigate = useNavigate();

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <button className="icon-btn" onClick={() => navigate('/dashboard')} title="Back to Dashboard">
          <ArrowLeft size={18} />
        </button>
        <button className="icon-btn" onClick={onToggleSidebar} title="Toggle contents">
          <Menu size={18} />
        </button>
        <span className="top-bar-title">{title}</span>
      </div>

      <div className="top-bar-right">
        {onToggleEditor && (
          <button className="edit-mode-btn" onClick={onToggleEditor} title="Open Editor">
            <PenTool size={15} />
            <span>Edit</span>
          </button>
        )}
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
