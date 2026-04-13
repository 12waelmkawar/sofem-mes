import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

interface OF {
  id: number; numero: string; statut: string; priorite: string;
  produit_nom: string; client_nom: string; date_echeance: string;
}

const DAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

export default function CalendarPage() {
  const navigate = useNavigate();
  const { data } = useQuery<{ data: OF[] }>({
    queryKey: ['ofs-calendar'],
    queryFn: () => api.get('/api/of?limit=200').then(r => r.data),
  });

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const ofs = data?.data || [];
  // Group by date
  const byDate: Record<string, OF[]> = {};
  ofs.forEach(of => {
    if (!of.date_echeance) return;
    const d = of.date_echeance.split('T')[0];
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(of);
  });

  const getColor = (of: OF) => {
    if (of.statut === 'COMPLETED') return 'var(--green)';
    if (of.priorite === 'URGENT') return 'var(--red)';
    if (of.priorite === 'HIGH') return 'var(--accent)';
    return 'var(--blue)';
  };

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Monday-based week: getDay() 0=Sun -> convert to Mon=0
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const monthName = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">CALENDRIER</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1))} className="text-[var(--muted)] hover:text-[var(--text)] text-xl">&lt;</button>
          <span className="font-['Bebas_Neue'] text-xl tracking-wider capitalize">{monthName}</span>
          <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1))} className="text-[var(--muted)] hover:text-[var(--text)] text-xl">&gt;</button>
          <button onClick={() => setCurrentDate(new Date())} className="text-[10px] font-['IBM_Plex_Mono'] text-[var(--red)] border border-[var(--red)] rounded px-2 py-1">Aujourd'hui</button>
          <div className="flex gap-1 ml-3">
            <button onClick={() => setViewMode('month')} className={`text-[10px] font-['IBM_Plex_Mono'] border rounded px-2 py-1 ${viewMode === 'month' ? 'bg-[var(--red)] text-white border-[var(--red)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>Mois</button>
            <button onClick={() => setViewMode('week')} className={`text-[10px] font-['IBM_Plex_Mono'] border rounded px-2 py-1 ${viewMode === 'week' ? 'bg-[var(--red)] text-white border-[var(--red)]' : 'border-[var(--border)] text-[var(--muted)]'}`}>Semaine</button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--red)]"></span>Urgent</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--accent)]"></span>Haute</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--blue)]"></span>Normale</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--green)]"></span>Termine</span>
      </div>

      {viewMode === 'month' ? (
        <div className="grid grid-cols-7 gap-px bg-[var(--border)] rounded-lg overflow-hidden">
          {DAYS.map(d => <div key={d} className="bg-[var(--bg3)] text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase text-center py-2">{d}</div>)}
          {cells.map((day, i) => {
            if (!day) return <div key={i} className="bg-[var(--bg)] min-h-[80px]" />;
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayOFs = byDate[dateStr] || [];
            const isToday = dateStr === todayStr;
            return (
              <div
                key={i}
                className={`bg-[var(--bg2)] min-h-[80px] p-1 cursor-pointer transition-colors hover:bg-[var(--bg3)] ${isToday ? 'ring-2 ring-inset ring-[var(--red)] bg-[var(--red-g,#dc262610)]' : ''}`}
                onClick={() => dayOFs.length > 0 && navigate(`/admin#orders`)}
              >
                <span className={`text-[9px] font-['IBM_Plex_Mono'] ${isToday ? 'font-bold text-[var(--red)]' : 'text-[var(--muted)]'}`}>{day}</span>
                <div className="mt-0.5 space-y-0.5">
                  {dayOFs.slice(0, 3).map(of => (
                    <div key={of.id} className="text-[7px] font-['IBM_Plex_Mono'] truncate px-1 rounded-sm leading-tight"
                      style={{ backgroundColor: getColor(of) + '20', color: getColor(of), borderLeft: `2px solid ${getColor(of)}` }}>
                      {of.numero} {of.produit_nom}
                    </div>
                  ))}
                  {dayOFs.length > 3 && <span className="text-[7px] text-[var(--muted)]">+{dayOFs.length - 3} autres</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Week View */
        <div className="grid grid-cols-7 gap-2">
          {(() => {
            const weekStart = new Date(year, month, 1);
            const dayOfWeek = (weekStart.getDay() + 6) % 7;
            weekStart.setDate(weekStart.getDate() - dayOfWeek);
            const days = [];
            for (let i = 0; i < 7; i++) {
              const d = new Date(weekStart);
              d.setDate(weekStart.getDate() + i);
              days.push(d);
            }
            return days.map((d, i) => {
              const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              const dayOFs = byDate[dateStr] || [];
              const isToday = dateStr === todayStr;
              return (
                <div key={i} className={`bg-[var(--bg2)] border rounded-lg p-2 min-h-[200px] ${isToday ? 'border-[var(--red)]' : 'border-[var(--border)]'}`}>
                  <p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--muted)] uppercase mb-2">{DAYS[i]} {d.getDate()}</p>
                  <div className="space-y-1">
                    {dayOFs.map(of => (
                      <div key={of.id} className="text-[8px] font-['IBM_Plex_Mono'] p-1 rounded"
                        style={{ backgroundColor: getColor(of) + '20', color: getColor(of), borderLeft: `2px solid ${getColor(of)}` }}>
                        <p className="truncate">{of.numero}</p>
                        <p className="truncate opacity-70">{of.produit_nom}</p>
                      </div>
                    ))}
                    {dayOFs.length === 0 && <p className="text-[7px] text-[var(--muted)]">Aucun</p>}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}

