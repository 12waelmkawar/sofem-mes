import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';

export default function PlanningPage() {
  const { data: slots } = useQuery<any[]>({ queryKey: ['planning'], queryFn: () => api.get('/api/planning').then(r => r.data) });
  const { data: ofs } = useQuery<any[]>({ queryKey: ['plan-ofs'], queryFn: () => api.get('/api/of?limit=200').then(r => r.data.data) });
  const { data: machines } = useQuery<any[]>({ queryKey: ['plan-machines'], queryFn: () => api.get('/api/machines').then(r => r.data) });
  const { data: operateurs } = useQuery<any[]>({ queryKey: ['plan-ops'], queryFn: () => api.get('/api/operateurs?limit=200').then(r => r.data.data) });

  const statutColors: Record<string, 'green' | 'blue' | 'orange' | 'red' | 'muted'> = {
    PLANIFIE: 'blue', EN_COURS: 'orange', TERMINE: 'green', ANNULE: 'red',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">PLANNING</h1></div>
        <CreatePlanningSlotButton ofs={ofs || []} machines={machines || []} operateurs={operateurs || []} />
      </div>

      {/* Gantt-like visual */}
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5 mb-6">
        <h2 className="font-['Bebas_Neue'] text-lg tracking-wider mb-4">VUE GANTT</h2>
        {slots?.length ? (
          <div className="space-y-2">
            {slots.map(s => {
              const start = new Date(s.date_debut);
              const end = new Date(s.date_fin);
              const duration = end.getTime() - start.getTime();
              const color = statutColors[s.statut] || 'blue';
              const bgMap: Record<string, string> = { blue: 'var(--blue)', green: 'var(--green)', orange: 'var(--accent)', red: 'var(--red)', muted: 'var(--muted)' };
              return (
                <div key={s.id} className="flex items-center gap-3">
                  <span className="w-24 text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] truncate">{s.of_numero} - {s.produit_nom}</span>
                  <div className="flex-1 bg-[var(--bg3)] rounded-full h-6 relative overflow-hidden">
                    <div
                      className="h-full rounded-full flex items-center px-2 text-[8px] text-white font-['IBM_Plex_Mono']"
                      style={{ backgroundColor: bgMap[color], width: `${Math.max(10, (duration / (1000 * 60 * 60 * 24 * 7)) * 100)}%` }}
                    >
                      {s.machine_nom || '—'}
                    </div>
                  </div>
                  <span className="w-20 text-[8px] text-[var(--muted)] text-right">{start.toLocaleDateString('fr-FR')}</span>
                </div>
              );
            })}
          </div>
        ) : <p className="text-[var(--muted)] text-sm">Aucun creneau</p>}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[8px] uppercase tracking-[0.1em]">
            <tr><th className="text-left px-3 py-2">OF</th><th className="text-left px-3 py-2">Produit</th><th className="text-left px-3 py-2">Machine</th><th className="text-left px-3 py-2">Operateur</th><th className="text-left px-3 py-2">Debut</th><th className="text-left px-3 py-2">Fin</th><th className="text-left px-3 py-2">Statut</th></tr>
          </thead>
          <tbody>
            {slots?.map(s => (
              <tr key={s.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2 font-bold">{s.of_numero}</td>
                <td className="px-3 py-2">{s.produit_nom}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{s.machine_nom || '—'}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{s.operateur_prenom ? `${s.operateur_prenom} ${s.operateur_nom}` : '—'}</td>
                <td className="px-3 py-2 text-[var(--muted)] whitespace-nowrap">{s.date_debut ? new Date(s.date_debut).toLocaleString('fr-FR') : '—'}</td>
                <td className="px-3 py-2 text-[var(--muted)] whitespace-nowrap">{s.date_fin ? new Date(s.date_fin).toLocaleString('fr-FR') : '—'}</td>
                <td className="px-3 py-2"><Badge label={s.statut} color={statutColors[s.statut]} /></td>
              </tr>
            ))}
            {(!slots || slots.length === 0) && <tr><td colSpan={7} className="px-3 py-8 text-center text-[var(--muted)] text-[10px]">Aucun creneau</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreatePlanningSlotButton({ ofs, machines, operateurs }: { ofs: any[]; machines: any[]; operateurs: any[] }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const [f, setF] = useState({ of_id: '', machine_id: '', operateur_id: '', date_debut: '', date_fin: '' });
  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/api/planning', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['planning'] }); setOpen(false); toast.success('Creneau cree'); },
    onError: (e: any) => toast.error(e.response?.data?.error?.message || 'Erreur'),
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Nouveau Creneau</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nouveau Creneau" width="max-w-xl">
        <form onSubmit={e => { e.preventDefault(); if (!f.of_id || !f.date_debut || !f.date_fin) { toast.error('Champs requis'); return; } createMut.mutate({ of_id: parseInt(f.of_id), machine_id: f.machine_id ? parseInt(f.machine_id) : null, operateur_id: f.operateur_id ? parseInt(f.operateur_id) : null, date_debut: f.date_debut, date_fin: f.date_fin }); }} className="space-y-3">
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">OF *</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.of_id} onChange={e => setF({ ...f, of_id: e.target.value })} required><option value="">—</option>{ofs.map(o => <option key={o.id} value={o.id}>{o.numero} - {o.produit_nom}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Machine</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.machine_id} onChange={e => setF({ ...f, machine_id: e.target.value })}><option value="">—</option>{machines.filter(m => m.statut === 'OPERATIONNELLE').map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}</select></div>
            <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Operateur</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.operateur_id} onChange={e => setF({ ...f, operateur_id: e.target.value })}><option value="">—</option>{operateurs.map(o => <option key={o.id} value={o.id}>{o.prenom} {o.nom}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Debut *</label><input type="datetime-local" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.date_debut} onChange={e => setF({ ...f, date_debut: e.target.value })} required /></div>
            <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Fin *</label><input type="datetime-local" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.date_fin} onChange={e => setF({ ...f, date_fin: e.target.value })} required /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit">Creer</Button></div>
        </form>
      </Modal>
    </>
  );
}
