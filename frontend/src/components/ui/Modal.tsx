import { PropsWithChildren, useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function Modal({ open, onClose, title, width = 'max-w-lg', children, footer }: PropsWithChildren<ModalProps>) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className={`w-[95vw] ${width} bg-[var(--bg2,#141414)] border border-[var(--border,#2a2a2a)] rounded-2xl shadow-2xl overflow-hidden`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border,#2a2a2a)]">
            <h2 className="font-['Bebas_Neue'] text-xl tracking-[0.1em] text-[var(--text,#fff)]">{title}</h2>
            <button onClick={onClose} className="text-[var(--muted,#737373)] hover:text-[var(--text,#fff)] text-xl leading-none">&times;</button>
          </div>
        )}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-[var(--border,#2a2a2a)] flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
