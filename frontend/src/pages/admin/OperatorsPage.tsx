import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../store/authStore';

export default function OperatorsPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  const { data } = useQuery({ queryKey: ['operateurs'], queryFn: () => api.get('/api/operateurs?limit=500').then(r => r.data.data) });
  const createMut = useMutation({ mutationFn: (d: any) => api.post('/api/operateurs', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['operateurs'] }); setShow(false); toast.success('Operateur cree'); } });
  const updateMut = useMutation({ mutationFn: ({ id, data: d }: any) => api.put(`/api/operateurs/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['operateurs'] }); setEdit(null); toast.success('Operateur modifie'); } });
  const deleteMut = useMutation({ mutationFn: (id: number) => api.delete(`/api/operateurs/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['operateurs'] }); toast.success('Operateur supprime'); } });

  const roleColors: Record<string, 'red' | 'blue' | 'green' | 'muted'> = { CHEF_ATELIER: 'blue', RESPONSABLE: 'red', TECHNICIEN: 'green', OPERATEUR: 'muted' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">OPERATEURS</h1><p className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted)]">{data?.length || 0} operateurs</p></div>
        {isManager() && <Button onClick={() => setShow(true)}>+ Operateur</Button>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-[12px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[9px] uppercase tracking-[0.1em]">
            <tr><th className="text-left px-3 py-2"></th><th className="text-left px-3 py-2">Prenom</th><th className="text-left px-3 py-2">Nom</th><th className="text-left px-3 py-2">Specialite</th><th className="text-left px-3 py-2">Role</th><th className="text-left px-3 py-2">Telephone</th><th className="text-left px-3 py-2">Taux</th>{isManager() && <th className="text-right px-3 py-2">Actions</th>}</tr>
          </thead>
          <tbody>
            {data?.map((o: any) => (
              <tr key={o.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2"><div className="w-8 h-8 rounded-full bg-[var(--red)] flex items-center justify-center text-white font-['Bebas_Neue'] text-sm">{o.prenom[0]}{o.nom[0]}</div></td>
                <td className="px-3 py-2 font-medium">{o.prenom}</td>
                <td className="px-3 py-2">{o.nom}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{o.specialite}</td>
                <td className="px-3 py-2"><Badge label={o.role} color={roleColors[o.role]} /></td>
                <td className="px-3 py-2 text-[var(--muted)]">{o.telephone || '—'}</td>
                <td className="px-3 py-2 text-[10px]">{o.type_taux === 'HORAIRE' && `${o.taux_horaire} TND/h`}{o.type_taux === 'PIECE' && `${o.taux_piece} TND/pcs`}{o.type_taux === 'BOTH' && `${o.taux_horaire}/h + ${o.taux_piece}/pcs`}</td>
                {isManager() && <td className="px-3 py-2 text-right"><button onClick={() => setEdit(o)} className="text-[var(--blue)] hover:underline mr-2">Edit</button><button onClick={() => { if (confirm('Supprimer?')) deleteMut.mutate(o.id); }} className="text-[var(--red)] hover:underline">Suppr</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <OpModal open={show} onClose={() => setShow(false)} onSubmit={(d: any) => createMut.mutate(d)} />
      {edit && <OpModal open={!!edit} onClose={() => setEdit(null)} onSubmit={(d: any) => updateMut.mutate({ id: edit.id, data: d })} initial={edit} />}
    </div>
  );
}

function OpModal({ open, onClose, onSubmit, initial }: { open: boolean; onClose: () => void; onSubmit: (d: any) => void; initial?: any }) {
  const [f, setF] = useState(initial ? { prenom: initial.prenom, nom: initial.nom, specialite: initial.specialite, role: initial.role, telephone: initial.telephone || '', email: initial.email || '', type_taux: initial.type_taux, taux_horaire: initial.taux_horaire, taux_piece: initial.taux_piece } : { prenom: '', nom: '', specialite: 'Ponçage', role: 'OPERATEUR', telephone: '', email: '', type_taux: 'HORAIRE', taux_horaire: 0, taux_piece: 0 });
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Modifier Operateur' : 'Nouvel Operateur'} width="max-w-xl">
      <form onSubmit={e => { e.preventDefault(); if (!f.prenom || !f.nom) { toast.error('Prenom et Nom requis'); return; } onSubmit(f); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Prenom *</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.prenom} onChange={e => setF({ ...f, prenom: e.target.value })} required /></div>
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Nom *</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.nom} onChange={e => setF({ ...f, nom: e.target.value })} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Specialite</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.specialite} onChange={e => setF({ ...f, specialite: e.target.value })} /></div>
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Role</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.role} onChange={e => setF({ ...f, role: e.target.value })}><option value="OPERATEUR">Operateur</option><option value="CHEF_ATELIER">Chef Atelier</option><option value="RESPONSABLE">Responsable</option><option value="TECHNICIEN">Technicien</option></select></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Telephone</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.telephone} onChange={e => setF({ ...f, telephone: e.target.value })} /></div>
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Email</label><input type="email" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
        </div>
        <div>
          <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Type Taux</label>
          <div className="flex gap-3 mt-1">
            {(['HORAIRE', 'PIECE', 'BOTH'] as const).map(t => (
              <button key={t} type="button" onClick={() => setF({ ...f, type_taux: t })} className={`px-3 py-1 rounded text-[10px] font-['IBM_Plex_Mono'] border ${f.type_taux === t ? 'bg-[var(--red)] text-white border-[var(--red)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>{t}</button>
            ))}
          </div>
        </div>
        {(f.type_taux === 'HORAIRE' || f.type_taux === 'BOTH') && (
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Taux Horaire (TND/h)</label><input type="number" step="0.01" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.taux_horaire} onChange={e => setF({ ...f, taux_horaire: +e.target.value })} /></div>
        )}
        {(f.type_taux === 'PIECE' || f.type_taux === 'BOTH') && (
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Taux Piece (TND/pcs)</label><input type="number" step="0.01" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.taux_piece} onChange={e => setF({ ...f, taux_piece: +e.target.value })} /></div>
        )}
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit">{initial ? 'Enregistrer' : 'Creer'}</Button></div>
      </form>
    </Modal>
  );
}
