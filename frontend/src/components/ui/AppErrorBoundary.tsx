import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Unknown runtime error',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App runtime error:', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[var(--bg,#0a0a0a)] text-[var(--text,#fafafa)] flex items-center justify-center p-6">
        <div className="max-w-2xl w-full rounded-xl border border-[var(--border,#2a2a2a)] bg-[var(--bg2,#141414)] p-5">
          <h1 className="font-['Bebas_Neue'] text-2xl tracking-wider text-[var(--red,#ef4444)]">Application Error</h1>
          <p className="mt-2 text-sm text-[var(--muted,#a3a3a3)] font-['IBM_Plex_Mono']">A runtime error occurred while rendering this page.</p>
          <pre className="mt-4 text-xs text-[var(--text,#fafafa)] whitespace-pre-wrap break-words font-['IBM_Plex_Mono']">{this.state.message}</pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded bg-[var(--red,#ef4444)] text-white text-xs font-['IBM_Plex_Mono']"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}