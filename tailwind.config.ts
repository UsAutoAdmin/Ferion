import type { Config } from "tailwindcss";

/**
 * Ferion design tokens.
 *
 * Every color here is a CSS variable defined in `app/globals.css` so the
 * palette can be tuned in one place. Use the semantic Tailwind class
 * (`bg-surface`, `text-fg`, `text-accent`) — never a raw hex — in components.
 *
 * Palette source: Atoms (atoms.co). Dark-first: near-black surfaces, warm
 * cream type, sand / bronze / copper accents.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          raised: "rgb(var(--surface-raised) / <alpha-value>)",
          overlay: "rgb(var(--surface-overlay) / <alpha-value>)",
        },
        // Type
        fg: {
          DEFAULT: "rgb(var(--fg) / <alpha-value>)",
          muted: "rgb(var(--fg-muted) / <alpha-value>)",
          subtle: "rgb(var(--fg-subtle) / <alpha-value>)",
        },
        // Brand accents
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          hover: "rgb(var(--accent-hover) / <alpha-value>)",
          deep: "rgb(var(--accent-deep) / <alpha-value>)",
          bright: "rgb(var(--accent-bright) / <alpha-value>)",
          rust: "rgb(var(--accent-rust) / <alpha-value>)",
        },
        // Secondary / data-viz palette
        teal: "rgb(var(--teal) / <alpha-value>)",
        slate: "rgb(var(--slate) / <alpha-value>)",
        sage: "rgb(var(--sage) / <alpha-value>)",
        olive: "rgb(var(--olive) / <alpha-value>)",
        taupe: "rgb(var(--taupe) / <alpha-value>)",
        // Hairlines
        line: {
          DEFAULT: "rgb(var(--line) / <alpha-value>)",
          strong: "rgb(var(--line-strong) / <alpha-value>)",
        },
        // Status
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        "brand-sm": "0.375rem",
        "brand-md": "0.5rem",
        "brand-lg": "0.75rem",
      },
      boxShadow: {
        "brand-sm": "0 1px 2px 0 rgb(0 0 0 / 0.4)",
        "brand-md": "0 4px 12px -2px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.4)",
        "brand-lg": "0 16px 40px -8px rgb(0 0 0 / 0.6), 0 4px 10px -4px rgb(0 0 0 / 0.5)",
        "accent-glow": "0 0 0 1px rgb(var(--accent) / 0.35), 0 8px 24px -8px rgb(var(--accent) / 0.25)",
      },
      letterSpacing: {
        eyebrow: "0.18em",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
