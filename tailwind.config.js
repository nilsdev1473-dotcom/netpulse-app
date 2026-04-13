/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#080809",
        surface: "#0F0F12",
        "surface-raised": "#161619",
        cyan: "#00E5FF",
        success: "#00FF87",
        warning: "#FFAA00",
        danger: "#FF4455",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Courier New", "monospace"],
      },
      borderColor: {
        netpulse: "rgba(255,255,255,0.07)",
      },
      animation: {
        "gauge-pulse": "gauge-pulse 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
