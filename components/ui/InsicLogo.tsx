import * as React from "react";

// ─── Mark SVG — geometry pixel-measured from chosen icon PNG ─────────────────
// Source: 437529c9-…-2.png (1254×1254), normalized to 256×256 viewBox.
// InsicMark clips to mark-only viewport (dot + bars, no card background).

type MarkProps = {
  className?: string;
  style?: React.CSSProperties;
  mono?: boolean;
  title?: string;
};

function InsicMark({ className, style, mono = false, title = "insic" }: MarkProps) {
  const olive = mono ? "#FFFFFF" : "#5F790B";
  const ink   = mono ? "#FFFFFF" : "#06101F";
  // Tight viewport: dot top=68.8, bars bottom=173.3 → height=104.5, center x≈127.7
  // ViewBox: x=93 y=68 w=70 h=106  (content + small padding)
  return (
    <svg
      className={className}
      style={style}
      viewBox="93 68 70 106"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {title && <title>{title}</title>}
      <circle cx="127.7" cy="79.9"  r="11.1"  fill={olive} />
      <rect   x="110.4"  y="102.5" width="34.7" height="9.4" rx="1.69" fill={ink} />
      <rect   x="110.4"  y="118.2" width="28.4" height="9.4" rx="1.69" fill={ink} />
      <rect   x="110.4"  y="133.7" width="37.2" height="9.2" rx="1.65" fill={ink} />
      <rect   x="110.4"  y="149.2" width="36.3" height="9.2" rx="1.65" fill={ink} />
      <rect   x="110.4"  y="164.1" width="28.4" height="9.2" rx="1.65" fill={ink} />
    </svg>
  );
}

// ─── App icon SVG — rounded-rect card + mark, matches the chosen PNG ─────────

export type InsicAppIconProps = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

export function InsicAppIcon({ size = 40, className, style }: InsicAppIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <defs>
        <filter id="icon-shadow" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="#06101F" floodOpacity="0.14" />
        </filter>
      </defs>
      {/* Rounded-rect white card — inset 53px, rx=54 matches source */}
      <rect x="53" y="53" width="150" height="150" rx="38" fill="#FFFFFF" filter="url(#icon-shadow)" />
      {/* Olive dot */}
      <circle cx="127.7" cy="79.9"  r="11.1"  fill="#5F790B" />
      {/* 5 navy bars — pixel-measured from 437529c9 PNG */}
      <rect x="110.4" y="102.5" width="34.7" height="9.4" rx="1.69" fill="#06101F" />
      <rect x="110.4" y="118.2" width="28.4" height="9.4" rx="1.69" fill="#06101F" />
      <rect x="110.4" y="133.7" width="37.2" height="9.2" rx="1.65" fill="#06101F" />
      <rect x="110.4" y="149.2" width="36.3" height="9.2" rx="1.65" fill="#06101F" />
      <rect x="110.4" y="164.1" width="28.4" height="9.2" rx="1.65" fill="#06101F" />
    </svg>
  );
}

// ─── Wordmark SVG — live Inter text + olive tittle overlay ───────────────────
//
// WHY INLINE SVG TEXT:
//   Pre-baked PNGs were exported without Inter — tittle dots are rectangular
//   (system fallback). Inline SVG <text> in the DOM inherits the CSS-loaded
//   Inter Variable, giving the correct circular tittle dots and letterforms.
//
// OLIVE TITTLE OVERLAY:
//   SVG <text> is monochromatic. We paint the tittles olive by measuring exact
//   glyph positions (Inter UPM 2816, tittle bbox 268cx / rows 1490–1820) and
//   drawing olive <circle> elements on top of the matching text glyphs.
//
// Inter UPM metrics used:
//   ascender   = 2728   cap-height  = 1456
//   descender  = -688   i-advance   = 556
//   n-advance  = 1260   s-advance   = 1012   c-advance = 1016
//   tittle-cx  = 268 (from glyph origin)
//   tittle-cy  = (1820+1490)/2 = 1655 above baseline
//   tittle-r   = (1820-1490)/2 = 165 units

// Precomputed positions at the three sizes, letter-spacing -0.045em.
// viewBox sized to exactly fit the text advance width.

type WordmarkSize = "sm" | "md" | "lg";

const WORDMARK: Record<WordmarkSize, {
  vbW: number;
  vbH: number;
  baseline: number;
}> = (() => {
  const UPM   = 2816;
  const LS_EM = -0.045;
  const ADV   = { i: 556, n: 1260, s: 1012, c: 1016 };
  const ASC_U = 2728;

  const result: Record<WordmarkSize, ReturnType<typeof compute>> = {} as never;

  function compute(fs: number) {
    const scale = fs / UPM;
    const ls_px = LS_EM * fs;
    let x = 0;
    for (const ch of ["i", "n", "s", "i", "c"] as const) {
      x += ADV[ch] * scale + ls_px;
    }
    const totalW = x - ls_px;
    return {
      vbW: Math.ceil(totalW + 0.5),
      vbH: fs,
      baseline: (ASC_U / UPM) * fs,
    };
  }

  result.sm = compute(18);
  result.md = compute(20);
  result.lg = compute(24);
  return result;
})();

function InsicWordmark({
  size,
  ink,
  style,
}: {
  size: WordmarkSize;
  ink: string;
  style?: React.CSSProperties;
}) {
  const { vbW, vbH, baseline } = WORDMARK[size];

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      style={{ display: "block", overflow: "visible", ...style }}
      aria-hidden="true"
    >
      <text
        x="0"
        y={baseline}
        style={{
          fontFamily: "var(--font-sans, Inter, ui-sans-serif, sans-serif)",
          fontSize: vbH,
          fontWeight: 760,
          letterSpacing: `${-0.045 * vbH}px`,
          fill: ink,
          dominantBaseline: "auto",
        }}
      >
        insic
      </text>
    </svg>
  );
}

// ─── Logo lockup ─────────────────────────────────────────────────────────────
//
// Mark viewBox "93 68 70 106": bars span rows 34.5–105.3 (66.9% of 106),
// bars center at 69.9 (65.9% of 106). Dot bottom at 23.0/106 of markH.
//
// markH sized so dot has ≥2px clearance above translateY (text top).
// Iterate: clearance = ty − (23/106 × markH) ≥ 2.

export type LogoSize = "sm" | "md" | "lg";

const SIZES: Record<LogoSize, { markH: number; wSize: WordmarkSize; ty: number; gap: number }> = {
  // sm: markH=34 markW=22 ty=10  dot_bot=7.4 clearance=2.6px
  sm: { markH: 34, wSize: "sm", ty: 10, gap: 7  },
  // md: markH=36 markW=24 ty=10  dot_bot=7.8 clearance=2.2px
  md: { markH: 36, wSize: "md", ty: 10, gap: 8  },
  // lg: markH=44 markW=29 ty=12  dot_bot=9.5 clearance=2.5px
  lg: { markH: 44, wSize: "lg", ty: 12, gap: 10 },
};

export type InsicLogoLockupProps = {
  size?: LogoSize;
  on?: "light" | "dark";
  className?: string;
  style?: React.CSSProperties;
};

export function InsicLogoLockup({
  size = "md",
  on = "light",
  className,
  style,
}: InsicLogoLockupProps) {
  const { markH, wSize, ty, gap } = SIZES[size];
  const markW = Math.round(markH * 124 / 160);
  const dark  = on === "dark";
  const ink   = dark ? "#FFFFFF" : "#06101F";
  const { vbW, vbH } = WORDMARK[wSize];

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "flex-start",
        gap,
        lineHeight: 0,
        userSelect: "none",
        ...style,
      }}
      role="img"
      aria-label="insic"
    >
      <InsicMark
        style={{ width: markW, height: markH, flexShrink: 0, display: "block" }}
        mono={dark}
      />
      <InsicWordmark
        size={wSize}
        ink={ink}
        style={{
          width: vbW,
          height: vbH,
          flexShrink: 0,
          transform: `translateY(${ty}px)`,
        }}
      />
    </span>
  );
}

// ─── Legacy variant API ───────────────────────────────────────────────────────

type InsicLogoProps = {
  variant?: "horizontal" | "mark" | "wordmark";
  mono?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
};

export function InsicLogo({
  variant = "horizontal",
  mono = false,
  className,
  style,
  title = "insic",
}: InsicLogoProps) {
  if (variant === "mark") {
    return (
      <InsicMark
        className={className}
        style={style}
        mono={mono}
        title={title}
      />
    );
  }
  return (
    <InsicLogoLockup
      size="md"
      on={mono ? "dark" : "light"}
      className={className}
      style={style}
    />
  );
}
