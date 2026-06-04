import * as React from "react";
import Image from "next/image";

// ─── Standalone mark (pure SVG, geometry only) ───────────────────────────────

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

// ─── Lockup using the designer-cropped PNG ────────────────────────────────────
//
// The source PNGs (insic-logo-horizontal.png) have heavy whitespace:
//   top 14%, bottom 6%, left 10%, right 23% — all empty.
// We pre-cropped them to content + 4px padding → 235×104px, aspect 2.260:1.
// At any `height` h, width = h × 2.260. The PNG has the mark/wordmark
// already designed to be optically aligned (dot above bars, text beside bars).
// No CSS translateY tricks needed — the PNG is the truth.
//
// Sizes map to target visual heights for the logo content:
//   sm  →  20px tall (pricing breadcrumb)
//   md  →  26px tall (app TopBar, Sidebar)
//   lg  →  32px tall (landing navbar)

export type LogoSize = "sm" | "md" | "lg";

const HEIGHTS: Record<LogoSize, number> = { sm: 20, md: 26, lg: 32 };
// Cropped PNG is 235×104 → aspect = 235/104
const ASPECT = 235 / 104;

export type InsicLogoLockupProps = {
  size?: LogoSize;
  /** "dark" = white-on-transparent variant for dark backgrounds */
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
  const h = HEIGHTS[size];
  const w = Math.round(h * ASPECT);
  const src = on === "dark"
    ? "/brand/insic-logo-horizontal-white-cropped.png"
    : "/brand/insic-logo-horizontal-cropped.png";

  return (
    <Image
      src={src}
      alt="insic"
      width={235}
      height={104}
      priority
      className={className}
      style={{ height: h, width: w, display: "block", flexShrink: 0, ...style }}
    />
  );
}

// ─── Legacy API (backward compat — InsicLogo still works) ────────────────────

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
