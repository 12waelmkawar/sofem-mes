import { useState, useEffect } from 'react';
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

// ─── Constants ─────────────────────────────────────────────────────────

const STATUT_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon', APPROVED: 'Approuve', IN_PROGRESS: 'En cours', COMPLETED: 'Termine', CANCELLED: 'Annule',
};
const STATUT_COLORS: Record<string, 'red' | 'green' | 'blue' | 'muted'> = {
  DRAFT: 'muted', APPROVED: 'blue', IN_PROGRESS: 'red', COMPLETED: 'green', CANCELLED: 'red',
};
const STATUT_ICONS: Record<string, string> = {
  DRAFT: '📝', APPROVED: '✅', IN_PROGRESS: '⚙️', COMPLETED: '🏁', CANCELLED: '❌',
};
const PRIORITE_LABELS: Record<string, string> = { URGENT: 'Urgent', HIGH: 'Haute', NORMAL: 'Normal', LOW: 'Basse' };
const PRIORITE_COLORS: Record<string, 'red' | 'orange' | 'blue' | 'muted'> = { URGENT: 'red', HIGH: 'orange', NORMAL: 'blue', LOW: 'muted' };
const PRIORITE_ICONS: Record<string, string> = { URGENT: '🔴', HIGH: '🟠', NORMAL: '🔵', LOW: '⚪' };

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
  const [opsOF, setOpsOF] = useState<OF | null>(null);

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

  // Status summary
  const statusCounts: Record<string, number> = { ALL: allOrders.length, DRAFT: 0, APPROVED: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 };
  allOrders.forEach(of => { statusCounts[of.statut] = (statusCounts[of.statut] || 0) + 1; });

  return (
    <div className="space-y-4">
      {/* Header with stats */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-['Bebas_Neue'] text-[30px] tracking-[0.15em] text-[var(--text)]">ORDRES DE FABRICATION</h1>
          <p className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted)]">
            {filtered.length} ordre{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
            {filterStatut && ` • ${STATUT_LABELS[filterStatut]}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {manager && (
            <Button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              Nouvel OF
            </Button>
          )}
        </div>
      </div>

      {/* Status pills */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: '', label: 'Tous', count: statusCounts.ALL },
          { key: 'IN_PROGRESS', label: 'En cours', count: statusCounts.IN_PROGRESS, color: 'red' as const },
          { key: 'DRAFT', label: 'Brouillon', count: statusCounts.DRAFT, color: 'muted' as const },
          { key: 'APPROVED', label: 'Approuve', count: statusCounts.APPROVED, color: 'blue' as const },
          { key: 'COMPLETED', label: 'Termine', count: statusCounts.COMPLETED, color: 'green' as const },
          { key: 'CANCELLED', label: 'Annule', count: statusCounts.CANCELLED, color: 'red' as const },
        ].map(s => {
          const active = filterStatut === s.key;
          const c = s.color || 'muted';
          return (
            <button key={s.key} onClick={() => setFilterStatut(s.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-['IBM_Plex_Mono'] border transition-all duration-150 ${
                active
                  ? `bg-[var(--${c})] text-white border-[var(--${c})] shadow-lg shadow-[var(--${c}-g,#dc262620)]`
                  : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--muted)] bg-[var(--bg2)]'
              }`}>
              {STATUT_ICONS[s.key as keyof typeof STATUT_ICONS] || ''}
              <span>{s.label}</span>
              <span className={`ml-1 px-1.5 py-0.5 rounded text-[8px] font-bold ${active ? 'bg-white/20' : 'bg-[var(--bg3)]'}`}>
                {s.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search bar */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" strokeLinecap="round" />
        </svg>
        <input
          className="w-full bg-[var(--bg2)] border border-[var(--border)] rounded-lg pl-10 pr-8 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--red)] focus:ring-1 focus:ring-[var(--red-g)] transition-all outline-none"
          placeholder="Rechercher par numero, produit, client..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)] transition-colors" title="Effacer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--bg2)]">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
            <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[8px] uppercase tracking-[0.12em]">
              <tr>
                <th className="text-left px-4 py-3">N OF</th>
                <th className="text-left px-4 py-3">Produit</th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">Client</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">Qte</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Priorite</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Echeance</th>
                <th className="text-left px-4 py-3">Operations</th>
                {manager && <th className="text-right px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={9} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[var(--red)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[var(--muted)] text-[10px]">Chargement des ordres...</p>
                  </div>
                </td></tr>
              )}
              {!isLoading && filtered.map(of => (
                <tr key={of.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]/50 transition-colors group cursor-pointer"
                  onClick={() => setEditOF(of)}>
                  <td className="px-4 py-3">
                    <span className="font-bold text-[var(--text)] group-hover:text-[var(--red)] transition-colors">{of.numero}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--text)] truncate max-w-[180px]" title={of.produit_nom}>{of.produit_nom}</p>
                    <p className="text-[8px] text-[var(--muted)]">{of.produit_code}</p>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <p className="text-[var(--muted)] truncate max-w-[140px]" title={of.client_nom || ''}>{of.client_nom || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-['Bebas_Neue'] text-lg text-[var(--text)] hidden md:table-cell">{of.quantite}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="inline-flex items-center gap-1">
                      <span>{PRIORITE_ICONS[of.priorite]}</span>
                      <Badge label={PRIORITE_LABELS[of.priorite] || of.priorite} color={PRIORITE_COLORS[of.priorite]} />
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-1.5">
                      <span>{STATUT_ICONS[of.statut as keyof typeof STATUT_ICONS]}</span>
                      <Badge label={STATUT_LABELS[of.statut]} color={STATUT_COLORS[of.statut]} />
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {of.date_echeance ? (
                      <div>
                        <p className="text-[var(--muted)]">{new Date(of.date_echeance).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</p>
                        {(() => {
                          const diff = Math.ceil((new Date(of.date_echeance).getTime() - Date.now()) / 86400000);
                          if (diff < 0) return <p className="text-[8px] text-[var(--red)] font-bold">Retard {Math.abs(diff)}j</p>;
                          if (diff <= 3) return <p className="text-[8px] text-[var(--accent)]">{diff}j restants</p>;
                          return null;
                        })()}
                      </div>
                    ) : <p className="text-[var(--muted)]">—</p>}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={e => { e.stopPropagation(); setOpsOF(of); }}
                      className="flex items-center gap-2 text-xs font-['IBM_Plex_Sans'] font-medium px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text)] bg-[var(--bg)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all shadow-sm"
                    >
                      <svg className="w-4 h-4 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      {(of.operations || []).length} Opérations
                    </button>
                  </td>
                  {manager && (
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditOF(of)} title="Modifier"
                          className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--blue)] hover:border-[var(--blue)] hover:bg-[var(--blue)]/10 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => setDupOF(of)} title="Dupliquer"
                          className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
                        {of.statut !== 'CANCELLED' && of.statut !== 'COMPLETED' && (
                          <>
                            <button onClick={() => setCancelOF(of)} title="Annuler"
                              className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-orange-400 hover:border-orange-500 hover:bg-orange-500/10 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                            </button>
                            <button onClick={() => setDelOF(of)} title="Supprimer"
                              className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-red-400 hover:border-red-500 hover:bg-red-500/10 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={manager ? 9 : 8} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-4xl opacity-30">📋</div>
                    <p className="text-[var(--muted)] text-sm font-['IBM_Plex_Mono']">Aucun ordre trouvé</p>
                    <p className="text-[var(--muted)] text-[10px]">
                      {search ? `Aucun résultat pour "${search}"` : filterStatut ? `Aucun ordre en statut ${STATUT_LABELS[filterStatut]}` : 'Creez votre premier ordre de fabrication'}
                    </p>
                    {manager && !search && !filterStatut && (
                      <Button onClick={() => setShowCreate(true)} className="mt-2">+ Nouvel OF</Button>
                    )}
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
      {editOF && <EditModal of={allOrders.find(o => o.id === editOF.id) || editOF} onClose={() => setEditOF(null)} />}
      {cancelOF && <CancelModal of={cancelOF} onClose={() => setCancelOF(null)} onConfirm={(r) => cancelMut.mutate({ id: cancelOF.id, reason: r })} />}
      {dupOF && <DupModal of={dupOF} onClose={() => setDupOF(null)} onDup={(d) => dupMut.mutate({ id: dupOF.id, data: d })} />}
      {delOF && <DeleteModal of={delOF} onClose={() => setDelOF(null)} onDelete={() => delMut.mutate(delOF.id)} />}
      {opsOF && <OperationsModal of={allOrders.find(o => o.id === opsOF.id) || opsOF} onClose={() => setOpsOF(null)} />}
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


  const [tab, setTab] = useState<'details' | 'bom'>('details');
  const ops = of.operations || [];
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



  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveMut.mutate({
      id: of.id,
      data: {
        produit_id: parseInt(f.produit_id), quantite: parseInt(String(f.quantite)), priorite: f.priorite,
        client_id: f.client_id ? parseInt(f.client_id) : null, atelier: of.atelier,
        date_echeance: f.date_echeance, notes: f.notes || null,
        operations: ops.map((op: any, i) => ({ operation_nom: op.operation_nom, machine_id: op.machine_id || null, ordre: i })),
        bom_overrides: [],
      },
    });
  };

  const selProduit = produits?.data?.find(p => p.id === parseInt(f.produit_id));



  return (
    <Modal open onClose={onClose} title={`Modifier ${of.numero}`} width="max-w-2xl">
      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-[var(--border)] pb-2">
        {[{ key: 'details' as const, label: 'Details' }, { key: 'bom' as const, label: 'Nomenclature' }].map(t => (
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

// ─── Operations Modal ──────────────────────────────────────────────────

function OperationsModal({ of, onClose }: { of: OF; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: machines } = useQuery<any[]>({ queryKey: ['machines-ops'], queryFn: () => api.get('/api/machines').then(r => r.data) });
  const { data: opTypes } = useQuery<any[]>({ queryKey: ['op-types-ops'], queryFn: () => api.get('/api/operation-types').then(r => r.data) });

  const [ops, setOps] = useState<any[]>(of.operations || []);
  const [_tick, setTick] = useState(0);

  // Keep local ops state in sync with fresh data from React Query
  useEffect(() => {
    setOps(of.operations || []);
  }, [of.operations]);

  // Refresh elapsed time every second (1000ms) for high-fidelity live display
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const advanceOpMut = useMutation({
    mutationFn: ({ opId, statut }: { opId: number; statut: string }) => api.put(`/api/of/${of.id}/operations/${opId}`, { statut }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ofs'] }); toast.success('Operation mise a jour'); },
    onError: (e: any) => toast.error(e.response?.data?.error?.message || 'Erreur'),
  });

  const addOpMut = useMutation({
    mutationFn: (d: any) => api.post(`/api/of/${of.id}/operations`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ofs'] }); toast.success('Operation ajoutee'); },
    onError: () => toast.error('Erreur ajout operation'),
  });

  const delOpMut = useMutation({
    mutationFn: (opId: number) => api.delete(`/api/of/${of.id}/operations/${opId}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ofs'] }); toast.success('Operation supprimee'); },
    onError: () => toast.error('Erreur suppression operation'),
  });

  const reorderMut = useMutation({
    mutationFn: (data: any) => api.put(`/api/of/${of.id}/operations/reorder`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ofs'] }); toast.success('Operations reordonnees'); },
    onError: () => toast.error('Erreur reordonnancement'),
  });

  const opStatusLabels: Record<string, string> = { PENDING: 'En attente', IN_PROGRESS: 'En cours', COMPLETED: 'Terminee' };

  const [newType, setNewType] = useState('');
  const [newMachine, setNewMachine] = useState('');

  // Elapsed time calculator with seconds
  function getElapsed(debut: string | null, fin: string | null): { hh: number; mm: number; ss: number; totalSeconds: number; text: string } {
    if (!debut) return { hh: 0, mm: 0, ss: 0, totalSeconds: 0, text: '—' };
    const start = new Date(debut).getTime();
    const end = fin ? new Date(fin).getTime() : Date.now();
    const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
    const hh = Math.floor(totalSeconds / 3600);
    const mm = Math.floor((totalSeconds % 3600) / 60);
    const ss = totalSeconds % 60;
    return {
      hh, mm, ss, totalSeconds,
      text: `${hh > 0 ? hh + 'h' : ''}${String(mm).padStart(2, '0')}m${String(ss).padStart(2, '0')}s`,
    };
  }

  const handleAddOp = () => {
    if (!newType) { toast.error('Type requis'); return; }
    addOpMut.mutate({
      operation_nom: newType,
      machine_id: newMachine ? parseInt(newMachine) : null,
      ordre: ops.length,
    });
    setNewType('');
    setNewMachine('');
  };

  const handleReorder = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= ops.length) return;
    const newOps = [...ops];
    const [moved] = newOps.splice(fromIdx, 1);
    newOps.splice(toIdx, 0, moved);
    const reordered = newOps.map((op, i) => ({ id: op.id, ordre: i }));
    setOps(newOps);
    reorderMut.mutate({ operations: reordered });
  };

  // Total time calculation
  const totalTime = ops.reduce((total, op) => total + getElapsed(op.debut, op.fin).totalSeconds, 0);
  const totalHH = Math.floor(totalTime / 3600);
  const totalMM = Math.floor((totalTime % 3600) / 60);

  return (
    <Modal open onClose={onClose} title={`Operations — ${of.numero}`} width="max-w-3xl">
      <div className="space-y-4">
        {/* Total time summary */}
        <div className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 flex items-center justify-between">
          <div className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted)]">
            <p>Temps total enregistre: <span className="text-[var(--text)] font-bold text-sm">{totalHH}h{String(totalMM).padStart(2, '0')}m</span></p>
            <p>{ops.length} operation{ops.length > 1 ? 's' : ''} planifiees</p>
          </div>
          <div className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted)] text-right">
            <p>Ordre modifiable avec les fleches ↑↓</p>
            <p>Operation terminee re-ouvrable avec ↺</p>
          </div>
        </div>

        {/* Operations list */}
        {ops.length === 0 ? (
          <p className="text-[var(--muted)] text-sm text-center py-8">Aucune operation planifiee</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {ops.map((op, i) => {
              const elapsed = getElapsed(op.debut, op.fin);
              const isCompleted = op.statut === 'COMPLETED';
              const isInProgress = op.statut === 'IN_PROGRESS';

              return (
                <div key={op.id || i} className={`flex items-center gap-3 border rounded-lg p-3 transition-colors ${
                  isInProgress ? 'bg-[var(--accent)]/5 border-[var(--accent)]' : isCompleted ? 'bg-[var(--green)]/5 border-[var(--green)]/30' : 'bg-[var(--bg)] border-[var(--border)]'
                }`}>
                  {/* Sequence number + reorder buttons */}
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-['Bebas_Neue'] ${
                      isCompleted ? 'bg-[var(--green)] text-white' : isInProgress ? 'bg-[var(--accent)] text-white animate-pulse' : 'bg-[var(--bg3)] text-[var(--muted)]'
                    }`}>{i + 1}</div>
                    <div className="flex gap-0.5">
                      <button onClick={() => handleReorder(i, i - 1)} disabled={i === 0}
                        className="w-4 h-4 flex items-center justify-center text-[8px] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-20" title="Monter">↑</button>
                      <button onClick={() => handleReorder(i, i + 1)} disabled={i === ops.length - 1}
                        className="w-4 h-4 flex items-center justify-center text-[8px] text-[var(--muted)] hover:text-[var(--text)] disabled:opacity-20" title="Descendre">↓</button>
                    </div>
                  </div>

                  {/* Operation info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{op.operation_nom}</p>
                    <p className="text-[9px] text-[var(--muted)]">
                      {op.machine_nom || 'Pas de machine'}
                      {op.operateurs_noms ? ` | ${op.operateurs_noms}` : ''}
                    </p>
                    {op.debut && (
                      <p className="text-[8px] text-[var(--muted)] mt-0.5">
                        Debut: {new Date(op.debut).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        {op.fin ? ` | Fin: ${new Date(op.fin).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ` | En cours depuis ${elapsed.text}`}
                      </p>
                    )}
                  </div>

                  {/* Time display */}
                  <div className="text-right min-w-[80px]">
                    <p className={`text-sm font-['IBM_Plex_Mono'] font-bold ${isCompleted ? 'text-[var(--green)]' : isInProgress ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
                      {elapsed.text}
                    </p>
                    <p className="text-[7px] text-[var(--muted)]">{elapsed.totalSeconds}s total</p>
                  </div>

                  {/* Status badge */}
                  <Badge label={opStatusLabels[op.statut] || op.statut}
                    color={isCompleted ? 'green' : isInProgress ? 'orange' : 'muted'} />

                  {/* Action buttons */}
                  <div className="flex gap-1">
                    {op.statut === 'PENDING' && (
                      <button onClick={() => advanceOpMut.mutate({ opId: op.id, statut: 'IN_PROGRESS' })}
                        className="px-2 py-1 rounded text-[10px] bg-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)]/30 transition-colors" title="Demarrer">
                        ▶
                      </button>
                    )}
                    {op.statut === 'IN_PROGRESS' && (
                      <button onClick={() => advanceOpMut.mutate({ opId: op.id, statut: 'COMPLETED' })}
                        className="px-2 py-1 rounded text-[10px] bg-[var(--green)]/20 text-[var(--green)] hover:bg-[var(--green)]/30 transition-colors" title="Terminer">
                        ✓
                      </button>
                    )}
                    {op.statut === 'COMPLETED' && (
                      <button onClick={() => { if (confirm(`Re-ouvrir "${op.operation_nom}"? Le temps precedent sera perdu.`)) advanceOpMut.mutate({ opId: op.id, statut: 'IN_PROGRESS' }); }}
                        className="px-2 py-1 rounded text-[10px] bg-[var(--blue)]/20 text-[var(--blue)] hover:bg-[var(--blue)]/30 transition-colors" title="Re-ouvrir">
                        ↺
                      </button>
                    )}
                    {!isCompleted && !isInProgress && (
                      <button onClick={() => { if (confirm('Supprimer cette operation?')) delOpMut.mutate(op.id); }}
                        className="px-2 py-1 rounded text-[10px] text-red-400 hover:bg-red-500/10 transition-colors" title="Supprimer">
                        ×
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add operation */}
        <div className="border-t border-[var(--border)] pt-3">
          <p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase mb-2">Ajouter une operation</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[8px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Type</label>
              <select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-xs" value={newType} onChange={e => setNewType(e.target.value)}>
                <option value="">—</option>{opTypes?.map(t => <option key={t.id} value={t.nom}>{t.nom}</option>)}
              </select>
            </div>
            <div className="w-44">
              <label className="text-[8px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Machine</label>
              <select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-xs" value={newMachine} onChange={e => setNewMachine(e.target.value)}>
                <option value="">—</option>{machines?.filter(m => m.statut === 'OPERATIONNELLE').map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
              </select>
            </div>
            <button type="button" onClick={handleAddOp} disabled={addOpMut.isPending}
              className="px-3 py-1.5 rounded bg-[var(--red)] text-white text-[10px] hover:bg-[var(--red-d)] disabled:opacity-40">
              + Ajouter
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>Fermer</Button>
        </div>
      </div>
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
