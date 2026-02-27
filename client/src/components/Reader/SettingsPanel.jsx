import { useRef } from 'react';

/** Tiny inline color picker — shows a "+" swatch that opens a native color input */
function CustomColorPicker({ highlightColor, onPick }) {
  const inputRef = useRef(null);
  const isCustom = highlightColor && !HIGHLIGHT_PRESETS.some(p => p.color === highlightColor);
  return (
    <button
      className={`hl-color-swatch hl-custom-swatch ${isCustom ? 'active' : ''}`}
      style={isCustom ? { background: highlightColor } : undefined}
      onClick={() => inputRef.current?.click()}
      title="Custom color"
    >
      {!isCustom && <span className="hl-auto-label">+</span>}
      <input
        ref={inputRef}
        type="color"
        className="hl-hidden-input"
        value={highlightColor || '#c0392b'}
        onChange={e => onPick(e.target.value)}
      />
    </button>
  );
}

const HIGHLIGHT_PRESETS = [
  { name: 'Default', color: '' },
  // Reds
  { name: 'Red', color: '#c0392b' },
  { name: 'Crimson', color: '#dc143c' },
  { name: 'Coral', color: '#e74c3c' },
  // Oranges
  { name: 'Orange', color: '#e67e22' },
  { name: 'Tangerine', color: '#f39c12' },
  // Yellows
  { name: 'Yellow', color: '#d4a017' },
  { name: 'Gold', color: '#f1c40f' },
  // Greens
  { name: 'Green', color: '#27ae60' },
  { name: 'Emerald', color: '#2ecc71' },
  { name: 'Teal', color: '#1abc9c' },
  // Blues
  { name: 'Blue', color: '#2563eb' },
  { name: 'Sky', color: '#3498db' },
  { name: 'Navy', color: '#2c3e9b' },
  // Purples
  { name: 'Purple', color: '#8e44ad' },
  { name: 'Violet', color: '#6c5ce7' },
  { name: 'Indigo', color: '#5b21b6' },
  // Pinks
  { name: 'Pink', color: '#e84393' },
  { name: 'Rose', color: '#fd79a8' },
  { name: 'Magenta', color: '#c2185b' },
  // Browns / Neutrals
  { name: 'Brown', color: '#8b5e34' },
  { name: 'Slate', color: '#636e72' },
];

export default function SettingsPanel({
  fontSize, setFontSize,
  theme, setTheme,
  lineHeight, setLineHeight,
  readingMode, setReadingMode,
  highlightColor, setHighlightColor,
  textAlign, setTextAlign,
}) {
  return (
    <div className="settings-panel">
      <h3>Reading Settings</h3>

      {/* Font size */}
      <div className="setting-row">
        <label>Font Size</label>
        <div className="size-controls">
          <button onClick={() => setFontSize(s => Math.max(12, s - 2))}>A-</button>
          <span>{fontSize}px</span>
          <button onClick={() => setFontSize(s => Math.min(32, s + 2))}>A+</button>
        </div>
      </div>

      {/* Theme */}
      <div className="setting-row">
        <label>Theme</label>
        <div className="theme-options">
          <button
            className={`theme-btn light ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
          >Light</button>
          <button
            className={`theme-btn sepia ${theme === 'sepia' ? 'active' : ''}`}
            onClick={() => setTheme('sepia')}
          >Sepia</button>
          <button
            className={`theme-btn dark ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
          >Dark</button>
        </div>
      </div>

      {/* Highlight color */}
      <div className="setting-row">
        <label>Highlight Color</label>
        <div className="highlight-color-options">
          {HIGHLIGHT_PRESETS.map(p => (
            <button
              key={p.name}
              className={`hl-color-swatch ${(highlightColor || '') === p.color ? 'active' : ''}`}
              style={p.color ? { background: p.color } : undefined}
              onClick={() => setHighlightColor(p.color)}
              title={p.name}
            >
              {!p.color && <span className="hl-auto-label">A</span>}
            </button>
          ))}
          <CustomColorPicker
            highlightColor={highlightColor}
            onPick={setHighlightColor}
          />
        </div>
      </div>

      {/* Line height */}
      <div className="setting-row">
        <label>Line Spacing</label>
        <input
          type="range"
          min="1.4" max="2.4" step="0.1"
          value={lineHeight}
          onChange={e => setLineHeight(parseFloat(e.target.value))}
        />
      </div>

      {/* Reading mode */}
      <div className="setting-row">
        <label>Reading Mode</label>
        <div className="theme-options">
          <button
            className={`theme-btn ${readingMode === 'scroll' ? 'active' : ''}`}
            onClick={() => setReadingMode('scroll')}
            style={{ background: 'rgba(16,185,129,0.06)', color: '#d1fae5' }}
          >Scroll</button>
          <button
            className={`theme-btn ${readingMode === 'paginated' ? 'active' : ''}`}
            onClick={() => setReadingMode('paginated')}
            style={{ background: 'rgba(16,185,129,0.06)', color: '#d1fae5' }}
          >Paginated</button>
        </div>
      </div>

      {/* Text alignment */}
      <div className="setting-row">
        <label>Text Align</label>
        <div className="theme-options">
          {['left', 'center', 'right', 'justify'].map(align => (
            <button
              key={align}
              className={`theme-btn ${textAlign === align ? 'active' : ''}`}
              onClick={() => setTextAlign(align)}
              style={{ background: 'rgba(16,185,129,0.06)', color: '#d1fae5', textTransform: 'capitalize' }}
            >{align}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
