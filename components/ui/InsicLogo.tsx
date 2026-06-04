import * as React from "react";

// ─── Mark SVG — exact geometry from insic-app-icon.svg ───────────────────────
// Source viewBox 256×256, content centred within a 216×216 inset.
// We expose the mark alone (no rounded-rect background) in a 124×160 viewport
// for use in the lockup (aspect ratio preserved from the original design).

type MarkProps = {
  className?: string;
  style?: React.CSSProperties;
  mono?: boolean;
  title?: string;
};

function InsicMark({ className, style, mono = false, title = "insic" }: MarkProps) {
  const olive = mono ? "#FFFFFF" : "#5F790B";
  const ink   = mono ? "#FFFFFF" : "#06101F";
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 124 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {title && <title>{title}</title>}
      <circle cx="62.6" cy="24.2" r="12.15" fill={olive} />
      <rect x="36.95" y="53.9"  width="51.3" height="9.45" rx="1.69" fill={ink} />
      <rect x="36.95" y="72.8"  width="51.3" height="9.45" rx="1.69" fill={ink} />
      <rect x="36.95" y="91.7"  width="62.1" height="9.45" rx="1.69" fill={ink} />
      <rect x="36.95" y="110.6" width="56.7" height="9.45" rx="1.69" fill={ink} />
      <rect x="36.95" y="129.5" width="45.9" height="9.45" rx="1.69" fill={ink} />
    </svg>
  );
}

// ─── App icon SVG — rounded-rect background + mark, matches generated PNGs ───
// Use this for <link rel="icon"> contexts or anywhere you want the full icon
// tile. Matches the geometry of the PIL-rendered insic-app-icon-*.png files.

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
      {/* Rounded-rect white card */}
      <rect x="20" y="20" width="216" height="216" rx="54" fill="#FFFFFF" />
      {/* Olive dot */}
      <circle cx="127.6" cy="78.2" r="12.15" fill="#5F790B" />
      {/* 5 navy bars — exact geometry from insic-app-icon.svg */}
      <rect x="101.95" y="107.9"  width="51.3" height="9.45" rx="1.69" fill="#06101F" />
      <rect x="101.95" y="126.8"  width="51.3" height="9.45" rx="1.69" fill="#06101F" />
      <rect x="101.95" y="145.7"  width="62.1" height="9.45" rx="1.69" fill="#06101F" />
      <rect x="101.95" y="164.6"  width="56.7" height="9.45" rx="1.69" fill="#06101F" />
      <rect x="101.95" y="183.5"  width="45.9" height="9.45" rx="1.69" fill="#06101F" />
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

// Precomputed positions at the three sizes, letter-spacing -0.045em:
// viewBox is sized to exactly fit the text (width × fs), positioned at origin.

type WordmarkSize = "sm" | "md" | "lg";

// font-size, and precomputed i-dot cx values (in the SVG coordinate space
// where 1 unit = 1px, text baseline at y = ascender/UPM × fs)
const WORDMARK: Record<WordmarkSize, {
  fs: number;
  vbW: number;   // viewBox width (≈ total text advance)
  vbH: number;   // viewBox height = fs (line-height 1)
  baseline: number;  // y of text baseline
  cx0: number;   // first i tittle cx
  cx3: number;   // second i tittle cx
  cy: number;    // tittle center y
  tr: number;    // tittle radius (enlarged 40% vs mathematical for visibility)
}> = (() => {
  const UPM   = 2816;
  const LS_EM = -0.045;
  const ADV   = { i: 556, n: 1260, s: 1012, c: 1016 };
  const T_CX  = 268;
  const T_CY_U = (1820 + 1490) / 2;  // 1655 above baseline
  const T_R_U  = (1820 - 1490) / 2;  // 165 units
  const ASC_U = 2728;

  const result: Record<WordmarkSize, ReturnType<typeof compute>> = {} as never;

  function compute(fs: number) {
    const scale  = fs / UPM;
    const ls_px  = LS_EM * fs;
    let x = 0;
    const starts: number[] = [];
    for (const ch of ["i", "n", "s", "i", "c"] as const) {
      starts.push(x);
      x += ADV[ch] * scale + ls_px;
    }
    const totalW = x - ls_px;  // remove trailing ls
    const baseline = (ASC_U / UPM) * fs;
    return {
      fs,
      vbW: Math.ceil(totalW + 0.5),
      vbH: fs,
      baseline,
      cx0: starts[0] + T_CX * scale,
      cx3: starts[3] + T_CX * scale,
      cy:  baseline - T_CY_U * scale,
      tr:  T_R_U * scale * 1.4,  // 40% larger for visual weight at small sizes
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
  const { fs, vbW, vbH, baseline, cx0, cx3, cy, tr } = WORDMARK[size];

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      style={{ display: "block", overflow: "visible", ...style }}
      aria-hidden="true"
    >
      {/* Text in Inter — inherits CSS-loaded font from the DOM */}
      <text
        x="0"
        y={baseline}
        style={{
          fontFamily: "var(--font-sans, Inter, ui-sans-serif, sans-serif)",
          fontSize: fs,
          fontWeight: 760,
          letterSpacing: `${-0.045 * fs}px`,
          fill: ink,
          dominantBaseline: "auto",
        }}
      >
        insic
      </text>
      {/* Olive tittle overlay — drawn on top of the text */}
      <circle cx={cx0} cy={cy} r={tr} fill="#5F790B" />
      <circle cx={cx3} cy={cy} r={tr} fill="#5F790B" />
    </svg>
  );
}

// ─── Logo lockup ─────────────────────────────────────────────────────────────
//
// ALIGNMENT MATH (mark bars 54–139 in 160px viewBox, center = 60.3% of markH):
//   bars_center = 0.6031 × markH
//   cap_center from span top (with line-height:1) = 0.7103 × fs
//   translateY = bars_center − cap_center
//
// Size table — markH chosen so mark bars ≈ Inter cap-height at that fs.

export type LogoSize = "sm" | "md" | "lg";

const SIZES: Record<LogoSize, { markH: number; wSize: WordmarkSize; ty: number; gap: number }> = {
  //  bars_ctr = 0.6031×36=21.7  cap_ctr = 0.7103×18=12.8  ty=8.9≈9
  sm: { markH: 36, wSize: "sm", ty: 9,  gap: 6 },
  //  bars_ctr = 0.6031×38=22.9  cap_ctr = 0.7103×20=14.2  ty=8.7≈9
  md: { markH: 38, wSize: "md", ty: 9,  gap: 8 },
  //  bars_ctr = 0.6031×44=26.5  cap_ctr = 0.7103×24=17.0  ty=9.5≈10
  lg: { markH: 44, wSize: "lg", ty: 10, gap: 9 },
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
  const { vbW, vbH, fs } = WORDMARK[wSize];

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
