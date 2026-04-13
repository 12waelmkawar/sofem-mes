import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

export default function ReportsPage() {
  const { data: production } = useQuery<any[]>({ queryKey: ['rapport-prod'], queryFn: () => api.get('/api/rapports/production-mensuelle').then(r => r.data) });
  const { data: stockAlerts } = useQuery<any[]>({ queryKey: ['rapport-stock'], queryFn: () => api.get('/api/rapports/stock-alertes').then(r => r.data) });
  const { data: operators } = useQuery<any[]>({ queryKey: ['rapport-ops'], queryFn: () => api.get('/api/rapports/operateurs').then(r => r.data).catch(() => []) });

  const maxTotal = Math.max(...(production || []).map(p => p.total || 0), 1);

  return (
    <div>
      <h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em] mb-4">RAPPORTS</h1>

      {/* Monthly Production Chart */}
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5 mb-6">
        <h2 className="font-['Bebas_Neue'] text-lg tracking-wider mb-4">PRODUCTION MENSUELLE (12 MOIS)</h2>
        <div className="flex items-end gap-2 h-32">
          {(production || []).map((m: any, i: number) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[8px] text-[var(--muted)]">{m.total}</span>
              <div className="w-full rounded-t overflow-hidden" style={{ height: `${Math.max((m.total / maxTotal) * 100, 4)}%` }}>
                <div className="w-full h-full rounded-t bg-[var(--red,#dc2626)] opacity-70" />
              </div>
              <span className="text-[7px] text-[var(--muted)]">{m.mois_label}</span>
            </div>
          ))}
          {(!production || production.length === 0) && <p className="text-[10px] text-[var(--muted)] w-full text-center py-8">Aucune donnee</p>}
        </div>
      </div>

      {/* Stock Alerts */}
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5 mb-6">
        <h2 className="font-['Bebas_Neue'] text-lg tracking-wider mb-4">ALERTES STOCK</h2>
        {(stockAlerts || []).length === 0 ? <p className="text-[var(--green)] text-sm">Stock OK ✓</p> : (
          <div className="space-y-2">
            {(stockAlerts || []).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between bg-[var(--bg)] rounded-lg px-4 py-2">
                <span className="text-sm">{s.nom}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-[var(--muted)]">{s.stock_actuel} / {s.stock_minimum} {s.unite}</span>
                  <div className="w-24 bg-[var(--bg3)] rounded-full h-2 overflow-hidden"><div className="h-full bg-[var(--red)] rounded-full" style={{ width: `${s.pct_stock}%` }} /></div>
                  <span className="text-[9px] text-[var(--red)] font-bold">{s.pct_stock}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Operator Performance */}
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="font-['Bebas_Neue'] text-lg tracking-wider mb-4">PERFORMANCE OPERATEURS</h2>
        {(operators || []).length === 0 ? <p className="text-[var(--muted)] text-sm">Pas de donnees</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
              <thead className="text-[var(--muted)] text-[8px] uppercase tracking-[0.1em]">
                <tr><th className="text-left py-2">Operateur</th><th className="text-left py-2">Specialite</th><th className="text-right py-2">OFs</th><th className="text-right py-2">Ops terminees</th></tr>
              </thead>
              <tbody>
                {(operators || []).map((o: any) => (
                  <tr key={o.id} className="border-t border-[var(--border)]"><td className="py-2">{o.prenom} {o.nom}</td><td className="py-2 text-[var(--muted)]">{o.specialite}</td><td className="py-2 text-right">{o.total_ofs || 0}</td><td className="py-2 text-right text-[var(--green)]">{o.ops_terminees || 0}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
