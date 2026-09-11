import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f4f6f8",
          100: "#e9edf1",
          200: "#cfd6de",
          300: "#a8b5c2",
          400: "#6b7d90",
          500: "#4a5868",
          600: "#36414f",
          700: "#252e39",
          800: "#18202a",
          900: "#10161e",
        },
        sage: {
          50: "#eef3f0",
          100: "#d9e6de",
          200: "#b8cfc2",
          300: "#8eaf9b",
          400: "#698b79",
          500: "#4f6d5f",
          600: "#3d554b",
          700: "#31453d",
          800: "#283833",
          900: "#202d29",
        },
        gold: {
          50: "#fbf6ea",
          100: "#f5ebcd",
          200: "#ebd89f",
          300: "#ddc06f",
          400: "#c8a34f",
          500: "#ab853c",
          600: "#89692f",
          700: "#694f25",
          800: "#49371d",
          900: "#312614",
        },
      },
      boxShadow: {
        panel: "0 18px 50px -26px rgba(10, 16, 24, 0.28)",
        soft: "0 10px 30px -18px rgba(14, 23, 34, 0.22)",
      },
      fontFamily: {
        sans: ["Avenir Next", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
        serif: ["Iowan Old Style", "Palatino Linotype", "Book Antiqua", "Georgia", "serif"],
      },
      backgroundImage: {
        "grain-radial":
          "radial-gradient(circle at top left, rgba(216, 230, 222, 0.24), transparent 32%), radial-gradient(circle at bottom right, rgba(235, 216, 159, 0.18), transparent 28%)",
      },
    },
  },
  plugins: [],
};

export default config;
