import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        mute: "var(--mute)",
        card: "var(--card)",
        teal: {
          DEFAULT: "var(--teal)",
          dark: "var(--teal-2)",
          hover: "#0b778b",
        },
        orange: {
          DEFAULT: "var(--orange)",
          hover: "#d97416",
        },
        ok: "var(--ok)",
        red: "var(--red)",
        line: "var(--line)",
      },
      backgroundColor: {
        glass: "var(--glass)",
      },
      borderRadius: {
        panel: "24px",
        btn: "16px",
      },
      boxShadow: {
        soft: "var(--shadow)",
        pill: "0 4px 20px rgba(0, 0, 0, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
