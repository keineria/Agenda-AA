import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Nunito", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Poppins", "Nunito", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          sky: "#3EC6F2",
          blue: "#1A10E8",
          gold: "#FFC02E",
          ink: "#2B2A4C",
          muted: "#7C7A9A",
          pink: "rgb(var(--accent) / <alpha-value>)",
          violet: "#7B6CF6",
          navy: "#0B2545",
          teal: "#14B8A6",
        },
      },
      boxShadow: {
        card: "0 18px 40px -18px rgba(43, 42, 76, 0.35)",
        soft: "0 6px 18px -8px rgba(43, 42, 76, 0.25)",
        pink: "0 10px 24px -8px rgba(236, 95, 168, 0.65)",
      },
      borderRadius: { xl2: "1.25rem" },
    },
  },
  plugins: [],
} satisfies Config;
