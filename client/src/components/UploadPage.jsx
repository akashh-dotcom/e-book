import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Upload, BookOpen, Headphones, Wand2, Download,
  ChevronRight, ChevronLeft, Sparkles, AudioLines, Globe, LayoutDashboard,
  Zap, Shield, Star, Music, Play, Pause, SkipBack, SkipForward,
  PenTool, Search, Settings, Bookmark, Menu, List,
} from 'lucide-react';
import useBookStore from '../store/bookStore';

export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [bookOpen, setBookOpen] = useState(0);
  const [pageTurn, setPageTurn] = useState(0);
  const [revealed, setRevealed] = useState(new Set());
  const [activeWord, setActiveWord] = useState(0);
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

  // Two-phase scroll: phase1 = book opens, phase2 = page turns to editor
  const handleScroll = useCallback(() => {
    if (!bookSectionRef.current) return;
    const rect = bookSectionRef.current.getBoundingClientRect();
    const windowH = window.innerHeight;
    // Phase 1: book opens (section top from 70% → 30% of viewport)
    const openStart = windowH * 0.7;
    const openEnd   = windowH * 0.3;
    const p1 = Math.max(0, Math.min(1, (openStart - rect.top) / (openStart - openEnd)));
    setBookOpen(p1);
    // Phase 2: page turn (section top from 20% → -40% of viewport)
    const turnStart = windowH * 0.2;
    const turnEnd   = windowH * -0.4;
    const p2 = Math.max(0, Math.min(1, (turnStart - rect.top) / (turnStart - turnEnd)));
    setPageTurn(p2);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Auto-cycle word highlighting when book is open (simulates audio playback)
  const demoWords = [
    'Alice','was','beginning','to','get','very','tired','of',
    'sitting','by','her','sister','on','the','bank,','and',
    'of','having','nothing','to','do.','Once','or','twice',
    'she','had','peeped','into','the','book','her','sister',
    'was','reading,','but','it','had','no','pictures','or',
    'conversations','in','it.'
  ];

  const isBookReady = bookOpen >= 0.5;
  useEffect(() => {
    if (!isBookReady) { setActiveWord(0); return; }
    const timer = setInterval(() => {
      setActiveWord(prev => (prev + 1) % demoWords.length);
    }, 400);
    return () => clearInterval(timer);
  }, [isBookReady]);

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

  const coverAngle = bookOpen * 155;                              // 0° (closed) → 155° (wide open)
  const pageSpread = bookOpen * 18;                               // pages fan out as book opens
  const contentOpacity = Math.max(0, (bookOpen - 0.2) * 1.25);   // fade in from 20%→100%
  const coverShadow = 4 + bookOpen * 16;                         // shadow grows as cover lifts

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
      <section className="px-6" id="book-demo" ref={bookSectionRef}
        style={{ paddingTop: '6rem', paddingBottom: '6rem', minHeight: '180vh' }}>
        <div className="flex flex-col items-center sticky top-20">
          {/* Header */}
          <div data-reveal-id="demo-header" className={`text-center mb-10 ${revealCls('demo-header')}`}>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              <span className="bg-gradient-to-r from-forest-300 via-forest-400 to-candy-accent bg-clip-text text-transparent bg-[length:200%_200%] animate-gradient-shift">
                See the sync magic
              </span>
            </h2>
            <p className="text-forest-200/50 text-base">
              {bookOpen < 0.9 ? 'Scroll down slowly to open the book' : pageTurn < 0.3 ? 'Keep scrolling to turn the page' : 'The VoxBook editor — exactly as you use it'}
            </p>
          </div>

          {/* ===== TWO-SIDED OPEN BOOK ===== */}
          <div className="relative flex justify-center items-center"
            style={{ width: `${320 + bookOpen * 320}px`, maxWidth: '90vw', height: '440px', transition: 'width 0.15s ease-out' }}>

            {/* Shadow under book */}
            <div className="absolute pointer-events-none" style={{
              width: `${240 + bookOpen * 280}px`, height: '24px',
              bottom: '-30px', left: '50%', transform: 'translateX(-50%)',
              background: 'radial-gradient(ellipse, rgba(0,0,0,0.5), transparent 70%)',
              filter: `blur(${5 + bookOpen * 10}px)`,
              opacity: 0.5 + bookOpen * 0.5,
            }} />

            {/* Spine (center of open book) */}
            <div className="absolute pointer-events-none" style={{
              top: 0, bottom: 0, left: '50%', width: '14px', transform: 'translateX(-50%)',
              background: 'linear-gradient(90deg, rgba(0,0,0,0.15), rgba(0,0,0,0.03) 30%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.03) 70%, rgba(0,0,0,0.15))',
              zIndex: 30,
              opacity: bookOpen,
              borderRadius: '2px',
            }} />

            {/* ===== LEFT PAGE — reading with word highlights ===== */}
            <div className="absolute overflow-hidden" style={{
              top: 0, bottom: 0, left: 0, width: '50%',
              opacity: bookOpen,
              transition: 'opacity 0.3s',
            }}>
              <div className="w-full h-full bg-[#f9f3e8] rounded-l-md border border-r-0 border-[#d8cfb6] flex flex-col overflow-hidden">
                {/* Page header */}
                <div className="px-3 py-2 border-b border-[#e8dfc9] flex items-center justify-between flex-shrink-0">
                  <span className="text-[8px] text-[#8b7355] uppercase tracking-widest font-medium">Chapter I</span>
                  <span className="text-[7px] text-[#b8a88a]">Page 1</span>
                </div>
                {/* Chapter title */}
                <div className="px-4 pt-3 pb-1 flex-shrink-0">
                  <h3 className="text-[11px] font-bold text-[#3d2e1a] tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
                    Down the Rabbit-Hole
                  </h3>
                  <div className="w-8 h-[1px] bg-[#c4b496] mt-1.5" />
                </div>
                {/* Animated text with word highlights */}
                <div className="flex-1 px-4 py-2 overflow-hidden">
                  <div className="text-[9px] leading-[1.85] flex flex-wrap gap-x-[2px] gap-y-[1px]"
                    style={{ fontFamily: 'Georgia, serif', color: '#5a4a3a' }}>
                    {demoWords.map((word, i) => {
                      const isActive = i === activeWord;
                      const isPast = i < activeWord;
                      return (
                        <span key={i}
                          className="inline-block px-[1px] rounded-sm"
                          style={{
                            transition: 'all 0.2s ease',
                            background: isActive ? 'rgba(192, 57, 43, 0.12)' : 'transparent',
                            color: isActive ? '#c0392b' : isPast ? '#3d2e1a' : '#9a8b7a',
                            fontWeight: isActive ? 600 : 400,
                            transform: isActive ? 'scale(1.06)' : 'scale(1)',
                          }}>
                          {word}
                        </span>
                      );
                    })}
                  </div>
                </div>
                {/* Page footer */}
                <div className="px-3 py-1.5 border-t border-[#e8dfc9] flex-shrink-0 flex justify-center">
                  <span className="text-[7px] text-[#b8a88a]">— 1 —</span>
                </div>
              </div>
            </div>

            {/* ===== RIGHT PAGE — audio controls & waveform ===== */}
            <div className="absolute overflow-hidden" style={{
              top: 0, bottom: 0, right: 0, width: '50%',
              opacity: bookOpen,
              transition: 'opacity 0.3s',
            }}>
              <div className="w-full h-full bg-[#faf5ec] rounded-r-md border border-l-0 border-[#d8cfb6] flex flex-col overflow-hidden">
                {/* Top portion - continued text */}
                <div className="px-3 py-2 border-b border-[#e8dfc9] flex items-center justify-between flex-shrink-0">
                  <span className="text-[8px] text-[#8b7355] uppercase tracking-widest font-medium">Alice in Wonderland</span>
                  <span className="text-[7px] text-[#b8a88a]">Page 2</span>
                </div>
                <div className="flex-1 px-4 py-3 overflow-hidden">
                  <div className="text-[9px] leading-[1.85]" style={{ fontFamily: 'Georgia, serif', color: '#5a4a3a' }}>
                    <p className="mb-2">So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies...</p>
                    <p className="mb-2">when suddenly a White Rabbit with pink eyes ran close by her.</p>
                    <p className="italic text-[#7a6b5a]">&ldquo;Oh dear! Oh dear! I shall be late!&rdquo;</p>
                  </div>
                </div>
                {/* Audio player bar */}
                <div className="px-3 py-2.5 border-t border-[#e8dfc9] bg-[#f5eee0] flex-shrink-0">
                  <div className="flex items-end gap-[1.5px] h-3.5 mb-2 justify-center">
                    {[...Array(28)].map((_, i) => {
                      const playing = bookOpen >= 0.5;
                      const h = playing
                        ? Math.abs(Math.sin((activeWord * 0.8 + i) * 0.7)) * 8 + 2
                        : 2;
                      return (
                        <div key={i} className="w-[1.5px] rounded-full"
                          style={{
                            height: `${h}px`,
                            background: playing ? '#8b5e34' : '#c4b496',
                            opacity: playing ? 0.7 : 0.3,
                            transition: 'height 0.2s ease',
                          }} />
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: '#8b5e34' }}>
                      {isBookReady ? <Pause size={7} className="text-white" /> : <Play size={7} className="text-white ml-px" />}
                    </div>
                    <div className="flex-1 h-[2px] bg-[#d8cfb6] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        background: '#8b5e34',
                        width: `${(activeWord / demoWords.length) * 100}%`,
                        transition: 'width 0.4s linear',
                      }} />
                    </div>
                    <span className="text-[7px] font-mono tabular-nums" style={{ color: '#8b7355' }}>
                      {`0:${String(Math.floor(activeWord * 0.6)).padStart(2, '0')}`} / 0:25
                    </span>
                  </div>
                </div>
                {/* Page footer */}
                <div className="px-3 py-1.5 border-t border-[#e8dfc9] flex-shrink-0 flex justify-center">
                  <span className="text-[7px] text-[#b8a88a]">— 2 —</span>
                </div>
              </div>
            </div>

            {/* ===== FRONT COVER (opens to reveal pages) ===== */}
            <div className="absolute overflow-hidden" style={{
              top: 0, bottom: 0, right: 0, width: '50%',
              perspective: '1200px',
              zIndex: 20,
              pointerEvents: 'none',
            }}>
              <div className="absolute inset-0 flex items-center justify-center" style={{
                background: 'linear-gradient(145deg, #10b981, #059669, #047857, #065f46)',
                borderRadius: '0 8px 8px 0',
                border: '1px solid rgba(16,185,129,0.25)',
                boxShadow: `${coverShadow}px ${coverShadow * 0.5}px ${coverShadow * 2}px rgba(0,0,0,${0.25 + bookOpen * 0.2}), inset 0 1px 0 rgba(255,255,255,0.15)`,
                transformOrigin: 'left center',
                transform: `rotateY(${-coverAngle}deg)`,
                backfaceVisibility: 'hidden',
                transition: 'transform 0.1s ease-out',
              }}>
                <div className="text-center text-forest-100 relative">
                  <div className="absolute -inset-10 border border-forest-300/10 rounded-lg pointer-events-none" />
                  <BookOpen size={40} className="mx-auto mb-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" />
                  <div className="text-lg font-bold tracking-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">VoxBook</div>
                  <div className="text-[9px] text-forest-200/40 mt-1 uppercase tracking-[0.2em]">Interactive Audio</div>
                  <p className="text-[10px] text-forest-200/30 mt-4 italic">↓ Scroll to open</p>
                </div>
              </div>
            </div>

            {/* ===== BACK COVER (left side, opens outward) ===== */}
            <div className="absolute overflow-hidden" style={{
              top: 0, bottom: 0, left: 0, width: '50%',
              perspective: '1200px',
              zIndex: 20,
              pointerEvents: 'none',
            }}>
              <div className="absolute inset-0" style={{
                background: 'linear-gradient(215deg, #065f46, #064e3b, #022c22)',
                borderRadius: '8px 0 0 8px',
                border: '1px solid rgba(6,78,59,0.6)',
                boxShadow: `${-coverShadow}px ${coverShadow * 0.5}px ${coverShadow * 2}px rgba(0,0,0,${0.2 + bookOpen * 0.15})`,
                transformOrigin: 'right center',
                transform: `rotateY(${coverAngle}deg)`,
                backfaceVisibility: 'hidden',
                transition: 'transform 0.1s ease-out',
              }} />
            </div>

            {/* ===== PAGE TURN OVERLAY — flips right page to reveal editor ===== */}
            {bookOpen > 0.9 && (
              <>
                {/* Editor preview (underneath the turning page) */}
                <div className="absolute overflow-hidden" style={{
                  top: 0, bottom: 0, right: 0, width: '50%',
                  opacity: pageTurn,
                  zIndex: 14,
                }}>
                  {/* Mini replica of the actual VoxBook editor UI */}
                  <div className="w-full h-full bg-white rounded-r-md border border-l-0 border-gray-200 flex flex-col overflow-hidden">
                    {/* TopBar replica */}
                    <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <Menu size={9} className="text-gray-400" />
                        <span className="text-[8px] font-semibold text-gray-700 truncate">Alice in Wonderland</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 rounded flex items-center justify-center bg-blue-50">
                          <PenTool size={7} className="text-blue-500" />
                        </div>
                        <div className="w-4 h-4 rounded flex items-center justify-center hover:bg-gray-100">
                          <Search size={7} className="text-gray-400" />
                        </div>
                        <div className="w-4 h-4 rounded flex items-center justify-center hover:bg-gray-100">
                          <Settings size={7} className="text-gray-400" />
                        </div>
                        <div className="w-4 h-4 rounded flex items-center justify-center hover:bg-gray-100">
                          <Bookmark size={7} className="text-gray-400" />
                        </div>
                      </div>
                    </div>

                    {/* Body: sidebar + content */}
                    <div className="flex flex-1 overflow-hidden">
                      {/* Mini sidebar */}
                      <div className="flex-shrink-0 border-r border-gray-100 bg-gray-50/80 flex flex-col" style={{ width: '65px' }}>
                        <div className="px-1.5 py-1.5 border-b border-gray-100">
                          <div className="flex items-center gap-1">
                            <List size={7} className="text-gray-400" />
                            <span className="text-[6px] uppercase text-gray-400 font-semibold tracking-wide">Contents</span>
                          </div>
                        </div>
                        <div className="flex-1 py-1 overflow-hidden">
                          {['I. Down the Rab...', 'II. The Pool of...', 'III. A Caucus-R...', 'IV. The Rabbit...', 'V. Advice from...', 'VI. Pig and Pe...'].map((ch, i) => (
                            <div key={i} className="px-1.5 py-[3px] text-[5px] truncate cursor-default"
                              style={{
                                color: i === 0 ? '#2563eb' : '#888',
                                fontWeight: i === 0 ? 600 : 400,
                                borderLeft: i === 0 ? '2px solid #2563eb' : '2px solid transparent',
                                background: i === 0 ? 'rgba(37,99,235,0.05)' : 'transparent',
                              }}>
                              {ch}
                            </div>
                          ))}
                        </div>
                        <div className="px-1.5 py-1 border-t border-gray-100">
                          <span className="text-[5px] text-gray-400">12 chapters</span>
                        </div>
                      </div>

                      {/* Main content area */}
                      <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Audio upload bar */}
                        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-100 flex-shrink-0">
                          <div className="text-[5px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium border border-green-200">
                            Audio synced
                          </div>
                          <div className="text-[5px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium border border-purple-200">
                            Auto-Sync
                          </div>
                        </div>

                        {/* Chapter content with word highlights */}
                        <div className="flex-1 px-3 py-2 overflow-hidden">
                          <h4 className="text-[9px] font-bold text-gray-800 mb-1.5 pb-1 border-b border-gray-200"
                            style={{ fontFamily: 'Georgia, serif' }}>
                            CHAPTER I. Down the Rabbit-Hole
                          </h4>
                          <div className="text-[7.5px] leading-[1.75] flex flex-wrap gap-x-[2px] gap-y-[1px]"
                            style={{ fontFamily: 'Georgia, serif' }}>
                            {demoWords.map((word, i) => {
                              const isActive = i === activeWord;
                              const isPast = i < activeWord;
                              return (
                                <span key={`ed-${i}`}
                                  className="inline-block px-[1px] rounded-sm cursor-pointer"
                                  style={{
                                    transition: 'all 0.2s ease',
                                    background: isActive ? 'rgba(192, 57, 43, 0.12)' : isPast ? 'transparent' : 'transparent',
                                    color: isActive ? '#c0392b' : isPast ? '#1a1a1a' : '#6b6b6b',
                                    fontWeight: isActive ? 600 : 400,
                                    transform: isActive ? 'scale(1.08)' : 'scale(1)',
                                  }}>
                                  {word}
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {/* Audio bar replica */}
                        <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                          <div className="flex items-center gap-0.5">
                            <div className="w-3 h-3 rounded-full flex items-center justify-center" style={{ border: '1px solid #ddd' }}>
                              <SkipBack size={5} className="text-gray-400" />
                            </div>
                            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
                              {isBookReady ? <Pause size={6} className="text-white" /> : <Play size={6} className="text-white ml-px" />}
                            </div>
                            <div className="w-3 h-3 rounded-full flex items-center justify-center" style={{ border: '1px solid #ddd' }}>
                              <SkipForward size={5} className="text-gray-400" />
                            </div>
                          </div>
                          <div className="flex-1 h-[3px] bg-gray-200 rounded-full overflow-hidden relative">
                            <div className="h-full bg-blue-500 rounded-full" style={{
                              width: `${(activeWord / demoWords.length) * 100}%`,
                              transition: 'width 0.4s linear',
                            }} />
                          </div>
                          <span className="text-[6px] text-gray-400 font-mono tabular-nums">
                            {`0:${String(Math.floor(activeWord * 0.6)).padStart(2, '0')}`} / 0:25
                          </span>
                          <div className="text-[5px] px-1 py-0.5 rounded border border-gray-200 bg-white text-gray-500 font-semibold">
                            1x
                          </div>
                        </div>

                        {/* Bottom bar replica */}
                        <div className="flex items-center justify-center gap-2 px-2 py-1 border-t border-gray-200 bg-white flex-shrink-0">
                          <ChevronLeft size={7} className="text-gray-300" />
                          <span className="text-[5px] text-gray-400 truncate">Chapter I</span>
                          <span className="text-[5px] text-gray-400">1 of 12</span>
                          <div className="w-10 h-[2px] bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: '8%' }} />
                          </div>
                          <span className="text-[5px] text-gray-400">8%</span>
                          <ChevronRight size={7} className="text-gray-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* The turning page (right page flips left to reveal editor) */}
                <div className="absolute overflow-hidden" style={{
                  top: 0, bottom: 0, right: 0, width: '50%',
                  perspective: '1600px',
                  zIndex: pageTurn < 0.98 ? 16 : 12,
                  pointerEvents: 'none',
                }}>
                  <div className="absolute inset-0 flex flex-col overflow-hidden" style={{
                    background: '#faf5ec',
                    borderRadius: '0 6px 6px 0',
                    border: '1px solid #d8cfb6',
                    transformOrigin: 'left center',
                    transform: `rotateY(${-pageTurn * 180}deg)`,
                    backfaceVisibility: 'hidden',
                    transition: 'transform 0.08s ease-out',
                    boxShadow: pageTurn > 0.05 ? `${-4 - pageTurn * 8}px 2px ${8 + pageTurn * 12}px rgba(0,0,0,${0.08 + pageTurn * 0.15})` : 'none',
                  }}>
                    {/* Same content as right page (visible before flip) */}
                    <div className="px-3 py-2 border-b border-[#e8dfc9] flex items-center justify-between flex-shrink-0">
                      <span className="text-[8px] text-[#8b7355] uppercase tracking-widest font-medium">Alice in Wonderland</span>
                      <span className="text-[7px] text-[#b8a88a]">Page 2</span>
                    </div>
                    <div className="flex-1 px-4 py-3 overflow-hidden">
                      <div className="text-[9px] leading-[1.85]" style={{ fontFamily: 'Georgia, serif', color: '#5a4a3a' }}>
                        <p className="mb-2">So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies...</p>
                        <p className="mb-2">when suddenly a White Rabbit with pink eyes ran close by her.</p>
                        <p className="italic text-[#7a6b5a]">&ldquo;Oh dear! Oh dear! I shall be late!&rdquo;</p>
                      </div>
                    </div>
                    <div className="px-3 py-1.5 border-t border-[#e8dfc9] flex-shrink-0 flex justify-center">
                      <span className="text-[7px] text-[#b8a88a]">— 2 —</span>
                    </div>
                  </div>
                </div>
              </>
            )}
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
