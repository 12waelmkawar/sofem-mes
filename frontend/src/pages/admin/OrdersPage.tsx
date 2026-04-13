import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../store/authStore';

// ─── Types ─────────────────────────────────────────────────────────────

interface OF {
  id: number; numero: string; statut: string; priorite: string; quantite: number;
  produit_id: number; produit_nom: string; produit_code: string;
  client_id: number | null; client_nom: string; client_code: string;
  chef_projet_id: number | null; chef_prenom: string; chef_nom: string;
  atelier: string; date_echeance: string; plan_numero: string | null; notes: string | null;
  bl_numero: string; bl_statut: string; created_at: string;
  operations: { id: number; statut: string; ordre: number; operation_nom: string; machine_nom: string | null; operateurs_noms: string | null; debut: string | null; fin: string | null }[];
  bom: any[];
}

const STATUT_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon', APPROVED: 'Approuve', IN_PROGRESS: 'En cours', COMPLETED: 'Termine', CANCELLED: 'Annule',
};
const STATUT_COLORS: Record<string, 'red' | 'green' | 'blue' | 'muted'> = {
  DRAFT: 'muted', APPROVED: 'blue', IN_PROGRESS: 'red', COMPLETED: 'green', CANCELLED: 'red',
};
const PRIORITE_COLORS: Record<string, 'red' | 'orange' | 'blue' | 'muted'> = { URGENT: 'red', HIGH: 'orange', NORMAL: 'blue', LOW: 'muted' };

// ─── Main Component ────────────────────────────────────────────────────

export default function OrdersPage() {
  const { isManager } = useAuth();
  const manager = isManager();
  const qc = useQueryClient();
  const [filterStatut, setFilterStatut] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editOF, setEditOF] = useState<OF | null>(null);
  const [cancelOF, setCancelOF] = useState<OF | null>(null);
  const [dupOF, setDupOF] = useState<OF | null>(null);
  const [delOF, setDelOF] = useState<OF | null>(null);

  const { data, isLoading } = useQuery<{ data: OF[] }>({
    queryKey: ['ofs'],
    queryFn: () => api.get('/api/of?limit=500').then(r => r.data),
  });

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => api.put(`/api/of/${id}/cancel`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ofs'] }); setCancelOF(null); toast.success('OF annule'); },
    onError: () => toast.error('Erreur annulation'),
  });

  const dupMut = useMutation({
    mutationFn: ({ id, data: d }: { id: number; data: any }) => api.post(`/api/of/${id}/duplicate`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ofs'] }); setDupOF(null); toast.success('OF duplique'); },
    onError: () => toast.error('Erreur duplication'),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => api.delete(`/api/of/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ofs'] }); setDelOF(null); toast.success('OF supprime'); },
    onError: (e: any) => toast.error(e.response?.data?.error?.message || 'Erreur suppression'),
  });

  const allOrders = data?.data || [];
  const filtered = allOrders.filter(of => {
    if (filterStatut && of.statut !== filterStatut) return false;
    if (search) {
      const s = search.toLowerCase();
      return of.numero.toLowerCase().includes(s) || of.produit_nom.toLowerCase().includes(s) || (of.client_nom || '').toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">ORDRES DE FABRICATION</h1>
          <p className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted)]">{filtered.length} ordres</p>
        </div>
        <div className="flex gap-2">
          <input className="bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-1.5 text-xs w-48" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
          {manager && <Button onClick={() => setShowCreate(true)}>+ Nouvel OF</Button>}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {['', 'IN_PROGRESS', 'DRAFT', 'APPROVED', 'COMPLETED', 'CANCELLED'].map(s => (
          <button key={s} onClick={() => setFilterStatut(s)}
            className={`px-3 py-1 rounded text-[10px] font-['IBM_Plex_Mono'] border ${filterStatut === s ? 'bg-[var(--red)] text-white border-[var(--red)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>
            {s ? STATUT_LABELS[s] : 'Tous'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[8px] uppercase tracking-[0.1em]">
            <tr>
              <th className="text-left px-3 py-2">N OF</th>
              <th className="text-left px-3 py-2">Produit</th>
              <th className="text-left px-3 py-2">Client</th>
              <th className="text-right px-3 py-2">Qte</th>
              <th className="text-left px-3 py-2">Priorite</th>
              <th className="text-left px-3 py-2">Statut</th>
              <th className="text-left px-3 py-2">Echeance</th>
              <th className="text-left px-3 py-2">Ops</th>
              {manager && <th className="text-right px-3 py-2">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="px-3 py-8 text-center text-[var(--muted)]">Chargement...</td></tr>}
            {filtered.map(of => (
              <tr key={of.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2 font-bold">{of.numero}</td>
                <td className="px-3 py-2">{of.produit_nom}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{of.client_nom || '—'}</td>
                <td className="px-3 py-2 text-right">{of.quantite}</td>
                <td className="px-3 py-2"><Badge label={of.priorite} color={PRIORITE_COLORS[of.priorite]} /></td>
                <td className="px-3 py-2"><Badge label={STATUT_LABELS[of.statut]} color={STATUT_COLORS[of.statut]} /></td>
                <td className="px-3 py-2 text-[var(--muted)]">{of.date_echeance ? new Date(of.date_echeance).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {(of.operations || []).slice(0, 3).map(op => (
                        <span key={op.id} className={`w-2 h-2 rounded-full ${op.statut === 'COMPLETED' ? 'bg-[var(--green)]' : op.statut === 'IN_PROGRESS' ? 'bg-[var(--accent)] animate-pulse' : 'bg-[var(--muted)] opacity-40'}`} title={op.operation_nom} />
                      ))}
                    </div>
                    <button
                      onClick={() => void 0}
                      className="text-[10px] font-semibold text-[var(--accent)] hover:text-[var(--text)]"
                    >
                      OPS ({(of.operations || []).length})
                    </button>
                  </div>
                </td>
                {manager && (
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditOF(of)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[10px] text-[var(--blue)] hover:border-[var(--blue)] hover:bg-[var(--blue)]/10 transition-colors"
                        title="Modifier"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Edit
                      </button>

                      <button
                        onClick={() => setDupOF(of)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[10px] text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
                        title="Dupliquer"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Dup
                      </button>

                      {of.statut !== 'CANCELLED' && of.statut !== 'COMPLETED' && (
                        <>
                          <button
                            onClick={() => setCancelOF(of)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[10px] text-orange-400 hover:border-orange-500 hover:bg-orange-500/10 transition-colors"
                            title="Annuler"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            Ann
                          </button>
                          <button
                            onClick={() => setDelOF(of)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[10px] text-red-400 hover:border-red-500 hover:bg-red-500/10 transition-colors"
                            title="Supprimer"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!isLoading && filtered.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-[var(--muted)]">Aucun ordre</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
      {editOF && <EditModal of={editOF} onClose={() => setEditOF(null)} />}
      {cancelOF && <CancelModal of={cancelOF} onClose={() => setCancelOF(null)} onConfirm={(r) => cancelMut.mutate({ id: cancelOF.id, reason: r })} />}
      {dupOF && <DupModal of={dupOF} onClose={() => setDupOF(null)} onDup={(d) => dupMut.mutate({ id: dupOF.id, data: d })} />}
      {delOF && <DeleteModal of={delOF} onClose={() => setDelOF(null)} onDelete={() => delMut.mutate(delOF.id)} />}
    </div>
  );
}

// ─── Create Modal ──────────────────────────────────────────────────────

function CreateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: produits } = useQuery<{ data: any[] }>({ queryKey: ['produits'], queryFn: () => api.get('/api/produits?limit=500').then(r => r.data) });
  const { data: clients } = useQuery<{ data: any[] }>({ queryKey: ['clients'], queryFn: () => api.get('/api/clients?limit=500').then(r => r.data) });
  const { data: machines } = useQuery<any[]>({ queryKey: ['machines'], queryFn: () => api.get('/api/machines').then(r => r.data) });
  const { data: opTypes } = useQuery<any[]>({ queryKey: ['op-types'], queryFn: () => api.get('/api/operation-types').then(r => r.data) });

  const [f, setF] = useState({ produit_id: '', quantite: 1, priorite: 'NORMAL', client_id: '', date_echeance: '', notes: '' });
  const [ops, setOps] = useState<any[]>([]);

  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/api/of', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ofs'] }); onClose(); toast.success('OF cree'); },
    onError: () => toast.error('Erreur creation'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.produit_id || !f.date_echeance) { toast.error('Produit et date requis'); return; }
    createMut.mutate({
      produit_id: parseInt(f.produit_id), quantite: parseInt(String(f.quantite)), priorite: f.priorite,
      client_id: f.client_id ? parseInt(f.client_id) : null, atelier: 'Atelier A', date_echeance: f.date_echeance,
      notes: f.notes || null, operations: ops, bom_overrides: [],
    });
  };

  const selProduit = produits?.data?.find(p => p.id === parseInt(f.produit_id));

  return (
    <Modal open onClose={onClose} title="Nouvel OF" width="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Produit *</label>
            <select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.produit_id} onChange={e => setF({ ...f, produit_id: e.target.value })} required>
              <option value="">—</option>{produits?.data?.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Quantite</label>
            <input type="number" min="1" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.quantite} onChange={e => setF({ ...f, quantite: +e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Priorite</label>
            <select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.priorite} onChange={e => setF({ ...f, priorite: e.target.value })}>
              <option value="NORMAL">Normal</option><option value="URGENT">Urgent</option><option value="HIGH">Haute</option><option value="LOW">Basse</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Client</label>
            <select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.client_id} onChange={e => setF({ ...f, client_id: e.target.value })}>
              <option value="">—</option>{clients?.data?.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Date Echeance *</label>
          <input type="date" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.date_echeance} onChange={e => setF({ ...f, date_echeance: e.target.value })} required />
        </div>

        {/* Operations builder */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Operations</label>
            <button type="button" onClick={() => setOps([...ops, { operation_nom: '', machine_id: null, ordre: ops.length }])} className="text-[9px] text-[var(--accent)]">+ Ligne</button>
          </div>
          {ops.map((op, i) => (
            <div key={i} className="flex gap-2 items-center mb-1">
              <select className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-xs" value={op.operation_nom} onChange={e => { const n = [...ops]; n[i] = { ...n[i], operation_nom: e.target.value }; setOps(n); }}>
                <option value="">Type...</option>{opTypes?.map(t => <option key={t.id} value={t.nom}>{t.nom}</option>)}
              </select>
              <select className="w-40 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1 text-xs" value={op.machine_id || ''} onChange={e => { const n = [...ops]; n[i] = { ...n[i], machine_id: e.target.value ? parseInt(e.target.value) : null }; setOps(n); }}>
                <option value="">Machine...</option>{machines?.filter(m => m.statut === 'OPERATIONNELLE').map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
              <button type="button" onClick={() => setOps(ops.filter((_, idx) => idx !== i))} className="text-[var(--red)] text-sm">×</button>
            </div>
          ))}
        </div>

        {/* BOM preview */}
        {selProduit?.bom?.length > 0 && (
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded p-2">
            <label className="text-[8px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Nomenclature</label>
            {selProduit.bom.map((b: any) => (
              <div key={b.materiau_id} className="flex justify-between text-[9px] py-0.5">
                <span>{b.materiau_nom}</span>
                <span className="text-[var(--muted)]">{(b.quantite_par_unite * f.quantite).toFixed(1)} {b.unite}</span>
                <span className={b.stock_actuel < b.quantite_par_unite * f.quantite ? 'text-[var(--red)]' : 'text-[var(--green)]'}>Stock: {b.stock_actuel}</span>
              </div>
            ))}
          </div>
        )}

        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Notes</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit">Creer OF</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit Modal ────────────────────────────────────────────────────────

function EditModal({ of, onClose }: { of: OF; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: produits } = useQuery<{ data: any[] }>({ queryKey: ['produits'], queryFn: () => api.get('/api/produits?limit=500').then(r => r.data) });
  const { data: clients } = useQuery<{ data: any[] }>({ queryKey: ['clients'], queryFn: () => api.get('/api/clients?limit=500').then(r => r.data) });
  const { data: machines } = useQuery<any[]>({ queryKey: ['machines'], queryFn: () => api.get('/api/machines').then(r => r.data) });
  const { data: opTypes } = useQuery<any[]>({ queryKey: ['op-types'], queryFn: () => api.get('/api/operation-types').then(r => r.data) });

  const [tab, setTab] = useState<'details' | 'operations' | 'bom'>('details');
  const [ops, setOps] = useState<any[]>(of.operations || []);
  const [f, setF] = useState({
    produit_id: String(of.produit_id), quantite: of.quantite, priorite: of.priorite,
    client_id: String(of.client_id || ''), date_echeance: of.date_echeance ? new Date(of.date_echeance).toISOString().split('T')[0] : '',
    notes: of.notes || '',
  });

  const saveMut = useMutation({
    mutationFn: ({ id, data: d }: { id: number; data: any }) => api.put(`/api/of/${id}/full`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ofs'] }); onClose(); toast.success('OF modifie'); },
    onError: () => toast.error('Erreur modification'),
  });

  const advanceOpMut = useMutation({
    mutationFn: ({ opId, statut }: { opId: number; statut: string }) => api.put(`/api/of/${of.id}/operations/${opId}`, { statut }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ofs'] }); toast.success('Operation mise a jour'); },
    onError: (e: any) => toast.error(e.response?.data?.error?.message || 'Erreur'),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMut.mutate({
      id: of.id,
      data: {
        produit_id: parseInt(f.produit_id), quantite: parseInt(String(f.quantite)), priorite: f.priorite,
        client_id: f.client_id ? parseInt(f.client_id) : null, atelier: of.atelier,
        date_echeance: f.date_echeance, notes: f.notes || null,
        operations: ops.map((op, i) => ({ operation_nom: op.operation_nom, machine_id: op.machine_id || null, ordre: i })),
        bom_overrides: [],
      },
    });
  };

  const selProduit = produits?.data?.find(p => p.id === parseInt(f.produit_id));

  const opStatusLabels: Record<string, string> = { PENDING: 'En attente', IN_PROGRESS: 'En cours', COMPLETED: 'Terminee' };

  return (
    <Modal open onClose={onClose} title={`Modifier ${of.numero}`} width="max-w-2xl">
      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-[var(--border)] pb-2">
        {[{ key: 'details' as const, label: 'Details' }, { key: 'operations' as const, label: 'Operations' }, { key: 'bom' as const, label: 'Nomenclature' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1 rounded text-[10px] font-['IBM_Plex_Mono'] border ${tab === t.key ? 'bg-[var(--red)] text-white border-[var(--red)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'details' && (
        <form onSubmit={handleSave} className="space-y-3">
          <div className="bg-[var(--bg)] border border-[var(--border)] rounded p-3 text-[10px] font-['IBM_Plex_Mono']">
            <p>Statut actuel: <Badge label={STATUT_LABELS[of.statut]} color={STATUT_COLORS[of.statut]} /></p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Produit</label>
              <select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.produit_id} onChange={e => setF({ ...f, produit_id: e.target.value })}>
                {produits?.data?.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Quantite</label>
              <input type="number" min="1" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.quantite} onChange={e => setF({ ...f, quantite: +e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Priorite</label>
              <select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.priorite} onChange={e => setF({ ...f, priorite: e.target.value })}>
                <option value="URGENT">Urgent</option><option value="HIGH">Haute</option><option value="NORMAL">Normal</option><option value="LOW">Basse</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Client</label>
              <select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.client_id} onChange={e => setF({ ...f, client_id: e.target.value })}>
                <option value="">—</option>{clients?.data?.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Date Echeance</label>
            <input type="date" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.date_echeance} onChange={e => setF({ ...f, date_echeance: e.target.value })} />
          </div>
          <div>
            <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Notes</label>
            <textarea className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      )}

      {tab === 'operations' && (
        <div className="space-y-3">
          {/* Operations list */}
          {ops.length === 0 ? (
            <p className="text-[var(--muted)] text-sm text-center py-8">Aucune operation</p>
          ) : (
            <div className="space-y-2">
              {ops.map((op, i) => (
                <div key={i} className="flex items-center gap-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3">
                  <div className="w-6 h-6 rounded-full bg-[var(--bg3)] flex items-center justify-center text-[10px] font-['IBM_Plex_Mono'] font-bold text-[var(--muted)]">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{op.operation_nom}</p>
                    <p className="text-[9px] text-[var(--muted)]">{op.machine_nom || 'Pas de machine'} {op.operateurs_noms ? `| ${op.operateurs_noms}` : ''}</p>
                  </div>
                  <Badge label={opStatusLabels[op.statut] || op.statut}
                    color={op.statut === 'COMPLETED' ? 'green' : op.statut === 'IN_PROGRESS' ? 'orange' : 'muted'} />
                  <div className="flex gap-1">
                    {op.statut === 'PENDING' && (
                      <button onClick={() => advanceOpMut.mutate({ opId: op.id, statut: 'IN_PROGRESS' })}
                        className="px-2 py-1 rounded text-[9px] bg-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/30" title="Demarrer">
                        ▶
                      </button>
                    )}
                    {op.statut === 'IN_PROGRESS' && (
                      <button onClick={() => advanceOpMut.mutate({ opId: op.id, statut: 'COMPLETED' })}
                        className="px-2 py-1 rounded text-[9px] bg-[var(--green)]/20 text-[var(--green)] hover:bg-[var(--green)]/30" title="Terminer">
                        ✓
                      </button>
                    )}
                    <button onClick={() => setOps(ops.filter((_, idx) => idx !== i))}
                      className="px-2 py-1 rounded text-[9px] text-red-400 hover:bg-red-500/10" title="Supprimer">
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add operation */}
          <div className="border-t border-[var(--border)] pt-3">
            <p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase mb-2">Ajouter une operation</p>
            <div className="flex gap-2 items-center">
              <select id="new-op-type" className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-xs">
                <option value="">Type...</option>{opTypes?.map(t => <option key={t.id} value={t.nom}>{t.nom}</option>)}
              </select>
              <select id="new-op-machine" className="w-40 bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-xs">
                <option value="">Machine...</option>{machines?.filter(m => m.statut === 'OPERATIONNELLE').map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
              <button type="button" onClick={() => {
                const typeEl = document.getElementById('new-op-type') as HTMLSelectElement;
                const machEl = document.getElementById('new-op-machine') as HTMLSelectElement;
                if (!typeEl?.value) { toast.error('Type requis'); return; }
                setOps([...ops, { operation_nom: typeEl.value, machine_id: machEl?.value ? parseInt(machEl.value) : null, ordre: ops.length, statut: 'PENDING' }]);
                typeEl.value = ''; machEl && (machEl.value = '');
              }} className="px-3 py-1.5 rounded bg-[var(--red)] text-white text-[10px] hover:bg-[var(--red-d)]">+</button>
            </div>
          </div>
        </div>
      )}

      {tab === 'bom' && (
        <div>
          <p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase mb-2">Nomenclature du produit</p>
          {(selProduit?.bom || of.bom || (of as any).product_bom || []).length === 0 ? (
            <p className="text-[var(--muted)] text-sm text-center py-8">Aucun materiau dans la nomenclature</p>
          ) : (
            <table className="w-full text-[10px] font-['IBM_Plex_Mono']">
              <thead className="text-[var(--muted)] text-[8px] uppercase">
                <tr><th className="text-left py-1">Materiau</th><th className="text-right py-1">Qte/u</th><th className="text-right py-1">Qte totale</th><th className="text-right py-1">Stock</th></tr>
              </thead>
              <tbody>
                {(selProduit?.bom || of.bom || (of as any).product_bom || []).map((b: any, i: number) => (
                  <tr key={b.materiau_id || i} className="border-t border-[var(--border)]">
                    <td className="py-1">{b.materiau_nom}</td>
                    <td className="py-1 text-right">{b.quantite_par_unite} {b.unite}</td>
                    <td className="py-1 text-right">{(b.quantite_par_unite * f.quantite).toFixed(1)} {b.unite}</td>
                    <td className={`py-1 text-right ${b.stock_actuel < b.quantite_par_unite * f.quantite ? 'text-[var(--red)]' : 'text-[var(--green)]'}`}>{b.stock_actuel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={onClose}>Fermer</Button>
            <Button onClick={() => { setTab('details'); }}>Enregistrer</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Cancel Modal ──────────────────────────────────────────────────────

function CancelModal({ of, onClose, onConfirm }: { of: OF; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Modal open onClose={onClose} title={`Annuler ${of.numero}`} width="max-w-md">
      <div className="space-y-4">
        <p className="text-[10px] text-[var(--muted)]">Produit: {of.produit_nom} | Statut: <Badge label={STATUT_LABELS[of.statut]} color={STATUT_COLORS[of.statut]} /></p>
        <div>
          <label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Raison * (min 5 caracteres)</label>
          <textarea className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" rows={3} value={reason} onChange={e => setReason(e.target.value)} required />
        </div>
        <p className="text-[9px] text-[var(--red)]">⚠ Action irreversible — annulation en cascade du BL, DA, BC</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="danger" disabled={reason.length < 5} onClick={() => onConfirm(reason)}>Confirmer</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Duplicate Modal ───────────────────────────────────────────────────

function DupModal({ of, onClose, onDup }: { of: OF; onClose: () => void; onDup: (d: any) => void }) {
  const defaultDate = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0]; })();
  const [f, setF] = useState({ quantite: of.quantite, priorite: of.priorite, date_echeance: defaultDate, notes: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onDup({ quantite: parseInt(String(f.quantite)) || 1, priorite: f.priorite, date_echeance: f.date_echeance, notes: f.notes || null });
  };

  return (
    <Modal open onClose={onClose} title={`Dupliquer ${of.numero}`} width="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="bg-[var(--bg)] border border-[var(--border)] rounded p-3 text-[10px] font-['IBM_Plex_Mono']">
          <p className="text-[var(--muted)]">Source: <span className="text-[var(--text)] font-bold">{of.numero}</span></p>
          <p>{of.produit_nom} | Qte: {of.quantite} | Ops: {(of.operations || []).length}</p>
        </div>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Nouvelle Quantite</label><input type="number" min="1" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.quantite} onChange={e => setF({ ...f, quantite: +e.target.value })} /></div>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Priorite</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.priorite} onChange={e => setF({ ...f, priorite: e.target.value })}><option value="URGENT">Urgent</option><option value="HIGH">Haute</option><option value="NORMAL">Normal</option><option value="LOW">Basse</option></select></div>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Date Echeance</label><input type="date" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.date_echeance} onChange={e => setF({ ...f, date_echeance: e.target.value })} /></div>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit">Dupliquer</Button></div>
      </form>
    </Modal>
  );
}

// ─── Delete Modal ──────────────────────────────────────────────────────

function DeleteModal({ of, onClose, onDelete }: { of: OF; onClose: () => void; onDelete: () => void }) {
  return (
    <Modal open onClose={onClose} title={`Supprimer ${of.numero}`} width="max-w-md">
      <div className="space-y-4">
        <div className="bg-[var(--bg)] border border-[var(--border)] rounded p-3 text-[10px] font-['IBM_Plex_Mono']">
          <p className="text-[var(--muted)]">Source: <span className="text-[var(--text)] font-bold">{of.numero}</span></p>
          <p>{of.produit_nom} | Qte: {of.quantite} | Statut: {STATUT_LABELS[of.statut]}</p>
          <p>Operations: {(of.operations || []).length}</p>
        </div>
        <div className="bg-red-950/30 border border-red-800 rounded p-3">
          <p className="text-[10px] text-red-300 font-['IBM_Plex_Mono']">⚠ Suppression irreversible</p>
          <p className="text-[9px] text-red-400 mt-1">Cet OF, son BL, ses operations et sa nomenclature seront supprimes definitivement.</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button variant="danger" onClick={onDelete}>Supprimer</Button>
        </div>
      </div>
    </Modal>
  );
}
