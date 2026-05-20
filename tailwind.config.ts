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
        // ── shadcn/ui CSS variable tokens (Tailwind v3) ───────────────────────
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        border:     'hsl(var(--border))',
        input:      'hsl(var(--input))',
        ring:       'hsl(var(--ring))',
        card:       { DEFAULT: 'hsl(var(--card))',        foreground: 'hsl(var(--card-foreground))' },
        popover:    { DEFAULT: 'hsl(var(--popover))',     foreground: 'hsl(var(--popover-foreground))' },
        muted:      { DEFAULT: 'hsl(var(--muted))',       foreground: 'hsl(var(--muted-foreground))' },
        accent:     { DEFAULT: 'hsl(var(--accent))',      foreground: 'hsl(var(--accent-foreground))' },
        secondary:  { DEFAULT: 'hsl(var(--secondary))',   foreground: 'hsl(var(--secondary-foreground))' },
        destructive:{ DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        primary:    { DEFAULT: 'hsl(var(--primary))',     foreground: 'hsl(var(--primary-foreground))' },

        // ── Financial semantic tokens ─────────────────────────────────────────
        up:           '#10B981',  // emerald-500 (brighter for dark bg)
        down:         '#EF4444',  // red-500
        warn:         '#F59E0B',  // amber-500
        'accent-blue':'#3B82F6',  // accent blue

        // ── Dark glass palette ────────────────────────────────────────────────
        'deep':          '#050D1F',   // page base
        'mid':           '#0A1628',   // section fills / elevated surfaces
        'raised':        '#0E1F36',   // higher elevation
        'neon':          '#3B82F6',   // accent blue
        'neon-light':    '#60A5FA',   // blue-400
        'neon-cyan':     '#06B6D4',   // cyan accent

        // ── Clairo brand palette ──────────────────────────────────────────────
        'brand-navy':         '#3B82F6',  // updated to accent blue
        'brand-emerald':      '#10B981',  // positive signals
        'brand-gold':         '#FBBF24',  // amber-400 on dark
        'brand-gold-decor':   '#F59E0B',
        'brand-red':          '#EF4444',
        'brand-surface':      '#050D1F',

        // ── Legacy MDM3 tokens (Header/Sidebar — keep until refactored) ───────
        "on-primary":               "#ffffff",
        "on-primary-container":     "#7999dc",
        "primary-container":        "#002f6c",
        "primary-fixed":            "#d8e2ff",
        "primary-fixed-dim":        "#aec6ff",
        "on-primary-fixed":         "#001a42",
        "on-primary-fixed-variant": "#224583",
        "secondary-container":      "#75f8b3",
        "on-secondary":             "#ffffff",
        "on-secondary-container":   "#007147",
        tertiary:                   "#271a00",
        "tertiary-container":       "#412e00",
        "tertiary-fixed":           "#ffdfa0",
        "tertiary-fixed-dim":       "#fbbc00",
        surface:                    "#fbf9f8",
        "surface-dim":              "#dbd9d9",
        "surface-bright":           "#fbf9f8",
        "surface-container-lowest": "#ffffff",
        "surface-container-low":    "#f5f3f3",
        "surface-container":        "#efeded",
        "surface-container-high":   "#eae8e7",
        "surface-container-highest":"#e4e2e2",
        "surface-variant":          "#e4e2e2",
        "on-surface":               "#1b1c1c",
        "on-surface-variant":       "#434750",
        "inverse-surface":          "#303030",
        "inverse-on-surface":       "#f2f0f0",
        outline:                    "#747781",
        "outline-variant":          "#c4c6d2",
        "on-background":            "#1b1c1c",
        error:                      "#ba1a1a",
        "error-container":          "#ffdad6",
        "on-error":                 "#ffffff",
        "on-error-container":       "#93000a",
      },
      fontFamily: {
        headline: ["Manrope",       "system-ui", "sans-serif"],
        body:     ["Inter",         "system-ui", "sans-serif"],
        label:    ["Inter",         "system-ui", "sans-serif"],
        sans:     ["Inter",         "system-ui", "sans-serif"],
        mono:     ["IBM Plex Mono", "Courier New", "monospace"],
      },
      fontSize: {
        'display':  ['2rem',    { lineHeight: '1.15', fontWeight: '900', letterSpacing: '-0.03em' }],
        'hero':     ['1.75rem', { lineHeight: '1.2',  fontWeight: '800', letterSpacing: '-0.02em' }],
        'heading':  ['1.25rem', { lineHeight: '1.3',  fontWeight: '700' }],
        'subhead':  ['1rem',    { lineHeight: '1.4',  fontWeight: '600' }],
        'label':    ['0.6875rem', { lineHeight: '1.4', fontWeight: '700', letterSpacing: '0.06em' }],
        'micro':    ['0.6875rem', { lineHeight: '1.4', fontWeight: '400' }],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        sm:      "0.25rem",
        md:      "0.5rem",
        lg:      "0.5rem",
        xl:      "0.75rem",
        "2xl":   "1rem",
        full:    "9999px",
      },
      boxShadow: {
        card:        "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
        "card-md":   "0 4px 12px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.3)",
        float:       "0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.3)",
        nav:         "0 2px 12px rgba(0,0,0,0.4)",
        "glow-sm":   "0 0 15px rgba(59,130,246,0.2), 0 0 5px rgba(59,130,246,0.1)",
        "glow-md":   "0 0 30px rgba(59,130,246,0.35), 0 0 10px rgba(59,130,246,0.15)",
        "glow-lg":   "0 0 50px rgba(59,130,246,0.5), 0 0 20px rgba(59,130,246,0.2)",
        "glow-cyan": "0 0 20px rgba(6,182,212,0.4), 0 0 6px rgba(6,182,212,0.2)",
      },
      animation: {
        'glow-pulse':    'glow-pulse 2.5s ease-in-out infinite',
        'float':         'float 4s ease-in-out infinite',
        'float-slow':    'float 6s ease-in-out infinite',
        'float-delay':   'float 4s ease-in-out 1.2s infinite',
        'border-rotate': 'border-rotate 4s linear infinite',
        'scan-line':     'scan-line 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
