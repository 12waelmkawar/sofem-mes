import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../store/authStore';

interface BR { id: number; br_numero: string; bc_numero: string; fournisseur: string; statut: string; quantite_commandee: number; quantite_recue: number | null; montant_total: number; date_reception: string; }
const STAT_COLORS: Record<string, 'green' | 'red' | 'muted' | 'orange'> = { EN_ATTENTE: 'muted', COMPLET: 'green', PARTIEL: 'orange', ANNULE: 'red' };

export default function BRPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [confirmBR, setConfirmBR] = useState<BR | null>(null);

  const { data } = useQuery<BR[]>({ queryKey: ['brs'], queryFn: () => api.get('/api/achats/br').then(r => r.data) });
  const confirmMut = useMutation({ mutationFn: ({ id, data: d }: any) => api.put(`/api/achats/br/${id}/confirmer`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['brs'] }); setConfirmBR(null); toast.success('Reception confirmee'); } });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">BONS DE RECEPTION</h1><p className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted)]">{data?.length || 0} BRs</p></div>
        {isManager() && <Button onClick={() => toast.info('Creation BR via BC')}>+ Reception</Button>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[8px] uppercase tracking-[0.1em]">
            <tr><th className="text-left px-3 py-2">N BR</th><th className="text-left px-3 py-2">BC lie</th><th className="text-left px-3 py-2">Fournisseur</th><th className="text-left px-3 py-2">Statut</th><th className="text-right px-3 py-2">Qte Cmd</th><th className="text-right px-3 py-2">Qte Recue</th><th className="text-left px-3 py-2">Date</th><th className="text-right px-3 py-2">Actions</th></tr>
          </thead>
          <tbody>
            {data?.map(br => (
              <tr key={br.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2 font-bold">{br.br_numero}</td>
                <td className="px-3 py-2">{br.bc_numero}</td>
                <td className="px-3 py-2">{br.fournisseur}</td>
                <td className="px-3 py-2"><Badge label={br.statut} color={STAT_COLORS[br.statut]} /></td>
                <td className="px-3 py-2 text-right">{br.quantite_commandee}</td>
                <td className="px-3 py-2 text-right">{br.quantite_recue ?? '—'}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{br.date_reception ? new Date(br.date_reception).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="px-3 py-2 text-right">
                  {br.statut !== 'COMPLET' && br.statut !== 'ANNULE' && <button onClick={() => setConfirmBR(br)} className="text-[var(--green)] hover:underline text-[9px]">Receptionner</button>}
                </td>
              </tr>
            ))}
            {(!data || data.length === 0) && <tr><td colSpan={8} className="px-3 py-8 text-center text-[var(--muted)] text-[10px]">Aucun BR</td></tr>}
          </tbody>
        </table>
      </div>

      {confirmBR && <ConfirmModal br={confirmBR} onClose={() => setConfirmBR(null)} onConfirm={(d: any) => confirmMut.mutate({ id: confirmBR.id, data: d })} />}
    </div>
  );
}

function ConfirmModal({ br, onClose, onConfirm }: { br: BR; onClose: () => void; onConfirm: (d: any) => void }) {
  const [qty, setQty] = useState(br.quantite_commandee);
  const [prix, setPrix] = useState(0);
  return (
    <Modal open onClose={onClose} title={`Receptionner ${br.br_numero}`} width="max-w-md">
      <form onSubmit={e => { e.preventDefault(); onConfirm({ quantite_recue: qty, prix_unitaire: prix }); }} className="space-y-3">
        <p className="text-[10px] text-[var(--muted)]">BC: {br.bc_numero} | Fournisseur: {br.fournisseur}</p>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Qte Commandee</label><input disabled className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={br.quantite_commandee} /></div>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Qte Recue</label><input type="number" min="0" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={qty} onChange={e => setQty(+e.target.value)} required /></div>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Prix Unitaire (DT)</label><input type="number" step="0.01" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={prix} onChange={e => setPrix(+e.target.value)} /></div>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit">Confirmer</Button></div>
      </form>
    </Modal>
  );
}
