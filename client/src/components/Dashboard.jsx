import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen, Trash2, Upload, Plus, Search, Loader, LogOut, ArrowLeft, User,
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
      className="min-h-screen bg-forest-950 text-forest-100 font-sans"
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

      {/* ── Top Navigation Bar ── */}
      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-forest-950/80 border-b border-forest-500/8">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          {/* Left: Logo + nav */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 text-forest-100 no-underline font-bold text-lg tracking-tight">
              <BookOpen size={22} className="text-forest-400" />
              <span>VoxBook</span>
            </Link>
            <div className="hidden sm:flex items-center gap-1">
              <Link to="/"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-forest-200/50 no-underline hover:text-forest-50 hover:bg-white/[0.04] transition-all">
                <ArrowLeft size={14} />
                Home
              </Link>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-forest-50 bg-forest-500/10">
                Library
              </div>
            </div>
          </div>

          {/* Center: Search */}
          <div className="flex-1 max-w-md mx-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-forest-500/10 bg-forest-500/[0.04]
              focus-within:border-forest-500/40 focus-within:shadow-[0_0_0_3px_rgba(16,185,129,0.1)] transition-all">
              <Search size={14} className="text-forest-600 flex-shrink-0" />
              <input type="text" placeholder="Search books..."
                className="border-none bg-transparent outline-none text-forest-100 text-sm font-[inherit] w-full placeholder:text-forest-700"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Right: Upload + User + Logout */}
          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-forest-500 to-forest-400 text-forest-950 text-sm font-semibold
                shadow-[0_2px_12px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(16,185,129,0.45)] active:translate-y-0
                disabled:opacity-70 disabled:cursor-default transition-all cursor-pointer border-none font-[inherit]"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />}
              <span className="hidden sm:inline">{uploading ? `Uploading ${progress}%` : 'Upload EPUB'}</span>
            </button>
            <input ref={fileInputRef} type="file" accept=".epub" className="hidden"
              onChange={e => handleFile(e.target.files[0])} />

            {user && (
              <button onClick={() => setProfileOpen(true)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.08]
                  hover:bg-white/[0.08] transition-all cursor-pointer overflow-hidden flex-shrink-0"
                title={user.username}
              >
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs font-bold text-forest-300">
                    {user.username?.charAt(0)?.toUpperCase()}
                  </span>
                )}
              </button>
            )}

            {user && (
              <button onClick={() => { logout(); navigate('/login'); }}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.06] text-forest-200/40
                  hover:bg-white/[0.08] hover:text-forest-50 transition-all cursor-pointer"
                title="Logout">
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
        {error && (
          <div className="max-w-7xl mx-auto px-6 pb-2">
            <p className="text-xs text-candy-400 text-center">{error}</p>
          </div>
        )}
      </nav>

      {/* ── Main Content ── */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {paymentSuccess && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-forest-500/15 border border-forest-500/25 text-forest-300 text-sm font-medium flex items-center gap-2 animate-fade-in-up">
            Payment successful! Your plan has been upgraded.
          </div>
        )}

        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-forest-50 to-forest-300 bg-clip-text text-transparent">
              Your Library
            </h1>
            <p className="text-sm text-forest-500/50 mt-1.5">{books.length} {books.length === 1 ? 'book' : 'books'} in your collection</p>
          </div>
        </div>

        {/* States */}
        {loading ? (
          <div className="flex flex-col items-center justify-center text-center py-24 text-forest-600">
            <div className="w-10 h-10 border-[3px] border-forest-800 border-t-forest-400 rounded-full animate-spin mb-5" />
            <p className="text-sm">Loading your library...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24">
            {books.length === 0 ? (
              <>
                <div className="w-24 h-24 rounded-3xl bg-forest-500/8 flex items-center justify-center text-forest-600 mb-6 animate-pulse-glow">
                  <BookOpen size={48} />
                </div>
                <h3 className="text-xl font-semibold text-forest-300 mb-2">Your library is empty</h3>
                <p className="text-sm text-forest-600 mb-6 max-w-sm">Upload your first EPUB to start reading with AI-powered audio sync.</p>
                <button
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl border border-dashed border-forest-500/30 bg-forest-500/[0.06] text-forest-300 text-sm font-semibold
                    hover:bg-forest-500/[0.12] hover:border-forest-500/50 hover:text-forest-200 hover:-translate-y-0.5 transition-all cursor-pointer font-[inherit]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={18} />
                  Upload your first book
                </button>
              </>
            ) : (
              <>
                <div className="w-24 h-24 rounded-3xl bg-forest-500/8 flex items-center justify-center text-forest-600 mb-6">
                  <Search size={48} />
                </div>
                <h3 className="text-xl font-semibold text-forest-300 mb-2">No results</h3>
                <p className="text-sm text-forest-600">No books match "<span className="text-forest-400">{search}</span>"</p>
              </>
            )}
          </div>
        ) : (
          /* ── Book Grid: Vertical cards ── */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {filtered.map((book, i) => (
              <Link key={book._id} to={`/read/${book._id}`}
                className="group flex flex-col no-underline text-inherit rounded-2xl border border-forest-500/8 bg-forest-500/[0.02] overflow-hidden
                  hover:border-forest-500/25 hover:bg-forest-500/[0.05] hover:-translate-y-1.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.4),0_0_0_1px_rgba(16,185,129,0.1)]
                  transition-all duration-300 cursor-pointer animate-fade-in-up"
                style={{ animationDelay: `${i * 60}ms` }}>

                {/* Cover */}
                <div className="relative aspect-[3/4] w-full bg-gradient-to-br from-forest-500/12 to-forest-900/40 flex items-center justify-center overflow-hidden">
                  {book.cover ? (
                    <img
                      src={`/storage/books/${book._id}/assets/${book.cover}`}
                      alt={book.title}
                      draggable={false}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-forest-600">
                      <BookOpen size={36} className="group-hover:text-forest-500 transition-colors" />
                    </div>
                  )}
                  {/* Chapters badge */}
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-forest-950/70 backdrop-blur-sm text-[10px] font-medium text-forest-300 border border-forest-500/10">
                    {book.totalChapters} ch
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-forest-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                {/* Info */}
                <div className="flex-1 px-3 pt-3 pb-2 flex flex-col gap-0.5 min-w-0">
                  <div className="text-sm font-semibold text-forest-50 truncate leading-tight group-hover:text-forest-200 transition-colors">
                    {book.title}
                  </div>
                  {book.author && (
                    <div className="text-xs text-forest-400/50 truncate">{book.author}</div>
                  )}
                </div>

                {/* Delete button */}
                <div className="px-3 pb-3">
                  <button
                    className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-transparent border border-transparent text-forest-700 text-xs
                      opacity-0 group-hover:opacity-100 hover:!bg-candy-500/10 hover:!border-candy-500/20 hover:!text-candy-400 transition-all cursor-pointer font-[inherit]"
                    onClick={(e) => handleDelete(e, book._id)}
                    title="Delete book"
                  >
                    <Trash2 size={12} />
                    <span>Delete</span>
                  </button>
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
