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
  const [revealed, setRevealed] = useState(new Set());
  const [activeWord, setActiveWord] = useState(0);
  const [editorVisible, setEditorVisible] = useState(false);
  const fileInputRef = useRef(null);
  const editorSectionRef = useRef(null);
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

  // Scroll: editor visibility
  const handleScroll = useCallback(() => {
    if (editorSectionRef.current) {
      const r = editorSectionRef.current.getBoundingClientRect();
      setEditorVisible(r.top < window.innerHeight * 0.75);
    }
  }, []);

  useEffect(() => {
    handleScroll();
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

  useEffect(() => {
    if (!editorVisible) { setActiveWord(0); return; }
    const timer = setInterval(() => {
      setActiveWord(prev => (prev + 1) % demoWords.length);
    }, 400);
    return () => clearInterval(timer);
  }, [editorVisible]);

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
    {
      icon: <Headphones size={28} />, title: 'Audio Narration',
      desc: 'AI-powered voices bring every page to life with crystal-clear, natural narration.',
      gradient: 'from-violet-500 to-purple-600', glow: 'rgba(139,92,246,0.3)',
      bgGlow: 'radial-gradient(circle at 30% 20%, rgba(139,92,246,0.15) 0%, transparent 60%)',
      iconBg: 'from-violet-500/20 to-purple-500/20', textAccent: 'text-violet-400',
      span: 'lg:col-span-2', // wider card
      visual: (
        <div className="absolute -right-2 -bottom-2 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
          <div className="flex items-end gap-[3px]">
            {[40,60,35,55,45,65,30,50,40,55,35,60].map((h,i) => (
              <div key={i} className="w-[4px] rounded-full bg-violet-400 animate-wave" style={{ height: `${h}px`, animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      ),
    },
    {
      icon: <Wand2 size={28} />, title: 'Magic Sync',
      desc: "Words light up as they're spoken — like karaoke for books!",
      gradient: 'from-amber-400 to-orange-500', glow: 'rgba(251,191,36,0.3)',
      bgGlow: 'radial-gradient(circle at 70% 30%, rgba(251,191,36,0.12) 0%, transparent 60%)',
      iconBg: 'from-amber-400/20 to-orange-500/20', textAccent: 'text-amber-400',
      span: '',
      visual: (
        <div className="absolute right-4 bottom-4 opacity-20 group-hover:opacity-50 transition-opacity duration-500">
          <Sparkles size={48} className="text-amber-400 animate-sparkle" />
        </div>
      ),
    },
    {
      icon: <AudioLines size={28} />, title: 'Timeline Editor',
      desc: 'Drag and drop to fine-tune exactly when each word appears in the audio.',
      gradient: 'from-cyan-400 to-blue-500', glow: 'rgba(34,211,238,0.3)',
      bgGlow: 'radial-gradient(circle at 50% 80%, rgba(34,211,238,0.12) 0%, transparent 60%)',
      iconBg: 'from-cyan-400/20 to-blue-500/20', textAccent: 'text-cyan-400',
      span: '',
      visual: (
        <div className="absolute right-3 bottom-3 opacity-15 group-hover:opacity-35 transition-opacity duration-500">
          <svg width="60" height="40" viewBox="0 0 60 40">
            <rect x="0" y="8" width="12" height="24" rx="3" fill="currentColor" className="text-cyan-400" />
            <rect x="16" y="2" width="12" height="36" rx="3" fill="currentColor" className="text-cyan-300" />
            <rect x="32" y="12" width="12" height="16" rx="3" fill="currentColor" className="text-blue-400" />
            <rect x="48" y="5" width="12" height="30" rx="3" fill="currentColor" className="text-blue-300" />
          </svg>
        </div>
      ),
    },
    {
      icon: <Globe size={28} />, title: '50+ Fun Voices',
      desc: 'From soothing storytellers to energetic adventurers — find the perfect voice for every story.',
      gradient: 'from-emerald-400 to-teal-500', glow: 'rgba(52,211,153,0.3)',
      bgGlow: 'radial-gradient(circle at 40% 70%, rgba(52,211,153,0.12) 0%, transparent 60%)',
      iconBg: 'from-emerald-400/20 to-teal-500/20', textAccent: 'text-emerald-400',
      span: '',
      visual: (
        <div className="absolute right-4 bottom-3 opacity-15 group-hover:opacity-40 transition-opacity duration-500 flex gap-1">
          {['🗣️','🎙️','🗣️'].map((e,i) => (
            <span key={i} className="text-2xl animate-float" style={{ animationDelay: `${i * 0.5}s` }}>{e}</span>
          ))}
        </div>
      ),
    },
    {
      icon: <Download size={28} />, title: 'EPUB 3 Export',
      desc: 'Download your creation as a standards-compliant audiobook — ready to share everywhere.',
      gradient: 'from-rose-400 to-pink-500', glow: 'rgba(251,113,133,0.3)',
      bgGlow: 'radial-gradient(circle at 60% 20%, rgba(251,113,133,0.12) 0%, transparent 60%)',
      iconBg: 'from-rose-400/20 to-pink-500/20', textAccent: 'text-rose-400',
      span: 'lg:col-span-2', // wider card
      visual: (
        <div className="absolute right-4 bottom-4 opacity-15 group-hover:opacity-40 transition-opacity duration-500">
          <div className="relative">
            <BookOpen size={44} className="text-rose-400" />
            <Download size={18} className="text-pink-300 absolute -bottom-1 -right-1" />
          </div>
        </div>
      ),
    },
    {
      icon: <Sparkles size={28} />, title: 'Pretty Themes',
      desc: 'Light, sepia, and dark modes with smooth word highlighting.',
      gradient: 'from-fuchsia-400 to-purple-500', glow: 'rgba(232,121,249,0.3)',
      bgGlow: 'radial-gradient(circle at 80% 50%, rgba(232,121,249,0.12) 0%, transparent 60%)',
      iconBg: 'from-fuchsia-400/20 to-purple-500/20', textAccent: 'text-fuchsia-400',
      span: '',
      visual: (
        <div className="absolute right-3 bottom-3 opacity-15 group-hover:opacity-40 transition-opacity duration-500 flex gap-1.5">
          {[{bg:'bg-white border border-gray-200',s:20},{bg:'bg-amber-100',s:20},{bg:'bg-gray-900',s:20}].map((t,i) => (
            <div key={i} className={`${t.bg} rounded-lg`} style={{ width: t.s, height: t.s + 6 }} />
          ))}
        </div>
      ),
    },
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
              <a key={s} href={`#${s === 'Upload' ? 'upload' : s === 'Demo' ? 'editor-demo' : 'features'}`}
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
            <a href="#editor-demo"
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
      <section className="py-28 px-6 max-w-6xl mx-auto relative" id="features">
        {/* Section background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full pointer-events-none opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, rgba(34,211,238,0.06) 30%, rgba(251,191,36,0.04) 60%, transparent 80%)' }} />

        <div data-reveal-id="features-header" className={`text-center mb-16 relative z-10 ${revealCls('features-header')}`}>
          <p className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-forest-500/20 bg-forest-500/10 text-forest-300 text-xs font-medium mb-5">
            <Zap size={13} />
            Powerful features
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-forest-50 mb-4 leading-tight">
            Everything you need to create<br />
            <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-amber-400 bg-clip-text text-transparent bg-[length:200%_200%] animate-gradient-shift">
              synced audiobooks
            </span>
          </h2>
          <p className="text-forest-200/50 text-lg max-w-lg mx-auto">From upload to export — a complete creative toolkit, right in your browser.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
          {features.map((f, i) => (
            <div key={i} data-reveal-id={`feat-${i}`}
              className={`relative overflow-hidden rounded-2xl p-7 pb-8 group cursor-default
                border border-white/[0.06] backdrop-blur-sm
                hover:-translate-y-2 hover:scale-[1.02]
                transition-all duration-500 ease-out
                ${f.span}
                ${revealCls(`feat-${i}`, `delay-[${i * 100}ms]`)}`}
              style={{
                background: f.bgGlow + ', rgba(255,255,255,0.02)',
                boxShadow: `0 0 0 1px rgba(255,255,255,0.03)`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.boxShadow = `0 20px 60px -15px ${f.glow}, 0 0 0 1px rgba(255,255,255,0.08)`;
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.03)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
              }}
            >
              {/* Gradient border shimmer on hover */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `linear-gradient(135deg, ${f.glow.replace('0.3','0.05')} 0%, transparent 50%, ${f.glow.replace('0.3','0.03')} 100%)` }} />

              {/* Visual element */}
              {f.visual}

              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.iconBg} flex items-center justify-center ${f.textAccent} mb-5
                group-hover:scale-110 group-hover:shadow-lg transition-all duration-300 relative z-10`}
                style={{ boxShadow: `0 0 0 0 ${f.glow}` }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 25px ${f.glow}`}
                onMouseLeave={e => e.currentTarget.style.boxShadow = `0 0 0 0 ${f.glow}`}
              >
                {f.icon}
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold text-forest-50 mb-2 relative z-10">{f.title}</h3>
              <p className="text-sm text-forest-200/50 leading-relaxed relative z-10 max-w-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Editor Preview Section ---- */}
      <section className="py-28 px-6 max-w-5xl mx-auto relative overflow-hidden" id="editor-demo" ref={editorSectionRef}>
        {/* Background glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[800px] pointer-events-none opacity-40"
          style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(59,130,246,0.12) 0%, rgba(139,92,246,0.08) 30%, transparent 70%)' }} />

        <div data-reveal-id="editor-header" className={`text-center mb-16 relative z-10 ${revealCls('editor-header')}`}>
          <p className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-300 text-xs font-medium mb-5">
            <Play size={13} />
            Live preview
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 leading-tight">
            See the
            <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent bg-[length:200%_200%] animate-gradient-shift">
              {' '}magic{' '}
            </span>
            in action
          </h2>
          <p className="text-forest-200/50 text-lg max-w-lg mx-auto">
            This is exactly what you get — a real, interactive reader running in your browser.
          </p>
        </div>

        {/* Editor mockup - full width center stage */}
        <div className="relative z-10">
          <div className="flex justify-center">
            <div className="relative w-full max-w-[740px] transition-all duration-700 ease-out"
              style={{
                opacity: editorVisible ? 1 : 0,
                transform: editorVisible ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.95)',
              }}>

              {/* Glow ring behind the mockup */}
              <div className="absolute -inset-6 rounded-3xl pointer-events-none opacity-60 animate-pulse-glow"
                style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(59,130,246,0.1) 0%, rgba(139,92,246,0.06) 40%, transparent 75%)' }} />

              {/* Browser chrome */}
              <div className="relative rounded-t-2xl bg-[#1a1a2e] border border-b-0 border-white/[0.06] px-4 py-2.5 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 bg-white/[0.05] rounded-lg px-3 py-1 text-[11px] text-gray-500 font-mono flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border border-green-500/50 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  </div>
                  localhost:5173/read/alice-in-wonderland
                </div>
              </div>

              {/* Editor UI */}
              <div className="relative rounded-b-2xl border border-white/[0.06] border-t-0 overflow-hidden bg-white shadow-2xl shadow-black/40"
                style={{ height: '440px' }}>
                {/* TopBar */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-2.5">
                    <Menu size={16} className="text-gray-400" />
                    <span className="text-sm font-semibold text-gray-700">Alice in Wonderland</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center bg-blue-50 border border-blue-200">
                      <PenTool size={13} className="text-blue-500" />
                    </div>
                    <div className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100">
                      <Search size={13} className="text-gray-400" />
                    </div>
                    <div className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100">
                      <Settings size={13} className="text-gray-400" />
                    </div>
                    <div className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-gray-100">
                      <Bookmark size={13} className="text-gray-400" />
                    </div>
                  </div>
                </div>

                {/* Body: sidebar + content */}
                <div className="flex" style={{ height: 'calc(100% - 41px)' }}>
                  {/* Sidebar */}
                  <div className="hidden sm:flex flex-shrink-0 border-r border-gray-100 bg-gray-50/80 flex-col" style={{ width: '180px' }}>
                    <div className="px-3 py-2.5 border-b border-gray-100">
                      <div className="flex items-center gap-1.5">
                        <List size={13} className="text-gray-400" />
                        <span className="text-[11px] uppercase text-gray-400 font-semibold tracking-wide">Contents</span>
                      </div>
                    </div>
                    <div className="flex-1 py-1.5 overflow-hidden">
                      {['I. Down the Rabbit-Hole', 'II. The Pool of Tears', 'III. A Caucus-Race', 'IV. The Rabbit Sends...', 'V. Advice from a Cat...', 'VI. Pig and Pepper', 'VII. A Mad Tea-Party', 'VIII. The Queen\'s Cro...'].map((ch, i) => (
                        <div key={i} className="px-3 py-[5px] text-[11px] truncate cursor-default transition-colors"
                          style={{
                            color: i === 0 ? '#2563eb' : '#666',
                            fontWeight: i === 0 ? 600 : 400,
                            borderLeft: i === 0 ? '3px solid #2563eb' : '3px solid transparent',
                            background: i === 0 ? 'rgba(37,99,235,0.05)' : 'transparent',
                          }}>
                          {ch}
                        </div>
                      ))}
                    </div>
                    <div className="px-3 py-2 border-t border-gray-100">
                      <span className="text-[10px] text-gray-400">12 chapters</span>
                    </div>
                  </div>

                  {/* Main content area */}
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Status badges */}
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 flex-shrink-0">
                      <div className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-medium border border-green-200">
                        Audio synced
                      </div>
                      <div className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium border border-purple-200">
                        Auto-Sync
                      </div>
                    </div>

                    {/* Chapter content with animated word highlights */}
                    <div className="flex-1 px-5 py-4 overflow-hidden">
                      <h4 className="text-base font-bold text-gray-800 mb-3 pb-2 border-b border-gray-200"
                        style={{ fontFamily: 'Georgia, serif' }}>
                        CHAPTER I. Down the Rabbit-Hole
                      </h4>
                      <div className="text-sm leading-[2] flex flex-wrap gap-x-[3px] gap-y-[2px]"
                        style={{ fontFamily: 'Georgia, serif' }}>
                        {demoWords.map((word, i) => {
                          const isActive = i === activeWord;
                          const isPast = i < activeWord;
                          return (
                            <span key={`ed-${i}`}
                              className="inline-block px-[2px] rounded-sm cursor-pointer"
                              style={{
                                transition: 'all 0.2s ease',
                                background: isActive ? 'rgba(59,130,246,0.15)' : 'transparent',
                                color: isActive ? '#2563eb' : isPast ? '#1a1a1a' : '#6b6b6b',
                                fontWeight: isActive ? 600 : 400,
                                transform: isActive ? 'scale(1.08)' : 'scale(1)',
                                borderRadius: '3px',
                              }}>
                              {word}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Audio bar */}
                    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center border border-gray-300 hover:bg-gray-100 transition-colors">
                          <SkipBack size={10} className="text-gray-400" />
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/30 cursor-pointer">
                          {editorVisible ? <Pause size={12} className="text-white" /> : <Play size={12} className="text-white ml-0.5" />}
                        </div>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center border border-gray-300 hover:bg-gray-100 transition-colors">
                          <SkipForward size={10} className="text-gray-400" />
                        </div>
                      </div>
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden relative">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" style={{
                          width: `${(activeWord / demoWords.length) * 100}%`,
                          transition: 'width 0.4s linear',
                        }} />
                      </div>
                      <span className="text-[11px] text-gray-400 font-mono tabular-nums">
                        {`0:${String(Math.floor(activeWord * 0.6)).padStart(2, '0')}`} / 0:25
                      </span>
                      <div className="text-[10px] px-1.5 py-0.5 rounded border border-gray-200 bg-white text-gray-500 font-semibold cursor-pointer hover:bg-gray-50 transition-colors">
                        1x
                      </div>
                    </div>

                    {/* Bottom bar */}
                    <div className="flex items-center justify-center gap-3 px-4 py-1.5 border-t border-gray-200 bg-white flex-shrink-0">
                      <ChevronLeft size={14} className="text-gray-300" />
                      <span className="text-[11px] text-gray-400">Chapter I</span>
                      <span className="text-[11px] text-gray-400">1 of 12</span>
                      <div className="w-20 h-[3px] bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" style={{ width: '8%' }} />
                      </div>
                      <span className="text-[11px] text-gray-400">8%</span>
                      <ChevronRight size={14} className="text-gray-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating annotation pointers — point to specific UI areas */}
              {/* Left pointer: Sidebar */}
              <div className="hidden lg:flex absolute -left-[170px] top-[160px] items-center gap-2 animate-bounce-in"
                style={{ animationDelay: '0.6s' }}>
                <div className="px-3 py-2 rounded-xl border border-blue-500/20 bg-blue-500/[0.08] backdrop-blur-sm">
                  <p className="text-[11px] font-semibold text-blue-300 whitespace-nowrap">Smart Sidebar</p>
                  <p className="text-[10px] text-blue-300/50 whitespace-nowrap">Jump to any chapter</p>
                </div>
                <div className="w-8 h-[2px] bg-gradient-to-r from-blue-400/60 to-blue-400/0" />
              </div>

              {/* Left pointer: Audio bar */}
              <div className="hidden lg:flex absolute -left-[180px] bottom-[60px] items-center gap-2 animate-bounce-in"
                style={{ animationDelay: '1.0s' }}>
                <div className="px-3 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] backdrop-blur-sm">
                  <p className="text-[11px] font-semibold text-emerald-300 whitespace-nowrap">Built-in Audio Player</p>
                  <p className="text-[10px] text-emerald-300/50 whitespace-nowrap">Play, seek, speed control</p>
                </div>
                <div className="w-8 h-[2px] bg-gradient-to-r from-emerald-400/60 to-emerald-400/0" />
              </div>

              {/* Right pointer: Word highlight */}
              <div className="hidden lg:flex absolute -right-[180px] top-[220px] items-center gap-2 animate-bounce-in"
                style={{ animationDelay: '0.8s' }}>
                <div className="w-8 h-[2px] bg-gradient-to-l from-amber-400/60 to-amber-400/0" />
                <div className="px-3 py-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.08] backdrop-blur-sm">
                  <p className="text-[11px] font-semibold text-amber-300 whitespace-nowrap">Word Sync</p>
                  <p className="text-[10px] text-amber-300/50 whitespace-nowrap">Highlights as you listen</p>
                </div>
              </div>

              {/* Right pointer: Status badges */}
              <div className="hidden lg:flex absolute -right-[165px] top-[100px] items-center gap-2 animate-bounce-in"
                style={{ animationDelay: '1.2s' }}>
                <div className="w-8 h-[2px] bg-gradient-to-l from-violet-400/60 to-violet-400/0" />
                <div className="px-3 py-2 rounded-xl border border-violet-500/20 bg-violet-500/[0.08] backdrop-blur-sm">
                  <p className="text-[11px] font-semibold text-violet-300 whitespace-nowrap">Auto-Sync Engine</p>
                  <p className="text-[10px] text-violet-300/50 whitespace-nowrap">AI aligns words to audio</p>
                </div>
              </div>
            </div>
          </div>

          {/* Ticker strip below the mockup — social proof / quick stats */}
          <div data-reveal-id="editor-ticker" className={`mt-14 flex flex-wrap justify-center gap-x-8 gap-y-4 ${revealCls('editor-ticker')}`}>
            {[
              { icon: <Zap size={15} className="text-amber-400" />, text: 'Processes a full book in under 2 min' },
              { icon: <Globe size={15} className="text-emerald-400" />, text: 'Works entirely in your browser' },
              { icon: <BookOpen size={15} className="text-blue-400" />, text: 'Supports any EPUB file' },
              { icon: <Headphones size={15} className="text-violet-400" />, text: '50+ natural AI voices' },
            ].map((t, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                {t.icon}
                <span className="text-xs text-forest-200/60 font-medium">{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section className="py-28 px-6 max-w-6xl mx-auto relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] pointer-events-none opacity-25"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, rgba(52,211,153,0.06) 40%, transparent 70%)' }} />

        <div data-reveal-id="steps-header" className={`text-center mb-20 relative z-10 ${revealCls('steps-header')}`}>
          <p className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-forest-500/20 bg-forest-500/10 text-forest-300 text-xs font-medium mb-5">
            <Zap size={13} />
            Simple process
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-forest-50 mb-4 leading-tight">
            How it{' '}
            <span className="bg-gradient-to-r from-forest-300 via-forest-400 to-candy-accent bg-clip-text text-transparent bg-[length:200%_200%] animate-gradient-shift">
              works
            </span>
          </h2>
          <p className="text-forest-200/50 text-lg max-w-md mx-auto">Three simple steps to your synced audiobook</p>
        </div>

        {/* Circular infographic layout */}
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-center gap-16 lg:gap-24">

          {/* Left: Donut chart / circle */}
          <div data-reveal-id="circle-chart" className={`relative flex-shrink-0 ${revealCls('circle-chart')}`}>
            {/* Outer rotating ring */}
            <div className="absolute -inset-5 rounded-full animate-spin-slow pointer-events-none">
              <svg width="100%" height="100%" viewBox="0 0 320 320">
                <circle cx="160" cy="160" r="155" fill="none" stroke="rgba(16,185,129,0.06)" strokeWidth="1" strokeDasharray="8 12" />
              </svg>
            </div>

            {/* Orbiting dots on the rotating ring */}
            <div className="absolute -inset-5 rounded-full animate-spin-slow pointer-events-none" style={{ animationDuration: '25s' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-forest-400/60" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded-full bg-candy-accent/40" />
              <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-400/40" />
            </div>

            {/* Main donut SVG */}
            <div className="relative w-[260px] h-[260px] sm:w-[300px] sm:h-[300px]">
              <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                {/* Background circle */}
                <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="22" />

                {/* Segment 1: Upload - Forest green */}
                <circle cx="100" cy="100" r="85" fill="none"
                  stroke="url(#grad1)" strokeWidth="22" strokeLinecap="round"
                  strokeDasharray={`${(1/3) * 2 * Math.PI * 85 - 12} ${2 * Math.PI * 85}`}
                  strokeDashoffset="0"
                  className="transition-all duration-1000"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.3))' }} />

                {/* Segment 2: Generate - Violet */}
                <circle cx="100" cy="100" r="85" fill="none"
                  stroke="url(#grad2)" strokeWidth="22" strokeLinecap="round"
                  strokeDasharray={`${(1/3) * 2 * Math.PI * 85 - 12} ${2 * Math.PI * 85}`}
                  strokeDashoffset={`${-(1/3) * 2 * Math.PI * 85}`}
                  className="transition-all duration-1000"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(139,92,246,0.3))' }} />

                {/* Segment 3: Enjoy - Amber */}
                <circle cx="100" cy="100" r="85" fill="none"
                  stroke="url(#grad3)" strokeWidth="22" strokeLinecap="round"
                  strokeDasharray={`${(1/3) * 2 * Math.PI * 85 - 12} ${2 * Math.PI * 85}`}
                  strokeDashoffset={`${-(2/3) * 2 * Math.PI * 85}`}
                  className="transition-all duration-1000"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.3))' }} />

                {/* Gradient definitions */}
                <defs>
                  <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                  <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                  <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#fbbf24" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-forest-950/90 border border-white/[0.06] flex flex-col items-center justify-center gap-1.5 shadow-xl">
                  <BookOpen size={28} className="text-forest-400" />
                  <span className="text-forest-100 font-bold text-sm tracking-tight">VoxBook</span>
                  <span className="text-[10px] text-forest-300/50">3 Steps</span>
                </div>
              </div>

              {/* Step number badges positioned on the donut */}
              {/* Step 1: top-right */}
              <div className="absolute animate-scale-in" style={{ top: '2%', right: '8%', animationDelay: '0.3s' }}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-forest-500 to-forest-400 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-forest-500/30 animate-glow-ring">
                  1
                </div>
              </div>
              {/* Step 2: bottom-left */}
              <div className="absolute animate-scale-in" style={{ bottom: '2%', left: '2%', animationDelay: '0.6s' }}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-violet-400 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-violet-500/30"
                  style={{ boxShadow: '0 0 0 0 rgba(139,92,246,0.4)', animation: 'glowRing 2s ease-in-out infinite' }}>
                  2
                </div>
              </div>
              {/* Step 3: bottom-right */}
              <div className="absolute animate-scale-in" style={{ bottom: '2%', right: '2%', animationDelay: '0.9s' }}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-400 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-amber-500/30"
                  style={{ boxShadow: '0 0 0 0 rgba(251,191,36,0.4)', animation: 'glowRing 2s ease-in-out infinite 0.5s' }}>
                  3
                </div>
              </div>
            </div>
          </div>

          {/* Right: Step cards connected with lines */}
          <div className="flex flex-col gap-6 lg:gap-5 w-full max-w-[380px]">
            {[
              { num: '1', emoji: '📤', title: 'Upload your EPUB', desc: 'Drop your EPUB file and we parse every chapter, image, and metadata instantly — no config needed.', color: 'from-forest-500 to-forest-400', border: 'border-forest-500/20', glow: 'rgba(16,185,129,0.15)', accent: 'text-forest-400', dot: 'bg-forest-400' },
              { num: '2', emoji: '🤖', title: 'AI generates audio', desc: 'Our AI creates natural narration and syncs every word to the audio timeline automatically.', color: 'from-violet-500 to-violet-400', border: 'border-violet-500/20', glow: 'rgba(139,92,246,0.15)', accent: 'text-violet-400', dot: 'bg-violet-400' },
              { num: '3', emoji: '🎉', title: 'Read, listen & export', desc: 'Enjoy word-level highlights as you listen, then export as a standards-compliant EPUB 3 audiobook!', color: 'from-amber-500 to-amber-400', border: 'border-amber-500/20', glow: 'rgba(251,191,36,0.15)', accent: 'text-amber-400', dot: 'bg-amber-400' },
            ].map((s, i) => (
              <div key={i} data-reveal-id={`step-${i}`}
                className={`relative group animate-fade-in-up ${revealCls(`step-${i}`, `delay-[${i * 200}ms]`)}`}
                style={{ animationDelay: `${0.2 + i * 0.2}s` }}>

                {/* Connector line (vertical) between cards */}
                {i < 2 && (
                  <div className="hidden lg:block absolute left-[23px] top-full w-[2px] h-5 z-0"
                    style={{ background: `linear-gradient(to bottom, ${s.glow}, transparent)` }} />
                )}

                <div className={`relative flex gap-4 items-start p-5 rounded-2xl border ${s.border}
                  hover:-translate-y-1 hover:scale-[1.02] transition-all duration-400 cursor-default overflow-hidden`}
                  style={{ background: `radial-gradient(circle at 0% 50%, ${s.glow} 0%, transparent 60%), rgba(255,255,255,0.02)` }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = `0 16px 50px -12px ${s.glow}, 0 0 0 1px rgba(255,255,255,0.08)`}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >
                  {/* Shimmer overlay on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: `linear-gradient(135deg, ${s.glow.replace('0.15','0.05')} 0%, transparent 50%)` }} />

                  {/* Number circle with icon */}
                  <div className="flex-shrink-0 relative z-10">
                    <div className={`w-[46px] h-[46px] rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shadow-lg
                      group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}
                      style={{ boxShadow: `0 4px 20px ${s.glow}` }}>
                      <span className="text-xl">{s.emoji}</span>
                    </div>
                    {/* Step number badge */}
                    <div className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br ${s.color} flex items-center justify-center
                      text-[10px] font-bold text-white shadow-md border-2 border-forest-950`}>
                      {s.num}
                    </div>
                  </div>

                  {/* Text content */}
                  <div className="flex-1 relative z-10 min-w-0">
                    <h3 className={`text-base font-semibold text-forest-50 mb-1.5 flex items-center gap-2`}>
                      {s.title}
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`} />
                    </h3>
                    <p className="text-sm text-forest-200/50 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </div>
            ))}

            {/* CTA below steps */}
            <div data-reveal-id="steps-cta" className={`mt-2 ${revealCls('steps-cta', 'delay-[700ms]')}`}>
              <a href="#upload"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-forest-500 to-forest-400 text-forest-950 font-semibold text-sm no-underline
                  hover:scale-105 hover:shadow-[0_8px_30px_rgba(16,185,129,0.3)] transition-all duration-300">
                Get Started Now <ChevronRight size={16} />
              </a>
            </div>
          </div>
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
