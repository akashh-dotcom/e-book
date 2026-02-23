import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  BookOpen, Shield, Users, Trash2, LogOut, Search,
  User, Mail, Phone, Crown, ChevronDown, AlertTriangle,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';

export default function AdminDashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteModal, setDeleteModal] = useState(null);
  const [stats, setStats] = useState({ total: 0, admins: 0, users: 0 });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/auth/admin/users');
      setUsers(data.users);
      setStats({
        total: data.users.length,
        admins: data.users.filter(u => u.role === 'admin').length,
        users: data.users.filter(u => u.role === 'user').length,
      });
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/auth/admin/users/${id}`);
      setDeleteModal(null);
      fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-forest-950 text-forest-50 font-sans">
      {/* Top nav */}
      <nav className="sticky top-0 z-50 bg-forest-950/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-forest-500 to-forest-400 flex items-center justify-center">
              <BookOpen size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold text-forest-50 tracking-tight">VoxBook</span>
            <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 text-[11px] font-semibold flex items-center gap-1">
              <Shield size={12} /> Admin
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-sm text-forest-200/50 hidden sm:block">{user?.email}</span>
            <button onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-forest-200/70 text-sm
                hover:bg-white/[0.06] hover:text-forest-50 transition-all">
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-forest-200/50 mt-1">Manage users and monitor platform activity</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Total Users', value: stats.total, icon: <Users size={22} />, color: 'from-forest-500 to-forest-400', glow: 'rgba(16,185,129,0.12)' },
            { label: 'Regular Users', value: stats.users, icon: <User size={22} />, color: 'from-blue-500 to-blue-400', glow: 'rgba(59,130,246,0.12)' },
            { label: 'Admins', value: stats.admins, icon: <Crown size={22} />, color: 'from-amber-500 to-amber-400', glow: 'rgba(251,191,36,0.12)' },
          ].map((s, i) => (
            <div key={i} className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 overflow-hidden">
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: `radial-gradient(circle at 0% 0%, ${s.glow} 0%, transparent 60%)` }} />
              <div className="relative flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white shadow-lg`}>
                  {s.icon}
                </div>
                <div>
                  <p className="text-forest-200/50 text-sm">{s.label}</p>
                  <p className="text-2xl font-bold text-forest-50">{s.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Users table */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          {/* Table header with search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 border-b border-white/[0.06]">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users size={20} className="text-forest-400" />
              All Users
            </h2>
            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-400/40" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-9 pr-4 text-forest-50 placeholder-forest-200/30 text-sm
                  focus:outline-none focus:border-forest-400/40 transition-all"
                placeholder="Search by name or email..." />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-forest-200/40">Loading users...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-forest-200/40">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="text-left text-forest-200/40 font-medium px-6 py-4">User</th>
                    <th className="text-left text-forest-200/40 font-medium px-6 py-4 hidden sm:table-cell">Phone</th>
                    <th className="text-left text-forest-200/40 font-medium px-6 py-4">Role</th>
                    <th className="text-left text-forest-200/40 font-medium px-6 py-4 hidden md:table-cell">Joined</th>
                    <th className="text-right text-forest-200/40 font-medium px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u._id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                            u.role === 'admin' ? 'bg-gradient-to-br from-amber-500 to-amber-400' : 'bg-gradient-to-br from-forest-500 to-forest-400'
                          }`}>
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-forest-50 font-medium">{u.username}</p>
                            <p className="text-forest-200/40 text-xs">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-forest-200/50 hidden sm:table-cell">{u.phone || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          u.role === 'admin'
                            ? 'bg-amber-400/10 text-amber-400'
                            : 'bg-forest-400/10 text-forest-400'
                        }`}>
                          {u.role === 'admin' && <Crown size={12} />}
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-forest-200/40 hidden md:table-cell">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {u._id !== user?.id && (
                          <button onClick={() => setDeleteModal(u)}
                            className="p-2 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-all"
                            title="Delete user">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-forest-950 border border-white/[0.08] rounded-2xl p-8 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-forest-50">Delete User</h3>
            </div>
            <p className="text-sm text-forest-200/50 mb-6">
              Are you sure you want to delete <strong className="text-forest-50">{deleteModal.username}</strong> ({deleteModal.email})?
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-forest-200/70 text-sm font-medium
                  hover:bg-white/[0.06] transition-all">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteModal._id)}
                className="flex-1 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium
                  hover:bg-red-500/20 transition-all">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
