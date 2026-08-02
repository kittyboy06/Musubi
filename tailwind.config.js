/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        obsidian: {
          bg: '#161618',
          surface: '#202024',
          border: '#2e2e34',
          input: '#27272c',
          accent: '#7c3aed',
        },
      },
    },
  },
  plugins: [],
};
