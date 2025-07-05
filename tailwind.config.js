/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        'manrope': ['Manrope', 'sans-serif'],
      },
      colors: {
        'stock-dark': '#162013',
        'stock-green': '#50d22c',
        'stock-secondary': '#2e4328',
        'stock-border': '#416039',
        'stock-card': '#21301c',
        'stock-muted': '#a1c398',
      },
    },
  },
  plugins: [],
};