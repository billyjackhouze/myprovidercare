/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // PreAuthPro design system — exact hex values from live screenshot
        navy: {
          DEFAULT: '#1B2D4E',
          light: '#243d68',
        },
        primary: {
          DEFAULT: '#2563EB',
          hover: '#1d4ed8',
        },
        teal: { DEFAULT: '#0D9488' },
        green: { DEFAULT: '#10B981' },
        amber: { DEFAULT: '#F59E0B' },
        orange: { DEFAULT: '#F97316' },
        purple: { DEFAULT: '#7C3AED' },
        danger: { DEFAULT: '#EF4444' },
        // Layout
        page: '#F1F5F9',
        card: '#FFFFFF',
        border: '#E2E8F0',
        muted: '#64748B',
        heading: '#0F172A',
        'nav-inactive': '#94A3B8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'stat': ['28px', { fontWeight: '500' }],
        'label-sm': ['11px', { letterSpacing: '0.06em' }],
      },
      borderRadius: {
        card: '6px',
      },
    },
  },
  plugins: [],
}
