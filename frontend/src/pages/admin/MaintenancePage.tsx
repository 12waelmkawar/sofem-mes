import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useAuth } from '../../store/authStore';

interface MO { id: number; om_numero: string; titre: string; machine_nom: string; type_maintenance: string; priorite: string; statut: string; technicien_prenom: string; technicien_nom: string; date_planifiee: string; }
const STAT_COLORS: Record<string, 'green' | 'red' | 'orange' | 'muted'> = { PLANIFIE: 'muted', EN_COURS: 'orange', TERMINE: 'green', ANNULE: 'red' };
const TYPE_ICONS: Record<string, string> = { PREVENTIVE: '🛡️', CORRECTIVE: '🔧', URGENCE: '🚨' };

export default function MaintenancePage() {
  const { isManager } = useAuth();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const { data } = useQuery<MO[]>({ queryKey: ['maintenance'], queryFn: () => api.get('/api/maintenance').then(r => r.data) });
  const { data: machines } = useQuery<any[]>({ queryKey: ['mach-maint'], queryFn: () => api.get('/api/machines').then(r => r.data), enabled: show });
  const { data: operateurs } = useQuery<any[]>({ queryKey: ['op-maint'], queryFn: () => api.get('/api/operateurs?limit=200').then(r => r.data.data), enabled: show });

  const createMut = useMutation({ mutationFn: (d: any) => api.post('/api/maintenance', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); setShow(false); toast.success('OM cree'); } });
  const statMut = useMutation({ mutationFn: ({ id, statut }: any) => api.put(`/api/maintenance/${id}`, { statut }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); toast.success('OM mis a jour'); } });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">MAINTENANCE</h1><p className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--muted)]">{data?.length || 0} ordres de maintenance</p></div>
        {isManager() && <Button onClick={() => setShow(true)}>+ Nouvel Ordre</Button>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-[11px] font-['IBM_Plex_Mono']">
          <thead className="bg-[var(--bg3)] text-[var(--muted)] text-[8px] uppercase tracking-[0.1em]">
            <tr><th className="text-left px-3 py-2">N OM</th><th className="text-left px-3 py-2">Titre</th><th className="text-left px-3 py-2">Machine</th><th className="text-left px-3 py-2">Type</th><th className="text-left px-3 py-2">Technicien</th><th className="text-left px-3 py-2">Priorite</th><th className="text-left px-3 py-2">Statut</th><th className="text-left px-3 py-2">Date</th><th className="text-right px-3 py-2">Actions</th></tr>
          </thead>
          <tbody>
            {data?.map(mo => (
              <tr key={mo.id} className="border-t border-[var(--border)] hover:bg-[var(--bg3)]">
                <td className="px-3 py-2 font-bold">{mo.om_numero}</td>
                <td className="px-3 py-2">{mo.titre}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{mo.machine_nom}</td>
                <td className="px-3 py-2">{TYPE_ICONS[mo.type_maintenance] || ''} {mo.type_maintenance}</td>
                <td className="px-3 py-2 text-[var(--muted)]">{mo.technicien_prenom ? `${mo.technicien_prenom} ${mo.technicien_nom}` : '—'}</td>
                <td className="px-3 py-2"><Badge label={mo.priorite} color={mo.priorite === 'URGENTE' ? 'red' : mo.priorite === 'HAUTE' ? 'orange' : 'blue'} /></td>
                <td className="px-3 py-2"><Badge label={mo.statut} color={STAT_COLORS[mo.statut]} /></td>
                <td className="px-3 py-2 text-[var(--muted)]">{mo.date_planifiee ? new Date(mo.date_planifiee).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="px-3 py-2 text-right">
                  {mo.statut === 'PLANIFIE' && <button onClick={() => statMut.mutate({ id: mo.id, statut: 'EN_COURS' })} className="text-[var(--accent)] hover:underline text-[9px] mr-1">Demarrer</button>}
                  {mo.statut === 'EN_COURS' && <button onClick={() => statMut.mutate({ id: mo.id, statut: 'TERMINE' })} className="text-[var(--green)] hover:underline text-[9px] mr-1">Terminer</button>}
                </td>
              </tr>
            ))}
            {(!data || data.length === 0) && <tr><td colSpan={9} className="px-3 py-8 text-center text-[var(--muted)] text-[10px]">Aucun ordre de maintenance</td></tr>}
          </tbody>
        </table>
      </div>
      {show && <CreateMOModal onClose={() => setShow(false)} machines={machines || []} operateurs={operateurs || []} onCreate={(d: any) => createMut.mutate(d)} />}
    </div>
  );
}

function CreateMOModal({ onClose, machines, operateurs, onCreate }: { onClose: () => void; machines: any[]; operateurs: any[]; onCreate: (d: any) => void }) {
  const [f, setF] = useState({ titre: '', machine_id: '', type_maintenance: 'CORRECTIVE', priorite: 'NORMAL', technicien_id: '', date_planifiee: new Date().toISOString().split('T')[0] });
  return (
    <Modal open onClose={onClose} title="Nouvel Ordre de Maintenance" width="max-w-xl">
      <form onSubmit={e => { e.preventDefault(); if (!f.titre || !f.machine_id) { toast.error('Titre et machine requis'); return; } onCreate({ ...f, machine_id: parseInt(f.machine_id), technicien_id: f.technicien_id ? parseInt(f.technicien_id) : null }); }} className="space-y-3">
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Titre *</label><input className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.titre} onChange={e => setF({ ...f, titre: e.target.value })} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Machine *</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.machine_id} onChange={e => setF({ ...f, machine_id: e.target.value })} required><option value="">—</option>{machines.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}</select></div>
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Type</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.type_maintenance} onChange={e => setF({ ...f, type_maintenance: e.target.value })}><option value="PREVENTIVE">Preventif</option><option value="CORRECTIVE">Correctif</option><option value="URGENCE">Urgence</option></select></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Priorite</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.priorite} onChange={e => setF({ ...f, priorite: e.target.value })}><option value="BASSE">Basse</option><option value="NORMAL">Normal</option><option value="HAUTE">Haute</option><option value="URGENTE">Urgente</option></select></div>
          <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Technicien</label><select className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.technicien_id} onChange={e => setF({ ...f, technicien_id: e.target.value })}><option value="">—</option>{operateurs.map(o => <option key={o.id} value={o.id}>{o.prenom} {o.nom}</option>)}</select></div>
        </div>
        <div><label className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase">Date Planifiee</label><input type="date" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-3 py-2 text-sm" value={f.date_planifiee} onChange={e => setF({ ...f, date_planifiee: e.target.value })} /></div>
        <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button type="submit">Creer</Button></div>
      </form>
    </Modal>
  );
}
