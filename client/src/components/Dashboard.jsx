import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen, Trash2, ChevronRight, Upload, Plus,
  LayoutDashboard, Search, Loader,
} from 'lucide-react';
import useBookStore from '../store/bookStore';

export default function Dashboard() {
  const { books, fetchBooks, deleteBook, uploadBook } = useBookStore();
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

  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('revealed');
      }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.dash-reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [books, loading]);

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
    <div className="dash">
      {/* Sidebar */}
      <aside className="dash-sidebar">
        <Link to="/" className="dash-logo">
          <BookOpen size={22} />
          <span>VoxBook</span>
        </Link>

        <nav className="dash-nav">
          <div className="dash-nav-item active">
            <LayoutDashboard size={18} />
            <span>Library</span>
          </div>
        </nav>

        <div className="dash-sidebar-footer">
          <button
            className="dash-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader size={18} className="spin" /> : <Plus size={18} />}
            {uploading ? `Uploading ${progress}%` : 'Upload EPUB'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".epub"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />
          {error && <p className="dash-upload-error">{error}</p>}
        </div>
      </aside>

      {/* Main */}
      <main className="dash-main">
        <header className="dash-header">
          <div>
            <h1 className="dash-title">Your Library</h1>
            <p className="dash-subtitle">{books.length} {books.length === 1 ? 'book' : 'books'}</p>
          </div>
          <div className="dash-header-actions">
            <div className="dash-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search books..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </header>

        {loading ? (
          <div className="dash-empty">
            <div className="loading-spinner" />
            <p>Loading your library...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="dash-empty">
            {books.length === 0 ? (
              <>
                <div className="dash-empty-icon">
                  <BookOpen size={48} />
                </div>
                <h3>No books yet</h3>
                <p>Upload your first EPUB to get started.</p>
                <button
                  className="dash-empty-upload"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={18} />
                  Upload EPUB
                </button>
              </>
            ) : (
              <>
                <div className="dash-empty-icon">
                  <Search size={48} />
                </div>
                <h3>No results</h3>
                <p>No books match "{search}"</p>
              </>
            )}
          </div>
        ) : (
          <div className="dash-grid">
            {filtered.map((book, i) => (
              <Link
                key={book._id}
                to={`/read/${book._id}`}
                className="dash-card dash-reveal"
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                <div className="dash-card-cover">
                  {book.cover ? (
                    <img
                      src={`/storage/books/${book._id}/assets/${book.cover}`}
                      alt={book.title}
                      draggable={false}
                    />
                  ) : (
                    <BookOpen size={28} />
                  )}
                </div>
                <div className="dash-card-body">
                  <div className="dash-card-title">{book.title}</div>
                  {book.author && (
                    <div className="dash-card-author">{book.author}</div>
                  )}
                  <div className="dash-card-meta">
                    {book.totalChapters} {book.totalChapters === 1 ? 'chapter' : 'chapters'}
                  </div>
                </div>
                <div className="dash-card-actions">
                  <button
                    className="dash-card-delete"
                    onClick={(e) => handleDelete(e, book._id)}
                    title="Delete book"
                  >
                    <Trash2 size={14} />
                  </button>
                  <span className="dash-card-arrow">
                    <ChevronRight size={16} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
