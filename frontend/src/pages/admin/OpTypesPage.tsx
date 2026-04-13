import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../store/authStore';

interface OpType { id: number; nom: string; description: string | null; ordre: number; actif: boolean; }

export default function OpTypesPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);

  const { data } = useQuery<OpType[]>({ queryKey: ['op-types-all'], queryFn: () => api.get('/api/operation-types/all').then(r => r.data) });
  const createMut = useMutation({ mutationFn: (d: any) => api.post('/api/operation-types', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['op-types-all'] }); setShow(false); toast.success('Type cree'); } });
  const deleteMut = useMutation({ mutationFn: (id: number) => api.delete(`/api/operation-types/${id}`), onSuccess: (res: any) => { qc.invalidateQueries({ queryKey: ['op-types-all'] }); toast.success(res.message || 'Type supprime'); } });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">TYPES D'OPERATIONS</h1><p className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted)]">{data?.length || 0} types</p></div>
        {isManager() && <Button onClick={() => setShow(true)}>+ Nouvelle Opération</Button>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[8px] uppercase tracking-[0.1em]">
            <tr><th className="text-left px-3 py-2">Ordre</th><th className="text-left px-3 py-2">Nom</th><th className="text-left px-3 py-2">Description</th><th className="text-left px-3 py-2">Statut</th><th className="text-right px-3 py-2">Actions</th></tr>
          </thead>
          <tbody>
            {data?.map(t => (
              <tr key={t.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2">{t.ordre}</td>
                <td className="px-3 py-2 font-medium">{t.nom}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{t.description || '—'}</td>
                <td className="px-3 py-2"><span className={`text-[9px] ${t.actif ? 'text-[var(--green)]' : 'text-[var(--muted)]'}`}>{t.actif ? 'ACTIF' : 'INACTIF'}</span></td>
                <td className="px-3 py-2 text-right"><button onClick={() => deleteMut.mutate(t.id)} className="text-[var(--red)] hover:underline text-[9px]">Suppr</button></td>
              </tr>
            ))}
            {(!data || data.length === 0) && <tr><td colSpan={5} className="px-3 py-8 text-center text-[var(--muted)] text-[10px]">Aucun type</td></tr>}
          </tbody>
        </table>
      </div>
      <CreateModal open={show} onClose={() => setShow(false)} onCreate={(d: any) => createMut.mutate(d)} />
    </div>
  );
}

function CreateModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (d: any) => void }) {
  const [f, setF] = useState({ nom: '', description: '', ordre: '' });
  return (
    <Modal open={open} onClose={onClose} title="Nouvelle Opération" width="max-w-md">
      <form onSubmit={e => { e.preventDefault(); if (!f.nom.trim()) { toast.error('Nom requis'); return; } onCreate({ ...f, ordre: f.ordre ? parseInt(f.ordre) : undefined }); }} className="space-y-3">
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Nom *</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} required /></div>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Description</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></div>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Ordre</label><input type="number" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.ordre} onChange={e => setF({ ...f, ordre: e.target.value })} /></div>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit">Creer</Button></div>
      </form>
    </Modal>
  );
}
