/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        danger: "#DC2626",
        dangerDark: "#991B1B",
        ink: "#0F172A",
        muted: "#64748B",
        line: "#E2E8F0",
      },
    },
  },
  plugins: [],
};
