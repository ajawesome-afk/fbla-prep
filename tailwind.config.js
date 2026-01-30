/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fbla: {
          blue: '#003366',
          gold: '#FFD700',
        }
      }
    },
  },
  plugins: [],
}