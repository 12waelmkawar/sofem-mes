import clsx from 'clsx';

interface BadgeProps {
  label: string;
  color?: 'red' | 'green' | 'blue' | 'orange' | 'muted';
  variant?: 'filled' | 'outlined' | 'soft';
  className?: string;
}

const colors = {
  red: {
    filled: 'bg-[var(--red,#dc2626)] text-white',
    outlined: 'border border-[var(--red,#dc2626)] text-[var(--red,#dc2626)]',
    soft: 'bg-[var(--red,#dc2626)]/15 text-[var(--red,#dc2626)]',
  },
  green: {
    filled: 'bg-[var(--green,#22c55e)] text-white',
    outlined: 'border border-[var(--green,#22c55e)] text-[var(--green,#22c55e)]',
    soft: 'bg-[var(--green,#22c55e)]/15 text-[var(--green,#22c55e)]',
  },
  blue: {
    filled: 'bg-[var(--blue,#3b82f6)] text-white',
    outlined: 'border border-[var(--blue,#3b82f6)] text-[var(--blue,#3b82f6)]',
    soft: 'bg-[var(--blue,#3b82f6)]/15 text-[var(--blue,#3b82f6)]',
  },
  orange: {
    filled: 'bg-[var(--accent,#f97316)] text-white',
    outlined: 'border border-[var(--accent,#f97316)] text-[var(--accent,#f97316)]',
    soft: 'bg-[var(--accent,#f97316)]/15 text-[var(--accent,#f97316)]',
  },
  muted: {
    filled: 'bg-[var(--muted,#737373)] text-white',
    outlined: 'border border-[var(--muted,#737373)] text-[var(--muted,#737373)]',
    soft: 'bg-[var(--muted,#737373)]/15 text-[var(--muted,#737373)]',
  },
};

export default function Badge({ label, color = 'muted', variant = 'soft', className }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-["IBM_Plex_Mono"] font-semibold uppercase tracking-[0.08em]',
      colors[color][variant],
      className
    )}>
      {label}
    </span>
  );
}
