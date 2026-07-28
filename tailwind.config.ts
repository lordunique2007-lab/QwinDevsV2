import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        qwin: {
          bg: "#0B0E14",
          surface: "#121620",
          surface2: "#1A2030",
          border: "#242B3D",
          primary: "#6C5CE7",
          primary2: "#8B7CF6",
          accent: "#22D3B6",
          gold: "#F4C542",
          text: "#E7E9F0",
          muted: "#8A93A8"
        }
      },
      fontFamily: {
        display: ["'Sora'", "sans-serif"],
        body: ["'Inter'", "sans-serif"]
      },
      boxShadow: {
        glow: "0 0 24px rgba(108, 92, 231, 0.35)",
        goldglow: "0 0 24px rgba(244, 197, 66, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
