import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import Badge from '../../components/ui/Badge';

interface DashboardStats {
  ordres_actifs: number;
  urgents: number;
  taux_completion: string;
  alertes_stock: number;
  en_retard: number;
  graphique: { mois_label: string; total: number; completes: number }[];
}

interface OF {
  id: number; numero: string; statut: string; priorite: string;
  produit_nom: string; client_nom: string; quantite: number;
  date_echeance: string; created_at: string;
  operations: { id: number; statut: string; ordre: number; operation_nom: string }[];
}

interface StockAlert {
  id: number; nom: string; stock_actuel: number; stock_minimum: number;
  unite: string; pct_stock: number;
}

export default function DashboardPage() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/api/dashboard').then(r => r.data),
  });

  const { data: ofs } = useQuery<{ data: OF[] }>({
    queryKey: ['of-list'],
    queryFn: () => api.get('/api/of?limit=100').then(r => r.data),
  });

  const { data: stockAlerts } = useQuery<StockAlert[]>({
    queryKey: ['stock-alerts'],
    queryFn: () => api.get('/api/rapports/stock-alertes').then(r => r.data).catch(() => []),
  });

  const statutColors: Record<string, 'red' | 'green' | 'blue' | 'muted'> = {
    DRAFT: 'muted', APPROVED: 'blue', IN_PROGRESS: 'red', COMPLETED: 'green', CANCELLED: 'red',
  };
  const statutLabels: Record<string, string> = {
    DRAFT: 'Brouillon', APPROVED: 'Approuve', IN_PROGRESS: 'En cours', COMPLETED: 'Termine', CANCELLED: 'Annule',
  };
  const prioriteColors: Record<string, 'red' | 'orange' | 'blue' | 'muted'> = {
    URGENT: 'red', HIGH: 'orange', NORMAL: 'blue', LOW: 'muted',
  };

  const recentOFs = (ofs?.data || []).slice(0, 6);
  const currentMonthLabel = new Date().toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <KpiCard label="Ordres Actifs" value={stats?.ordres_actifs || 0} color="red" />
        <KpiCard label="Urgents" value={stats?.urgents || 0} color="orange" />
        <KpiCard label="Taux Completion" value={`${stats?.taux_completion || 0}%`} color="green" />
        <KpiCard label="Alertes Stock" value={stats?.alertes_stock || 0} color={stats && stats.alertes_stock > 0 ? 'red' : 'green'} />
        <KpiCard label="En Retard" value={stats?.en_retard || 0} color={(stats?.en_retard || 0) > 0 ? 'red' : 'green'} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Recent OFs */}
        <div className="col-span-2 bg-[var(--bg2)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)]">
            <h2 className="font-['Bebas_Neue'] text-lg tracking-wider">ORDRES RECENTS</h2>
          </div>
          <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
            <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[8px] uppercase tracking-[0.1em]">
              <tr>
                <th className="text-left px-3 py-2">N OF</th>
                <th className="text-left px-3 py-2">Produit</th>
                <th className="text-left px-3 py-2">Client</th>
                <th className="text-left px-3 py-2">Statut</th>
                <th className="text-left px-3 py-2">Priorite</th>
                <th className="text-left px-3 py-2">Echeance</th>
              </tr>
            </thead>
            <tbody>
              {recentOFs.map(of => (
                <tr key={of.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                  <td className="px-3 py-2 font-bold">{of.numero}</td>
                  <td className="px-3 py-2">{of.produit_nom}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{of.client_nom || '—'}</td>
                  <td className="px-3 py-2"><Badge label={statutLabels[of.statut] || of.statut} color={statutColors[of.statut]} /></td>
                  <td className="px-3 py-2"><Badge label={of.priorite} color={prioriteColors[of.priorite]} /></td>
                  <td className="px-3 py-2 text-[var(--muted)]">{of.date_echeance ? new Date(of.date_echeance).toLocaleDateString('fr-FR') : '—'}</td>
                </tr>
              ))}
              {recentOFs.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--muted)] text-[10px]">Aucun ordre de fabrication</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Stock Alerts */}
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <h2 className="font-['Bebas_Neue'] text-lg tracking-wider">ALERTES STOCK</h2>
              <Badge label={`${stockAlerts?.length || 0}`} color="red" />
            </div>
            <div className="p-4 space-y-3 max-h-48 overflow-y-auto">
              {stockAlerts && stockAlerts.length > 0 ? stockAlerts.slice(0, 8).map(s => (
                <div key={s.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-medium truncate">{s.nom}</p>
                    <p className="text-[8px] text-[var(--muted)]">{s.stock_actuel} / {s.stock_minimum} {s.unite}</p>
                  </div>
                  <div className="w-16 ml-2">
                    <div className="w-full bg-[var(--bg)] rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--red)]" style={{ width: `${Math.min(s.pct_stock, 100)}%` }} />
                    </div>
                    <p className="text-[7px] text-[var(--red)] text-center">{s.pct_stock}%</p>
                  </div>
                </div>
              )) : (
                <p className="text-[10px] text-[var(--muted)] text-center py-4">Stock OK ✓</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Chart */}
      <div className="mt-6 bg-[var(--bg2)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)]">
          <h2 className="font-['Bebas_Neue'] text-lg tracking-wider">PRODUCTION MENSUELLE</h2>
        </div>
        <div className="p-5">
          <div className="flex items-end gap-2 h-32">
            {(stats?.graphique || []).map((m, i) => {
              const maxTotal = Math.max(...(stats?.graphique || []).map(g => g.total), 1);
              const height = Math.max((m.total / maxTotal) * 100, 4);
              const isCurrentMonth = m.mois_label === currentMonthLabel;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[8px] text-[var(--muted)]">{m.total}</span>
                  <div className="w-full rounded-t overflow-hidden" style={{ height: `${height}%` }}>
                    <div
                      className="w-full h-full rounded-t transition-all duration-600"
                      style={{
                        backgroundColor: isCurrentMonth ? 'var(--red,#dc2626)' : 'var(--muted,#737373)',
                        opacity: isCurrentMonth ? 1 : 0.55,
                      }}
                    />
                  </div>
                  <span className="text-[7px] text-[var(--muted)]">{m.mois_label}</span>
                </div>
              );
            })}
            {(stats?.graphique || []).length === 0 && (
              <p className="text-[10px] text-[var(--muted)] text-center w-full py-8">Aucune donnee</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const textColors: Record<string, string> = { red: 'text-[var(--red)]', green: 'text-[var(--green)]', orange: 'text-[var(--accent)]', blue: 'text-[var(--blue)]', muted: 'text-[var(--muted)]' };
  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-4">
      <p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">{label}</p>
      <p className={`font-['Bebas_Neue'] text-[40px] leading-none mt-1 ${textColors[color] || 'text-[var(--text)]'}`}>{value}</p>
    </div>
  );
}
