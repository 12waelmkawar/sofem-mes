/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary brand color (section 3.1)
        red: {
          DEFAULT: 'var(--red)',
          d: 'var(--red-d)',
          g: 'var(--red-g)',
        },
        // Background hierarchy
        bg: {
          DEFAULT: 'var(--bg)',
          2: 'var(--bg2)',
          3: 'var(--bg3)',
        },
        // Status colors (section 3.3)
        green: 'var(--green)',
        blue: 'var(--blue)',
        accent: 'var(--accent)',
        orange: 'var(--accent)',
        muted: 'var(--muted)',
      },
      fontFamily: {
        // Typography system (section 2.2)
        bebas: ["'Bebas Neue', sans-serif"],
        mono: ["'IBM Plex Mono', monospace"],
        sans: ["'IBM Plex Sans', sans-serif"],
      },
      fontSize: {
        // Key sizes from spec
        'kpi': ['36px', { lineHeight: '1.2', letterSpacing: '0.05em' }],
        'page-header': ['28px', { lineHeight: '1.3', letterSpacing: '0.02em' }],
        'table': ['12px', { lineHeight: '1.4' }],
        'badge': ['9px', { lineHeight: '1.4', letterSpacing: '0.05em' }],
        'form-label': ['8px', { lineHeight: '1.4', letterSpacing: '0.1em' }],
        'numpad': ['22px', { lineHeight: '1.2', letterSpacing: '0.02em' }],
        'clock': ['10px', { lineHeight: '1.4', letterSpacing: '0.05em' }],
      },
      letterSpacing: {
        'tight': '0.02em',
        'normal': '0.05em',
        'wide': '0.1em',
        'wider': '0.15em',
        'widest': '0.2em',
      },
      zIndex: {
        '100': '100',
        '200': '200',
        '300': '300',
        '400': '400',
        '500': '500',
      },
      animation: {
        'blink': 'blink 1s ease-in-out infinite',
        'shake': 'shake 0.5s ease-in-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px var(--red)' },
          '50%': { boxShadow: '0 0 20px var(--red)' },
        },
      },
    },
  },
  plugins: [],
};
