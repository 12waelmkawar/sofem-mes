import { create } from 'zustand';
import { api } from '../lib/api';

export interface User {
  userId: number;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR';
  nom: string;
  prenom: string;
  operateur_id: number | null;
  pin_must_change?: boolean;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  loaded: boolean;
  fetchUser: () => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: () => boolean;
  isManager: () => boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  loaded: false,

  fetchUser: async () => {
    try {
      const res = await api.get<User>('/api/auth/me');
      set({ user: res.data, loading: false, loaded: true });
    } catch {
      set({ user: null, loading: false, loaded: false });
    }
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch { /* ignore */ }
    window._loggingOut = true;
    set({ user: null, loading: false, loaded: false });
    window.location.href = '/login';
  },

  isAdmin: () => get().user?.role === 'ADMIN',
  isManager: () => get().user?.role === 'MANAGER' || get().user?.role === 'ADMIN',
}));
