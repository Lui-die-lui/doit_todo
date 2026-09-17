import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Bright, warm, near-monochrome "observation chart" palette.
        // Status/emphasis is expressed with shape, fill and line weight,
        // not with hue -- see components/Badges.tsx and the constellation view.
        paper: "#FCFCFA", // page background
        surface: "#FFFFFF", // cards / panels
        "surface-muted": "#F3F3EF", // inactive surface
        ink: {
          DEFAULT: "#11110F", // primary black (completed / primary actions)
          900: "#11110F",
          700: "#22221F", // body text
          500: "#666660", // secondary text
          400: "#999992", // muted text
        },
        line: {
          DEFAULT: "#E8E8E2", // hairline border
          strong: "#D2D2CB", // emphasized border
        },
      },
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "JetBrains Mono",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      letterSpacing: {
        label: "0.12em",
      },
    },
  },
  plugins: [],
};

export default config;
