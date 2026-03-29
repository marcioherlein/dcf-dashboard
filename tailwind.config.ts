import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Stitch "Kinetic Precision" palette
        primary:               "#001b44",
        "primary-container":   "#002f6c",
        "on-primary":          "#ffffff",
        "on-primary-container":"#7999dc",
        "primary-fixed":       "#d8e2ff",
        "primary-fixed-dim":   "#aec6ff",
        "on-primary-fixed":    "#001a42",
        "on-primary-fixed-variant": "#224583",

        secondary:             "#006d43",
        "secondary-container": "#75f8b3",
        "on-secondary":        "#ffffff",
        "on-secondary-container": "#007147",

        tertiary:              "#271a00",
        "tertiary-container":  "#412e00",
        "tertiary-fixed":      "#ffdfa0",
        "tertiary-fixed-dim":  "#fbbc00",

        background:            "#fbf9f8",
        "on-background":       "#1b1c1c",
        surface:               "#fbf9f8",
        "surface-dim":         "#dbd9d9",
        "surface-bright":      "#fbf9f8",
        "surface-container-lowest": "#ffffff",
        "surface-container-low":    "#f5f3f3",
        "surface-container":        "#efeded",
        "surface-container-high":   "#eae8e7",
        "surface-container-highest":"#e4e2e2",
        "surface-variant":     "#e4e2e2",
        "on-surface":          "#1b1c1c",
        "on-surface-variant":  "#434750",
        "inverse-surface":     "#303030",
        "inverse-on-surface":  "#f2f0f0",

        outline:               "#747781",
        "outline-variant":     "#c4c6d2",

        error:                 "#ba1a1a",
        "error-container":     "#ffdad6",
        "on-error":            "#ffffff",
        "on-error-container":  "#93000a",

        // Keep foreground for legacy usage
        foreground: "#1b1c1c",
      },
      fontFamily: {
        headline: ["Manrope", "system-ui", "sans-serif"],
        body:     ["Inter", "system-ui", "sans-serif"],
        label:    ["Inter", "system-ui", "sans-serif"],
        sans:     ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        sm:      "0.125rem",
        md:      "0.25rem",
        lg:      "0.25rem",
        xl:      "0.5rem",
        "2xl":   "0.75rem",
        full:    "9999px",
      },
      boxShadow: {
        card:    "0 20px 40px rgba(0,27,68,0.06)",
        float:   "0 8px 24px rgba(0,27,68,0.10)",
        nav:     "0 2px 12px rgba(0,27,68,0.08)",
      },
    },
  },
  plugins: [],
};
export default config;
