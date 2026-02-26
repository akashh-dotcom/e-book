const HIGHLIGHT_PRESETS = [
  { name: 'Default', color: '' },
  { name: 'Red', color: '#c0392b' },
  { name: 'Orange', color: '#e67e22' },
  { name: 'Yellow', color: '#d4a017' },
  { name: 'Green', color: '#27ae60' },
  { name: 'Blue', color: '#2563eb' },
  { name: 'Purple', color: '#8e44ad' },
  { name: 'Pink', color: '#e84393' },
];

export default function SettingsPanel({
  fontSize, setFontSize,
  theme, setTheme,
  lineHeight, setLineHeight,
  readingMode, setReadingMode,
  highlightColor, setHighlightColor,
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
            style={{ background: 'var(--bg-alt)', color: 'var(--text)' }}
          >Scroll</button>
          <button
            className={`theme-btn ${readingMode === 'paginated' ? 'active' : ''}`}
            onClick={() => setReadingMode('paginated')}
            style={{ background: 'var(--bg-alt)', color: 'var(--text)' }}
          >Paginated</button>
        </div>
      </div>
    </div>
  );
}
