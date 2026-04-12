import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../store/authStore';

export default function ClientsPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  const { data } = useQuery({ queryKey: ['clients'], queryFn: () => api.get('/api/clients?limit=500').then(r => r.data.data) });
  const createMut = useMutation({ mutationFn: (d: any) => api.post('/api/clients', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setShow(false); toast.success('Client cree'); } });
  const updateMut = useMutation({ mutationFn: ({ id, data: d }: any) => api.put(`/api/clients/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setEdit(null); toast.success('Client modifie'); } });
  const deleteMut = useMutation({ mutationFn: (id: number) => api.delete(`/api/clients/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client supprime'); } });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">CLIENTS</h1><p className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted)]">{data?.length || 0} clients</p></div>
        {isManager() && <Button onClick={() => setShow(true)}>+ Client</Button>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-[12px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[9px] uppercase tracking-[0.1em]">
            <tr><th className="text-left px-3 py-2">Code</th><th className="text-left px-3 py-2">Raison Sociale</th><th className="text-left px-3 py-2">Telephone</th><th className="text-left px-3 py-2">Email</th><th className="text-left px-3 py-2">Ville</th><th className="text-left px-3 py-2">MF</th>{isManager() && <th className="text-right px-3 py-2">Actions</th>}</tr>
          </thead>
          <tbody>
            {data?.map((c: any) => (
              <tr key={c.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2 text-[var(--muted)]">{c.code}</td>
                <td className="px-3 py-2 font-medium">{c.nom}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{c.telephone || '—'}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{c.email || '—'}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{c.ville || '—'}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{c.matricule_fiscal || '—'}</td>
                {isManager() && <td className="px-3 py-2 text-right"><button onClick={() => setEdit(c)} className="text-[var(--blue)] hover:underline mr-2">Edit</button><button onClick={() => { if (confirm('Supprimer?')) deleteMut.mutate(c.id); }} className="text-[var(--red)] hover:underline">Suppr</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ClientModal open={show} onClose={() => setShow(false)} onSubmit={(d: any) => createMut.mutate(d)} />
      {edit && <ClientModal open={!!edit} onClose={() => setEdit(null)} onSubmit={(d: any) => updateMut.mutate({ id: edit.id, data: d })} initial={edit} />}
    </div>
  );
}

function ClientModal({ open, onClose, onSubmit, initial }: { open: boolean; onClose: () => void; onSubmit: (d: any) => void; initial?: any }) {
  const [f, setF] = useState(initial ? { nom: initial.nom, telephone: initial.telephone || '', email: initial.email || '', adresse: initial.adresse || '', ville: initial.ville || '', matricule_fiscal: initial.matricule_fiscal || '', notes: initial.notes || '' } : { nom: '', telephone: '', email: '', adresse: '', ville: '', matricule_fiscal: '', notes: '' });
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Modifier Client' : 'Nouveau Client'}>
      <form onSubmit={e => { e.preventDefault(); if (!f.nom.trim()) { toast.error('Nom requis'); return; } onSubmit(f); }} className="space-y-3">
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Nom *</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Telephone</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.telephone} onChange={e => setF({ ...f, telephone: e.target.value })} /></div>
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Email</label><input type="email" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Ville</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.ville} onChange={e => setF({ ...f, ville: e.target.value })} /></div>
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Matricule Fiscal</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.matricule_fiscal} onChange={e => setF({ ...f, matricule_fiscal: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit">{initial ? 'Enregistrer' : 'Creer'}</Button></div>
      </form>
    </Modal>
  );
}
