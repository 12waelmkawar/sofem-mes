import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import Badge from '../../components/ui/Badge';

type Tab = 'production' | 'achats' | 'operateurs' | 'qualite';

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('production');
  const tabs: { key: Tab; label: string }[] = [
    { key: 'production', label: 'Production' },
    { key: 'achats', label: 'Achats & Stock' },
    { key: 'operateurs', label: 'Operateurs' },
    { key: 'qualite', label: 'Qualite' },
  ];

  return (
    <div>
      <h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em] mb-4">ANALYTIQUES</h1>
      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded text-[11px] font-['IBM_Plex_Mono'] border transition-colors ${tab === t.key ? 'bg-[var(--red)] text-white border-[var(--red)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'production' && <ProductionTab />}
      {tab === 'achats' && <AchatsTab />}
      {tab === 'operateurs' && <OperateursTab />}
      {tab === 'qualite' && <QualiteTab />}
    </div>
  );
}

function ProductionTab() {
  const { data } = useQuery<any>({ queryKey: ['analytics-production'], queryFn: () => api.get('/api/analytics/production').then(r => r.data) });
  if (!data) return <p className="text-[var(--muted)]">Chargement...</p>;

  return (
    <div className="space-y-6">
      {/* Monthly Chart */}
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="font-['Bebas_Neue'] text-lg tracking-wider mb-4">OF PAR MOIS (12 MOIS)</h3>
        <div className="flex items-end gap-2 h-32">
          {(data.par_mois || []).map((m: any, i: number) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[8px] text-[var(--muted)]">{m.total}</span>
              <div className="w-full rounded-t overflow-hidden" style={{ height: `${Math.max((m.total / Math.max(...data.par_mois.map((p: any) => p.total), 1)) * 100, 4)}%` }}>
                <div className="w-full h-full rounded-t bg-[var(--red)] opacity-70" />
              </div>
              <span className="text-[7px] text-[var(--muted)]">{m.mois_label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Status Distribution */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="font-['Bebas_Neue'] text-lg tracking-wider mb-3">REPARTITION PAR STATUT</h3>
          <div className="space-y-2">
            {(data.statuts || []).map((s: any) => (
              <div key={s.statut} className="flex items-center justify-between">
                <Badge label={s.statut} color={s.statut === 'COMPLETED' ? 'green' : s.statut === 'IN_PROGRESS' ? 'red' : 'blue'} />
                <span className="font-['Bebas_Neue'] text-2xl">{s.n}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="font-['Bebas_Neue'] text-lg tracking-wider mb-3">CHARGE PAR ATELIER</h3>
          <div className="space-y-2">
            {(data.ateliers || []).map((a: any) => (
              <div key={a.atelier} className="flex items-center justify-between">
                <span className="text-sm">{a.atelier}</span>
                <span className="font-['Bebas_Neue'] text-2xl">{a.n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Late OFs */}
      {data.retards?.length > 0 && (
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="font-['Bebas_Neue'] text-lg tracking-wider mb-3 text-[var(--red)]">OF EN RETARD</h3>
          <table className="w-full text-[10px] font-['IBM_Plex_Mono']">
            <thead className="text-[var(--muted)] text-[8px] uppercase"><tr><th className="text-left py-1">N OF</th><th className="text-left py-1">Produit</th><th className="text-left py-1">Client</th><th className="text-right py-1">Retard</th></tr></thead>
            <tbody>
              {data.retards.map((r: any) => (
                <tr key={r.numero} className="border-t border-[var(--border)]">
                  <td className="py-1 font-bold">{r.numero}</td>
                  <td className="py-1">{r.produit_nom}</td>
                  <td className="py-1 text-[var(--muted)]">{r.client_nom || '—'}</td>
                  <td className="py-1 text-right font-['Bebas_Neue'] text-xl text-[var(--red)]">+{r.jours_retard}j</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AchatsTab() {
  const { data } = useQuery<any>({ queryKey: ['analytics-achats'], queryFn: () => api.get('/api/analytics/achats').then(r => r.data) });
  if (!data) return <p className="text-[var(--muted)]">Chargement...</p>;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[var(--bg2)] border border-[var(--red)] rounded-xl p-4"><p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--red)] uppercase">Alertes Stock</p><p className="font-['Bebas_Neue'] text-[36px] text-[var(--red)]">{data.stock?.filter((s: any) => s.pct_stock < 50).length || 0}</p></div>
        <div className="bg-[var(--bg2)] border border-[var(--accent)] rounded-xl p-4"><p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--accent)] uppercase">Stock Bas</p><p className="font-['Bebas_Neue'] text-[36px] text-[var(--accent)]">{data.stock?.filter((s: any) => s.pct_stock >= 50 && s.pct_stock < 90).length || 0}</p></div>
        <div className="bg-[var(--bg2)] border border-[var(--blue)] rounded-xl p-4"><p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--blue)] uppercase">Valeur Stock</p><p className="font-['Bebas_Neue'] text-[36px] text-[var(--blue)]">{(data.valeur_totale_stock || 0).toFixed(0)} DT</p></div>
        <div className="bg-[var(--bg2)] border border-[var(--muted)] rounded-xl p-4"><p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">DAs en attente</p><p className="font-['Bebas_Neue'] text-[36px]">{data.da_statuts?.find((d: any) => d.statut === 'PENDING')?.n || 0}</p></div>
      </div>

      {/* Stock Levels */}
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="font-['Bebas_Neue'] text-lg tracking-wider mb-3">NIVEAUX DE STOCK</h3>
        <div className="grid grid-cols-2 gap-3">
          {(data.stock || []).map((s: any) => (
            <div key={s.id} className="flex items-center justify-between bg-[var(--bg)] rounded-lg px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium truncate">{s.nom}</p>
                <p className="text-[8px] text-[var(--muted)]">{s.stock_actuel} / {s.stock_minimum} {s.unite}</p>
              </div>
              <div className="w-16 ml-2">
                <div className="w-full bg-[var(--bg3)] rounded-full h-2 overflow-hidden">
                  <div className={`h-full rounded-full ${s.pct_stock < 50 ? 'bg-[var(--red)]' : s.pct_stock < 90 ? 'bg-[var(--accent)]' : 'bg-[var(--green)]'}`} style={{ width: `${Math.min(s.pct_stock, 100)}%` }} />
                </div>
                <p className="text-[7px] text-center">{s.pct_stock}%</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Suppliers */}
      {(data.top_fournisseurs || []).length > 0 && (
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="font-['Bebas_Neue'] text-lg tracking-wider mb-3">TOP FOURNISSEURS (par depenses)</h3>
          {(data.top_fournisseurs || []).map((f: any) => (
            <div key={f.fournisseur} className="flex items-center justify-between py-1 border-b border-[var(--border)] last:border-0">
              <span className="text-[10px]">{f.fournisseur}</span>
              <span className="font-['Bebas_Neue'] text-xl">{(f.montant_total || 0).toFixed(0)} DT</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OperateursTab() {
  const { data } = useQuery<any>({ queryKey: ['analytics-operateurs'], queryFn: () => api.get('/api/analytics/operateurs').then(r => r.data) });
  if (!data) return <p className="text-[var(--muted)]">Chargement...</p>;

  return (
    <div className="space-y-6">
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--border)]"><h3 className="font-['Bebas_Neue'] text-lg tracking-wider">PERFORMANCE OPERATEURS</h3></div>
        <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[8px] uppercase tracking-[0.1em]">
            <tr><th className="text-left px-3 py-2">Operateur</th><th className="text-left px-3 py-2">Role</th><th className="text-left px-3 py-2">Specialite</th><th className="text-right px-3 py-2">Ops Terminees</th><th className="text-right px-3 py-2">Duree Totale</th><th className="text-right px-3 py-2">OFs Impliques</th></tr>
          </thead>
          <tbody>
            {(data.performance || []).map((o: any) => (
              <tr key={o.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2 font-medium">{o.prenom} {o.nom}</td>
                <td className="px-3 py-2"><Badge label={o.role} color={o.role === 'CHEF_ATELIER' ? 'blue' : 'muted'} /></td>
                <td className="px-3 py-2 text-[var(--muted)]">{o.specialite}</td>
                <td className="px-3 py-2 text-right font-['Bebas_Neue'] text-2xl text-[var(--green)]">{o.ops_terminees}</td>
                <td className="px-3 py-2 text-right">{Math.round(o.duree_totale_min / 60)}h{o.duree_totale_min % 60}m</td>
                <td className="px-3 py-2 text-right">{o.ofs_impliques}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QualiteTab() {
  const { data } = useQuery<any>({ queryKey: ['analytics-qualite'], queryFn: () => api.get('/api/analytics/qualite').then(r => r.data) });
  if (!data) return <p className="text-[var(--muted)]">Chargement...</p>;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[var(--bg2)] border border-[var(--green)] rounded-xl p-4"><p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--green)] uppercase">Taux Conformite</p><p className="font-['Bebas_Neue'] text-[36px] text-[var(--green)]">{data.kpis?.taux_global || 0}%</p></div>
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-4"><p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Total Contrôles</p><p className="font-['Bebas_Neue'] text-[36px]">{data.kpis?.total_cq || 0}</p></div>
        <div className="bg-[var(--bg2)] border border-[var(--red)] rounded-xl p-4"><p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--red)] uppercase">NC Ouvertes</p><p className="font-['Bebas_Neue'] text-[36px] text-[var(--red)]">{data.nc_kpis?.ouvertes || 0}</p></div>
        <div className="bg-[var(--bg2)] border border-[var(--accent)] rounded-xl p-4"><p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--accent)] uppercase">NC Critiques</p><p className="font-['Bebas_Neue'] text-[36px] text-[var(--accent)]">{data.nc_kpis?.critiques || 0}</p></div>
      </div>

      {/* Defect Types */}
      {(data.defauts || []).length > 0 && (
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="font-['Bebas_Neue'] text-lg tracking-wider mb-3">TYPES DE DEFAUTS</h3>
          <div className="space-y-2">
            {(data.defauts || []).map((d: any) => (
              <div key={d.type_defaut} className="flex items-center justify-between">
                <span className="text-[10px]">{d.type_defaut}</span>
                <span className="font-['Bebas_Neue'] text-xl">{d.n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open NCs */}
      {(data.nc_ouvertes || []).length > 0 && (
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)]"><h3 className="font-['Bebas_Neue'] text-lg tracking-wider">NON-CONFORMITES OUVERTES</h3></div>
          <table className="w-full text-[10px] font-['IBM_Plex_Mono']">
            <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[8px] uppercase">
              <tr><th className="text-left px-3 py-1">N NC</th><th className="text-left px-3 py-1">OF</th><th className="text-left px-3 py-1">Defaut</th><th className="text-left px-3 py-1">Gravite</th><th className="text-left px-3 py-1">Responsable</th><th className="text-right px-3 py-1">Age</th><th className="text-left px-3 py-1">Action</th></tr>
            </thead>
            <tbody>
              {data.nc_ouvertes.map((nc: any) => (
                <tr key={nc.nc_numero} className="border-t border-[var(--border)]">
                  <td className="px-3 py-1 font-bold">{nc.nc_numero}</td>
                  <td className="px-3 py-1">{nc.of_numero || '—'}</td>
                  <td className="px-3 py-1">{nc.type_defaut}</td>
                  <td className="px-3 py-1"><Badge label={nc.gravite} color={nc.gravite === 'CRITIQUE' ? 'red' : nc.gravite === 'MAJEURE' ? 'orange' : 'blue'} /></td>
                  <td className="px-3 py-1 text-[var(--muted)]">{nc.resp_prenom ? `${nc.resp_prenom} ${nc.resp_nom}` : '—'}</td>
                  <td className={`px-3 py-1 text-right font-['Bebas_Neue'] text-lg ${nc.age_jours > 7 ? 'text-[var(--red)]' : ''}`}>{nc.age_jours}j</td>
                  <td className="px-3 py-1 text-[var(--muted)] truncate max-w-[150px]">{nc.action_corrective || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
