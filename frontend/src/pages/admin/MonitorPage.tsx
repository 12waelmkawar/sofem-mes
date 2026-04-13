import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

interface OF {
  id: number; numero: string; statut: string; produit_nom: string;
  client_nom: string; quantite: number; priorite: string;
  operations: { id: number; statut: string; ordre: number; operation_nom: string; machine_nom: string | null; operateurs_noms: string | null }[];
}

const STATUT_COLORS: Record<string, string> = {
  PENDING: 'var(--muted)', IN_PROGRESS: 'var(--accent)', COMPLETED: 'var(--green)',
};
const STATUT_LABELS: Record<string, string> = {
  PENDING: 'En attente', IN_PROGRESS: 'En cours', COMPLETED: 'Terminee',
};

export default function MonitorPage() {
  const queryClient = useQueryClient();
  const [_elapsedKey, setElapsedKey] = useState(0);

  const { data } = useQuery<{ data: OF[] }>({
    queryKey: ['ofs-monitor'],
    queryFn: () => api.get('/api/of?limit=500&statut=IN_PROGRESS').then(r => r.data),
    refetchInterval: 30000,
  });

  // Update elapsed time every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setElapsedKey(k => k + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const advanceOpMut = useMutation({
    mutationFn: ({ ofId, opId, statut }: { ofId: number; opId: number; statut: string }) =>
      api.put(`/api/of/${ofId}/operations/${opId}`, { statut }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ofs-monitor'] }); toast.success('Operation mise a jour'); },
    onError: (e: any) => toast.error(e.response?.data?.error?.message || 'Erreur'),
  });

  const ofs = data?.data || [];
  const activeCount = ofs.filter(of => of.statut === 'IN_PROGRESS').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">MONITORING PRODUCTION</h1>
          <p className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted)]">{activeCount} ORDRES EN COURS</p>
        </div>
        <Button variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ['ofs-monitor'] })}>Actualiser</Button>
      </div>

      {ofs.length === 0 ? (
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-12 text-center">
          <p className="text-[var(--muted)] font-['IBM_Plex_Mono'] text-sm">Aucun ordre en cours</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
            <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[8px] uppercase tracking-[0.1em]">
              <tr>
                <th className="text-left px-3 py-2">N OF / Client</th>
                <th className="text-left px-3 py-2">Produit</th>
                <th className="text-left px-3 py-2">Pipeline Operations</th>
                <th className="text-left px-3 py-2">Progression</th>
              </tr>
            </thead>
            <tbody>
              {ofs.map(of => {
                const ops = of.operations || [];
                const completed = ops.filter(o => o.statut === 'COMPLETED').length;
                const total = ops.length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                const inProgressOp = ops.find(o => o.statut === 'IN_PROGRESS');

                return (
                  <tr key={of.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                    <td className="px-3 py-2">
                      <p className="font-bold">{of.numero}</p>
                      <p className="text-[9px] text-[var(--muted)]">{of.client_nom || '—'}</p>
                    </td>
                    <td className="px-3 py-2">
                      <p>{of.produit_nom}</p>
                      <p className="text-[8px] text-[var(--muted)]">Qte: {of.quantite} | Priorite: <Badge label={of.priorite} color={of.priorite === 'URGENT' ? 'red' : of.priorite === 'HIGH' ? 'orange' : 'blue'} /></p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2 items-center">
                        {ops.map((op, i) => (
                          <div key={op.id} className="flex items-center">
                            {i > 0 && <div className="w-4 h-0.5 bg-[var(--border)]" />}
                            <button
                              onClick={() => {
                                const next = op.statut === 'PENDING' ? 'IN_PROGRESS' : op.statut === 'IN_PROGRESS' ? 'COMPLETED' : op.statut;
                                if (next === op.statut) return;
                                advanceOpMut.mutate({ ofId: of.id, opId: op.id, statut: next });
                              }}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[7px] font-['IBM_Plex_Mono'] border-2 transition-all hover:scale-110 cursor-pointer"
                              style={{
                                backgroundColor: op.statut === 'COMPLETED' ? 'var(--green)' : op.statut === 'IN_PROGRESS' ? 'var(--accent)' : 'transparent',
                                borderColor: STATUT_COLORS[op.statut],
                                color: op.statut === 'PENDING' ? 'var(--muted)' : 'white',
                                opacity: op.statut === 'PENDING' ? 0.4 : 1,
                                animation: op.statut === 'IN_PROGRESS' ? 'blink 1s ease-in-out infinite' : 'none',
                              }}
                              title={`${op.operation_nom}: ${STATUT_LABELS[op.statut]}`}
                            >
                              {op.statut === 'COMPLETED' ? '✓' : op.statut === 'IN_PROGRESS' ? '▶' : op.ordre + 1}
                            </button>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="w-24">
                        <div className="w-full bg-[var(--bg)] rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full bg-[var(--red)] transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[7px] text-[var(--muted)]">{pct}%</span>
                          {inProgressOp && (
                            <span className="text-[7px] text-[var(--accent)]">
                              {getElapsed(inProgressOp.statut === 'IN_PROGRESS' ? new Date().toISOString() : null)}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function getElapsed(debut: string | null | undefined): string {
  if (!debut) return '';
  const start = new Date(debut);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}h${mins > 0 ? String(mins).padStart(2, '0') : '00'}`;
}


