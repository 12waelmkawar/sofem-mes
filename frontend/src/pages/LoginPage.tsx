import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

declare global {
  interface ImportMeta {
    env: Record<string, string>;
  }
}

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

function resolveApiBase(): string {
  if ((window as any).SOFEM_API_URL) {
    return (window as any).SOFEM_API_URL.replace(/\/+$/, '');
  }
  const stored = localStorage.getItem('SOFEM_API_URL');
  if (stored) return stored.replace(/\/+$/, '');
  const { hostname, port, protocol } = window.location;
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && port && parseInt(port) !== 8000) {
    return `${protocol}//${hostname}:8000`;
  }
  return `${protocol}//${hostname}${port ? ':' + port : ''}`;
}

api.defaults.baseURL = resolveApiBase();

type LoginResponse = {
  role: string;
  nom: string;
  prenom: string;
  operateur_id: number | null;
  requires_2fa?: boolean;
  locked?: boolean;
  retry_after_seconds?: number;
  pin_must_change?: boolean;
};

type NumPadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'back';

export default function LoginPage() {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [lockout, setLockout] = useState<{ seconds: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockout) {
      intervalRef.current = setInterval(() => {
        setLockout(prev => {
          if (!prev || prev.seconds <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return null;
          }
          return { seconds: prev.seconds - 1 };
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [lockout]);

  const handleKey = useCallback((key: NumPadKey) => {
    if (lockout || loading) return;
    setError('');

    if (key === 'back') {
      setPin(prev => prev.slice(0, -1));
      return;
    }

    setPin(prev => {
      if (prev.length >= 8) return prev;
      const next = prev + key;
      // Auto-submit on 4+ digits
      if (next.length >= 4) {
        setTimeout(() => handleLogin(next), 300);
      }
      return next;
    });
  }, [lockout, loading]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lockout || loading) return;
      if (e.key >= '0' && e.key <= '9') {
        handleKey(e.key as NumPadKey);
      } else if (e.key === 'Backspace') {
        handleKey('back');
      } else if (e.key === 'Enter' && pin.length >= 4) {
        handleLogin(pin);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, lockout, loading, handleKey]);

  const handleLogin = async (pinValue?: string) => {
    const pinToUse = pinValue || pin;
    if (pinToUse.length < 4 || loading || lockout) return;

    setLoading(true);
    setError('');

    try {
      const res = await api.post<LoginResponse>('/api/auth/login', { pin: pinToUse });

      if (res.data.locked) {
        setLockout({ seconds: res.data.retry_after_seconds || 30 });
        setPin('');
        setLoading(false);
        return;
      }

      // Redirect by role
      const role = res.data.role;
      if (role === 'ADMIN' || role === 'MANAGER') {
        navigate('/admin');
      } else {
        navigate('/operator');
      }
    } catch (err: any) {
      if (err.response?.status === 429) {
        const retryAfter = err.response.data?.retry_after_seconds || 30;
        setLockout({ seconds: retryAfter });
        setError(`Trop de tentatives. Réessayez dans ${retryAfter}s`);
      } else if (err.response?.status === 401) {
        setError('PIN incorrect');
        triggerShake();
      } else if (err.response?.data?.error?.message?.includes('HTML')) {
        setError('API non joignable: HTML reçu au lieu de JSON');
      } else {
        setError('Erreur de connexion');
        triggerShake();
      }
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  const isReady = pin.length >= 4 && !lockout;

  const keys: (NumPadKey | null)[] = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    null, '0', 'back',
  ];

  return (
    <div className="min-h-screen bg-[var(--bg,#0a0a0a)] flex items-center justify-center p-4">
      <div
        className={`w-[340px] rounded-2xl border border-neutral-800 bg-[var(--bg2,#141414)] p-10 shadow-2xl overflow-hidden relative ${shaking ? 'animate-shake' : ''}`}
        style={{ borderTop: '3px solid var(--red,#dc2626)' }}
      >
        {/* Stripe pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, #fff 10px, #fff 11px)',
          }}
        />

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 relative z-10">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--red,#dc2626)' }}
          >
            <span className="text-[var(--text,#fff)] font-['Bebas_Neue'] text-3xl">S</span>
          </div>
          <div>
            <h1 className="font-['Bebas_Neue'] text-3xl tracking-[0.15em] text-[var(--text,#fff)]">
              SOFEM
            </h1>
            <p className="text-[9px] font-['IBM_Plex_Mono'] text-[var(--red,#dc2626)] tracking-wider uppercase">
              MES v2.0 - Manufacturing Execution System
            </p>
          </div>
        </div>

        {/* PIN Dots */}
        <div className="mb-4 relative z-10">
          <p className="text-[8px] font-['IBM_Plex_Mono'] text-neutral-500 uppercase tracking-wider mb-3">
            Entrez votre code PIN
          </p>
          <div className="flex gap-3 justify-center">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className="w-4 h-4 rounded-full border-2 border-neutral-700 transition-all duration-200"
                style={
                  pin[i]
                    ? {
                        backgroundColor: 'var(--red,#dc2626)',
                        borderColor: 'var(--red,#dc2626)',
                        transform: 'scale(1.1)',
                      }
                    : {}
                }
              />
            ))}
          </div>
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2 mb-4 relative z-10">
          {keys.map((key, i) => (
            <div key={i}>
              {key ? (
                <button
                  onClick={() => handleKey(key)}
                  disabled={!!lockout || loading}
                  className="w-full h-14 rounded-lg font-['Bebas_Neue'] text-[22px] tracking-wider text-[var(--text,#fff)] transition-all duration-150 hover:bg-[var(--red-g,#dc262620)] hover:shadow-[0_0_12px_var(--red-g,#dc262640)] disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'transparent' }}
                >
                  {key === 'back' ? (
                    <svg className="w-6 h-6 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l7-7 11 0 0 14-11 0-7-7z" />
                    </svg>
                  ) : (
                    key
                  )}
                </button>
              ) : (
                <div />
              )}
            </div>
          ))}
        </div>

        {/* Login Button */}
        <button
          onClick={() => handleLogin()}
          disabled={!isReady}
          className={`w-full py-3 rounded-lg font-['IBM_Plex_Mono'] text-[11px] tracking-[0.15em] uppercase transition-all duration-200 ${
            isReady
              ? 'bg-[var(--red,#dc2626)] text-white hover:bg-[var(--red-d,#b91c1c)] shadow-[0_0_20px_var(--red-g,#dc262630)]'
              : 'bg-neutral-800 text-neutral-600 opacity-40 cursor-not-allowed'
          }`}
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>

        {/* Error */}
        {error && (
          <p className="mt-3 text-[10px] font-['IBM_Plex_Mono'] text-[var(--red,#dc2626)] text-center">
            {error}
          </p>
        )}

        {/* Lockout */}
        {lockout && (
          <p className="mt-3 text-[10px] font-['IBM_Plex_Mono'] text-orange-400 text-center">
            Trop de tentatives. Réessayez dans {Math.floor(lockout.seconds / 60)}:{(lockout.seconds % 60).toString().padStart(2, '0')}
          </p>
        )}

        {/* Footer */}
        <p className="mt-6 text-[9px] font-['IBM_Plex_Mono'] text-neutral-600 text-center relative z-10">
          SMARTMOVE - Mahmoud Njeh - © 2026
        </p>
      </div>
    </div>
  );
}
