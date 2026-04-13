import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../store/authStore';

interface User { id: number; nom: string; prenom: string; role: string; actif: boolean; operateur: string | null; created_at: string; pin_must_change: boolean; }
interface Setting { id: number; groupe: string; cle: string; valeur: string; type: string; description: string; }
interface Operateur { id: number; prenom: string; nom: string; }

export default function SettingsPage() {
  const [tab, setTab] = useState<'systeme' | 'affichage' | 'users'>('systeme');

  return (
    <div>
      <h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em] mb-4">PARAMETRES</h1>
      <div className="flex gap-2 mb-6">
        {[{ key: 'systeme' as const, label: 'Systeme' }, { key: 'affichage' as const, label: 'Affichage' }, { key: 'users' as const, label: 'Utilisateurs' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded text-[11px] font-['IBM_Plex_Mono'] border transition-colors ${tab === t.key ? 'bg-[var(--red)] text-white border-[var(--red)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'systeme' && <SystemeTab />}
      {tab === 'affichage' && <AffichageTab />}
      {tab === 'users' && <UsersTab />}
    </div>
  );
}

// ─── System Settings ────────────────────────────────────────────

function SystemeTab() {
  const { isAdmin } = useAuth();
  const { data } = useQuery<{ data: Setting[] }>({ queryKey: ['settings'], queryFn: () => api.get('/api/settings').then(r => r.data) });
  const saveMut = useMutation({
    mutationFn: (d: { cle: string; valeur: string }[]) => api.put('/api/settings/bulk', { settings: Object.fromEntries(d.map(s => [s.cle, s.valeur])) }),
    onSuccess: () => toast.success('Parametres enregistres'),
    onError: () => toast.error('Erreur'),
  });

  const groups = ['societe', 'finance', 'workflow', 'alertes', 'pdf', 'acces'];
  const groupLabels: Record<string, string> = { societe: 'Societe', finance: 'Finance', workflow: 'Workflow', alertes: 'Alertes', pdf: 'Documents', acces: 'Acces' };
  const [values, setValues] = useState<Record<string, string>>({});

  const settings = (data?.data || []);
  const byGroup: Record<string, Setting[]> = {};
  settings.forEach(s => { if (!byGroup[s.groupe]) byGroup[s.groupe] = []; byGroup[s.groupe].push(s); });

  const handleSave = () => {
    const changes = Object.entries(values).map(([cle, valeur]) => ({ cle, valeur }));
    if (changes.length === 0) { toast.info('Aucune modification'); return; }
    saveMut.mutate(changes);
  };

  return (
    <div>
      <div className="flex justify-end mb-4"><Button onClick={handleSave}>Tout Sauvegarder</Button></div>
      <div className="grid grid-cols-2 gap-4">
        {groups.map(g => {
          const items = byGroup[g] || [];
          if (items.length === 0) return null;
          return (
            <div key={g} className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-4">
              <h3 className="font-['Bebas_Neue'] text-lg tracking-wider mb-3">{groupLabels[g]}</h3>
              <div className="space-y-2">
                {items.map(s => (
                  <div key={s.cle} className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">{s.cle.replace(/_/g, ' ')}</p>
                      <p className="text-[8px] text-[var(--muted)]">{s.description}</p>
                    </div>
                    <input className="w-32 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-xs text-right"
                      value={values[s.cle] !== undefined ? values[s.cle] : s.valeur}
                      onChange={e => setValues(v => ({ ...v, [s.cle]: e.target.value }))}
                      disabled={!isAdmin()}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Display Settings ───────────────────────────────────────────

function AffichageTab() {
  const [theme, setTheme] = useState(localStorage.getItem('sofem_display_theme') || 'dark');
  const [accent, setAccent] = useState(localStorage.getItem('sofem_accent_color') || '');

  const colors = [
    { name: 'Rouge', value: '#ef4444' },
    { name: 'Bleu', value: '#3b82f6' },
    { name: 'Vert', value: '#22c55e' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Violet', value: '#8b5cf6' },
    { name: 'Rose', value: '#ec4899' },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="font-['Bebas_Neue'] text-lg tracking-wider mb-4">Theme</h3>
        <div className="flex gap-3">
          <button onClick={() => { setTheme('dark'); document.documentElement.classList.remove('light'); localStorage.setItem('sofem_display_theme', 'dark'); }}
            className={`flex-1 p-4 rounded-lg border text-center ${theme === 'dark' ? 'border-[var(--red)] bg-[var(--bg3)]' : 'border-[var(--border)]'}`}>
            <p className="text-2xl mb-1">🌙</p><p className="text-[10px] font-['IBM_Plex_Mono']">Sombre</p>
          </button>
          <button onClick={() => { setTheme('light'); document.documentElement.classList.add('light'); localStorage.setItem('sofem_display_theme', 'light'); }}
            className={`flex-1 p-4 rounded-lg border text-center ${theme === 'light' ? 'border-[var(--red)] bg-[var(--bg3)]' : 'border-[var(--border)]'}`}>
            <p className="text-2xl mb-1">☀️</p><p className="text-[10px] font-['IBM_Plex_Mono']">Clair</p>
          </button>
        </div>
      </div>
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="font-['Bebas_Neue'] text-lg tracking-wider mb-4">Couleur d'Accentuation</h3>
        <div className="grid grid-cols-6 gap-2">
          {colors.map(c => (
            <button key={c.value} onClick={() => { setAccent(c.value); localStorage.setItem('sofem_accent_color', c.value); document.documentElement.style.setProperty('--red', c.value); }}
              className={`w-full aspect-square rounded-lg border-2 transition-transform hover:scale-110 ${accent === c.value ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c.value }} title={c.name} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Users Tab ──────────────────────────────────────────────────

function UsersTab() {
  const qc = useQueryClient();
  const { data } = useQuery<{ data: User[] }>({ queryKey: ['users'], queryFn: () => api.get('/api/auth/users').then(r => r.data) });
  const { data: operateurs } = useQuery<{ data: Operateur[] }>({ queryKey: ['op-list'], queryFn: () => api.get('/api/operateurs?limit=500').then(r => r.data) });
  const [show, setShow] = useState(false);
  const [resetPin, setResetPin] = useState<User | null>(null);

  const resetPinMut = useMutation({
    mutationFn: ({ uid, new_pin }: { uid: number; new_pin: string }) => api.post(`/api/auth/users/${uid}/reset-pin`, { new_pin, force_change: true }),
    onSuccess: () => { setResetPin(null); toast.success('PIN reinitialise'); },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, actif }: { id: number; actif: boolean }) => api.put(`/api/auth/users/${id}`, { actif }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Utilisateur modifie'); },
  });

  return (
    <div>
      <div className="flex justify-end mb-4"><Button onClick={() => setShow(true)}>+ Utilisateur</Button></div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-[12px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[9px] uppercase tracking-[0.1em]">
            <tr><th className="text-left px-3 py-2"></th><th className="text-left px-3 py-2">Nom</th><th className="text-left px-3 py-2">Prenom</th><th className="text-left px-3 py-2">Role</th><th className="text-left px-3 py-2">Operateur</th><th className="text-left px-3 py-2">Statut</th><th className="text-right px-3 py-2">Actions</th></tr>
          </thead>
          <tbody>
            {data?.data?.map(u => (
              <tr key={u.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2"><div className="w-8 h-8 rounded-full bg-[var(--red)] flex items-center justify-center text-white font-['Bebas_Neue'] text-sm">{u.prenom[0]}{u.nom[0]}</div></td>
                <td className="px-3 py-2 font-medium">{u.nom}</td>
                <td className="px-3 py-2">{u.prenom}</td>
                <td className="px-3 py-2"><Badge label={u.role} color={u.role === 'ADMIN' ? 'red' : u.role === 'MANAGER' ? 'blue' : 'green'} /></td>
                <td className="px-3 py-2 text-[var(--muted)]">{u.operateur || '—'}</td>
                <td className="px-3 py-2">
                  <button onClick={() => toggleMut.mutate({ id: u.id, actif: !u.actif })}
                    className={`text-[10px] ${u.actif ? 'text-[var(--green)]' : 'text-[var(--muted)]'}`}>
                    {u.actif ? 'ACTIF' : 'INACTIF'}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setResetPin(u)} className="text-[var(--accent)] hover:underline text-[9px] mr-2">Reset PIN</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <UserCreateModal open={show} onClose={() => setShow(false)} operateurs={operateurs?.data || []} />

      {resetPin && (
        <Modal open onClose={() => setResetPin(null)} title={`Reinitialiser PIN — ${resetPin.prenom} ${resetPin.nom}`} width="max-w-sm">
          <form onSubmit={e => {
            e.preventDefault();
            const pin = (e.target as any).pin.value;
            if (!/^\d{4,8}$/.test(pin)) { toast.error('PIN: 4-8 chiffres'); return; }
            resetPinMut.mutate({ uid: resetPin.id, new_pin: pin });
          }} className="space-y-4">
            <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Nouveau PIN (4-8 chiffres)</label><input name="pin" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm font-['IBM_Plex_Mono'] text-center text-xl tracking-[0.3em]" maxLength={8} required /></div>
            <p className="text-[9px] text-[var(--accent)]">L'utilisateur devra changer son PIN a la prochaine connexion</p>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setResetPin(null)}>Annuler</Button><Button type="submit">Reinitialiser</Button></div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function UserCreateModal({ open, onClose, operateurs }: { open: boolean; onClose: () => void; operateurs: Operateur[] }) {
  const qc = useQueryClient();
  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/api/auth/users', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onClose(); toast.success('Utilisateur cree'); },
  });
  const [f, setF] = useState({ nom: '', prenom: '', role: 'OPERATOR', pin: '', operateur_id: '' });
  return (
    <Modal open={open} onClose={onClose} title="Nouvel Utilisateur" width="max-w-md">
      <form onSubmit={e => { e.preventDefault(); if (!/^\d{4,8}$/.test(f.pin)) { toast.error('PIN: 4-8 chiffres'); return; } if (!f.nom || !f.prenom) { toast.error('Nom et Prenom requis'); return; } createMut.mutate({ ...f, operateur_id: f.operateur_id ? parseInt(f.operateur_id) : null }); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3"><div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Prenom *</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.prenom} onChange={e => setF({ ...f, prenom: e.target.value })} required /></div><div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Nom *</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} required /></div></div>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Role</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}><option value="ADMIN">Admin</option><option value="MANAGER">Manager</option><option value="OPERATOR">Operateur</option></select></div>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">PIN (4-8 chiffres) *</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm font-['IBM_Plex_Mono'] text-center tracking-[0.3em]" maxLength={8} value={f.pin} onChange={e => setF({ ...f, pin: e.target.value.replace(/\D/g, '') })} required /></div>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Operateur lie</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.operateur_id} onChange={e => setF({ ...f, operateur_id: e.target.value })}><option value="">—</option>{operateurs.map(o => <option key={o.id} value={o.id}>{o.prenom} {o.nom}</option>)}</select></div>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit">Creer</Button></div>
      </form>
    </Modal>
  );
}

