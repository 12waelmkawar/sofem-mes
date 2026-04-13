import { PropsWithChildren, useEffect, useRef, useState } from 'react';

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
  const [visible, setVisible] = useState(open);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
    } else if (visible) {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [open, visible]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-200 ${
        animating ? 'bg-black/60 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-none'
      }`}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`w-[95vw] ${width} bg-[var(--bg2,#141414)] border border-[var(--border,#2a2a2a)] rounded-2xl shadow-2xl overflow-hidden transition-all duration-200 ${
          animating ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border,#2a2a2a)]">
            <h2 className="font-['Bebas_Neue'] text-xl tracking-[0.1em] text-[var(--text,#fff)]">{title}</h2>
            <button onClick={onClose} className="text-[var(--muted,#737373)] hover:text-[var(--text,#fff)] hover:bg-[var(--bg3)] rounded-lg p-1.5 transition-colors text-xl leading-none">&times;</button>
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
