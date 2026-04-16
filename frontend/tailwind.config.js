/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0a7ea4',
        secondary: '#00D4AA',
        dark: '#0f172a',
        light: '#f8fafc',
      },
    },
  },
  plugins: [],
}
