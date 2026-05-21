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
        up:           '#059669',  // emerald-600 (deeper for light bg)
        down:         '#DC2626',  // red-600
        warn:         '#D97706',  // amber-600
        'accent-blue':'#2563EB',  // blue-600

        // ── Dark nav / hero palette (kept for TopBar, BottomNav, hero) ────────
        'deep':          '#050D1F',
        'mid':           '#0A1628',
        'raised':        '#0E1F36',
        'neon':          '#3B82F6',
        'neon-light':    '#60A5FA',
        'neon-cyan':     '#06B6D4',

        // ── Clairo brand palette ──────────────────────────────────────────────
        'brand-navy':         '#2563EB',
        'brand-emerald':      '#059669',
        'brand-gold':         '#D97706',
        'brand-gold-decor':   '#D97706',
        'brand-red':          '#DC2626',
        'brand-surface':      '#F1F5F9',

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
        card:        "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-md":   "0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)",
        float:       "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
        nav:         "0 2px 12px rgba(0,0,0,0.4)",
        "glow-sm":   "0 0 12px rgba(37,99,235,0.2), 0 0 4px rgba(37,99,235,0.1)",
        "glow-md":   "0 0 24px rgba(37,99,235,0.3), 0 0 8px rgba(37,99,235,0.12)",
        "glow-lg":   "0 0 40px rgba(37,99,235,0.4), 0 0 16px rgba(37,99,235,0.18)",
        "glow-cyan": "0 0 20px rgba(6,182,212,0.35), 0 0 6px rgba(6,182,212,0.18)",
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
