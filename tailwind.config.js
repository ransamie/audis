/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './src/index.html',
  ],
  theme: {
    extend: {
      colors: {
        // Studio Cobalt accent — flat, high-contrast DAW control palette
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        // Matte graphite workstation surfaces (zero purple tint, zero glare)
        surface: {
          base:  '#141619',
          card:  '#1b1e23',
          muted: '#22262d',
          hover: '#2a2f38',
        },
        // Studio signal & status tones
        accent: {
          cyan:    '#38bdf8',
          emerald: '#2ec492',
          green:   '#22c55e',
          amber:   '#f59e0b',
          red:     '#ef4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
