import { useState, useEffect } from 'react';
import clsx from 'clsx';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

const toasts: ToastItem[] = [];
let listeners: (() => void)[] = [];

function notify(message: string, type: ToastItem['type'] = 'info', duration = 3500) {
  const id = Date.now();
  toasts.push({ id, message, type });
  listeners.forEach(l => l());
  setTimeout(() => {
    const idx = toasts.findIndex(t => t.id === id);
    if (idx > -1) toasts.splice(idx, 1);
    listeners.forEach(l => l());
  }, duration);
}

export const toast = {
  success: (m: string, d?: number) => notify(m, 'success', d),
  error: (m: string, d?: number) => notify(m, 'error', d),
  warning: (m: string, d?: number) => notify(m, 'warning', d),
  info: (m: string, d?: number) => notify(m, 'info', d),
};

function ToastContainer() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick(t => t + 1);
    listeners.push(l);
    return () => { listeners = listeners.filter(x => x !== l); };
  }, []);

  const typeStyles = {
    success: 'border-l-[var(--green,#22c55e)] text-[var(--green,#22c55e)]',
    error: 'border-l-[var(--red,#dc2626)] text-[var(--red,#dc2626)]',
    warning: 'border-l-[var(--accent,#f97316)] text-[var(--accent,#f97316)]',
    info: 'border-l-[var(--blue,#3b82f6)] text-[var(--blue,#3b82f6)]',
  };

  return (
    <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-2 max-w-sm">
      {toasts.map(t => (
        <div
          key={t.id}
          className={clsx(
            'bg-[var(--bg2,#141414)] border border-[var(--border,#2a2a2a)] border-l-4 rounded-lg px-4 py-3 text-sm font-["IBM_Plex_Mono"] shadow-xl',
            typeStyles[t.type]
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

export default ToastContainer;
