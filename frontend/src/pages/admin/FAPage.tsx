import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../store/authStore';

interface FA { id: number; fa_numero: string; bc_numero: string; fournisseur: string; date_facture: string; montant_ht: number; }

export default function FAPage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const { data } = useQuery<FA[]>({ queryKey: ['fas'], queryFn: () => api.get('/api/achats/fa').then(r => r.data) });
  const { data: bcs } = useQuery<any[]>({ queryKey: ['bc-fa'], queryFn: () => api.get('/api/achats/bc').then(r => r.data), enabled: show });

  const createMut = useMutation({ mutationFn: (d: any) => api.post('/api/achats/fa', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['fas'] }); setShow(false); toast.success('FA creee'); } });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">FACTURES D'ACHAT</h1><p className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted)]">{data?.length || 0} FAs</p></div>
        {isManager() && <Button onClick={() => setShow(true)}>+ Facture Achat</Button>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[8px] uppercase tracking-[0.1em]">
            <tr><th className="text-left px-3 py-2">N FA</th><th className="text-left px-3 py-2">Fournisseur</th><th className="text-left px-3 py-2">BC lie</th><th className="text-right px-3 py-2">Montant HT</th><th className="text-left px-3 py-2">Date</th><th className="text-right px-3 py-2">Actions</th></tr>
          </thead>
          <tbody>
            {data?.map(fa => (
              <tr key={fa.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2 font-bold">{fa.fa_numero}</td>
                <td className="px-3 py-2">{fa.fournisseur}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{fa.bc_numero || '—'}</td>
                <td className="px-3 py-2 text-right">{fa.montant_ht?.toFixed(2) || '0.00'} DT</td>
                <td className="px-3 py-2 text-[var(--muted)]">{fa.date_facture ? new Date(fa.date_facture).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="px-3 py-2 text-right"><button className="text-[var(--blue)] hover:underline text-[9px]">PDF</button></td>
              </tr>
            ))}
            {(!data || data.length === 0) && <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--muted)] text-[10px]">Aucune facture</td></tr>}
          </tbody>
        </table>
      </div>
      {show && <CreateFAModal onClose={() => setShow(false)} bcs={bcs || []} onCreate={(d: any) => createMut.mutate(d)} />}
    </div>
  );
}

function CreateFAModal({ onClose, bcs, onCreate }: { onClose: () => void; bcs: any[]; onCreate: (d: any) => void }) {
  const [f, setF] = useState({ bc_id: '', fournisseur: '', date_facture: new Date().toISOString().split('T')[0] });
  return (
    <Modal open onClose={onClose} title="Nouvelle Facture d'Achat" width="max-w-md">
      <form onSubmit={e => { e.preventDefault(); if (!f.fournisseur || !f.date_facture) { toast.error('Champs requis'); return; } onCreate({ ...f, bc_id: f.bc_id ? parseInt(f.bc_id) : null }); }} className="space-y-3">
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">BC lie</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.bc_id} onChange={e => setF({ ...f, bc_id: e.target.value })}><option value="">—</option>{bcs.map(bc => <option key={bc.id} value={bc.id}>{bc.bc_numero} - {bc.fournisseur}</option>)}</select></div>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Fournisseur *</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.fournisseur} onChange={e => setF({ ...f, fournisseur: e.target.value })} required /></div>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Date Facture *</label><input type="date" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.date_facture} onChange={e => setF({ ...f, date_facture: e.target.value })} required /></div>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit">Creer</Button></div>
      </form>
    </Modal>
  );
}
