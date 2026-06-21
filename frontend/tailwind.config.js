/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0f172a',
          card: '#1e293b',
          hover: '#334155',
        },
        accent: {
          DEFAULT: '#6366f1',
          light: '#818cf8',
        },
      },
    },
  },
  plugins: [],
}
