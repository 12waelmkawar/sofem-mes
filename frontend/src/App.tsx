import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './store/authStore';
import LoginPage from './pages/LoginPage';
import AdminLayout from './components/layout/AdminLayout';
import MaterialsPage from './pages/admin/MaterialsPage';
import ProductsPage from './pages/admin/ProductsPage';
import ClientsPage from './pages/admin/ClientsPage';
import OperatorsPage from './pages/admin/OperatorsPage';
import MachinesPage from './pages/admin/MachinesPage';

function AdminPageRouter() {
  const location = useLocation();
  const page = location.hash.replace('#', '') || 'dashboard';

  if (page === 'materials') return <MaterialsPage />;
  if (page === 'products') return <ProductsPage />;
  if (page === 'clients') return <ClientsPage />;
  if (page === 'operators') return <OperatorsPage />;
  if (page === 'machines') return <MachinesPage />;

  return <DashboardPlaceholder />;
}

function AuthGuard({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { user, loading, fetchUser } = useAuth();
  useEffect(() => { fetchUser(); }, [fetchUser]);

  if (loading) return <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center text-[var(--muted)] font-['IBM_Plex_Mono']">Chargement...</div>;
  if (!user) return <Navigate to="/login" />;
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'OPERATOR' ? '/operator' : '/admin'} />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/operator" element={
        <AuthGuard allowedRoles={['OPERATOR']}>
          <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center">
            <div className="text-center">
              <h1 className="font-['Bebas_Neue'] text-4xl tracking-wider">Operator Dashboard</h1>
              <p className="mt-2 text-sm text-[var(--muted)] font-['IBM_Plex_Mono']">Phase 7+</p>
            </div>
          </div>
        </AuthGuard>
      } />
      <Route path="/admin" element={
        <AuthGuard allowedRoles={['ADMIN', 'MANAGER']}>
          <AdminLayout />
        </AuthGuard>
      }>
        <Route index element={<AdminPageRouter />} />
        <Route path="*" element={<AdminPageRouter />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function DashboardPlaceholder() {
  return (
    <div>
      <h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em] mb-4">DASHBOARD</h1>
      <div className="grid grid-cols-5 gap-4 mb-6">
        {['Ordres Actifs', 'Urgents', 'Taux Completion', 'Alertes Stock', 'En Retard'].map(label => (
          <div key={label} className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-4">
            <p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">{label}</p>
            <p className="font-['Bebas_Neue'] text-[36px] text-[var(--muted)]">0</p>
          </div>
        ))}
      </div>
      <p className="text-[var(--muted)] font-['IBM_Plex_Mono'] text-sm">Phase 7 — Orders, Calendar, Monitoring, Quality, BL, Settings, Users, Analytics...</p>
    </div>
  );
}
