import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./emails/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        serif: ["Arial", "Helvetica", "sans-serif"],
        sans: ["Arial", "Helvetica", "sans-serif"],
        mono: ["Arial", "Helvetica", "sans-serif"],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        atlas: {
          bg: "var(--atlas-bg)",
          "bg-2": "var(--atlas-bg-2)",
          "bg-3": "var(--atlas-bg-3)",
          "bg-4": "var(--atlas-bg-4)",
          ink: "var(--atlas-ink)",
          "ink-2": "var(--atlas-ink-2)",
          "ink-3": "var(--atlas-ink-3)",
          "ink-4": "var(--atlas-ink-4)",
          line: "var(--atlas-line)",
          "line-2": "var(--atlas-line-2)",
          gold: "var(--atlas-accent)",
          "gold-2": "var(--atlas-accent-2)",
          "gold-soft": "var(--atlas-accent-soft)",
          alert: "var(--atlas-alert)",
          "alert-soft": "var(--atlas-alert-soft)",
          warn: "var(--atlas-warn)",
          "warn-soft": "var(--atlas-warn-soft)",
          ok: "var(--atlas-ok)",
          "ok-2": "var(--atlas-ok-2)",
          "ok-soft": "var(--atlas-ok-soft)",
        },
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "atlas-flash": {
          "0%": { backgroundColor: "var(--atlas-accent-soft)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "atlas-flash": "atlas-flash 1.6s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
