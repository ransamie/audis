/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './src/index.html'
  ],
  theme: {
    extend: {
      colors: {
        // Brand palette — deep navy + electric violet
        brand: {
          50:  '#f0eeff',
          100: '#ddd9ff',
          200: '#c0b7ff',
          300: '#9d8aff',
          400: '#7c5cff',
          500: '#6030ff',  // primary
          600: '#5020ef',
          700: '#4010cf',
          800: '#3008a0',
          900: '#200060',
          950: '#110030',
        },
        surface: {
          base:  '#0d0d14',
          card:  '#141420',
          muted: '#1c1c2e',
          hover: '#22223a',
        },
        accent: {
          cyan:    '#00e5ff',
          magenta: '#ff2dff',
          green:   '#00ffb0',
          orange:  '#ff7c00',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow':    'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'glow':          'glow 2s ease-in-out infinite alternate',
        'slide-up':      'slideUp 0.4s ease-out',
        'fade-in':       'fadeIn 0.3s ease-out',
        'spin-slow':     'spin 3s linear infinite',
        'progress-bar':  'progressBar 0.3s ease-out',
      },
      keyframes: {
        glow: {
          '0%':   { boxShadow: '0 0 5px #6030ff44, 0 0 10px #6030ff22' },
          '100%': { boxShadow: '0 0 20px #6030ff88, 0 0 40px #6030ff44' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        progressBar: {
          '0%':   { width: '0%' },
          '100%': { width: '100%' },
        }
      },
      backgroundImage: {
        'gradient-radial':    'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand':     'linear-gradient(135deg, #6030ff, #00e5ff)',
        'gradient-dark':      'linear-gradient(180deg, #0d0d14 0%, #141420 100%)',
        'gradient-card':      'linear-gradient(145deg, #1c1c2e, #141420)',
        'noise':              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
      },
      borderColor: {
        'brand-glow': '#6030ff66',
      },
      dropShadow: {
        'brand': '0 0 16px #6030ff88',
        'cyan':  '0 0 12px #00e5ff88',
      }
    },
  },
  plugins: [],
}
