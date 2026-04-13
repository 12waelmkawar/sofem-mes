import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';

interface BL {
  id: number; numero: string; of_numero: string; produit_nom: string; quantite: number;
  destinataire: string; statut: string; date_livraison_reelle: string | null;
  date_livraison: string | null; notes: string | null;
}

export default function BLPage() {
  const qc = useQueryClient();
  const [deliverBL, setDeliverBL] = useState<BL | null>(null);

  const { data } = useQuery<BL[]>({
    queryKey: ['bls'],
    queryFn: () => api.get('/api/bl').then(r => r.data),
  });

  const deliverMut = useMutation({
    mutationFn: ({ id, data: d }: { id: number; data: any }) => api.put(`/api/bl/${id}/livrer`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bls'] }); setDeliverBL(null); toast.success('BL livre'); },
    onError: (e: any) => toast.error(e.response?.data?.error?.message || 'Erreur'),
  });

  const statColors: Record<string, 'blue' | 'green' | 'red'> = { EMIS: 'blue', LIVRE: 'green', CANCELLED: 'red' };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">BONS DE LIVRAISON</h1>
          <p className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted)]">{data?.length || 0} BLs</p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-[12px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[9px] uppercase tracking-[0.1em]">
            <tr><th className="text-left px-3 py-2">N BL</th><th className="text-left px-3 py-2">N OF</th><th className="text-left px-3 py-2">Produit</th><th className="text-right px-3 py-2">Qte</th><th className="text-left px-3 py-2">Destinataire</th><th className="text-left px-3 py-2">Statut</th><th className="text-left px-3 py-2">Date Livraison</th><th className="text-right px-3 py-2">Actions</th></tr>
          </thead>
          <tbody>
            {data?.map(bl => (
              <tr key={bl.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2 font-bold">{bl.numero}</td>
                <td className="px-3 py-2">{bl.of_numero}</td>
                <td className="px-3 py-2">{bl.produit_nom}</td>
                <td className="px-3 py-2 text-right">{bl.quantite}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{bl.destinataire || '—'}</td>
                <td className="px-3 py-2"><Badge label={bl.statut} color={statColors[bl.statut]} /></td>
                <td className="px-3 py-2 text-[var(--muted)]">{bl.date_livraison_reelle ? new Date(bl.date_livraison_reelle).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="px-3 py-2 text-right">
                  <button className="text-[var(--blue)] hover:underline text-[9px] mr-2">PDF</button>
                  {bl.statut === 'EMIS' && <button onClick={() => setDeliverBL(bl)} className="text-[var(--green)] hover:underline text-[9px]">Livrer</button>}
                </td>
              </tr>
            ))}
            {(!data || data.length === 0) && <tr><td colSpan={8} className="px-3 py-8 text-center text-[var(--muted)] text-[10px]">Aucun BL</td></tr>}
          </tbody>
        </table>
      </div>

      {deliverBL && <DeliverModal bl={deliverBL} onClose={() => setDeliverBL(null)} onDeliver={(d) => deliverMut.mutate({ id: deliverBL.id, data: d })} />}
    </div>
  );
}

function DeliverModal({ bl, onClose, onDeliver }: { bl: BL; onClose: () => void; onDeliver: (d: any) => void }) {
  const [f, setF] = useState({ destinataire: 'SOFEM', adresse: 'Route Sidi Salem 2.5KM, Sfax', date_livraison: new Date().toISOString().split('T')[0], notes: '' });
  return (
    <Modal open onClose={onClose} title={`Livrer ${bl.numero}`} width="max-w-md">
      <form onSubmit={e => { e.preventDefault(); onDeliver(f); }} className="space-y-3">
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Destinataire *</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.destinataire} onChange={e => setF({ ...f, destinataire: e.target.value })} required /></div>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Adresse</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.adresse} onChange={e => setF({ ...f, adresse: e.target.value })} /></div>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Date Livraison *</label><input type="date" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.date_livraison} onChange={e => setF({ ...f, date_livraison: e.target.value })} required /></div>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Notes</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit">Confirmer</Button></div>
      </form>
    </Modal>
  );
}
