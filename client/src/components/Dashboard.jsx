import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen, Trash2, ChevronRight, Upload, Plus,
  LayoutDashboard, Search, Loader, LogOut, ArrowLeft, Sparkles,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (searchParams.get('payment') === 'success') {
      setPaymentSuccess(true);
      searchParams.delete('payment');
      setSearchParams(searchParams, { replace: true });
      const t = setTimeout(() => setPaymentSuccess(false), 5000);
      return () => clearTimeout(t);
    }
  }, []);

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

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  };

  const filtered = books.filter(b =>
    b.title?.toLowerCase().includes(search.toLowerCase()) ||
    b.author?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="flex min-h-screen bg-forest-950 text-forest-100 font-sans"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-50 bg-forest-950/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-4 p-10 rounded-3xl border-2 border-dashed border-forest-400 bg-forest-500/10 animate-pulse">
            <Upload size={48} className="text-forest-400" />
            <p className="text-xl font-semibold text-forest-200">Drop EPUB file here</p>
          </div>
        </div>
      )}

      {/* ── Sidebar ── */}
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
          {user && (
            <button onClick={() => { logout(); navigate('/login'); }}
              className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-forest-200/60 text-sm
                hover:bg-white/[0.06] hover:text-forest-50 transition-all cursor-pointer font-[inherit]">
              <LogOut size={16} />
              Logout
            </button>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 min-w-0 p-7 overflow-y-auto max-md:p-5">
        {paymentSuccess && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-forest-500/15 border border-forest-500/25 text-forest-300 text-sm font-medium flex items-center gap-2 animate-fade-in-up">
            Payment successful! Your plan has been upgraded.
          </div>
        )}

        {/* Header row: title + upload button + search */}
        <header className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-forest-50 to-forest-300 bg-clip-text text-transparent">
              Your Library
            </h1>
            <p className="text-sm text-forest-500/60 mt-1">{books.length} {books.length === 1 ? 'book' : 'books'}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Upload button — prominent at top */}
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-forest-500 to-forest-400 text-forest-950 text-sm font-semibold
                shadow-[0_2px_12px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(16,185,129,0.45)] active:translate-y-0
                disabled:opacity-70 disabled:cursor-default transition-all cursor-pointer border-none font-[inherit] animate-pulse-glow"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
              {uploading ? `Uploading ${progress}%` : 'Upload EPUB'}
            </button>
            <input ref={fileInputRef} type="file" accept=".epub" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />
            {/* Search */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-forest-500/10 bg-forest-500/[0.04] min-w-[200px]
              focus-within:border-forest-500/40 focus-within:bg-forest-500/[0.06] focus-within:shadow-[0_0_0_3px_rgba(16,185,129,0.1)] transition-all">
              <Search size={16} className="text-forest-600 flex-shrink-0" />
              <input type="text" placeholder="Search books..."
                className="border-none bg-transparent outline-none text-forest-100 text-sm font-[inherit] w-full placeholder:text-forest-700"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </header>
        {error && <p className="mb-4 text-xs text-candy-400 text-center animate-fade-in-up">{error}</p>}

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center text-center py-20 text-forest-600">
            <div className="w-8 h-8 border-[3px] border-forest-800 border-t-forest-400 rounded-full animate-spin mb-4" />
            <p className="text-sm animate-pulse">Loading your library...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 animate-fade-in-up">
            {books.length === 0 ? (
              <>
                <div className="w-20 h-20 rounded-2xl bg-forest-500/8 flex items-center justify-center text-forest-600 mb-5 animate-pulse-glow">
                  <BookOpen size={48} />
                </div>
                <h3 className="text-lg font-semibold text-forest-400 mb-1.5">No books yet</h3>
                <p className="text-sm text-forest-600 mb-5">Upload your first EPUB to get started.</p>
                <button
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-dashed border-forest-500/30 bg-forest-500/[0.06] text-forest-300 text-sm font-semibold
                    hover:bg-forest-500/[0.12] hover:border-forest-500/50 hover:text-forest-200 hover:-translate-y-0.5 transition-all cursor-pointer font-[inherit]"
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
          /* ── Book Grid: Vertical compact cards ── */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map((book, i) => (
              <Link key={book._id} to={`/read/${book._id}`}
                className="group relative flex flex-col no-underline text-inherit rounded-xl overflow-hidden
                  bg-gradient-to-b from-forest-500/[0.04] to-transparent
                  border border-forest-500/[0.06]
                  hover:border-forest-400/20 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_20px_rgba(16,185,129,0.06)]
                  transition-all duration-300 cursor-pointer animate-fade-in-up"
                style={{ animationDelay: `${i * 50}ms` }}>

                {/* Cover — compact height */}
                <div className="relative aspect-[4/5] w-full bg-gradient-to-br from-forest-900/60 to-forest-950 flex items-center justify-center overflow-hidden">
                  {book.cover ? (
                    <img
                      src={`/storage/books/${book._id}/assets/${book.cover}`}
                      alt={book.title}
                      draggable={false}
                      className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500 ease-out"
                    />
                  ) : (
                    <BookOpen size={28} className="text-forest-700 group-hover:text-forest-500 transition-colors duration-300" />
                  )}

                  {/* Green glow on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-forest-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  {/* Chapters pill */}
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-px rounded bg-forest-950/70 backdrop-blur-sm text-[9px] font-medium text-forest-400 border border-forest-500/10">
                    {book.totalChapters} ch
                  </div>

                  {/* Delete — top-left on hover */}
                  <button
                    className="absolute top-1.5 left-1.5 flex items-center justify-center w-6 h-6 rounded-md
                      bg-forest-950/70 backdrop-blur-sm border border-forest-500/10
                      text-forest-600 opacity-0 group-hover:opacity-100
                      hover:!bg-candy-500/20 hover:!border-candy-400/30 hover:!text-candy-400
                      transition-all duration-200 cursor-pointer"
                    onClick={(e) => handleDelete(e, book._id)}
                    title="Delete book"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>

                {/* Info */}
                <div className="px-2.5 pt-2 pb-2.5 flex flex-col gap-px min-w-0">
                  <div className="text-[13px] font-semibold text-forest-100 truncate leading-snug group-hover:text-forest-50 transition-colors">
                    {book.title}
                  </div>
                  {book.author && (
                    <div className="text-[11px] text-forest-500/50 truncate">{book.author}</div>
                  )}
                </div>

                {/* Bottom glow line on hover */}
                <div className="absolute bottom-0 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-forest-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
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
