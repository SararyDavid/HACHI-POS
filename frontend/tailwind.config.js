/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'var(--brand-50, #F0F9FF)',
          100: 'var(--brand-100, #E0F2FE)',
          500: 'var(--brand-500, #0EA5E9)',
          600: 'var(--brand-600, #0284C7)',
        },
        surface: 'var(--surface, #FFFFFF)',
        canvas: 'var(--bg, #F8FAFC)',
        border: 'var(--border, #E2E8F0)',
        txt: {
          900: 'var(--text-900, #0F172A)',
          600: 'var(--text-600, #475569)',
          400: 'var(--text-400, #94A3B8)',
        },
        danger: {
          50: 'var(--danger-50, #FEF2F2)',
          600: 'var(--danger-600, #DC2626)',
        },
        warning: {
          50: 'var(--warning-50, #FFFBEB)',
          600: 'var(--warning-600, #D97706)',
        },
        success: {
          50: 'var(--success-50, #F0FDF4)',
          600: 'var(--success-600, #16A34A)',
        },
        slate: {
          850: '#151f30',
        }
      },
      borderRadius: {
        'card': 'var(--radius-card, 12px)',
        'btn': 'var(--radius-btn, 10px)',
        'pill': 'var(--radius-pill, 9999px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'soft': 'var(--shadow-soft, 0 1px 2px rgba(15,23,42,.06), 0 4px 12px rgba(15,23,42,.04))',
        'soft-hover': 'var(--shadow-soft-hover, 0 4px 12px rgba(15,23,42,.08), 0 1px 3px rgba(15,23,42,.06))',
        'brand-glow': '0 0 0 4px rgba(14, 165, 233, 0.10)',
        'card': '0 1px 2px rgba(15,23,42,.06), 0 4px 12px rgba(15,23,42,.04)',
        'modal': '0 20px 40px -10px rgba(15, 23, 42, 0.16)',
      }
    },
  },
  plugins: [],
}
