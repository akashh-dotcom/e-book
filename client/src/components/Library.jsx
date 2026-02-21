import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Trash2, ChevronRight } from 'lucide-react';
import useBookStore from '../store/bookStore';

export default function Library() {
  const { books, fetchBooks, deleteBook } = useBookStore();

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

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
        {books.map((book, i) => (
          <Link
            key={book._id}
            to={`/read/${book._id}`}
            className="book-card reveal"
            style={{ transitionDelay: `${i * 60}ms` }}
          >
            <div className="book-card-top">
              <div className="book-card-icon">
                <BookOpen size={20} />
              </div>
              <div className="book-card-info">
                <div className="book-card-title">{book.title}</div>
                {book.author && (
                  <div className="book-card-author">{book.author}</div>
                )}
              </div>
            </div>
            <div className="book-card-bottom">
              <span className="book-card-meta">{book.totalChapters} chapters</span>
              <div className="book-card-row">
                <button
                  className="book-card-delete"
                  onClick={(e) => handleDelete(e, book._id)}
                  title="Delete book"
                >
                  <Trash2 size={14} />
                </button>
                <span className="book-card-arrow"><ChevronRight size={16} /></span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
