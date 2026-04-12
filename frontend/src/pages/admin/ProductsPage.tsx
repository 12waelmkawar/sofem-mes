import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../store/authStore';

interface Materiau { id: number; code: string; nom: string; unite: string; }

interface Produit {
  id: number; code: string; nom: string; description: string | null;
  unite: string; prix_vente_ht: number;
  bom: { materiau_id: number; materiau_nom: string; materiau_code: string; unite: string; quantite_par_unite: number }[];
}

export default function ProductsPage() {
  const { isManager } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editData, setEditData] = useState<Produit | null>(null);
  const [bomProductId, setBomProductId] = useState<number | null>(null);

  const { data } = useQuery({
    queryKey: ['produits'],
    queryFn: () => api.get<{ data: Produit[] }>('/api/produits?limit=500').then(r => r.data.data),
  });

  const { data: materiaux } = useQuery({
    queryKey: ['materiaux-simple'],
    queryFn: () => api.get<{ data: Materiau[] }>('/api/materiaux?limit=500').then(r => r.data.data),
  });

  const { data: bomLines } = useQuery({
    queryKey: ['bom', bomProductId],
    enabled: !!bomProductId,
    queryFn: () => api.get<any[]>(`/api/produits/${bomProductId}/bom`).then(r => r.data),
  });

  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/api/produits', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['produits'] }); setShowCreate(false); toast.success('Produit cree'); },
    onError: () => toast.error('Erreur'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data: d }: { id: number; data: any }) => api.put(`/api/produits/${id}`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['produits'] }); setEditData(null); toast.success('Produit modifie'); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/api/produits/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['produits'] }); toast.success('Produit supprime'); },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">PRODUITS</h1>
          <p className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted)]">{data?.length || 0} produits</p>
        </div>
        {isManager() && <Button onClick={() => setShowCreate(true)}>+ Produit</Button>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-[12px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[9px] uppercase tracking-[0.1em]">
            <tr>
              <th className="text-left px-3 py-2">Code</th>
              <th className="text-left px-3 py-2">Produit</th>
              <th className="text-left px-3 py-2">Unite</th>
              <th className="text-right px-3 py-2">Prix Vente HT</th>
              <th className="text-left px-3 py-2">Nomenclature (BOM)</th>
              {isManager() && <th className="text-right px-3 py-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data?.map(p => (
              <tr key={p.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2 text-[var(--muted)]">{p.code}</td>
                <td className="px-3 py-2 font-medium">{p.nom}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{p.unite}</td>
                <td className="px-3 py-2 text-right">{p.prix_vente_ht.toFixed(2)} DT</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(p.bom || []).slice(0, 3).map((b: any) => (
                      <Badge key={b.materiau_id} label={`${b.materiau_nom} x${b.quantite_par_unite}`} color="blue" />
                    ))}
                    {(p.bom || []).length > 3 && <span className="text-[8px] text-[var(--muted)]">+{(p.bom || []).length - 3}</span>}
                    {isManager() && (
                      <button onClick={() => setBomProductId(p.id)} className="text-[9px] text-[var(--accent)] hover:underline ml-1">Edit BOM</button>
                    )}
                  </div>
                </td>
                {isManager() && (
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setEditData(p)} className="text-[var(--blue)] hover:underline mr-2">Edit</button>
                    <button onClick={() => { if (confirm('Supprimer?')) deleteMut.mutate(p.id); }} className="text-[var(--red)] hover:underline">Suppr</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* BOM Editor Panel */}
      {bomProductId && (
        <BomEditor
          productId={bomProductId}
          materiaux={materiaux || []}
          existingLines={bomLines || []}
          onClose={() => setBomProductId(null)}
        />
      )}

      <CreateEditModal open={showCreate} onClose={() => setShowCreate(false)} onSubmit={(d) => createMut.mutate(d)} />
      {editData && (
        <CreateEditModal open={!!editData} onClose={() => setEditData(null)} onSubmit={(d) => updateMut.mutate({ id: editData.id, data: d })} initial={editData} />
      )}
    </div>
  );
}

// ─── Create/Edit ────────────────────────────────────────────────

function CreateEditModal({ open, onClose, onSubmit, initial }: {
  open: boolean; onClose: () => void; onSubmit: (d: any) => void; initial?: any;
}) {
  const [form, setForm] = useState(initial ? {
    nom: initial.nom, description: initial.description || '', unite: initial.unite, prix_vente_ht: initial.prix_vente_ht,
  } : { nom: '', description: '', unite: 'pcs', prix_vente_ht: 0 });

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Modifier Produit' : 'Nouveau Produit'}>
      <form onSubmit={(e) => { e.preventDefault(); if (!form.nom.trim()) { toast.error('Nom requis'); return; } onSubmit(form); }} className="space-y-4">
        <div>
          <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Nom *</label>
          <input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.nom}
            onChange={e => setForm({ ...form, nom: e.target.value })} required />
        </div>
        <div>
          <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Description</label>
          <textarea className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" rows={2} value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Unite</label>
            <input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.unite}
              onChange={e => setForm({ ...form, unite: e.target.value })} />
          </div>
          <div>
            <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Prix Vente HT (DT)</label>
            <input type="number" step="0.01" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.prix_vente_ht}
              onChange={e => setForm({ ...form, prix_vente_ht: +e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit">{initial ? 'Enregistrer' : 'Creer'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── BOM Editor ─────────────────────────────────────────────────

function BomEditor({ productId, materiaux, existingLines, onClose }: {
  productId: number; materiaux: Materiau[]; existingLines: any[]; onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [newMatId, setNewMatId] = useState('');
  const [newQty, setNewQty] = useState(1);

  const addMut = useMutation({
    mutationFn: (d: any) => api.post(`/api/produits/${productId}/bom`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['produits', 'bom', productId] }); toast.success('Ligne ajoutee'); },
    onError: () => toast.error('Erreur'),
  });

  const delMut = useMutation({
    mutationFn: (matId: number) => api.delete(`/api/produits/${productId}/bom/${matId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['produits', 'bom', productId] }); toast.success('Ligne supprimee'); },
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMatId) return;
    addMut.mutate({ materiau_id: parseInt(newMatId), quantite_par_unite: newQty });
    setNewMatId('');
    setNewQty(1);
  };

  return (
    <div className="mt-6 bg-[var(--bg2)] border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 bg-[var(--bg3)]">
        <h3 className="font-['Bebas_Neue'] text-lg tracking-wider">EDITEUR NOMENCLATURE</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>Fermer</Button>
      </div>

      {/* Add line */}
      <form onSubmit={handleAdd} className="flex gap-3 px-5 py-3 border-b border-[var(--border)] items-end">
        <div className="flex-1">
          <label className="text-[8px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Materiau</label>
          <select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-xs" value={newMatId}
            onChange={e => setNewMatId(e.target.value)} required>
            <option value="">Selectionner...</option>
            {materiaux.map(m => <option key={m.id} value={m.id}>{m.code} - {m.nom}</option>)}
          </select>
        </div>
        <div className="w-24">
          <label className="text-[8px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Qte/u</label>
          <input type="number" step="0.001" min="0" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-xs"
            value={newQty} onChange={e => setNewQty(+e.target.value)} required />
        </div>
        <Button type="submit" size="sm">Ajouter</Button>
      </form>

      {/* Lines table */}
      <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
        <thead className="text-[var(--muted)] text-[8px] uppercase tracking-[0.1em]">
          <tr>
            <th className="text-left px-4 py-2">Materiau</th>
            <th className="text-right px-4 py-2">Qte/u</th>
            <th className="text-left px-4 py-2">Unite</th>
            <th className="text-right px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {existingLines.map((l: any) => (
            <tr key={l.materiau_id} className="border-t border-[var(--border)]">
              <td className="px-4 py-2">{l.materiau_nom}</td>
              <td className="px-4 py-2 text-right">{l.quantite_par_unite}</td>
              <td className="px-4 py-2 text-[var(--muted)]">{l.unite}</td>
              <td className="px-4 py-2 text-right">
                <button onClick={() => delMut.mutate(l.materiau_id)} className="text-[var(--red)] text-[10px] hover:underline">Supprimer</button>
              </td>
            </tr>
          ))}
          {existingLines.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-6 text-center text-[var(--muted)] text-[10px]">Aucun materiau dans la nomenclature</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

