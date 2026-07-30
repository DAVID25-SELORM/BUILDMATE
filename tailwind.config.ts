import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#f3f8f4", 100: "#dfeee3", 500: "#2f7d4c", 600: "#25653d", 700: "#1e5132", 900: "#133521" },
        sand: { 50: "#fbfaf7", 100: "#f4f0e7", 500: "#b88b4a" }
      },
      boxShadow: { soft: "0 16px 40px rgba(15, 23, 42, 0.08)" }
    }
  },
  plugins: []
} satisfies Config;
