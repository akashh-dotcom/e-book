import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, BookOpen, Headphones, Wand2, Download,
  ChevronRight, Sparkles, AudioLines, Globe,
} from 'lucide-react';
import useBookStore from '../store/bookStore';
import Library from './Library';

export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { uploadBook, fetchBooks, books } = useBookStore();

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('revealed');
      }),
      { threshold: 0.15 }
    );
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [books]);

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
    handleFile(e.dataTransfer.files[0]);
  };

  const features = [
    {
      icon: <Headphones size={28} />,
      title: 'Audio Narration',
      desc: 'Generate natural TTS audio or upload your own narration for every chapter.',
    },
    {
      icon: <Wand2 size={28} />,
      title: 'Word-Level Sync',
      desc: 'Automatic word-by-word alignment between text and audio powered by WhisperX.',
    },
    {
      icon: <AudioLines size={28} />,
      title: 'Timeline Editor',
      desc: 'Fine-tune word timings with a visual drag-and-drop timeline editor.',
    },
    {
      icon: <Globe size={28} />,
      title: '50+ Voices',
      desc: 'Choose from dozens of natural-sounding voices across multiple languages.',
    },
    {
      icon: <Download size={28} />,
      title: 'EPUB 3 Export',
      desc: 'Export your synced audiobook as a standards-compliant EPUB 3 with media overlays.',
    },
    {
      icon: <Sparkles size={28} />,
      title: 'Beautiful Reader',
      desc: 'Light, sepia, and dark themes with smooth word-level highlighting as you listen.',
    },
  ];

  return (
    <div className="landing">
      {/* ---- Navbar ---- */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <a href="/" className="landing-logo">
            <BookOpen size={22} />
            <span>VoxBook</span>
          </a>
          <div className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#upload">Get Started</a>
            {books.length > 0 && <a href="#library">Library</a>}
          </div>
          <div className="landing-nav-actions">
            <button className="landing-btn-ghost" disabled title="Coming soon">Log in</button>
            <button className="landing-btn-primary" disabled title="Coming soon">Sign up</button>
          </div>
        </div>
      </nav>

      {/* ---- Hero ---- */}
      <section className="landing-hero">
        <div className="landing-hero-glow" />
        <div className="landing-hero-content reveal">
          <p className="landing-badge">
            <Sparkles size={14} />
            <span>Audio-first EPUB experience</span>
          </p>
          <h1>
            Read. Listen.<br />
            <span className="gradient-text">Feel every word.</span>
          </h1>
          <p className="landing-hero-sub">
            Transform any EPUB into a synced audiobook with AI-powered narration,
            word-level highlighting, and a timeline editor — then export as EPUB 3.
          </p>
          <div className="landing-hero-cta">
            <a href="#upload" className="landing-btn-large">
              Get Started
              <ChevronRight size={18} />
            </a>
          </div>
        </div>
      </section>

      {/* ---- Features ---- */}
      <section className="landing-features" id="features">
        <div className="landing-section-header reveal">
          <h2>Everything you need to create<br /><span className="gradient-text">synced audiobooks</span></h2>
          <p>From upload to export — a complete production toolkit in your browser.</p>
        </div>
        <div className="landing-features-grid">
          {features.map((f, i) => (
            <div key={i} className="landing-feature-card reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="landing-feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Upload CTA ---- */}
      <section className="landing-upload-section" id="upload">
        <div className="landing-section-header reveal">
          <h2>Start with your EPUB</h2>
          <p>Drop a file below and we'll take care of the rest.</p>
        </div>
        <div
          className={`landing-upload-zone reveal ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
        >
          <div className="landing-upload-icon">
            <Upload size={36} />
          </div>
          <p className="landing-upload-text">
            <strong>Click to upload</strong> or drag and drop
          </p>
          <span className="landing-upload-hint">EPUB files up to 100 MB</span>

          {uploading && (
            <div className="landing-progress">
              <div className="landing-progress-bar">
                <div className="landing-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {error && <p className="landing-upload-error">{error}</p>}

          <input
            ref={fileInputRef}
            type="file"
            accept=".epub"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])}
          />
        </div>
      </section>

      {/* ---- Library ---- */}
      {books.length > 0 && (
        <section className="landing-library" id="library">
          <Library />
        </section>
      )}

      {/* ---- Footer ---- */}
      <footer className="landing-footer">
        <p>VoxBook &mdash; Open-source EPUB audiobook toolkit</p>
      </footer>
    </div>
  );
}
