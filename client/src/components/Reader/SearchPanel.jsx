import { useState } from 'react';
import { Search, X } from 'lucide-react';
import api from '../../services/api';

export default function SearchPanel({ bookId, onNavigate, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await api.get(
        `/books/${bookId}/search?q=${encodeURIComponent(query)}`
      );
      setResults(res.data);
    } catch {
      setResults([]);
    }
    setLoading(false);
  };

  return (
    <div className="search-panel">
      <div className="search-input-row">
        <Search size={16} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        <input
          type="text"
          placeholder="Search in this book..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          autoFocus
        />
        <button onClick={onClose}><X size={16} /></button>
      </div>

      <div className="search-results">
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', gap: 8 }}>
            <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            Searching...
          </div>
        )}
        {results.map((r, i) => (
          <button
            key={i}
            className="search-result"
            onClick={() => onNavigate(r.chapterIndex)}
          >
            <span className="result-chapter">{r.chapterTitle}</span>
            <span
              className="result-snippet"
              dangerouslySetInnerHTML={{
                __html: r.snippet.replace(
                  new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
                  '<mark>$&</mark>'
                )
              }}
            />
          </button>
        ))}
        {!loading && results.length === 0 && query && (
          <p className="no-results">No results found</p>
        )}
      </div>
    </div>
  );
}
