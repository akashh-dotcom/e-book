import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen, Trash2, ChevronRight, Upload, Plus,
  LayoutDashboard, Search, Loader, LogOut, ArrowLeft, User,
} from 'lucide-react';
import useBookStore from '../store/bookStore';
import useAuthStore from '../store/authStore';
import ProfilePanel from './ProfilePanel';

export default function Dashboard() {
  const { books, fetchBooks, deleteBook, uploadBook } = useBookStore();
  const { user, logout } = useAuthStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchBooks().finally(() => setLoading(false));
  }, [fetchBooks]);

  const handleDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Delete this book?')) {
      await deleteBook(id);
    }
  };

  const handleFile = async (file) => {
    if (!file || !file.name.endsWith('.epub')) {
      setError('Please select an .epub file');
      return;
    }
    setUploading(true);
    setError('');
    setProgress(0);
    try {
      const book = await uploadBook(file, setProgress);
      navigate(`/read/${book._id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
      setUploading(false);
    }
  };

  const filtered = books.filter(b =>
    b.title?.toLowerCase().includes(search.toLowerCase()) ||
    b.author?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-forest-950 text-forest-100 font-sans">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col bg-forest-950/70 border-r border-forest-500/8 p-5 sticky top-0 h-screen
        max-md:w-full max-md:h-auto max-md:relative max-md:flex-row max-md:items-center max-md:p-3 max-md:gap-3">
        <Link to="/" className="flex items-center gap-2.5 text-forest-100 no-underline text-lg font-bold tracking-tight px-2 mb-7 max-md:mb-0">
          <BookOpen size={22} className="text-forest-400" />
          <span>VoxBook</span>
        </Link>

        <nav className="flex flex-col gap-0.5 flex-1 max-md:flex-row max-md:flex-none">
          <Link to="/"
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-forest-200/50 no-underline hover:bg-white/[0.04] hover:text-forest-50 transition-all">
            <ArrowLeft size={18} />
            <span>Home</span>
          </Link>
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-forest-50 bg-forest-500/10">
            <LayoutDashboard size={18} className="text-forest-400" />
            <span>Library</span>
          </div>
        </nav>

        <div className="mt-auto pt-4 border-t border-forest-500/8 max-md:mt-0 max-md:ml-auto max-md:pt-0 max-md:border-0">
          {/* User profile pill */}
          {user && (
            <button onClick={() => setProfileOpen(true)}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 mb-3 rounded-xl bg-white/[0.03] border border-white/[0.06] text-left
                hover:bg-white/[0.06] transition-all cursor-pointer font-[inherit]">
              {user.avatar ? (
                <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-forest-400/20 flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-forest-500 to-forest-400 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {user.username?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-forest-50 truncate">{user.username}</p>
                <p className="text-[11px] text-forest-200/35 truncate">{user.email}</p>
              </div>
            </button>
          )}

          <button
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-forest-500 to-forest-400 text-forest-950 text-sm font-semibold
              shadow-[0_2px_12px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(16,185,129,0.45)] active:translate-y-0
              disabled:opacity-70 disabled:cursor-default transition-all cursor-pointer border-none font-[inherit]"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader size={18} className="animate-spin" /> : <Plus size={18} />}
            {uploading ? `Uploading ${progress}%` : 'Upload EPUB'}
          </button>
          <input ref={fileInputRef} type="file" accept=".epub" className="hidden"
            onChange={e => handleFile(e.target.files[0])} />
          {error && <p className="mt-2 text-xs text-candy-400 text-center">{error}</p>}
          {user && (
            <button onClick={() => { logout(); navigate('/login'); }}
              className="flex items-center justify-center gap-2 w-full mt-3 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-forest-200/60 text-sm
                hover:bg-white/[0.06] hover:text-forest-50 transition-all cursor-pointer font-[inherit]">
              <LogOut size={16} />
              Logout
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 p-7 overflow-y-auto max-md:p-5">
        <header className="flex items-end justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-forest-50 to-forest-300 bg-clip-text text-transparent">
              Your Library
            </h1>
            <p className="text-sm text-forest-500/60 mt-1">{books.length} {books.length === 1 ? 'book' : 'books'}</p>
          </div>
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-forest-500/10 bg-forest-500/[0.04] min-w-[220px]
            focus-within:border-forest-500/40 focus-within:bg-forest-500/[0.06] focus-within:shadow-[0_0_0_3px_rgba(16,185,129,0.1)] transition-all">
            <Search size={16} className="text-forest-600 flex-shrink-0" />
            <input type="text" placeholder="Search books..."
              className="border-none bg-transparent outline-none text-forest-100 text-sm font-[inherit] w-full placeholder:text-forest-700"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center text-center py-20 text-forest-600">
            <div className="w-6 h-6 border-3 border-forest-200 border-t-forest-500 rounded-full animate-spin mb-4" />
            <p>Loading your library...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            {books.length === 0 ? (
              <>
                <div className="w-20 h-20 rounded-2xl bg-forest-500/8 flex items-center justify-center text-forest-600 mb-5">
                  <BookOpen size={48} />
                </div>
                <h3 className="text-lg font-semibold text-forest-400 mb-1.5">No books yet</h3>
                <p className="text-sm text-forest-600 mb-5">Upload your first EPUB to get started.</p>
                <button
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-dashed border-forest-500/30 bg-forest-500/[0.06] text-forest-300 text-sm font-semibold
                    hover:bg-forest-500/[0.12] hover:border-forest-500/50 hover:text-forest-200 transition-all cursor-pointer font-[inherit]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={18} />
                  Upload EPUB
                </button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-2xl bg-forest-500/8 flex items-center justify-center text-forest-600 mb-5">
                  <Search size={48} />
                </div>
                <h3 className="text-lg font-semibold text-forest-400 mb-1.5">No results</h3>
                <p className="text-sm text-forest-600">No books match "{search}"</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {filtered.map((book, i) => (
              <Link key={book._id} to={`/read/${book._id}`}
                className="flex items-stretch no-underline text-inherit rounded-2xl border border-forest-500/8 bg-forest-500/[0.02] overflow-hidden
                  hover:border-forest-500/25 hover:bg-forest-500/[0.05] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3),0_0_0_1px_rgba(16,185,129,0.1)]
                  transition-all duration-300 cursor-pointer group"
                style={{ animationDelay: `${i * 50}ms` }}>
                <div className="w-[72px] flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-forest-500/12 to-forest-600/8 text-forest-400 border-r border-forest-500/5 overflow-hidden">
                  {book.cover ? (
                    <img src={`/storage/books/${book._id}/assets/${book.cover}`} alt={book.title} draggable={false} className="w-full h-full object-cover" />
                  ) : (
                    <BookOpen size={28} />
                  )}
                </div>
                <div className="flex-1 min-w-0 px-4 py-3.5 flex flex-col justify-center gap-0.5">
                  <div className="text-sm font-semibold text-forest-50 truncate tracking-tight">{book.title}</div>
                  {book.author && <div className="text-xs text-forest-400/60 truncate">{book.author}</div>}
                  <div className="text-[11px] text-forest-600 mt-0.5">
                    {book.totalChapters} {book.totalChapters === 1 ? 'chapter' : 'chapters'}
                  </div>
                </div>
                <div className="flex flex-col items-center justify-center px-3 gap-2">
                  <button
                    className="flex items-center justify-center w-7 h-7 rounded-lg bg-transparent text-forest-700 hover:bg-red-500/12 hover:text-candy-400 transition-all cursor-pointer border-none"
                    onClick={(e) => handleDelete(e, book._id)}
                    title="Delete book"
                  >
                    <Trash2 size={14} />
                  </button>
                  <span className="text-forest-800 group-hover:text-forest-400 group-hover:translate-x-0.5 transition-all">
                    <ChevronRight size={16} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Profile modal */}
      <ProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
