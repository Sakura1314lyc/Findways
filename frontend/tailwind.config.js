/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f8f6f1",
          100: "#f0ece4",
          200: "#e2dbd0",
          300: "#c8bfb2",
          400: "#a49a8c",
          500: "#80776b",
          600: "#625b52",
          700: "#49443d",
          800: "#322f2a",
          900: "#24231f",
          950: "#191915",
        },
        vermilion: {
          50: "#fbf2ef",
          100: "#f6e5de",
          200: "#ebc9bc",
          300: "#dca993",
          400: "#c97e62",
          500: "#b95b43",
          600: "#a94331",
          700: "#8e3427",
          800: "#742d23",
          900: "#59261f",
        },
      },
      fontFamily: {
        sans: [
          "Noto Sans SC",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "system-ui",
          "sans-serif",
        ],
        serif: ["Noto Serif SC", "Songti SC", "SimSun", "serif"],
      },
    },
  },
  plugins: [],
};
