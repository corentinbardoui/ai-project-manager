import type { Config } from "tailwindcss";
import { palette } from "./src/lib/tokens";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── Semantic color aliases ───────────────────────────────────────────
      // Change the palette here (and in src/lib/tokens.ts) to retheme the app.
      colors: {
        brand:   palette.brand,
        accent:  palette.accent,
        surface: palette.surface,
      },

      // ── Keyframes ────────────────────────────────────────────────────────
      keyframes: {
        "progress-bar": {
          "0%":   { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "fade-in": {
          "0%":   { opacity: "0", transform: "translateY(6px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "fade-out": {
          "0%":   { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(0.97)" },
        },
      },
      animation: {
        "progress-bar": "progress-bar 1.6s ease-in-out infinite",
        "fade-in":  "fade-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "fade-out": "fade-out 0.18s ease forwards",
      },
    },
  },
  plugins: [],
};
export default config;
