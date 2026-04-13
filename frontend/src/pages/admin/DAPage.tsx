import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../store/authStore';

interface DA {
  id: number; da_numero: string; description: string; materiau_nom: string; materiau_code: string;
  of_numero: string; produit_nom: string; quantite: number; unite: string; urgence: string;
  demandeur_prenom: string; demandeur_nom: string; statut: string; created_at: string;
}

const STAT_COLORS: Record<string, 'green' | 'red' | 'blue' | 'muted' | 'orange'> = {
  PENDING: 'muted', APPROVED: 'green', REJECTED: 'red', ORDERED: 'blue', RECEIVED: 'green', CANCELLED: 'red',
};

export default function DAPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);

  const { data } = useQuery<DA[]>({ queryKey: ['das'], queryFn: () => api.get('/api/achats/da').then(r => r.data) });
  const { data: materiaux } = useQuery<any[]>({ queryKey: ['mat-da'], queryFn: () => api.get('/api/materiaux?limit=500').then(r => r.data.data), enabled: show });
  const { data: ofs } = useQuery<any[]>({ queryKey: ['of-da'], queryFn: () => api.get('/api/of?limit=200').then(r => r.data.data), enabled: show });

  const createMut = useMutation({ mutationFn: (d: any) => api.post('/api/achats/da', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['das'] }); setShow(false); toast.success('DA cree'); } });
  const approveMut = useMutation({ mutationFn: ({ id, statut }: any) => api.put(`/api/achats/da/${id}`, { statut }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['das'] }); toast.success('DA mise a jour'); } });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">DEMANDES D'ACHAT</h1><p className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted)]">{data?.length || 0} DAs</p></div>
        <Button onClick={() => setShow(true)}>+ Demande</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[8px] uppercase tracking-[0.1em]">
            <tr><th className="text-left px-3 py-2">N DA</th><th className="text-left px-3 py-2">Description</th><th className="text-left px-3 py-2">Materiau</th><th className="text-right px-3 py-2">Qte</th><th className="text-left px-3 py-2">Urgence</th><th className="text-left px-3 py-2">Statut</th><th className="text-left px-3 py-2">OF</th><th className="text-right px-3 py-2">Actions</th></tr>
          </thead>
          <tbody>
            {data?.map(da => (
              <tr key={da.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2 font-bold">{da.da_numero}</td>
                <td className="px-3 py-2">{da.description}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{da.materiau_nom || '—'}</td>
                <td className="px-3 py-2 text-right">{da.quantite} {da.unite}</td>
                <td className="px-3 py-2"><Badge label={da.urgence} color={da.urgence === 'URGENT' ? 'red' : 'blue'} /></td>
                <td className="px-3 py-2"><Badge label={da.statut} color={STAT_COLORS[da.statut]} /></td>
                <td className="px-3 py-2 text-[var(--muted)]">{da.of_numero ? `${da.of_numero} (${da.produit_nom || ''})` : '—'}</td>
                <td className="px-3 py-2 text-right">
                  {da.statut === 'PENDING' && isManager() && <>
                    <button onClick={() => approveMut.mutate({ id: da.id, statut: 'APPROVED' })} className="text-[var(--green)] hover:underline mr-2 text-[9px]">✓ Approuver</button>
                    <button onClick={() => approveMut.mutate({ id: da.id, statut: 'REJECTED' })} className="text-[var(--red)] hover:underline text-[9px]">✗ Rejeter</button>
                  </>}
                </td>
              </tr>
            ))}
            {(!data || data.length === 0) && <tr><td colSpan={8} className="px-3 py-8 text-center text-[var(--muted)] text-[10px]">Aucune DA</td></tr>}
          </tbody>
        </table>
      </div>

      {show && <CreateDAModal onClose={() => setShow(false)} materiaux={materiaux || []} ofs={ofs || []} onCreate={(d: any) => createMut.mutate(d)} />}
    </div>
  );
}

function CreateDAModal({ onClose, materiaux, ofs, onCreate }: { onClose: () => void; materiaux: any[]; ofs: any[]; onCreate: (d: any) => void }) {
  const [f, setF] = useState({ description: '', materiau_id: '', of_id: '', quantite: '1', urgence: 'NORMAL' });
  return (
    <Modal open onClose={onClose} title="Nouvelle Demande d'Achat" width="max-w-xl">
      <form onSubmit={e => { e.preventDefault(); if (!f.description) { toast.error('Description requise'); return; } onCreate({ ...f, materiau_id: f.materiau_id ? parseInt(f.materiau_id) : null, of_id: f.of_id ? parseInt(f.of_id) : null, quantite: parseFloat(f.quantite) }); }} className="space-y-3">
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Description *</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Materiau</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.materiau_id} onChange={e => setF({ ...f, materiau_id: e.target.value })}><option value="">—</option>{materiaux.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}</select></div>
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Quantite</label><input type="number" min="1" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.quantite} onChange={e => setF({ ...f, quantite: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">OF lie</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.of_id} onChange={e => setF({ ...f, of_id: e.target.value })}><option value="">—</option>{ofs.map(o => <option key={o.id} value={o.id}>{o.numero}</option>)}</select></div>
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Urgence</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.urgence} onChange={e => setF({ ...f, urgence: e.target.value })}><option value="NORMAL">Normal</option><option value="URGENT">Urgent</option></select></div>
        </div>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit">Creer</Button></div>
      </form>
    </Modal>
  );
}
