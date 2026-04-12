import axios from 'axios';

function resolveApiBase(): string {
  if ((window as any).SOFEM_API_URL) return (window as any).SOFEM_API_URL.replace(/\/+$/, '');
  const stored = localStorage.getItem('SOFEM_API_URL');
  if (stored) return stored.replace(/\/+$/, '');
  const { hostname, port, protocol } = window.location;
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && port && parseInt(port) !== 8000) {
    return `${protocol}//${hostname}:8000`;
  }
  return `${protocol}//${hostname}${port ? ':' + port : ''}`;
}

export const api = axios.create({
  baseURL: resolveApiBase(),
  withCredentials: true,
});

// Silent API (for polling — no logout on 401)
export const apiSilent = axios.create({
  baseURL: resolveApiBase(),
  withCredentials: true,
});
apiSilent.interceptors.response.use(
  (res) => res,
  () => null
);

// Standard API — 401 redirects to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window._loggingOut) {
      window._loggingOut = true;
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

declare global {
  interface Window {
    _loggingOut?: boolean;
    SOFEM_API_URL?: string;
  }
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { total: number; limit: number; offset: number; has_more: boolean };
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: { field: string; issue: string }[];
  };
}
