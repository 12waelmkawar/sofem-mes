import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import Button from '../../components/ui/Button';

interface Activity {
  id: number; created_at: string; user_nom: string; action: string;
  entity_type: string; entity_id: number; entity_numero: string; detail: string;
}

const ACTION_ICONS: Record<string, string> = { CREATE: '+', UPDATE: '✏️', DELETE: '✕', LOGIN: '🔑', LOGOUT: '🚪', APPROVE: '✔️', REJECT: '✕', CONFIRM: '✔️', CANCEL: '✕', DEACTIVATE: '⏻' };
const ACTION_COLORS: Record<string, string> = { CREATE: 'text-[var(--green)]', UPDATE: 'text-[var(--accent)]', DELETE: 'text-[var(--red)]', LOGIN: 'text-[var(--blue)]', LOGOUT: 'text-[var(--muted)]', APPROVE: 'text-[var(--green)]', REJECT: 'text-[var(--red)]', CONFIRM: 'text-[var(--green)]', CANCEL: 'text-[var(--red)]', DEACTIVATE: 'text-[var(--muted)]' };

export default function ActivityPage() {
  const { data, refetch } = useQuery<Activity[]>({ queryKey: ['activity'], queryFn: () => api.get('/api/notifications/activity').then(r => r.data) });

  const exportCSV = () => {
    if (!data) return;
    const header = 'Date;Action;Utilisateur;Type;ID;Detail\n';
    const rows = data.map(a => `${a.created_at};${a.action};${a.user_nom || '—'};${a.entity_type};${a.entity_numero || a.entity_id};${a.detail || ''}`).join('\n');
    const blob = new Blob(['\ufeff' + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `activity_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">JOURNAL D'ACTIVITE</h1><p className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted)]">{data?.length || 0} entrees</p></div>
        <div className="flex gap-2"><Button variant="secondary" onClick={() => refetch()}>Actualiser</Button><Button variant="secondary" onClick={exportCSV}>Export CSV</Button></div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[8px] uppercase tracking-[0.1em]">
            <tr><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Action</th><th className="text-left px-3 py-2">Utilisateur</th><th className="text-left px-3 py-2">Type</th><th className="text-left px-3 py-2">ID</th><th className="text-left px-3 py-2">Detail</th></tr>
          </thead>
          <tbody>
            {data?.map(a => (
              <tr key={a.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2 text-[var(--muted)] whitespace-nowrap">{new Date(a.created_at).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-2"><span className={ACTION_COLORS[a.action] || 'text-[var(--muted)]'}>{ACTION_ICONS[a.action] || '•'} {a.action}</span></td>
                <td className="px-3 py-2">{a.user_nom || '—'}</td>
                <td className="px-3 py-2"><span className="text-[8px] bg-[var(--bg3)] rounded px-1.5 py-0.5">{a.entity_type}</span></td>
                <td className="px-3 py-2 text-[var(--muted)]">{a.entity_numero || a.entity_id}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{a.detail || '—'}</td>
              </tr>
            ))}
            {(!data || data.length === 0) && <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--muted)] text-[10px]">Aucune activite</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
