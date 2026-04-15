import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/authStore';
import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000',
  withCredentials: true,
});

interface Operation {
  id: number;
  of_id: number;
  of_numero: string;
  produit_nom: string;
  operation_type: string;
  machine_nom: string;
  statut: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  ordre: number;
  temps_estime: number;
  temps_reel?: number;
}

interface OF {
  id: number;
  numero: string;
  produit_nom: string;
  quantite: number;
  statut: string;
  priorite: string;
  client_nom: string;
}

export default function OperatorDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [operations, setOperations] = useState<Operation[]>([]);
  const [assignedOFs, setAssignedOFs] = useState<OF[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(null);
  const [completionPin, setCompletionPin] = useState('');
  const [completionError, setCompletionError] = useState('');
  const [completionLoading, setCompletionLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Get operations assigned to this operator
      const opsRes = await api.get('/api/of/operations/my-operations');
      setOperations(opsRes.data || []);
      
      // Get OFs assigned to this operator
      const ofsRes = await api.get('/api/of/my-ofs');
      setAssignedOFs(ofsRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOperation = async () => {
    if (!selectedOperation || completionPin.length !== 4) return;
    
    setCompletionLoading(true);
    setCompletionError('');
    
    try {
      await api.post('/api/of/operations/complete', {
        operation_id: selectedOperation.id,
        pin: completionPin,
        temps_reel: selectedOperation.temps_estime // Simplified - in real app would track actual time
      });
      
      setShowCompleteModal(false);
      setCompletionPin('');
      setSelectedOperation(null);
      fetchData(); // Refresh data
    } catch (err: any) {
      if (err.response?.status === 401) {
        setCompletionError('PIN incorrect');
      } else {
        setCompletionError('Erreur lors de la validation');
      }
    } finally {
      setCompletionLoading(false);
    }
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case 'COMPLETED': return 'bg-green-500';
      case 'IN_PROGRESS': return 'bg-orange-500 animate-pulse';
      case 'PENDING': return 'bg-red-900/50';
      default: return 'bg-neutral-700';
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case 'COMPLETED': return 'Terminée';
      case 'IN_PROGRESS': return 'En cours';
      case 'PENDING': return 'En attente';
      default: return statut;
    }
  };

  const getPriorityColor = (priorite: string) => {
    switch (priorite) {
      case 'URGENT': return 'text-red-500';
      case 'HAUTE': return 'text-orange-500';
      case 'NORMAL': return 'text-blue-400';
      default: return 'text-neutral-400';
    }
  };

  const openCompleteModal = (op: Operation) => {
    setSelectedOperation(op);
    setCompletionPin('');
    setCompletionError('');
    setShowCompleteModal(true);
  };

  const handlePinKey = (key: string) => {
    if (key === 'back') {
      setCompletionPin(prev => prev.slice(0, -1));
    } else if (completionPin.length < 4) {
      setCompletionPin(prev => prev + key);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg,#0a0a0a)] flex items-center justify-center">
        <div className="text-[var(--muted)] font-['IBM_Plex_Mono']">Chargement...</div>
      </div>
    );
  }

  const inProgressOps = operations.filter(op => op.statut === 'IN_PROGRESS');
  const pendingOps = operations.filter(op => op.statut === 'PENDING');
  const completedOps = operations.filter(op => op.statut === 'COMPLETED');

  return (
    <div className="min-h-screen bg-[var(--bg,#0a0a0a)] text-[var(--text,#fff)]">
      {/* Top Bar */}
      <header className="h-14 bg-[var(--bg2,#141414)] border-b border-[var(--border,#262626)] flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[var(--red,#dc2626)] flex items-center justify-center">
            <span className="font-['Bebas_Neue'] text-lg">S</span>
          </div>
          <span className="font-['Bebas_Neue'] text-xl tracking-wider">SOFEM</span>
          <span className="text-[10px] text-[var(--muted)] font-['IBM_Plex_Mono'] ml-2">OPERATOR</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[11px] font-['IBM_Plex_Mono'] text-[var(--text)]">
              {currentTime.toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[9px] text-[var(--muted)] font-['IBM_Plex_Mono']">
              {currentTime.toLocaleDateString('fr-TN')}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[var(--red,#dc2626)]/20 flex items-center justify-center">
              <span className="text-[11px] font-['IBM_Plex_Mono']">
                {user?.prenom?.[0]}{user?.nom?.[0]}
              </span>
            </div>
            <button 
              onClick={logout}
              className="text-[9px] text-[var(--muted)] hover:text-[var(--red)] font-['IBM_Plex_Mono']"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="font-['Bebas_Neue'] text-[28px] tracking-[0.15em]">
            BONJOUR, {user?.prenom?.toUpperCase()}
          </h1>
          <p className="text-[11px] text-[var(--muted)] font-['IBM_Plex_Mono']">
            Voici vos opérations assignées pour aujourd'hui
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[var(--bg2,#141414)] border border-[var(--border,#262626)] rounded-xl p-4">
            <p className="text-[9px] text-[var(--muted)] font-['IBM_Plex_Mono'] uppercase">En Cours</p>
            <p className="font-['Bebas_Neue'] text-[36px] text-orange-500">{inProgressOps.length}</p>
          </div>
          <div className="bg-[var(--bg2,#141414)] border border-[var(--border,#262626)] rounded-xl p-4">
            <p className="text-[9px] text-[var(--muted)] font-['IBM_Plex_Mono'] uppercase">En Attente</p>
            <p className="font-['Bebas_Neue'] text-[36px] text-[var(--red)]">{pendingOps.length}</p>
          </div>
          <div className="bg-[var(--bg2,#141414)] border border-[var(--border,#262626)] rounded-xl p-4">
            <p className="text-[9px] text-[var(--muted)] font-['IBM_Plex_Mono'] uppercase">Terminées</p>
            <p className="font-['Bebas_Neue'] text-[36px] text-green-500">{completedOps.length}</p>
          </div>
        </div>

        {/* Current Operations */}
        <div className="mb-6">
          <h2 className="font-['Bebas_Neue'] text-[20px] tracking-wider mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            OPÉRATIONS EN COURS
          </h2>
          
          {inProgressOps.length === 0 ? (
            <div className="bg-[var(--bg2,#141414)] border border-[var(--border,#262626)] rounded-xl p-8 text-center">
              <p className="text-[var(--muted)] font-['IBM_Plex_Mono'] text-sm">Aucune opération en cours</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inProgressOps.map(op => (
                <div key={op.id} className="bg-[var(--bg2,#141414)] border border-[var(--border,#262626)] rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-['Bebas_Neue'] text-[18px]">{op.of_numero}</span>
                        <span className="text-[9px] text-[var(--muted)] font-['IBM_Plex_Mono']">|</span>
                        <span className="text-[11px] text-[var(--muted)] font-['IBM_Plex_Mono']">{op.produit_nom}</span>
                      </div>
                      <p className="text-[13px] font-['IBM_Plex_Sans']">{op.operation_type}</p>
                      <div className="flex items-center gap-4 mt-2 text-[9px] text-[var(--muted)] font-['IBM_Plex_Mono']">
                        <span>Machine: {op.machine_nom}</span>
                        <span>Temps estimé: {op.temps_estime} min</span>
                      </div>
                    </div>
                    <button
                      onClick={() => openCompleteModal(op)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-[10px] font-['IBM_Plex_Mono'] uppercase tracking-wider transition-colors"
                    >
                      Terminer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Operations */}
        {pendingOps.length > 0 && (
          <div className="mb-6">
            <h2 className="font-['Bebas_Neue'] text-[20px] tracking-wider mb-4 text-[var(--muted)]">
              OPÉRATIONS EN ATTENTE
            </h2>
            <div className="space-y-3">
              {pendingOps.map(op => (
                <div key={op.id} className="bg-[var(--bg2,#141414)] border border-[var(--border,#262626)] rounded-xl p-4 opacity-70">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-['Bebas_Neue'] text-[18px]">{op.of_numero}</span>
                        <span className="text-[9px] text-[var(--muted)] font-['IBM_Plex_Mono']">|</span>
                        <span className="text-[11px] text-[var(--muted)] font-['IBM_Plex_Mono']">{op.produit_nom}</span>
                      </div>
                      <p className="text-[13px] font-['IBM_Plex_Sans']">{op.operation_type}</p>
                      <div className="flex items-center gap-4 mt-2 text-[9px] text-[var(--muted)] font-['IBM_Plex_Mono']">
                        <span>Machine: {op.machine_nom}</span>
                        <span>Ordre: {op.ordre}</span>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-red-900/50 rounded text-[9px] font-['IBM_Plex_Mono']">
                      En attente
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assigned OFs */}
        {assignedOFs.length > 0 && (
          <div>
            <h2 className="font-['Bebas_Neue'] text-[20px] tracking-wider mb-4">
              ORDRES DE FABRICATION ASSIGNÉS
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {assignedOFs.map(of => (
                <div key={of.id} className="bg-[var(--bg2,#141414)] border border-[var(--border,#262626)] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-['Bebas_Neue'] text-[16px]">{of.numero}</span>
                    <span className={`text-[9px] font-['IBM_Plex_Mono'] ${getPriorityColor(of.priorite)}`}>
                      {of.priorite}
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--muted)] font-['IBM_Plex_Sans'] mb-2">{of.produit_nom}</p>
                  <div className="flex items-center gap-4 text-[9px] text-[var(--muted)] font-['IBM_Plex_Mono']">
                    <span>Qté: {of.quantite}</span>
                    <span>Client: {of.client_nom}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Complete Operation Modal */}
      {showCompleteModal && selectedOperation && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg2,#141414)] border border-[var(--border,#262626)] rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-['Bebas_Neue'] text-[24px] tracking-wider mb-2">TERMINER L'OPÉRATION</h3>
            <p className="text-[11px] text-[var(--muted)] font-['IBM_Plex_Mono'] mb-6">
              {selectedOperation.operation_type} — {selectedOperation.of_numero}
            </p>
            
            <p className="text-[9px] text-[var(--muted)] font-['IBM_Plex_Mono'] uppercase mb-3">
              Entrez votre PIN pour confirmer
            </p>
            
            {/* PIN Display */}
            <div className="flex gap-3 justify-center mb-6">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className="w-4 h-4 rounded-full border-2 border-neutral-700"
                  style={completionPin[i] ? { backgroundColor: 'var(--red)', borderColor: 'var(--red)' } : {}}
                />
              ))}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((key, i) => (
                <div key={i}>
                  {key && (
                    <button
                      onClick={() => handlePinKey(key)}
                      className="w-full h-12 rounded-lg font-['Bebas_Neue'] text-[18px] hover:bg-[var(--red-g)] transition-colors"
                      disabled={completionLoading}
                    >
                      {key === 'back' ? '←' : key}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {completionError && (
              <p className="text-[10px] text-[var(--red)] font-['IBM_Plex_Mono'] text-center mb-4">
                {completionError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowCompleteModal(false)}
                className="flex-1 py-3 rounded-lg border border-[var(--border)] text-[10px] font-['IBM_Plex_Mono'] uppercase"
                disabled={completionLoading}
              >
                Annuler
              </button>
              <button
                onClick={handleCompleteOperation}
                disabled={completionPin.length !== 4 || completionLoading}
                className="flex-1 py-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-40 text-[10px] font-['IBM_Plex_Mono'] uppercase"
              >
                {completionLoading ? 'Validation...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
