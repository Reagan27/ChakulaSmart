/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: '#166534', 50: '#F0FDF4', 100: '#DCFCE7', 200: '#BBF7D0', 300: '#86EFAC', 400: '#4ADE80', 500: '#22C55E', 600: '#16A34A', 700: '#166534', 800: '#14532D', 900: '#0F3D22' },
        cream: '#FFFBF5',
        ink: '#1F2937',
        sun: { DEFAULT: '#F59E0B', 100: '#FEF3C7', 600: '#D97706' },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(22,101,52,0.05), 0 8px 24px -8px rgba(22,101,52,0.12)',
        lift: '0 2px 4px rgba(22,101,52,0.06), 0 20px 40px -12px rgba(22,101,52,0.22)',
      },
      keyframes: {
        rise: { '0%': { opacity: 0, transform: 'translateY(14px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        floaty: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      },
      animation: { rise: 'rise .6s ease-out both', floaty: 'floaty 6s ease-in-out infinite' },
    },
  },
  plugins: [],
}
