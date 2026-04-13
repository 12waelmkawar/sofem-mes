import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';

interface CQ {
  id: number; cq_numero: string; of_numero: string; produit_nom: string;
  type_controle: string; operateur_prenom: string; operateur_nom: string;
  date_controle: string; statut: string; quantite_controlee: number;
  quantite_conforme: number; quantite_rebut: number; notes: string | null;
}

interface NC {
  id: number; nc_numero: string; of_numero: string; produit_nom: string;
  type_defaut: string; description: string | null; gravite: string;
  action_corrective: string | null; resp_prenom: string | null; resp_nom: string | null;
  statut: string; created_at: string;
}

export default function QualitePage() {
  
  const [showCreate, setShowCreate] = useState(false);

  const { data: controles } = useQuery<CQ[]>({
    queryKey: ['controles'],
    queryFn: () => api.get('/api/qualite/controles').then(r => r.data),
  });

  const { data: ncs } = useQuery<NC[]>({
    queryKey: ['ncs'],
    queryFn: () => api.get('/api/qualite/nc').then(r => r.data),
  });

  const statColors: Record<string, 'green' | 'red' | 'orange'> = { CONFORME: 'green', NON_CONFORME: 'red', EN_ATTENTE: 'orange',  };
  const gravColors: Record<string, 'blue' | 'red'> = { MINEURE: 'blue', MAJEURE: 'red', CRITIQUE: 'red' };
  const gravEmoji: Record<string, string> = { MINEURE: '⚠️', MAJEURE: '🔴', CRITIQUE: '🚨' };

  const total = controles?.length || 0;
  const conformes = controles?.filter(c => c.statut === 'CONFORME').length || 0;
  const nonConformes = controles?.filter(c => c.statut === 'NON_CONFORME').length || 0;
  const taux = total > 0 ? Math.round((conformes / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">QUALITE & NON-CONFORMITES</h1></div>
        <div className="flex gap-2">
          <Button onClick={() => setShowCreate(true)}>+ Nouveau Controle</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-4"><p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Total Contrôles</p><p className="font-['Bebas_Neue'] text-[36px]">{total}</p></div>
        <div className="bg-[var(--bg2)] border border-[var(--green)] rounded-xl p-4"><p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--green)] uppercase">Taux Conformité</p><p className="font-['Bebas_Neue'] text-[36px] text-[var(--green)]">{taux}%</p></div>
        <div className="bg-[var(--bg2)] border border-[var(--red)] rounded-xl p-4"><p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--red)] uppercase">Non Conformes</p><p className="font-['Bebas_Neue'] text-[36px] text-[var(--red)]">{nonConformes}</p></div>
        <div className="bg-[var(--bg2)] border border-[var(--accent)] rounded-xl p-4"><p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--accent)] uppercase">NC Ouvertes</p><p className="font-['Bebas_Neue'] text-[36px] text-[var(--accent)]">{ncs?.filter(n => n.statut === 'OUVERTE').length || 0}</p></div>
      </div>

      {/* Controls table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] mb-8">
        <div className="px-4 py-2 border-b border-[var(--border)]"><h2 className="font-['Bebas_Neue'] text-lg tracking-wider">CONTRÔLES QUALITE</h2></div>
        <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[8px] uppercase tracking-[0.1em]">
            <tr><th className="text-left px-3 py-2">N CQ</th><th className="text-left px-3 py-2">OF</th><th className="text-left px-3 py-2">Produit</th><th className="text-left px-3 py-2">Type</th><th className="text-left px-3 py-2">Contrôleur</th><th className="text-left px-3 py-2">Date</th><th className="text-right px-3 py-2">Contrôlé</th><th className="text-right px-3 py-2">Conf</th><th className="text-right px-3 py-2">Rebut</th><th className="text-left px-3 py-2">Résultat</th></tr>
          </thead>
          <tbody>
            {controles?.map(c => (
              <tr key={c.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2 font-bold">{c.cq_numero}</td>
                <td className="px-3 py-2">{c.of_numero}</td>
                <td className="px-3 py-2">{c.produit_nom}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{c.type_controle}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{c.operateur_prenom || '—'}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{c.date_controle ? new Date(c.date_controle).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="px-3 py-2 text-right">{c.quantite_controlee}</td>
                <td className="px-3 py-2 text-right text-[var(--green)]">{c.quantite_conforme}</td>
                <td className="px-3 py-2 text-right text-[var(--red)]">{c.quantite_rebut}</td>
                <td className="px-3 py-2">
                  <Badge label={c.statut} color={statColors[c.statut]} />
                  {c.statut === 'NON_CONFORME' && <a href="#nc" className="text-[8px] text-[var(--red)] ml-1 hover:underline">+NC</a>}
                </td>
              </tr>
            ))}
            {(!controles || controles.length === 0) && <tr><td colSpan={10} className="px-3 py-8 text-center text-[var(--muted)] text-[10px]">Aucun contrôle</td></tr>}
          </tbody>
        </table>
      </div>

      {/* NCs table */}
      <div id="nc" className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <div className="px-4 py-2 border-b border-[var(--border)]"><h2 className="font-['Bebas_Neue'] text-lg tracking-wider">NON-CONFORMITES</h2></div>
        <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[8px] uppercase tracking-[0.1em]">
            <tr><th className="text-left px-3 py-2">N NC</th><th className="text-left px-3 py-2">OF</th><th className="text-left px-3 py-2">Type défaut</th><th className="text-left px-3 py-2">Gravité</th><th className="text-left px-3 py-2">Action Corrective</th><th className="text-left px-3 py-2">Responsable</th><th className="text-left px-3 py-2">Statut</th></tr>
          </thead>
          <tbody>
            {ncs?.map(nc => (
              <tr key={nc.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2 font-bold">{nc.nc_numero}</td>
                <td className="px-3 py-2">{nc.of_numero || '—'}</td>
                <td className="px-3 py-2">{nc.type_defaut}</td>
                <td className="px-3 py-2"><Badge label={`${gravEmoji[nc.gravite] || ''} ${nc.gravite}`} color={gravColors[nc.gravite]} /></td>
                <td className="px-3 py-2 text-[var(--muted)]">{nc.action_corrective || '—'}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{nc.resp_prenom ? `${nc.resp_prenom} ${nc.resp_nom}` : '—'}</td>
                <td className="px-3 py-2"><Badge label={nc.statut} color={nc.statut === 'OUVERTE' ? 'red' : nc.statut === 'EN_COURS' ? 'orange' : 'green'} /></td>
              </tr>
            ))}
            {(!ncs || ncs.length === 0) && <tr><td colSpan={7} className="px-3 py-8 text-center text-[var(--muted)] text-[10px]">Aucune non-conformite</td></tr>}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateControlModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateControlModal({ onClose }: { onClose: () => void }) {
  
  const { data: ofs } = useQuery<{ data: any[] }>({ queryKey: ['ofs-qc'], queryFn: () => api.get('/api/of?statut=IN_PROGRESS&limit=200').then(r => r.data) });
  const { data: operateurs } = useQuery<{ data: any[] }>({ queryKey: ['op-qc'], queryFn: () => api.get('/api/operateurs?limit=200').then(r => r.data) });

  const [form, setForm] = useState({ of_id: '', operateur_id: '', date_controle: new Date().toISOString().split('T')[0], quantite_controlee: '', quantite_conforme: '', quantite_rebut: '', notes: '' });
  const [resultat, setResultat] = useState('EN_ATTENTE');

  useEffect(() => {
    const controlee = parseFloat(form.quantite_controlee) || 0;
    const conforme = parseFloat(form.quantite_conforme) || 0;
    const rebut = parseFloat(form.quantite_rebut) || 0;
    if (rebut > 0 || conforme < controlee) setResultat(controlee > 0 ? 'NON_CONFORME' : 'EN_ATTENTE');
    else if (conforme === controlee && controlee > 0) setResultat('CONFORME');
    else setResultat('EN_ATTENTE');
  }, [form.quantite_controlee, form.quantite_conforme, form.quantite_rebut]);

  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/api/qualite/controles', d),
    onSuccess: () => { /* invalidation */; onClose(); toast.success('Contrôle cree'); },
    onError: () => toast.error('Erreur'),
  });

  const statColors: Record<string, 'green' | 'red' | 'orange'> = { CONFORME: 'green', NON_CONFORME: 'red', EN_ATTENTE: 'orange' };

  return (
    <Modal open onClose={onClose} title="Nouveau Contrôle Qualite" width="max-w-xl">
      <form onSubmit={e => { e.preventDefault(); if (!form.of_id || !form.quantite_controlee) { toast.error('OF et quantite controles requis'); return; } createMut.mutate({ ...form, of_id: parseInt(form.of_id), operateur_id: form.operateur_id ? parseInt(form.operateur_id) : null, quantite_controlee: parseFloat(form.quantite_controlee), quantite_conforme: parseFloat(form.quantite_conforme) || 0, quantite_rebut: parseFloat(form.quantite_rebut) || 0 }); }} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">OF *</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.of_id} onChange={e => setForm({ ...form, of_id: e.target.value })} required><option value="">Selectionner...</option>{ofs?.data?.filter(o => o.statut === 'IN_PROGRESS' || o.statut === 'COMPLETED').map(o => <option key={o.id} value={o.id}>{o.numero} - {o.produit_nom}</option>)}</select></div>
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Operateur</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.operateur_id} onChange={e => setForm({ ...form, operateur_id: e.target.value })}><option value="">—</option>{operateurs?.data?.map(o => <option key={o.id} value={o.id}>{o.prenom} {o.nom}</option>)}</select></div>
        </div>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Date</label><input type="date" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.date_controle} onChange={e => setForm({ ...form, date_controle: e.target.value })} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Qte Controlee *</label><input type="number" step="0.01" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.quantite_controlee} onChange={e => setForm({ ...form, quantite_controlee: e.target.value })} required /></div>
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Qte Conforme</label><input type="number" step="0.01" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.quantite_conforme} onChange={e => setForm({ ...form, quantite_conforme: e.target.value })} /></div>
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Qte Rebut</label><input type="number" step="0.01" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.quantite_rebut} onChange={e => setForm({ ...form, quantite_rebut: e.target.value })} /></div>
        </div>
        <div className="flex items-center justify-between bg-[var(--bg)] border border-[var(--border)] rounded px-4 py-2">
          <span className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Resultat</span>
          <Badge label={resultat} color={statColors[resultat]} />
        </div>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Notes</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit">Enregistrer</Button></div>
      </form>
    </Modal>
  );
}


