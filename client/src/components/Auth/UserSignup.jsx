import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BookOpen, User, Mail, Phone, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import useAuthStore from '../../store/authStore';

export default function UserSignup() {
  const [form, setForm] = useState({ username: '', email: '', phone: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const { signup, loading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signup(form);
      navigate('/dashboard');
    } catch {}
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="min-h-screen bg-forest-950 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.3) 0%, transparent 70%)' }} />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-forest-50 no-underline">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-forest-500 to-forest-400 flex items-center justify-center shadow-lg">
              <BookOpen size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">VoxBook</span>
          </Link>
          <h1 className="text-2xl font-bold text-forest-50 mt-6">Create your account</h1>
          <p className="text-forest-200/50 text-sm mt-2">Start converting your ebooks into audiobooks</p>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit}
          className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 backdrop-blur-sm space-y-5">

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Username */}
          <div>
            <label className="text-sm text-forest-200/70 mb-1.5 block">Username</label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400/50" />
              <input type="text" value={form.username} onChange={set('username')} required
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 pl-10 pr-4 text-forest-50 placeholder-forest-200/30 text-sm
                  focus:outline-none focus:border-forest-400/40 focus:ring-1 focus:ring-forest-400/20 transition-all"
                placeholder="Your name" />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-sm text-forest-200/70 mb-1.5 block">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400/50" />
              <input type="email" value={form.email} onChange={set('email')} required
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 pl-10 pr-4 text-forest-50 placeholder-forest-200/30 text-sm
                  focus:outline-none focus:border-forest-400/40 focus:ring-1 focus:ring-forest-400/20 transition-all"
                placeholder="you@example.com" />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="text-sm text-forest-200/70 mb-1.5 block">Phone <span className="text-forest-200/30">(optional)</span></label>
            <div className="relative">
              <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400/50" />
              <input type="tel" value={form.phone} onChange={set('phone')}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 pl-10 pr-4 text-forest-50 placeholder-forest-200/30 text-sm
                  focus:outline-none focus:border-forest-400/40 focus:ring-1 focus:ring-forest-400/20 transition-all"
                placeholder="+1 234 567 890" />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-sm text-forest-200/70 mb-1.5 block">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400/50" />
              <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} required minLength={6}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 pl-10 pr-11 text-forest-50 placeholder-forest-200/30 text-sm
                  focus:outline-none focus:border-forest-400/40 focus:ring-1 focus:ring-forest-400/20 transition-all"
                placeholder="Min. 6 characters" />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-400/50 hover:text-forest-400 transition-colors">
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-forest-500 to-forest-400 text-forest-950 font-semibold text-sm
              hover:shadow-[0_8px_30px_rgba(16,185,129,0.3)] hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Creating account...' : 'Sign Up'}
            {!loading && <ArrowRight size={16} />}
          </button>

          <p className="text-center text-sm text-forest-200/40">
            Already have an account?{' '}
            <Link to="/login" className="text-forest-400 hover:text-forest-300 transition-colors no-underline">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
