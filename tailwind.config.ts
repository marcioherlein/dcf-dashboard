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
        // ── shadcn/ui CSS variable bridge ──────────────────────────────────
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

        // ── insic Brand: Ink palette ──────────────────────────────────────
        ink: {
          950: "#06101F",
          900: "#0A1424",
          800: "#111C2E",
          700: "#1E2430",
        },

        // ── insic Brand: Olive (primary brand accent) ─────────────────────
        olive: {
          700: "#3E5206",
          600: "#4A6109",
          500: "#5C7410",
          100: "#DDE6F8",
          50:  "#EEF2FA",
        },

        // ── insic Brand: Neutral surfaces (cool blue-grey) ────────────────
        'bg-warm':     '#F0F1F6',
        'bg-soft':     '#F0F1F6',
        'surface':     '#FFFFFF',
        'surface-subtle': '#FBFAF7',
        'border-warm': '#E3E1DA',
        'border-strong-warm': '#CDD1C8',

        // ── insic Brand: Text hierarchy ───────────────────────────────────
        'text-ink':       '#06101F',
        'text-secondary': '#566174',
        'text-secondary-bg': '#566174',
        'text-muted':     '#8A95A6',
        'text-faint':     '#C4C4C4',

        // ── Supporting blue (secondary actions, links) ────────────────────
        'brand-blue': {
          600: '#2563EB',
          100: '#EAF1FF',
          50:  '#F4F7FF',
        },

        // ── Financial semantic colors ─────────────────────────────────────
        // Use ONLY for financial meaning — not as general decoration
        up:   '#11875D',   // positive / undervalued
        down: '#D83B3B',   // negative / overvalued
        warn: '#B56A00',   // uncertain / warning
        'up-soft':   '#E8F7EF',
        'down-soft': '#FCEAEA',
        'warn-soft': '#FFF4DA',

        // Legacy accent-blue alias (avoid new usage; prefer brand-blue)
        'accent-blue': '#2563EB',

        // ── Dark nav / hero ────────────────────────────────────────────────
        deep:   '#06101F',
        mid:    '#0A1424',
        raised: '#111C2E',

        // ── Neutral surface (landing) ──────────────────────────────────────
        cream: { DEFAULT: '#FAF9F6', dark: '#F4F3EF' },

        // ── Legacy brand aliases (kept for chart/landing references) ─────
        'brand-navy':    '#2563EB',
        'brand-emerald': '#11875D',
        'brand-gold':    '#B56A00',
        'brand-red':     '#D83B3B',
        'brand-surface': '#FFFFFF',
        'amber-gold':    '#B56A00',
      },

      fontFamily: {
        // System font stack — SF Pro on Apple, Segoe UI on Windows, Roboto on Android
        display:  ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"],
        headline: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"],
        body:     ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"],
        label:    ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"],
        sans:     ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"],
        mono:     ["var(--font-mono)", "DM Mono", "IBM Plex Mono", "Courier New", "monospace"],
        // Serif — only for landing hero headline if desired
        serif:    ["Georgia", "Times New Roman", "serif"],
      },

      fontSize: {
        // Landing hero (64px desktop, scales down)
        'display': ['clamp(2.375rem, 5.5vw, 4rem)', { lineHeight: '1.02', fontWeight: '700', letterSpacing: '-0.035em' }],
        // Page titles
        'hero':    ['2rem',   { lineHeight: '1.2',  fontWeight: '700', letterSpacing: '-0.025em' }],
        // Section titles
        'heading': ['1.5rem', { lineHeight: '1.3',  fontWeight: '700', letterSpacing: '-0.018em' }],
        // Card titles
        'subhead': ['1rem',   { lineHeight: '1.5',  fontWeight: '650' }],
        // Labels
        'label':   ['0.6875rem', { lineHeight: '1.4', fontWeight: '700', letterSpacing: '0.08em' }],
        'micro':   ['0.6875rem', { lineHeight: '1.4', fontWeight: '400' }],
      },

      borderRadius: {
        // 8px spacing system
        DEFAULT: "0.5rem",     // 8px — small controls
        sm:      "0.25rem",    // 4px
        md:      "0.625rem",   // 10px — inputs, buttons
        lg:      "0.75rem",    // 12px
        xl:      "1rem",       // 16px — cards
        "2xl":   "1.25rem",    // 20px — hero/product cards
        "3xl":   "1.375rem",   // 22px — app icon containers
        full:    "9999px",
      },

      boxShadow: {
        // insic shadow scale — restrained, pure black
        card:        "0 8px 24px rgba(0, 0, 0, 0.06)",
        "card-md":   "0 12px 32px rgba(0, 0, 0, 0.09)",
        float:       "0 16px 48px rgba(0, 0, 0, 0.14), 0 4px 12px rgba(0, 0, 0, 0.07)",
        nav:         "0 4px 20px rgba(0, 0, 0, 0.08)",
        // Olive glow variants (CTAs, selected states)
        "glow-sm":   "0 0 12px rgba(95, 121, 11, 0.18), 0 0 4px rgba(95, 121, 11, 0.09)",
        "glow-md":   "0 0 24px rgba(95, 121, 11, 0.25), 0 0 8px rgba(95, 121, 11, 0.10)",
        "glow-lg":   "0 0 40px rgba(95, 121, 11, 0.32), 0 0 16px rgba(95, 121, 11, 0.14)",
        // Blue glow — kept for blue-accent elements
        "glow-cyan": "0 0 20px rgba(37, 99, 235, 0.20), 0 0 6px rgba(37, 99, 235, 0.10)",
      },

      animation: {
        'glow-pulse':    'glow-pulse 2.5s ease-in-out infinite',
        'float':         'float 4s ease-in-out infinite',
        'float-slow':    'float 6s ease-in-out infinite',
        'float-delay':   'float 4s ease-in-out 1.2s infinite',
        'border-rotate': 'border-rotate 4s linear infinite',
        'scan-line':     'scan-line 4s ease-in-out infinite',
      },

      spacing: {
        // 8px base grid — key steps surfaced as named tokens
        '0.5': '0.125rem',  // 2px
        '1':   '0.25rem',   // 4px
        '1.5': '0.375rem',  // 6px
        '2':   '0.5rem',    // 8px
        '3':   '0.75rem',   // 12px
        '4':   '1rem',      // 16px
        '5':   '1.25rem',   // 20px
        '6':   '1.5rem',    // 24px
        '8':   '2rem',      // 32px
        '10':  '2.5rem',    // 40px
        '12':  '3rem',      // 48px
        '16':  '4rem',      // 64px
        '20':  '5rem',      // 80px
        '24':  '6rem',      // 96px
      },
    },
  },
  plugins: [],
};
export default config;
