import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  // The bootstrap script in the root layout stamps data-theme before paint.
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      // Values live as CSS variables in globals.css so themes can swap them.
      // The rgb(var()) form keeps every ink/75-style opacity modifier working.
      colors: {
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        cream: "rgb(var(--color-cream) / <alpha-value>)",
        coral: "rgb(var(--color-coral) / <alpha-value>)",
        moss: "rgb(var(--color-moss) / <alpha-value>)",
        amber: "rgb(var(--color-amber) / <alpha-value>)",
      },
      // Tighter radius scale than the Tailwind defaults so cards keep
      // defined corners instead of turning into soft blobs.
      borderRadius: {
        xl: "8px",
        "2xl": "10px",
        "3xl": "12px",
      },
      // Cap the heaviest weight; 900 reads shouty at display sizes.
      fontWeight: {
        black: "700",
      },
      fontFamily: {
        // Reserved for French phrases and quoted lesson text.
        serif: ["Charter", "Iowan Old Style", "Cambria", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
