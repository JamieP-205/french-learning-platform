import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#10233f",
        cream: "#faf7f0",
        coral: "#bd3f2c",
        moss: "#2f7d62",
        amber: "#a8721c",
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
