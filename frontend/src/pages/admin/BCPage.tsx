import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../store/authStore';

interface BC { id: number; bc_numero: string; fournisseur: string; da_numero: string; statut: string; montant_ht: number; created_at: string; lignes: any[]; }
const STAT_COLORS: Record<string, 'blue' | 'green' | 'red' | 'muted'> = { DRAFT: 'muted', ENVOYE: 'blue', RECU: 'green', ANNULE: 'red', RECU_PARTIEL: 'red' };

export default function BCPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const { data } = useQuery<BC[]>({ queryKey: ['bcs'], queryFn: () => api.get('/api/achats/bc').then(r => r.data) });
  const statMut = useMutation({ mutationFn: ({ id, statut }: any) => api.put(`/api/achats/bc/${id}`, { statut }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['bcs'] }); toast.success('BC mis a jour'); } });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">BONS DE COMMANDE</h1><p className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted)]">{data?.length || 0} BCs</p></div>
        {isManager() && <Button onClick={() => setShow(true)}>+ Bon Commande</Button>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[8px] uppercase tracking-[0.1em]">
            <tr><th className="text-left px-3 py-2">N BC</th><th className="text-left px-3 py-2">Fournisseur</th><th className="text-left px-3 py-2">DA liee</th><th className="text-right px-3 py-2">Montant HT</th><th className="text-left px-3 py-2">Statut</th><th className="text-left px-3 py-2">Lignes</th><th className="text-right px-3 py-2">Actions</th></tr>
          </thead>
          <tbody>
            {data?.map(bc => (
              <tr key={bc.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2 font-bold">{bc.bc_numero}</td>
                <td className="px-3 py-2">{bc.fournisseur}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{bc.da_numero || '—'}</td>
                <td className="px-3 py-2 text-right">{bc.montant_ht?.toFixed(2) || '0.00'} DT</td>
                <td className="px-3 py-2"><Badge label={bc.statut} color={STAT_COLORS[bc.statut]} /></td>
                <td className="px-3 py-2">{(bc.lignes || []).length} ligne(s)</td>
                <td className="px-3 py-2 text-right">
                  {bc.statut === 'DRAFT' && <button onClick={() => statMut.mutate({ id: bc.id, statut: 'ENVOYE' })} className="text-[var(--blue)] hover:underline text-[9px] mr-2">Envoyer</button>}
                  {bc.statut === 'ENVOYE' && <button onClick={() => statMut.mutate({ id: bc.id, statut: 'RECU' })} className="text-[var(--green)] hover:underline text-[9px] mr-2">Recevoir</button>}
                </td>
              </tr>
            ))}
            {(!data || data.length === 0) && <tr><td colSpan={7} className="px-3 py-8 text-center text-[var(--muted)] text-[10px]">Aucun BC</td></tr>}
          </tbody>
        </table>
      </div>
      {show && <CreateBCModal onClose={() => setShow(false)} />}
    </div>
  );
}

function CreateBCModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: das } = useQuery<any[]>({ queryKey: ['das-bc'], queryFn: () => api.get('/api/achats/da').then(r => r.data.filter((d: any) => d.statut === 'APPROVED')), enabled: true });
  const { data: materiaux } = useQuery<any[]>({ queryKey: ['mat-bc'], queryFn: () => api.get('/api/materiaux?limit=500').then(r => r.data.data) });
  const [fournisseur, setFournisseur] = useState('');
  const [daId, setDaId] = useState('');
  const [lignes, setLignes] = useState<any[]>([]);

  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/api/achats/bc', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bcs'] }); onClose(); toast.success('BC cree'); },
  });

  const addLigne = () => setLignes([...lignes, { materiau_id: '', quantite: 1, unite: 'pcs' }]);
  const updateLigne = (i: number, field: string, val: any) => { const next = [...lignes]; next[i] = { ...next[i], [field]: val }; setLignes(next); };
  const removeLigne = (i: number) => setLignes(lignes.filter((_, idx) => idx !== i));

  return (
    <Modal open onClose={onClose} title="Nouveau Bon de Commande" width="max-w-2xl">
      <form onSubmit={e => { e.preventDefault(); if (!fournisseur) { toast.error('Fournisseur requis'); return; } if (lignes.length === 0) { toast.error('Au moins une ligne requise'); return; } createMut.mutate({ fournisseur, da_id: daId ? parseInt(daId) : null, lignes: lignes.map(l => ({ ...l, materiau_id: l.materiau_id ? parseInt(l.materiau_id) : null })) }); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Fournisseur *</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={fournisseur} onChange={e => setFournisseur(e.target.value)} required /></div>
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">DA liee</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={daId} onChange={e => setDaId(e.target.value)}><option value="">—</option>{das?.map(d => <option key={d.id} value={d.id}>{d.da_numero} - {d.description}</option>)}</select></div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1"><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Lignes</label><Button type="button" variant="ghost" size="sm" onClick={addLigne}>+ Ligne</Button></div>
          {lignes.map((l, i) => (
            <div key={i} className="flex gap-2 items-center mb-1">
              <select className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-xs" value={l.materiau_id} onChange={e => updateLigne(i, 'materiau_id', e.target.value)}>
                <option value="">Materiau...</option>{materiaux?.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
              <input type="number" min="1" className="w-20 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-xs" value={l.quantite} onChange={e => updateLigne(i, 'quantite', +e.target.value)} />
              <button type="button" onClick={() => removeLigne(i)} className="text-[var(--red)] text-sm">×</button>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit">Creer</Button></div>
      </form>
    </Modal>
  );
}
