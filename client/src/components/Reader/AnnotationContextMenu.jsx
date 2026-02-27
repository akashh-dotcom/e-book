import { useState } from 'react';
import { Palette, Type, Languages, X, ChevronRight, Loader, Check } from 'lucide-react';

const BG_COLORS = [
  { name: 'Yellow', color: '#fef08a' },
  { name: 'Green', color: '#86efac' },
  { name: 'Blue', color: '#93c5fd' },
  { name: 'Pink', color: '#fda4af' },
  { name: 'Orange', color: '#fed7aa' },
  { name: 'Purple', color: '#c4b5fd' },
  { name: 'Cyan', color: '#a5f3fc' },
  { name: 'Red', color: '#fca5a5' },
];

const FONT_COLORS = [
  { name: 'Red', color: '#dc2626' },
  { name: 'Blue', color: '#2563eb' },
  { name: 'Green', color: '#16a34a' },
  { name: 'Purple', color: '#9333ea' },
  { name: 'Orange', color: '#ea580c' },
  { name: 'Pink', color: '#db2777' },
  { name: 'Teal', color: '#0d9488' },
  { name: 'Black', color: '#000000' },
];

const TRANSLATE_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'bn', name: 'Bengali' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'tr', name: 'Turkish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
];

export default function AnnotationContextMenu({
  x,
  y,
  selectedText,
  onApplyBgColor,
  onApplyFontColor,
  onTranslateSelection,
  onRemoveAnnotation,
  onClose,
  existingAnnotation,
  translating,
}) {
  const [activeTab, setActiveTab] = useState(null); // 'bg' | 'font' | 'translate'
  const [customBg, setCustomBg] = useState(existingAnnotation?.backgroundColor || '');
  const [customFont, setCustomFont] = useState(existingAnnotation?.fontColor || '');

  // Clamp menu position within viewport
  const menuWidth = activeTab ? 260 : 220;
  const menuHeight = activeTab === 'translate' ? 340 : activeTab ? 240 : 160;
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 10);

  return (
    <div
      className="annotation-context-menu"
      style={{ left: clampedX, top: clampedY }}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Header with selected text preview */}
      <div className="acm-header">
        <span className="acm-selected-text" title={selectedText}>
          {selectedText.length > 30 ? selectedText.slice(0, 30) + '...' : selectedText}
        </span>
        <button className="acm-close-btn" onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      {/* Main menu items */}
      {!activeTab && (
        <div className="acm-menu-items">
          <button className="acm-menu-item" onClick={() => setActiveTab('bg')}>
            <Palette size={15} />
            <span>Background Color</span>
            <ChevronRight size={14} className="acm-chevron" />
          </button>
          <button className="acm-menu-item" onClick={() => setActiveTab('font')}>
            <Type size={15} />
            <span>Font Color</span>
            <ChevronRight size={14} className="acm-chevron" />
          </button>
          <button className="acm-menu-item" onClick={() => setActiveTab('translate')}>
            <Languages size={15} />
            <span>Translate Selection</span>
            <ChevronRight size={14} className="acm-chevron" />
          </button>
          {existingAnnotation && (
            <button
              className="acm-menu-item acm-remove"
              onClick={() => { onRemoveAnnotation(); onClose(); }}
            >
              <X size={15} />
              <span>Remove Annotation</span>
            </button>
          )}
        </div>
      )}

      {/* Background Color submenu */}
      {activeTab === 'bg' && (
        <div className="acm-submenu">
          <button className="acm-back-btn" onClick={() => setActiveTab(null)}>
            <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
            Background Color
          </button>
          <div className="acm-color-grid">
            {BG_COLORS.map(c => (
              <button
                key={c.name}
                className={`acm-color-swatch ${existingAnnotation?.backgroundColor === c.color ? 'active' : ''}`}
                style={{ background: c.color }}
                onClick={() => { onApplyBgColor(c.color); onClose(); }}
                title={c.name}
              >
                {existingAnnotation?.backgroundColor === c.color && <Check size={12} />}
              </button>
            ))}
          </div>
          <div className="acm-custom-color">
            <label>Custom:</label>
            <input
              type="color"
              value={customBg || '#fef08a'}
              onChange={e => setCustomBg(e.target.value)}
            />
            <button
              className="acm-apply-btn"
              onClick={() => { onApplyBgColor(customBg); onClose(); }}
            >
              Apply
            </button>
          </div>
          {existingAnnotation?.backgroundColor && (
            <button
              className="acm-clear-btn"
              onClick={() => { onApplyBgColor(''); onClose(); }}
            >
              Clear Background
            </button>
          )}
        </div>
      )}

      {/* Font Color submenu */}
      {activeTab === 'font' && (
        <div className="acm-submenu">
          <button className="acm-back-btn" onClick={() => setActiveTab(null)}>
            <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
            Font Color
          </button>
          <div className="acm-color-grid">
            {FONT_COLORS.map(c => (
              <button
                key={c.name}
                className={`acm-color-swatch ${existingAnnotation?.fontColor === c.color ? 'active' : ''}`}
                style={{ background: c.color }}
                onClick={() => { onApplyFontColor(c.color); onClose(); }}
                title={c.name}
              >
                {existingAnnotation?.fontColor === c.color && <Check size={12} />}
              </button>
            ))}
          </div>
          <div className="acm-custom-color">
            <label>Custom:</label>
            <input
              type="color"
              value={customFont || '#dc2626'}
              onChange={e => setCustomFont(e.target.value)}
            />
            <button
              className="acm-apply-btn"
              onClick={() => { onApplyFontColor(customFont); onClose(); }}
            >
              Apply
            </button>
          </div>
          {existingAnnotation?.fontColor && (
            <button
              className="acm-clear-btn"
              onClick={() => { onApplyFontColor(''); onClose(); }}
            >
              Clear Font Color
            </button>
          )}
        </div>
      )}

      {/* Translate submenu */}
      {activeTab === 'translate' && (
        <div className="acm-submenu">
          <button className="acm-back-btn" onClick={() => setActiveTab(null)}>
            <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
            Translate To
          </button>
          {translating && (
            <div className="acm-translating">
              <Loader size={14} className="spin" />
              <span>Translating...</span>
            </div>
          )}
          <div className="acm-translate-list">
            {TRANSLATE_LANGUAGES.map(lang => (
              <button
                key={lang.code}
                className="acm-translate-item"
                onClick={() => onTranslateSelection(lang.code)}
                disabled={translating}
              >
                <span>{lang.name}</span>
                <span className="acm-lang-code">{lang.code.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
