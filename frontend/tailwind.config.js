/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        background: '#0B132B',
        primary: '#a855f7',
        'primary-container': 'rgba(168, 85, 247, 0.15)',
        'on-primary-container': '#c084fc',
        surface: {
          lowest: '#090e1b',
          low: '#0d1527',
          DEFAULT: '#121c35',
          high: '#182544',
          highest: '#1f3056',
          card: '#121c35',
          hover: '#1f3056',
        },
        accent: {
          DEFAULT: '#a855f7',
          light: '#c084fc',
        },
      },
    },
  },
  plugins: [],
}
