import * as React from "react";
import Image from "next/image";

// ─── Standalone mark (SVG, geometry only) ────────────────────────────────────

type MarkProps = {
  className?: string;
  style?: React.CSSProperties;
  mono?: boolean;
  title?: string;
};

function InsicMark({ className, style, mono = false, title = "insic" }: MarkProps) {
  const olive = mono ? "currentColor" : "#5F790B";
  const ink   = mono ? "currentColor" : "#06101F";
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 124 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title || undefined}
      aria-hidden={!title ? true : undefined}
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

// ─── Logo lockup ─────────────────────────────────────────────────────────────
//
// WHY SPLIT MARK + WORDMARK:
//   The combined horizontal PNG has the olive dot baked above the wordmark.
//   The full PNG bounding box is dot-top → wordmark-bottom, so the wordmark
//   occupies only 46% of the render height. At header sizes (26–32px) the
//   wordmark cap height is only ~11px — far too small.
//
//   Fix: render the SVG mark independently and the wordmark PNG independently,
//   each sized to their actual content, aligned with flex-start + translateY.
//
// GEOMETRY (from pixel measurement of insic-wordmark-cropped.png, 158×55):
//   Wordmark content spans rows 3–51 within the 55px crop (3px padding each side).
//   Cap height of 'insic' (no descenders) ≈ full 49px content ≈ 89% of crop height.
//
// GEOMETRY (mark SVG viewBox 0 0 124 160):
//   Bars span y=53.9–139 (85/160 = 53% of height).
//   Bars center = y=96.5 → 60.3% of mark height.
//
// At size "md" (mark rendered at 38px tall):
//   bars_center = 22.9px from SVG top
//   dot_bottom  =  8.6px            → dot sits clearly above wordmark
//   wordmark rendered at 27px tall
//   cap_center_from_word_top ≈ 13.5px
//   translateY = 22.9 - 13.5 = 9px  → aligns cap-center to bars-center

export type LogoSize = "sm" | "md" | "lg";

// All sizes: { markH, wordH, translateY, gap }
// markH  = rendered height of SVG mark (chosen so bars ≈ wordH)
// wordH  = rendered height of wordmark PNG
// translateY = px to shift wordmark down so cap aligns with bars center
const SIZES: Record<LogoSize, { markH: number; wordH: number; ty: number; gap: number }> = {
  sm: { markH: 26, wordH: 19, ty: 6,  gap: 6 },
  md: { markH: 38, wordH: 27, ty: 9,  gap: 8 },
  lg: { markH: 47, wordH: 34, ty: 11, gap: 10 },
};

// Wordmark PNG (insic-wordmark-cropped.png): 158×55 → aspect 2.873
const WORD_ASPECT = 158 / 55;

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
  const { markH, wordH, ty, gap } = SIZES[size];
  const markW = Math.round(markH * 124 / 160);
  const wordW = Math.round(wordH * WORD_ASPECT);
  const dark = on === "dark";

  // SVG mark: for dark mode we use the white/mono variant rendered as SVG
  // Wordmark PNG: separate light/dark crops
  const wordSrc = dark
    ? "/brand/insic-wordmark-white-cropped.png"
    : "/brand/insic-wordmark-cropped.png";

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
      {/* Mark — SVG, sized so bars height ≈ wordmark height */}
      <InsicMark
        style={{ width: markW, height: markH, flexShrink: 0, display: "block" }}
        mono={dark}
        title=""
      />
      {/* Wordmark PNG — shifted down so cap-center aligns to bars-center */}
      <Image
        src={wordSrc}
        alt=""
        aria-hidden
        width={158}
        height={55}
        priority
        style={{
          height: wordH,
          width: wordW,
          display: "block",
          flexShrink: 0,
          transform: `translateY(${ty}px)`,
          ...(dark ? { filter: "brightness(0) invert(1)" } : {}),
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
    return <InsicMark className={className} style={style} mono={mono} title={title} />;
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
