import * as React from "react";
import Image from "next/image";

// ─── Mark SVG — olive dot + navy bars, transparent background ────────────────
// ViewBox "93 68 70 106": dot + 5 bars, no card background.
// Used everywhere in the lockup. PNG (with white card) is only for app-icon
// contexts (favicon, splash screen, og-image).

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

// ─── App icon — PNG with white card, for non-UI contexts ─────────────────────
// Use only where a white-carded tile is appropriate: og-image, favicon, splash.
// Never use inside the navbar or sidebar — it puts a white box on the bg.

export type InsicAppIconProps = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

export function InsicAppIcon({ size = 40, className, style }: InsicAppIconProps) {
  return (
    <Image
      src="/logos/insic-icon.png"
      alt="insic"
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: Math.round(size * 0.21), display: "block", ...style }}
    />
  );
}

// ─── Logo lockup ─────────────────────────────────────────────────────────────
// SVG mark on transparent background — works on any surface color.
// ViewBox aspect ratio is 70:106 ≈ 0.66, so markW = markH × (70/106).

export type LogoSize = "sm" | "md" | "lg";

const LOCKUP_SIZES: Record<LogoSize, { markH: number }> = {
  sm: { markH: 28 },   // app sidebar, auth pages
  md: { markH: 32 },   // app topbar
  lg: { markH: 44 },   // landing navbar
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
  const { markH } = LOCKUP_SIZES[size];
  const markW = Math.round(markH * 70 / 106);

  return (
    <span
      className={className}
      style={{ display: "inline-flex", lineHeight: 0, userSelect: "none", ...style }}
      role="img"
      aria-label="insic"
    >
      <InsicMark
        mono={on === "dark"}
        style={{ width: markW, height: markH, display: "block", flexShrink: 0 }}
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
