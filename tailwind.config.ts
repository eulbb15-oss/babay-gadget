import type { Config } from 'tailwindcss';

/**
 * Palet DIKUNCI monokrom: hanya hitam, putih, dan abu netral.
 * Karena `theme.colors` (bukan `extend`) diganti, kelas warna seperti bg-red-500 tidak ada sama sekali.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      black: '#000000',
      white: '#ffffff',
      abu: { 100: '#f2f2f2', 200: '#e3e3e3', 300: '#c9c9c9', 500: '#6b6b6b', 700: '#333333' },
    },
    fontFamily: {
      sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
    },
    extend: {},
  },
  plugins: [],
};

export default config;
