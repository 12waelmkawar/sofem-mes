import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/authStore';
import ToastContainer from '../ui/Toast';

// ─── Nav Config ─────────────────────────────────────────────────

interface NavItem { label: string; page: string; icon?: string }
interface NavGroup { title: string; items: NavItem[]; adminOnly?: boolean }

const NAV_GROUPS: NavGroup[] = [
  { title: 'Principal', items: [
    { label: 'Dashboard', page: 'dashboard', icon: '◆' },
    { label: 'Ordres de Fab.', page: 'orders', icon: '▤' },
    { label: 'Calendrier', page: 'calendar', icon: '▣' },
    { label: 'Monitoring', page: 'monitor', icon: '◉' },
    { label: 'Bons Livraison', page: 'bl', icon: '▦' },
  ]},
  { title: 'Gestion', items: [
    { label: 'Materiaux', page: 'materials', icon: '▥' },
    { label: 'Produits', page: 'products', icon: '◈' },
    { label: 'Clients', page: 'clients', icon: '◉' },
    { label: 'Operateurs', page: 'operators', icon: '◧' },
  ]},
  { title: 'Equipements', items: [
    { label: 'Machines', page: 'machines', icon: '⚙' },
  ]},
  { title: 'Qualite', items: [
    { label: 'Controles', page: 'qualite', icon: '✓' },
    { label: 'Non-Conformites', page: 'nc', icon: '✗' },
  ]},
  { title: 'Admin', items: [
    { label: 'Parametres', page: 'settings', icon: '⚙' },
    { label: 'Utilisateurs', page: 'users', icon: '👤' },
    { label: 'Types Ops', page: 'op-types', icon: '⚡' },
  ], adminOnly: true },
];

// ─── Admin Layout ───────────────────────────────────────────────

export default function AdminLayout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('sofem_sidebar_collapsed') === 'true');
  const [theme, setTheme] = useState(() => localStorage.getItem('sofem_display_theme') || 'dark');
  const [clock, setClock] = useState(new Date().toLocaleString('fr-FR'));

  useEffect(() => {
    const interval = setInterval(() => setClock(new Date().toLocaleString('fr-FR')), 1000);
    return () => clearInterval(interval);
  }, []);

  // Hash-based navigation
  useEffect(() => {
    const hash = location.hash.replace('#', '') || 'dashboard';
    setActivePage(hash);
  }, [location]);

  const [activePage, setActivePage] = useState(() => location.hash.replace('#', '') || 'dashboard');

  const handleNavigate = useCallback((page: string) => {
    setActivePage(page);
    navigate(`/admin#${page}`);
  }, [navigate]);

  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    localStorage.setItem('sofem_sidebar_collapsed', String(next));
  };

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('sofem_display_theme', next);
    document.documentElement.classList.toggle('light', next === 'light');
  };

  return (
    <div className={`min-h-screen bg-[var(--bg,#0a0a0a)] text-[var(--text,#fafafa)] flex ${theme === 'light' ? 'light' : ''}`}>
      {/* Sidebar */}
      <aside
        className={`bg-[var(--bg2,#141414)] border-r border-[var(--border,#2a2a2a)] flex flex-col transition-all duration-300 ease-in-out overflow-hidden z-200 ${sidebarCollapsed ? 'w-0' : 'w-[190px]'}`}
      >
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_GROUPS.map(group => {
            if (group.adminOnly && !isAdmin()) return null;
            return (
              <div key={group.title} className="mb-2">
                <p className="px-4 text-[8px] font-['IBM_Plex_Mono'] text-[var(--muted,#737373)] uppercase tracking-[0.15em] mb-1">{group.title}</p>
                {group.items.map(item => (
                  <button
                    key={item.page}
                    onClick={() => handleNavigate(item.page)}
                    className={`w-full text-left px-4 py-2 text-[11px] font-['IBM_Plex_Mono'] transition-colors duration-150 flex items-center gap-2
                      ${activePage === item.page
                        ? 'text-white bg-[var(--red-g,#dc262620)] border-l-2 border-[var(--red,#dc2626)]'
                        : 'text-[var(--muted,#737373)] hover:text-[var(--text,#fff)] hover:bg-[var(--bg3,#1a1a1a)]'
                      }`}
                  >
                    <span className="w-4 text-center">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-[var(--border,#2a2a2a)]">
          <p className="text-[8px] font-['IBM_Plex_Mono'] text-[var(--muted,#737373)]">SOFEM MES v6.0<br />SMARTMOVE - 2025</p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-[58px] bg-[var(--bg2,#141414)] border-b border-[var(--border,#2a2a2a)] sticky top-0 z-200 flex items-center px-4 justify-between">
          <div className="flex items-center gap-3">
            <button onClick={toggleSidebar} className="text-[var(--muted,#737373)] hover:text-[var(--text,#fff)] text-xl">☰</button>
            <div className="w-9 h-9 bg-[var(--red,#dc2626)] rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v2H3V3zm0 16h18v2H3v-2zm0-8h18v2H3v-2z"/></svg>
            </div>
            <div>
              <h1 className="font-['Bebas_Neue'] text-xl tracking-[0.1em]">SOFEM MES</h1>
              <p className="text-[8px] font-['IBM_Plex_Mono'] text-[var(--red,#dc2626)] -mt-1">Administration</p>
            </div>
            {user && (
              <span className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted,#737373)] border border-[var(--border,#2a2a2a)] rounded px-2 py-0.5">{user.role}</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="text-right">
                <p className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted,#737373)]">{user.prenom} {user.nom}</p>
                <p className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted,#737373)]">{clock}</p>
              </div>
            )}
            <button onClick={toggleTheme} className="text-lg">{theme === 'dark' ? '☀️' : '🌙'}</button>
            <button onClick={logout} className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--red,#dc2626)] hover:underline">DECONNEXION</button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
