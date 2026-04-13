import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../store/authStore';

interface Fournisseur { id: number; code: string; nom: string; contact: string | null; telephone: string | null; email: string | null; ville: string; pays: string; statut: string; matricule_fiscal: string | null; }
const STAT_COLORS: Record<string, 'green' | 'muted' | 'red'> = { ACTIF: 'green', INACTIF: 'muted', BLACKLISTE: 'red' };

export default function FournisseursPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<Fournisseur | null>(null);

  const { data } = useQuery<Fournisseur[]>({ queryKey: ['fournisseurs'], queryFn: () => api.get('/api/fournisseurs').then(r => r.data) });
  const createMut = useMutation({ mutationFn: (d: any) => api.post('/api/fournisseurs', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fournisseurs'] }); setShow(false); toast.success('Fournisseur cree'); } });
  const updateMut = useMutation({ mutationFn: ({ id, data: d }: any) => api.put(`/api/fournisseurs/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fournisseurs'] }); setEdit(null); toast.success('Fournisseur modifie'); } });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">FOURNISSEURS</h1><p className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted)]">{data?.length || 0} fournisseurs</p></div>
        {isManager() && <Button onClick={() => setShow(true)}>+ Nouveau Fournisseur</Button>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[8px] uppercase tracking-[0.1em]">
            <tr><th className="text-left px-3 py-2">Code</th><th className="text-left px-3 py-2">Raison Sociale</th><th className="text-left px-3 py-2">Contact</th><th className="text-left px-3 py-2">Telephone</th><th className="text-left px-3 py-2">Email</th><th className="text-left px-3 py-2">Ville</th><th className="text-left px-3 py-2">Statut</th><th className="text-right px-3 py-2">Actions</th></tr>
          </thead>
          <tbody>
            {data?.map(f => (
              <tr key={f.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2 text-[var(--muted)]">{f.code}</td>
                <td className="px-3 py-2 font-medium">{f.nom}<br /><span className="text-[8px] text-[var(--muted)]">{f.matricule_fiscal || '—'}</span></td>
                <td className="px-3 py-2 text-[var(--muted)]">{f.contact || '—'}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{f.telephone || '—'}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{f.email || '—'}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{f.ville}</td>
                <td className="px-3 py-2"><Badge label={f.statut} color={STAT_COLORS[f.statut]} /></td>
                <td className="px-3 py-2 text-right"><button onClick={() => setEdit(f)} className="text-[var(--blue)] hover:underline text-[9px]">Edit</button></td>
              </tr>
            ))}
            {(!data || data.length === 0) && <tr><td colSpan={8} className="px-3 py-8 text-center text-[var(--muted)] text-[10px]">Aucun fournisseur</td></tr>}
          </tbody>
        </table>
      </div>
      <FournModal open={show} onClose={() => setShow(false)} onSubmit={(d: any) => createMut.mutate(d)} />
      {edit && <FournModal open={!!edit} onClose={() => setEdit(null)} onSubmit={(d: any) => updateMut.mutate({ id: edit.id, data: d })} initial={edit} />}
    </div>
  );
}

function FournModal({ open, onClose, onSubmit, initial }: { open: boolean; onClose: () => void; onSubmit: (d: any) => void; initial?: Fournisseur }) {
  const [f, setF] = useState(initial ? { nom: initial.nom, contact: initial.contact || '', telephone: initial.telephone || '', email: initial.email || '', ville: initial.ville, pays: initial.pays, matricule_fiscal: initial.matricule_fiscal || '' } : { nom: '', contact: '', telephone: '', email: '', ville: 'Sfax', pays: 'Tunisie', matricule_fiscal: '' });
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Modifier Fournisseur' : 'Nouveau Fournisseur'} width="max-w-xl">
      <form onSubmit={e => { e.preventDefault(); if (!f.nom.trim()) { toast.error('Nom requis'); return; } onSubmit(f); }} className="space-y-3">
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Raison Sociale *</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Contact</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.contact} onChange={e => setF({ ...f, contact: e.target.value })} /></div>
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Telephone</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.telephone} onChange={e => setF({ ...f, telephone: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Email</label><input type="email" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Ville</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.ville} onChange={e => setF({ ...f, ville: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Pays</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.pays} onChange={e => setF({ ...f, pays: e.target.value })} /></div>
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Matricule Fiscal</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.matricule_fiscal} onChange={e => setF({ ...f, matricule_fiscal: e.target.value })} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit">{initial ? 'Enregistrer' : 'Creer'}</Button></div>
      </form>
    </Modal>
  );
}
