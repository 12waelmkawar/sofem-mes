import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../store/authStore';

export default function MachinesPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  const { data } = useQuery({ queryKey: ['machines'], queryFn: () => api.get('/api/machines').then(r => r.data) });
  const { data: stats } = useQuery({ queryKey: ['machines-stats'], queryFn: () => api.get('/api/machines/stats/overview').then(r => r.data) });
  const createMut = useMutation({ mutationFn: (d: any) => api.post('/api/machines', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['machines', 'machines-stats'] }); setShow(false); toast.success('Machine creee'); } });
  const updateMut = useMutation({ mutationFn: ({ id, data: d }: any) => api.put(`/api/machines/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['machines'] }); setEdit(null); toast.success('Machine modifiee'); } });

  const statusColors: Record<string, 'green' | 'orange' | 'red' | 'muted'> = { OPERATIONNELLE: 'green', EN_MAINTENANCE: 'orange', EN_PANNE: 'red', ARRETEE: 'muted' };
  const statusLabels: Record<string, string> = { OPERATIONNELLE: 'Operationnelle', EN_MAINTENANCE: 'En Maintenance', EN_PANNE: 'En Panne', ARRETEE: 'Arretee' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">MACHINES</h1></div>
        {isManager() && <Button onClick={() => setShow(true)}>+ Machine</Button>}
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-4"><p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Total</p><p className="font-['Bebas_Neue'] text-[36px]">{stats.total}</p></div>
          <div className="bg-[var(--bg2)] border border-[var(--green)] rounded-xl p-4"><p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--green)] uppercase">Operationnelles</p><p className="font-['Bebas_Neue'] text-[36px] text-[var(--green)]">{stats.operationnelles}</p></div>
          <div className="bg-[var(--bg2)] border border-[var(--accent)] rounded-xl p-4"><p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--accent)] uppercase">Maintenance</p><p className="font-['Bebas_Neue'] text-[36px] text-[var(--accent)]">{stats.en_maintenance}</p></div>
          <div className="bg-[var(--bg2)] border border-[var(--red)] rounded-xl p-4"><p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--red)] uppercase">En Panne</p><p className="font-['Bebas_Neue'] text-[36px] text-[var(--red)]">{stats.en_panne}</p></div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-[12px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[9px] uppercase tracking-[0.1em]">
            <tr><th className="text-left px-3 py-2">Code</th><th className="text-left px-3 py-2">Nom</th><th className="text-left px-3 py-2">Type</th><th className="text-left px-3 py-2">Atelier</th><th className="text-left px-3 py-2">Statut</th>{isManager() && <th className="text-right px-3 py-2">Actions</th>}</tr>
          </thead>
          <tbody>
            {data?.map((m: any) => (
              <tr key={m.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2 text-[var(--muted)]">{m.code}</td>
                <td className="px-3 py-2 font-medium">{m.nom}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{m.type || '—'}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{m.atelier}</td>
                <td className="px-3 py-2">
                  {isManager() ? (
                    <select className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-[10px]" value={m.statut}
                      onChange={e => updateMut.mutate({ id: m.id, data: { statut: e.target.value } })}>
                      <option value="OPERATIONNELLE">Operationnelle</option>
                      <option value="EN_MAINTENANCE">En Maintenance</option>
                      <option value="EN_PANNE">En Panne</option>
                      <option value="ARRETEE">Arretee</option>
                    </select>
                  ) : <Badge label={statusLabels[m.statut]} color={statusColors[m.statut]} />}
                </td>
                {isManager() && <td className="px-3 py-2 text-right"><button onClick={() => setEdit(m)} className="text-[var(--blue)] hover:underline mr-2">Edit</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MachineModal open={show} onClose={() => setShow(false)} onSubmit={(d: any) => createMut.mutate(d)} />
      {edit && <MachineModal open={!!edit} onClose={() => setEdit(null)} onSubmit={(d: any) => updateMut.mutate({ id: edit.id, data: d })} initial={edit} />}
    </div>
  );
}

function MachineModal({ open, onClose, onSubmit, initial }: { open: boolean; onClose: () => void; onSubmit: (d: any) => void; initial?: any }) {
  const [f, setF] = useState(initial ? { nom: initial.nom, type: initial.type || '', atelier: initial.atelier, marque: initial.marque || '', modele: initial.modele || '', statut: initial.statut } : { nom: '', type: '', atelier: 'Atelier A', marque: '', modele: '', statut: 'OPERATIONNELLE' });
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Modifier Machine' : 'Nouvelle Machine'}>
      <form onSubmit={e => { e.preventDefault(); if (!f.nom.trim()) { toast.error('Nom requis'); return; } onSubmit(f); }} className="space-y-3">
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Nom *</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Type</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.type} onChange={e => setF({ ...f, type: e.target.value })} /></div>
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Atelier</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.atelier} onChange={e => setF({ ...f, atelier: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Marque</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.marque} onChange={e => setF({ ...f, marque: e.target.value })} /></div>
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Modele</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.modele} onChange={e => setF({ ...f, modele: e.target.value })} /></div>
        </div>
        {initial && (
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Statut</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.statut} onChange={e => setF({ ...f, statut: e.target.value })}><option value="OPERATIONNELLE">Operationnelle</option><option value="EN_MAINTENANCE">En Maintenance</option><option value="EN_PANNE">En Panne</option><option value="ARRETEE">Arretee</option></select></div>
        )}
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit">{initial ? 'Enregistrer' : 'Creer'}</Button></div>
      </form>
    </Modal>
  );
}
