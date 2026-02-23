import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import UploadPage from './components/UploadPage';
import Dashboard from './components/Dashboard';
import ReaderPage from './components/Reader/ReaderPage';
import SyncEditorPage from './components/SyncEditor/SyncEditorPage';
import UserSignup from './components/Auth/UserSignup';
import UserLogin from './components/Auth/UserLogin';
import AdminLogin from './components/Auth/AdminLogin';
import AdminDashboard from './components/Admin/AdminDashboard';
import useAuthStore from './store/authStore';

// Route guard — requires logged-in user (any role)
function ProtectedRoute({ children }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Route guard — requires logged-in admin
function AdminRoute({ children }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

// Redirect logged-in users away from auth pages
function GuestRoute({ children }) {
  const { user } = useAuthStore();
  if (user && user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const { hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<UploadPage />} />

        {/* Auth pages — guest only */}
        <Route path="/signup" element={<GuestRoute><UserSignup /></GuestRoute>} />
        <Route path="/login" element={<GuestRoute><UserLogin /></GuestRoute>} />
        <Route path="/admin/login" element={<GuestRoute><AdminLogin /></GuestRoute>} />

        {/* Protected — any logged-in user */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/read/:bookId" element={<ProtectedRoute><ReaderPage /></ProtectedRoute>} />
        <Route path="/sync-editor/:bookId/:chapterIndex" element={<ProtectedRoute><SyncEditorPage /></ProtectedRoute>} />

        {/* Admin only */}
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
