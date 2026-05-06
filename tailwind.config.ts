import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace"
        ]
      },
      colors: {
        terminal: {
          bg: "#0b0f14",
          fg: "#d6deeb",
          accent: "#7fdbca",
          ok: "#22c55e",
          ko: "#ef4444",
          dim: "#5f7e97"
        }
      }
    }
  },
  plugins: []
};

export default config;
