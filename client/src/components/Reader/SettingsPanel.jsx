export default function SettingsPanel({
  fontSize, setFontSize,
  theme, setTheme,
  lineHeight, setLineHeight,
  readingMode, setReadingMode,
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
