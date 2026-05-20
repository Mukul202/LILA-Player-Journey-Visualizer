import type { Config } from "tailwindcss";

/**
 * Dark "telemetry analytics" theme. Data-visualization colors (human/bot/event
 * hues) are duplicated from lib/colors.ts so they can be used as Tailwind
 * classes in the legend and filter chips.
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#080b11",
        panel: {
          DEFAULT: "#0f141d",
          raised: "#161c28",
          hover: "#1e2533",
        },
        edge: {
          DEFAULT: "#232c3b",
          soft: "#1a212e",
        },
        ink: {
          DEFAULT: "#e7ecf3",
          dim: "#9aa6b8",
          faint: "#5e6b7e",
        },
        brand: {
          DEFAULT: "#a78bfa",
          dim: "#7c5cde",
          deep: "#4c3a86",
        },
        human: "#22d3ee",
        bot: "#8b97a8",
        ev: {
          kill: "#f87171",
          death: "#e2e8f0",
          storm: "#e879f9",
          loot: "#fbbf24",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      boxShadow: {
        panel: "0 1px 0 rgba(255,255,255,0.02), 0 8px 24px -12px rgba(0,0,0,0.7)",
        glow: "0 0 0 1px rgba(167,139,250,0.4), 0 0 18px -4px rgba(167,139,250,0.5)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        spin: {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "spin-slow": "spin 1s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
