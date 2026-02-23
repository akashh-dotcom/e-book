import { useState, useEffect } from 'react';
import { Languages, X, Loader, RotateCcw } from 'lucide-react';
import api from '../../services/api';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'nl', name: 'Dutch' },
  { code: 'ru', name: 'Russian' },
  { code: 'pl', name: 'Polish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'cs', name: 'Czech' },
  { code: 'ro', name: 'Romanian' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'fi', name: 'Finnish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'el', name: 'Greek' },
  { code: 'tr', name: 'Turkish' },
  { code: 'ar', name: 'Arabic' },
  { code: 'he', name: 'Hebrew' },
  { code: 'fa', name: 'Persian' },
  { code: 'hi', name: 'Hindi' },
  { code: 'bn', name: 'Bengali' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'mr', name: 'Marathi' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ur', name: 'Urdu' },
  { code: 'ne', name: 'Nepali' },
  { code: 'si', name: 'Sinhala' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ms', name: 'Malay' },
  { code: 'tl', name: 'Filipino' },
  { code: 'my', name: 'Myanmar' },
  { code: 'km', name: 'Khmer' },
  { code: 'sw', name: 'Swahili' },
  { code: 'af', name: 'Afrikaans' },
  { code: 'am', name: 'Amharic' },
];

export default function TranslatePanel({
  bookLanguage,
  translatedLang,
  translating,
  translateProgress = 0,
  onTranslate,
  onShowOriginal,
  onClose,
}) {
  const [search, setSearch] = useState('');
  const bookLang = (bookLanguage || 'en').split('-')[0];
  const activeLang = translatedLang ? translatedLang.split('-')[0] : null;

  const filtered = LANGUAGES.filter(l => {
    if (search) {
      return l.name.toLowerCase().includes(search.toLowerCase()) ||
             l.code.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const handleSelect = (langCode) => {
    if (langCode === bookLang) {
      onShowOriginal();
    } else {
      onTranslate(langCode);
    }
  };

  return (
    <div className="side-panel translate-panel">
      <div className="side-panel-header">
        <Languages size={16} />
        <span>Translate Chapter</span>
        <button className="icon-btn" onClick={onClose} style={{ marginLeft: 'auto' }}>
          <X size={16} />
        </button>
      </div>

      {/* Current status */}
      <div className="translate-status">
        {translating ? (
          <div className="translate-status-row active">
            <Loader size={14} className="spin" />
            <span>Translating... {translateProgress > 0 ? `${translateProgress}%` : ''}</span>
            {translateProgress > 0 && (
              <div className="translation-progress-bar" style={{ flex: 1, marginLeft: 8 }}>
                <div
                  className="translation-progress-fill"
                  style={{ width: `${translateProgress}%` }}
                />
              </div>
            )}
          </div>
        ) : activeLang ? (
          <div className="translate-status-row active">
            <Languages size={14} />
            <span>Showing: <strong>{LANGUAGES.find(l => l.code === activeLang)?.name || activeLang.toUpperCase()}</strong></span>
            <button className="translate-original-btn" onClick={onShowOriginal}>
              <RotateCcw size={12} /> Original
            </button>
          </div>
        ) : (
          <div className="translate-status-row">
            <span>Original ({LANGUAGES.find(l => l.code === bookLang)?.name || bookLang.toUpperCase()})</span>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="translate-search">
        <input
          type="text"
          placeholder="Search languages..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Language list */}
      <div className="translate-list">
        {filtered.map(lang => {
          const isBookLang = lang.code === bookLang;
          const isActive = lang.code === activeLang;
          const isOriginal = isBookLang && !activeLang;

          return (
            <button
              key={lang.code}
              className={`translate-lang-btn ${isActive ? 'active' : ''} ${isOriginal ? 'original' : ''}`}
              onClick={() => handleSelect(lang.code)}
              disabled={translating}
            >
              <span className="translate-lang-name">{lang.name}</span>
              <span className="translate-lang-code">{lang.code.toUpperCase()}</span>
              {isBookLang && <span className="translate-lang-badge">Original</span>}
              {isActive && <span className="translate-lang-badge active">Active</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
