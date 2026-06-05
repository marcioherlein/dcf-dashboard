import * as React from "react";
import Image from "next/image";

// ─── Mark SVG — olive dot + navy bars, transparent background ────────────────
// Kept for the legacy InsicLogo variant="mark" API.

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

// ─── App icon — beige card tile, clips PNG corners via border-radius ──────────

export type InsicAppIconProps = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

export function InsicAppIcon({ size = 40, className, style }: InsicAppIconProps) {
  return (
    <Image
      src="/logos/insic-app-icon-cropped.png"
      alt="insic"
      width={size}
      height={size}
      className={className}
      style={{ display: "block", ...style }}
    />
  );
}

// ─── Logo lockup ─────────────────────────────────────────────────────────────
// Renders the beige card app icon. The PNG has a transparent outer area with
// a beige rounded-square inside; border-radius 22% clips the PNG to show only
// the beige card (no white bounding box).

export type LogoSize = "sm" | "md" | "lg";

const LOCKUP_SIZES: Record<LogoSize, { size: number }> = {
  sm: { size: 28 },   // app sidebar, auth pages
  md: { size: 32 },   // app topbar
  lg: { size: 40 },   // landing navbar
};

export type InsicLogoLockupProps = {
  size?: LogoSize;
  on?: "light" | "dark";
  className?: string;
  style?: React.CSSProperties;
};

export function InsicLogoLockup({
  size = "md",
  on: _on = "light",
  className,
  style,
}: InsicLogoLockupProps) {
  const { size: iconSize } = LOCKUP_SIZES[size];

  return (
    <span
      className={className}
      style={{ display: "inline-flex", lineHeight: 0, userSelect: "none", ...style }}
      role="img"
      aria-label="insic"
    >
      <Image
        src="/logos/insic-app-icon-cropped.png"
        alt="insic"
        width={iconSize}
        height={iconSize}
        style={{ display: "block", flexShrink: 0 }}
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
    <InsicLogoLockup size="md" on={mono ? "dark" : "light"} className={className} style={style} />
  );
}
