import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Upload, BookOpen, Headphones, Wand2, Download,
  ChevronRight, Sparkles, AudioLines, Globe, LayoutDashboard,
  Zap, Shield, Star, Music, Play,
} from 'lucide-react';
import useBookStore from '../store/bookStore';

export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [bookOpen, setBookOpen] = useState(0);
  const [revealed, setRevealed] = useState(new Set());
  const fileInputRef = useRef(null);
  const bookSectionRef = useRef(null);
  const navigate = useNavigate();
  const { uploadBook, fetchBooks, books } = useBookStore();

  useEffect(() => { fetchBooks(); }, [fetchBooks]);

  // Intersection observer for reveal
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          setRevealed(prev => new Set([...prev, e.target.dataset.revealId]));
        }
      }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('[data-reveal-id]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [books]);

  // Book-opening scroll effect
  const handleScroll = useCallback(() => {
    if (!bookSectionRef.current) return;
    const rect = bookSectionRef.current.getBoundingClientRect();
    const windowH = window.innerHeight;
    const p = Math.max(0, Math.min(1,
      (windowH - rect.top) / (windowH + rect.height * 0.5)
    ));
    setBookOpen(p);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

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

  const isR = (id) => revealed.has(id);
  const revealCls = (id, delay = '') =>
    `transition-all duration-700 ease-out ${delay} ${isR(id) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`;

  const features = [
    { icon: <Headphones size={28} />, title: 'Audio Narration', desc: 'AI-powered voices bring every page to life with natural narration.', emoji: '🎧' },
    { icon: <Wand2 size={28} />, title: 'Magic Sync', desc: "Words light up as they're spoken — like karaoke for books!", emoji: '✨' },
    { icon: <AudioLines size={28} />, title: 'Timeline Editor', desc: 'Drag and drop to fine-tune when each word appears.', emoji: '🎵' },
    { icon: <Globe size={28} />, title: '50+ Fun Voices', desc: 'Pick from soothing storytellers to energetic adventurers.', emoji: '🌍' },
    { icon: <Download size={28} />, title: 'EPUB 3 Export', desc: 'Download your creation as a real audiobook to share!', emoji: '📦' },
    { icon: <Sparkles size={28} />, title: 'Pretty Themes', desc: 'Light, sepia, and dark modes with smooth highlighting.', emoji: '🎨' },
  ];

  const stats = [
    { value: '50+', label: 'AI Voices', icon: <Music size={20} /> },
    { value: '10x', label: 'Faster', icon: <Zap size={20} /> },
    { value: '100%', label: 'Free', icon: <Star size={20} /> },
    { value: 'Safe', label: 'Secure', icon: <Shield size={20} /> },
  ];

  const steps = [
    { num: '1', emoji: '📤', title: 'Upload', desc: 'Drop your EPUB and we parse every chapter instantly.' },
    { num: '2', emoji: '🤖', title: 'Generate', desc: 'AI creates narration and syncs words to audio automatically.' },
    { num: '3', emoji: '🎉', title: 'Enjoy', desc: 'Read along with highlights, or export as EPUB 3!' },
  ];

  const coverAngle = 90 - bookOpen * 90;
  const pageSpread = bookOpen * 12;
  const videoOpacity = Math.max(0, (bookOpen - 0.5) * 2);

  return (
    <div className="min-h-screen bg-forest-950 text-forest-50 font-sans overflow-x-hidden relative">
      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        {[
          'w-1.5 h-1.5 bg-forest-400 top-[10%] left-[5%] animate-float',
          'w-1 h-1 bg-candy-accent top-[20%] left-[80%] animate-float-slow delay-1000',
          'w-2 h-2 bg-forest-300 top-[40%] left-[15%] animate-float-slow delay-2000',
          'w-1.5 h-1.5 bg-forest-500 top-[60%] left-[90%] animate-float delay-500',
          'w-1 h-1 bg-candy-400 top-[75%] left-[30%] animate-float-slow delay-3000',
          'w-2 h-2 bg-forest-200 top-[85%] left-[70%] animate-float delay-1500',
          'w-1 h-1 bg-forest-400 top-[15%] left-[50%] animate-float-slow delay-[4s]',
          'w-1.5 h-1.5 bg-candy-accent top-[55%] left-[45%] animate-float delay-[2.5s]',
        ].map((cls, i) => (
          <div key={i} className={`absolute rounded-full opacity-20 ${cls}`} />
        ))}
      </div>

      {/* ---- Navbar ---- */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-forest-950/80 border-b border-forest-500/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-14">
          <a href="/" className="flex items-center gap-2 text-forest-100 font-bold text-lg no-underline">
            <BookOpen size={22} className="text-forest-400 animate-wiggle-slow" />
            <span>VoxBook</span>
          </a>
          <div className="hidden md:flex gap-7">
            {['Features', 'Demo', 'Upload'].map(s => (
              <a key={s} href={`#${s === 'Upload' ? 'upload' : s === 'Demo' ? 'book-demo' : 'features'}`}
                className="text-forest-200/70 text-sm font-medium no-underline hover:text-forest-100 transition-colors">
                {s === 'Upload' ? 'Get Started' : s}
              </a>
            ))}
            {books.length > 0 && (
              <Link to="/dashboard" className="flex items-center gap-1.5 text-forest-300 font-semibold text-sm no-underline hover:text-forest-100 transition-colors">
                <LayoutDashboard size={15} />
                Dashboard
              </Link>
            )}
          </div>
          <div className="flex gap-2.5">
            <button disabled title="Coming soon"
              className="px-4 py-1.5 rounded-full border border-forest-500/25 bg-transparent text-forest-100 text-xs font-medium disabled:opacity-40 cursor-default">
              Log in
            </button>
            <button disabled title="Coming soon"
              className="px-4 py-1.5 rounded-full border-none bg-gradient-to-r from-forest-500 to-forest-400 text-forest-950 text-xs font-semibold disabled:opacity-40 cursor-default">
              Sign up
            </button>
          </div>
        </div>
      </nav>

      {/* ---- Hero ---- */}
      <section className="relative flex items-center justify-center min-h-screen pt-32 pb-20 px-6 text-center overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-[40%] left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full pointer-events-none animate-pulse-glow"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, rgba(52,211,153,0.12) 30%, rgba(255,107,107,0.06) 55%, transparent 70%)' }} />

        {/* Floating emojis */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {[
            { e: '📖', cls: 'top-[15%] left-[8%] animate-float text-3xl delay-0' },
            { e: '🎧', cls: 'top-[25%] right-[10%] animate-float-slow text-3xl delay-1000' },
            { e: '✨', cls: 'bottom-[30%] left-[12%] animate-float-fast text-2xl delay-2000' },
            { e: '🎵', cls: 'bottom-[20%] right-[15%] animate-float text-2xl delay-500' },
            { e: '🌟', cls: 'top-[45%] left-[5%] animate-float-slow text-3xl delay-3000' },
          ].map((f, i) => (
            <span key={i} className={`absolute opacity-30 ${f.cls}`}>{f.e}</span>
          ))}
        </div>

        <div data-reveal-id="hero" className={`relative max-w-2xl ${revealCls('hero')}`}>
          <p className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-forest-500/30 bg-forest-500/10 text-forest-300 text-xs font-medium mb-7 animate-bounce-in">
            <Sparkles size={14} />
            <span>Audio-first EPUB experience</span>
          </p>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.08] tracking-tighter text-forest-50 mb-5">
            Read. Listen.<br />
            <span className="bg-gradient-to-r from-forest-300 via-forest-400 to-candy-accent bg-clip-text text-transparent bg-[length:200%_200%] animate-gradient-shift">
              Feel every word.
            </span>
          </h1>
          <p className="text-lg text-forest-200/60 max-w-xl mx-auto mb-9">
            Transform any EPUB into a synced audiobook with AI-powered narration,
            word-level highlighting, and a timeline editor — then export as EPUB 3.
          </p>
          <div className="flex gap-3.5 justify-center flex-wrap">
            <a href="#upload"
              className="inline-flex items-center gap-1.5 px-8 py-3.5 rounded-full bg-gradient-to-r from-forest-500 to-forest-400 text-forest-950 font-semibold text-base no-underline animate-pulse-glow hover:scale-105 transition-transform">
              Get Started <ChevronRight size={18} />
            </a>
            <a href="#book-demo"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border-2 border-forest-500/30 text-forest-300 font-semibold text-base no-underline hover:bg-forest-500/10 hover:border-forest-400 hover:scale-[1.04] transition-all">
              <Play size={16} /> See the Magic
            </a>
          </div>
        </div>
      </section>

      {/* ---- Stats ribbon ---- */}
      <section data-reveal-id="stats" className={`flex justify-center gap-12 md:gap-16 px-6 py-10 max-w-3xl mx-auto -mt-10 relative z-10 ${revealCls('stats')}`}>
        {stats.map((s, i) => (
          <div key={i} className="text-center animate-slide-up" style={{ animationDelay: `${i * 150}ms` }}>
            <div className="text-forest-400 mb-2 flex justify-center">{s.icon}</div>
            <div className="text-3xl font-extrabold text-forest-100 tracking-tight">{s.value}</div>
            <div className="text-xs text-forest-300/50 uppercase tracking-widest mt-0.5">{s.label}</div>
          </div>
        ))}
      </section>

      {/* ---- Features ---- */}
      <section className="py-24 px-6 max-w-6xl mx-auto" id="features">
        <div data-reveal-id="features-header" className={`text-center mb-14 ${revealCls('features-header')}`}>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-forest-50 mb-3.5">
            Everything you need to create<br />
            <span className="bg-gradient-to-r from-forest-300 via-forest-400 to-candy-accent bg-clip-text text-transparent bg-[length:200%_200%] animate-gradient-shift">
              synced audiobooks
            </span>
          </h2>
          <p className="text-forest-200/50 text-lg max-w-md mx-auto">From upload to export — a complete toolkit in your browser.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div key={i} data-reveal-id={`feat-${i}`}
              className={`relative overflow-hidden rounded-2xl border border-forest-500/8 bg-forest-500/[0.03] p-8 group
                hover:bg-forest-500/[0.08] hover:border-forest-500/20 hover:-translate-y-1.5 hover:scale-[1.02]
                hover:shadow-[0_12px_40px_rgba(16,185,129,0.1)] transition-all duration-400 cursor-default
                ${revealCls(`feat-${i}`, `delay-[${i * 80}ms]`)}`}>
              <span className="absolute top-4 right-4 text-2xl opacity-30 group-hover:opacity-80 group-hover:scale-125 group-hover:rotate-12 transition-all duration-300">
                {f.emoji}
              </span>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-forest-500/15 to-forest-400/15 flex items-center justify-center text-forest-400 mb-4
                group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-300">
                {f.icon}
              </div>
              <h3 className="text-base font-semibold text-forest-50 mb-2">{f.title}</h3>
              <p className="text-sm text-forest-200/50 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Book Opening Demo ---- */}
      <section className="py-24 px-6" id="book-demo" ref={bookSectionRef}>
        <div data-reveal-id="demo-header" className={`text-center mb-14 ${revealCls('demo-header')}`}>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3.5">
            <span className="bg-gradient-to-r from-forest-300 via-forest-400 to-candy-accent bg-clip-text text-transparent bg-[length:200%_200%] animate-gradient-shift">
              See the sync magic
            </span>
          </h2>
          <p className="text-forest-200/50 text-lg">Scroll to open the book and watch sync in action!</p>
        </div>

        <div className="flex justify-center items-center min-h-[420px]">
          <div className="relative" style={{ perspective: '1200px', width: '340px', height: '380px' }}>
            {/* Back cover */}
            <div className="absolute inset-0 rounded-r-lg bg-forest-900 border border-forest-700/30 shadow-2xl" />
            {/* Pages */}
            {[...Array(5)].map((_, i) => (
              <div key={i}
                className="absolute top-2 bottom-2 left-1 right-1 bg-forest-100/90 rounded-r-sm origin-left transition-transform duration-200"
                style={{
                  transform: `rotateY(${-Math.min(pageSpread * (5 - i) / 5, 12)}deg)`,
                  zIndex: i,
                }} />
            ))}
            {/* Front cover */}
            <div
              className="absolute inset-0 rounded-lg bg-gradient-to-br from-forest-600 to-forest-800 border border-forest-500/20 shadow-2xl origin-left transition-transform duration-200 flex items-center justify-center"
              style={{ transform: `rotateY(${-coverAngle}deg)`, backfaceVisibility: 'hidden', zIndex: 10 }}>
              <div className="text-center text-forest-100">
                <BookOpen size={48} className="mx-auto mb-3 drop-shadow-lg" />
                <span className="text-xl font-bold tracking-tight">VoxBook</span>
              </div>
            </div>
            {/* Sync demo overlay */}
            <div
              className="absolute inset-0 flex items-center justify-center z-20 transition-opacity duration-300"
              style={{ opacity: videoOpacity }}>
              <div className="bg-forest-950/90 rounded-xl border border-forest-500/20 p-6 w-[300px] shadow-2xl backdrop-blur-sm">
                {/* Sync text */}
                <div className="mb-4 text-lg font-serif leading-relaxed">
                  {['Once', 'upon', 'a', 'time,', 'in', 'a', 'land', 'far', 'away...'].map((word, i) => (
                    <span key={i}
                      className={`inline-block mr-1.5 transition-all duration-300 ${
                        bookOpen > 0.6 + i * 0.04
                          ? 'text-forest-300 bg-forest-500/15 rounded px-0.5 scale-105'
                          : 'text-forest-200/40'
                      }`}>
                      {word}
                    </span>
                  ))}
                </div>
                {/* Waveform */}
                <div className="flex items-end gap-[3px] h-10 mb-3">
                  {[...Array(30)].map((_, i) => (
                    <div key={i}
                      className="w-1 bg-forest-400/60 rounded-full animate-wave"
                      style={{
                        animationDelay: `${i * 0.05}s`,
                        height: `${12 + Math.sin(i * 0.6) * 12 + Math.random() * 8}px`,
                      }} />
                  ))}
                </div>
                {/* Controls */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-forest-500 flex items-center justify-center text-forest-950 shadow-lg">
                    <Play size={16} />
                  </div>
                  <div className="flex-1 h-1.5 bg-forest-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-forest-500 to-forest-400 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(0, (bookOpen - 0.5) * 200)}%` }} />
                  </div>
                  <span className="text-xs text-forest-400/60 font-mono">0:42</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section className="py-24 px-6 max-w-5xl mx-auto">
        <div data-reveal-id="steps-header" className={`text-center mb-14 ${revealCls('steps-header')}`}>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-forest-50 mb-3.5">How it works</h2>
          <p className="text-forest-200/50 text-lg">Three simple steps to your synced audiobook</p>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-0">
          {steps.map((s, i) => (
            <div key={i} className="contents">
              <div data-reveal-id={`step-${i}`}
                className={`relative bg-forest-500/[0.04] border border-forest-500/10 rounded-2xl p-8 text-center flex-1 max-w-[280px]
                  hover:bg-forest-500/[0.08] hover:-translate-y-2 hover:shadow-[0_8px_30px_rgba(16,185,129,0.12)] transition-all duration-300 group
                  ${revealCls(`step-${i}`, `delay-[${i * 150}ms]`)}`}>
                <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-candy-accent text-white text-sm font-bold flex items-center justify-center shadow-lg animate-pop"
                  style={{ animationDelay: `${0.5 + i * 0.2}s` }}>
                  {s.num}
                </div>
                <div className="text-4xl mb-3 group-hover:animate-bounce">{s.emoji}</div>
                <h3 className="text-lg font-semibold text-forest-50 mb-2">{s.title}</h3>
                <p className="text-sm text-forest-200/50 leading-relaxed">{s.desc}</p>
              </div>
              {i < 2 && (
                <div className="text-forest-500/30 mx-2 hidden md:flex">
                  <ChevronRight size={24} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ---- Showcase (converted books) ---- */}
      {books.length > 0 && (
        <section className="py-20 px-6 max-w-6xl mx-auto text-center">
          <div data-reveal-id="showcase-header" className={`mb-10 ${revealCls('showcase-header')}`}>
            <h2 className="text-3xl font-bold tracking-tight text-forest-50 mb-3">Recently converted</h2>
            <p className="text-forest-200/50 text-lg">Books from your library, ready to read and listen.</p>
          </div>
          <div className="overflow-x-auto scrollbar-none -mx-6 px-6">
            <div className="flex justify-center gap-10 py-2 min-w-min">
              {books.slice(0, 8).map((book, i) => (
                <Link key={book._id} to={`/read/${book._id}`}
                  className="flex flex-col items-center gap-3 no-underline flex-shrink-0 w-[130px] group hover:-translate-y-1.5 transition-transform duration-300">
                  <div className="w-[120px] h-[170px] rounded-xl overflow-hidden bg-gradient-to-br from-forest-500/10 to-forest-700/5 flex items-center justify-center text-forest-800 shadow-xl group-hover:shadow-[0_8px_40px_rgba(16,185,129,0.2)] transition-shadow">
                    {book.cover ? (
                      <img src={`/storage/books/${book._id}/assets/${book.cover}`} alt={book.title} draggable={false} className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen size={32} />
                    )}
                  </div>
                  <span className="text-xs font-medium text-forest-300/60 text-center truncate w-full group-hover:text-forest-100 transition-colors">{book.title}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-8">
            <Link to="/dashboard"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-forest-500/25 text-forest-200/70 text-sm no-underline hover:bg-forest-500/10 hover:text-forest-100 transition-all">
              View all in Dashboard <ChevronRight size={16} />
            </Link>
          </div>
        </section>
      )}

      {/* ---- Upload CTA ---- */}
      <section className="py-20 px-6 max-w-xl mx-auto" id="upload">
        <div data-reveal-id="upload-header" className={`text-center mb-10 ${revealCls('upload-header')}`}>
          <h2 className="text-3xl font-bold tracking-tight text-forest-50 mb-3">Start with your EPUB</h2>
          <p className="text-forest-200/50 text-lg">Drop a file below and we'll take care of the rest.</p>
        </div>
        <div data-reveal-id="upload-zone"
          className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-all duration-300
            ${dragOver ? 'border-forest-400 bg-forest-500/[0.08] scale-[1.02]' : 'border-forest-500/15 bg-forest-500/[0.02]'}
            ${uploading ? 'pointer-events-none opacity-70' : ''}
            hover:border-forest-400 hover:bg-forest-500/[0.06] hover:scale-[1.01]
            ${revealCls('upload-zone')}`}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
        >
          <div className="text-forest-400/60 mb-3.5 transition-colors">
            <Upload size={36} />
          </div>
          <p className="text-forest-200/70 text-base mb-1.5">
            <strong className="text-forest-300">Click to upload</strong> or drag and drop
          </p>
          <span className="text-forest-500/40 text-sm">EPUB files up to 100 MB</span>

          {uploading && (
            <div className="mt-5">
              <div className="w-full max-w-[280px] h-1 bg-forest-800 rounded-full overflow-hidden mx-auto">
                <div className="h-full bg-gradient-to-r from-forest-500 to-forest-400 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {error && <p className="text-candy-400 text-sm mt-3.5">{error}</p>}

          <input ref={fileInputRef} type="file" accept=".epub" className="hidden"
            onChange={e => handleFile(e.target.files[0])} />
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="border-t border-forest-500/8 text-center py-8 px-6 text-forest-500/40 text-sm">
        <p>VoxBook &mdash; Open-source EPUB audiobook toolkit</p>
      </footer>
    </div>
  );
}
