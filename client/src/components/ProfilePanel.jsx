import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, User, Mail, Phone, Lock, Camera, Trash2, Save, AlertTriangle, Check, Eye, EyeOff,
} from 'lucide-react';
import useAuthStore from '../store/authStore';

export default function ProfilePanel({ open, onClose }) {
  const { user, updateProfile, changePassword, uploadAvatar, removeAvatar, deleteAccount, loading } = useAuthStore();
  const navigate = useNavigate();
  const avatarRef = useRef(null);

  const [tab, setTab] = useState('profile'); // profile | password | danger
  const [form, setForm] = useState({ username: user?.username || '', email: user?.email || '', phone: user?.phone || '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState({ current: false, new: false });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  if (!open || !user) return null;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const setPw = (key) => (e) => setPwForm({ ...pwForm, [key]: e.target.value });

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setMsg(''); setErr('');
    try {
      await updateProfile(form);
      setMsg('Profile updated');
    } catch (e) { setErr(e.message); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMsg(''); setErr('');
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setErr('Passwords do not match');
      return;
    }
    try {
      await changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMsg('Password changed');
    } catch (e) { setErr(e.message); }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(''); setErr('');
    try {
      await uploadAvatar(file);
      setMsg('Photo updated');
    } catch (e) { setErr(e.message); }
  };

  const handleRemoveAvatar = async () => {
    setMsg(''); setErr('');
    try {
      await removeAvatar();
      setMsg('Photo removed');
    } catch (e) { setErr(e.message); }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      navigate('/');
    } catch (e) { setErr(e.message); }
  };

  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'password', label: 'Password' },
    { id: 'danger', label: 'Delete' },
  ];

  const initials = user.username?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={onClose}>
      <div className="bg-forest-950 border border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-lg font-semibold text-forest-50">Profile Settings</h2>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-forest-200/40 hover:text-forest-50 hover:bg-white/[0.06] transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Avatar section */}
        <div className="flex flex-col items-center py-6 border-b border-white/[0.06]">
          <div className="relative group">
            {user.avatar ? (
              <img src={user.avatar} alt="Avatar"
                className="w-20 h-20 rounded-full object-cover border-2 border-forest-400/30" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-forest-500 to-forest-400 flex items-center justify-center text-2xl font-bold text-white">
                {initials}
              </div>
            )}
            {/* Camera overlay */}
            <button onClick={() => avatarRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none">
              <Camera size={22} className="text-white" />
            </button>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <p className="text-forest-50 font-semibold mt-3">{user.username}</p>
          <p className="text-forest-200/40 text-xs">{user.email}</p>
          {user.avatar && (
            <button onClick={handleRemoveAvatar}
              className="mt-2 text-xs text-red-400/60 hover:text-red-400 transition-colors cursor-pointer bg-transparent border-none font-[inherit]">
              Remove photo
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06]">
          {tabs.map(t => (
            <button key={t.id}
              onClick={() => { setTab(t.id); setMsg(''); setErr(''); }}
              className={`flex-1 py-3 text-sm font-medium transition-all cursor-pointer bg-transparent border-none font-[inherit]
                ${tab === t.id ? 'text-forest-400 border-b-2 border-forest-400' : 'text-forest-200/40 hover:text-forest-200/70'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Status messages */}
        <div className="px-6">
          {msg && (
            <div className="flex items-center gap-2 mt-4 px-4 py-2.5 rounded-xl bg-forest-400/10 border border-forest-400/20 text-forest-400 text-sm">
              <Check size={16} /> {msg}
            </div>
          )}
          {err && (
            <div className="flex items-center gap-2 mt-4 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertTriangle size={16} /> {err}
            </div>
          )}
        </div>

        {/* Tab content */}
        <div className="px-6 py-5">
          {tab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-xs text-forest-200/50 mb-1 block">Username</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400/40" />
                  <input type="text" value={form.username} onChange={set('username')} required
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-9 pr-4 text-forest-50 text-sm
                      focus:outline-none focus:border-forest-400/40 transition-all" />
                </div>
              </div>
              <div>
                <label className="text-xs text-forest-200/50 mb-1 block">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400/40" />
                  <input type="email" value={form.email} onChange={set('email')} required
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-9 pr-4 text-forest-50 text-sm
                      focus:outline-none focus:border-forest-400/40 transition-all" />
                </div>
              </div>
              <div>
                <label className="text-xs text-forest-200/50 mb-1 block">Phone</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400/40" />
                  <input type="tel" value={form.phone} onChange={set('phone')}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-9 pr-4 text-forest-50 text-sm
                      focus:outline-none focus:border-forest-400/40 transition-all" />
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-forest-500 to-forest-400 text-forest-950 font-semibold text-sm
                  hover:shadow-[0_4px_16px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50 cursor-pointer border-none font-[inherit]">
                <Save size={16} />
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}

          {tab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="text-xs text-forest-200/50 mb-1 block">Current Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400/40" />
                  <input type={showPw.current ? 'text' : 'password'} value={pwForm.currentPassword} onChange={setPw('currentPassword')} required
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-9 pr-10 text-forest-50 text-sm
                      focus:outline-none focus:border-forest-400/40 transition-all" />
                  <button type="button" onClick={() => setShowPw(p => ({ ...p, current: !p.current }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-400/40 hover:text-forest-400 transition-colors bg-transparent border-none cursor-pointer">
                    {showPw.current ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-forest-200/50 mb-1 block">New Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400/40" />
                  <input type={showPw.new ? 'text' : 'password'} value={pwForm.newPassword} onChange={setPw('newPassword')} required minLength={6}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-9 pr-10 text-forest-50 text-sm
                      focus:outline-none focus:border-forest-400/40 transition-all" placeholder="Min. 6 characters" />
                  <button type="button" onClick={() => setShowPw(p => ({ ...p, new: !p.new }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-400/40 hover:text-forest-400 transition-colors bg-transparent border-none cursor-pointer">
                    {showPw.new ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-forest-200/50 mb-1 block">Confirm New Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400/40" />
                  <input type="password" value={pwForm.confirmPassword} onChange={setPw('confirmPassword')} required minLength={6}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-9 pr-4 text-forest-50 text-sm
                      focus:outline-none focus:border-forest-400/40 transition-all" />
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-forest-500 to-forest-400 text-forest-950 font-semibold text-sm
                  hover:shadow-[0_4px_16px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50 cursor-pointer border-none font-[inherit]">
                <Lock size={16} />
                {loading ? 'Updating...' : 'Change Password'}
              </button>
            </form>
          )}

          {tab === 'danger' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-500/15 bg-red-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={18} className="text-red-400" />
                  <h3 className="text-sm font-semibold text-red-400">Delete Account</h3>
                </div>
                <p className="text-xs text-forest-200/50 leading-relaxed mb-4">
                  This will permanently delete your account, profile photo, and all associated data. This action cannot be undone.
                </p>
                {!deleteConfirm ? (
                  <button onClick={() => setDeleteConfirm(true)}
                    className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium
                      hover:bg-red-500/20 transition-all cursor-pointer font-[inherit]">
                    I want to delete my account
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-red-400 font-medium">Are you sure? This cannot be undone.</p>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteConfirm(false)}
                        className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-forest-200/70 text-sm
                          hover:bg-white/[0.06] transition-all cursor-pointer border-none font-[inherit]">
                        Cancel
                      </button>
                      <button onClick={handleDeleteAccount} disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium
                          hover:bg-red-500/30 transition-all disabled:opacity-50 cursor-pointer font-[inherit]">
                        <Trash2 size={14} />
                        {loading ? 'Deleting...' : 'Delete Forever'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
