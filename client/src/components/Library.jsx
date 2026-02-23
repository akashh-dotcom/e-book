import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Trash2 } from 'lucide-react';
import useBookStore from '../store/bookStore';

export default function Library() {
  const { books, fetchBooks, deleteBook } = useBookStore();

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Delete this book?')) {
      await deleteBook(id);
    }
  };

  if (books.length === 0) return null;

  return (
    <div className="library-section">
      <h2 className="library-title">Your Library</h2>
      <div className="library-grid">
        {books.map(book => (
          <Link
            key={book._id}
            to={`/read/${book._id}`}
            className="book-card"
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <BookOpen size={20} style={{ color: '#2563eb', flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div className="book-card-title">{book.title}</div>
                {book.author && (
                  <div className="book-card-author">by {book.author}</div>
                )}
              </div>
            </div>
            <div className="book-card-meta">
              {book.totalChapters} chapters
            </div>
            <div className="book-card-actions">
              <button
                className="book-card-delete"
                onClick={(e) => handleDelete(e, book._id)}
                title="Delete book"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
