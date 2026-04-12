import { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import clsx from 'clsx';

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export default function Button({ variant = 'primary', size = 'md', className, children, ...props }: PropsWithChildren<BtnProps>) {
  const base = 'inline-flex items-center justify-center font-["IBM_Plex_Mono"] font-semibold rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-1.5 text-[10px]', md: 'px-4 py-2 text-[11px]', lg: 'px-6 py-3 text-[12px]' };
  const variants = {
    primary: 'bg-[var(--red,#dc2626)] text-white hover:bg-[var(--red-d,#b91c1c)] shadow-[0_0_12px_var(--red-g,#dc262630)]',
    secondary: 'bg-[var(--bg3,#1a1a1a)] text-[var(--text,#fff)] border border-[var(--border,#2a2a2a)] hover:border-[var(--red,#dc2626)]',
    ghost: 'text-[var(--muted,#737373)] hover:text-[var(--text,#fff)] hover:bg-[var(--bg3,#1a1a1a)]',
    danger: 'bg-red-900/60 text-red-300 border border-red-800 hover:bg-red-900',
  };

  return (
    <button className={clsx(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  );
}
