import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../store/authStore';

interface Materiau {
  id: number; code: string; nom: string; unite: string;
  stock_actuel: number; stock_minimum: number; fournisseur: string | null;
  prix_unitaire: number; pct_stock: number; alerte: boolean;
}

interface Mouvement {
  id: number; materiau_nom: string; materiau_code: string; unite: string;
  type: 'ENTREE' | 'SORTIE' | 'ADJUST'; quantite: number;
  stock_avant: number; stock_apres: number; motif: string | null;
  of_numero: string | null; created_at: string;
}

const toNumber = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function MaterialsPage() {
  const { isManager } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const [editData, setEditData] = useState<Materiau | null>(null);

  const { data } = useQuery({
    queryKey: ['materiaux'],
    queryFn: async () => {
      const rows = await api.get<{ data: Materiau[] }>('/api/materiaux?limit=500').then(r => r.data.data || []);
      return rows.map((m) => ({
        ...m,
        stock_actuel: toNumber(m.stock_actuel),
        stock_minimum: toNumber(m.stock_minimum),
        prix_unitaire: toNumber(m.prix_unitaire),
        pct_stock: toNumber(m.pct_stock),
      }));
    },
  });

  const { data: movements } = useQuery({
    queryKey: ['mouvements'],
    queryFn: () => api.get<Mouvement[]>('/api/materiaux/mouvements?limit=20').then(r => r.data),
  });

  // Mutations
  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/api/materiaux', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['materiaux'] }); setShowCreate(false); toast.success('Materiau cree'); },
    onError: () => toast.error('Erreur creation'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data: d }: { id: number; data: any }) => api.put(`/api/materiaux/${id}`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['materiaux'] }); setEditData(null); toast.success('Materiau modifie'); },
    onError: () => toast.error('Erreur modification'),
  });

  const moveMut = useMutation({
    mutationFn: (d: any) => api.post('/api/materiaux/mouvement', d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['materiaux', 'mouvements'] }); setShowMove(false); toast.success('Mouvement enregistre'); },
    onError: () => toast.error('Erreur mouvement'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/api/materiaux/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['materiaux'] }); toast.success('Materiau supprime'); },
  });

  const typeColors: Record<string, 'green' | 'red' | 'orange'> = { ENTREE: 'green', SORTIE: 'red', ADJUST: 'orange' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">MATERIAUX</h1>
          <p className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted)]">{data?.length || 0} materiaux</p>
        </div>
        <div className="flex gap-2">
          {isManager() && <Button onClick={() => setShowCreate(true)}>+ Materiau</Button>}
          {isManager() && <Button variant="secondary" onClick={() => setShowMove(true)}>+ Mouvement</Button>}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-[12px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[9px] uppercase tracking-[0.1em]">
            <tr>
              <th className="text-left px-3 py-2">Code</th>
              <th className="text-left px-3 py-2">Nom</th>
              <th className="text-right px-3 py-2">Stock</th>
              <th className="text-right px-3 py-2">Min</th>
              <th className="text-left px-3 py-2">Unite</th>
              <th className="text-right px-3 py-2">Prix/u (DT)</th>
              <th className="text-left px-3 py-2">Niveau</th>
              {isManager() && <th className="text-right px-3 py-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data?.map(m => (
              <tr key={m.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2 text-[var(--muted)]">{m.code}</td>
                <td className="px-3 py-2 font-medium">{m.nom}</td>
                <td className={`px-3 py-2 text-right font-bold ${m.alerte ? 'text-[var(--red)]' : ''}`}>{m.stock_actuel}</td>
                <td className="px-3 py-2 text-right text-[var(--muted)]">{m.stock_minimum}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{m.unite}</td>
                <td className="px-3 py-2 text-right">{m.prix_unitaire.toFixed(2)}</td>
                <td className="px-3 py-2">
                  <div className="w-full bg-[var(--bg)] rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${m.pct_stock < 50 ? 'bg-[var(--red)]' : m.pct_stock < 90 ? 'bg-[var(--accent)]' : 'bg-[var(--green)]'}`}
                      style={{ width: `${Math.min(m.pct_stock, 100)}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-[var(--muted)]">{m.pct_stock}%</span>
                </td>
                {isManager() && (
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setEditData(m)} className="text-[var(--blue)] hover:underline mr-2">Edit</button>
                    <button onClick={() => { if (confirm('Supprimer?')) deleteMut.mutate(m.id); }} className="text-[var(--red)] hover:underline">Suppr</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Movements History */}
      <div className="mt-8">
        <h2 className="font-['Bebas_Neue'] text-xl tracking-[0.1em] mb-3">HISTORIQUE MOUVEMENTS</h2>
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
            <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[8px] uppercase tracking-[0.1em]">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Materiau</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-right px-3 py-2">Qte</th>
                <th className="text-right px-3 py-2">Avant</th>
                <th className="text-right px-3 py-2">Apres</th>
                <th className="text-left px-3 py-2">Motif</th>
              </tr>
            </thead>
            <tbody>
              {movements?.map(mv => (
                <tr key={mv.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2 text-[var(--muted)]">{new Date(mv.created_at).toLocaleString('fr-FR')}</td>
                  <td className="px-3 py-2">{mv.materiau_nom}</td>
                  <td className="px-3 py-2"><Badge label={mv.type} color={typeColors[mv.type]} /></td>
                  <td className="px-3 py-2 text-right">{mv.quantite}</td>
                  <td className="px-3 py-2 text-right text-[var(--muted)]">{mv.stock_avant}</td>
                  <td className="px-3 py-2 text-right font-bold">{mv.stock_apres}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{mv.motif || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      <CreateEditModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={(d) => createMut.mutate(d)}
      />

      {/* Edit Modal */}
      {editData && (
        <CreateEditModal
          open={!!editData}
          onClose={() => setEditData(null)}
          onSubmit={(d) => updateMut.mutate({ id: editData.id, data: d })}
          initial={editData}
        />
      )}

      {/* Movement Modal */}
      <MovementModal
        open={showMove}
        onClose={() => setShowMove(false)}
        materiaux={data || []}
        onSubmit={(d) => moveMut.mutate(d)}
      />
    </div>
  );
}

// ─── Create/Edit Form ──────────────────────────────────────────

function CreateEditModal({ open, onClose, onSubmit, initial }: {
  open: boolean; onClose: () => void; onSubmit: (d: any) => void; initial?: Materiau;
}) {
  const [form, setForm] = useState(initial ? {
    nom: initial.nom, unite: initial.unite, stock_minimum: initial.stock_minimum,
    prix_unitaire: initial.prix_unitaire, fournisseur: initial.fournisseur || '',
  } : { nom: '', unite: 'pcs', stock_minimum: 0, prix_unitaire: 0, fournisseur: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nom.trim()) { toast.error('Nom requis'); return; }
    onSubmit(initial ? form : { ...form, stock_actuel: 0 });
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Modifier Materiau' : 'Nouveau Materiau'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Nom *</label>
          <input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.nom}
            onChange={e => setForm({ ...form, nom: e.target.value })} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Unite</label>
            <input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.unite}
              onChange={e => setForm({ ...form, unite: e.target.value })} />
          </div>
          <div>
            <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Stock Min</label>
            <input type="number" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.stock_minimum}
              onChange={e => setForm({ ...form, stock_minimum: +e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Prix Unitaire (DT)</label>
            <input type="number" step="0.01" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.prix_unitaire}
              onChange={e => setForm({ ...form, prix_unitaire: +e.target.value })} />
          </div>
          <div>
            <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Fournisseur</label>
            <input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.fournisseur}
              onChange={e => setForm({ ...form, fournisseur: e.target.value })} />
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

// ─── Movement Form ─────────────────────────────────────────────

function MovementModal({ open, onClose, materiaux, onSubmit }: {
  open: boolean; onClose: () => void; materiaux: Materiau[]; onSubmit: (d: any) => void;
}) {
  const [form, setForm] = useState({ materiau_id: '', type: 'ENTREE' as const, quantite: 0, motif: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.materiau_id || form.quantite <= 0) { toast.error('Donnees invalides'); return; }
    onSubmit({ ...form, materiau_id: parseInt(form.materiau_id) });
  };

  return (
    <Modal open={open} onClose={onClose} title="Nouveau Mouvement">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Materiau *</label>
          <select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.materiau_id}
            onChange={e => setForm({ ...form, materiau_id: e.target.value })} required>
            <option value="">Selectionner...</option>
            {materiaux.map(m => <option key={m.id} value={m.id}>{m.code} - {m.nom}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Type *</label>
            <select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value as any })}>
              <option value="ENTREE">ENTREE (+)</option>
              <option value="SORTIE">SORTIE (-)</option>
              <option value="ADJUST">AJUSTEMENT (=)</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Quantite *</label>
            <input type="number" step="0.01" min="0" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.quantite || ''}
              onChange={e => setForm({ ...form, quantite: +e.target.value })} required />
          </div>
        </div>
        <div>
          <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Motif</label>
          <input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.motif}
            onChange={e => setForm({ ...form, motif: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit">Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
