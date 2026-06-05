import * as React from "react";
import Image from "next/image";

// ─── Mark SVG ────────────────────────────────────────────────────────────────
// Used only for mono/dark contexts (footer, dark surfaces) and the legacy API.
// The lockup uses the PNG icon (includes white card background) in light mode.

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

// ─── App icon ─────────────────────────────────────────────────────────────────
// Displays the PNG icon (white card + olive dot + bars) at a given pixel size.

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
      style={{
        // borderRadius clips the cream bg exactly at the card edge (card inset ≈ 21% of PNG)
        borderRadius: Math.round(size * 0.21),
        display: "block",
        ...style,
      }}
    />
  );
}

// ─── Logo lockup ─────────────────────────────────────────────────────────────
//
// Light mode: PNG icon (white card, olive dot, bars) + Inter wordmark.
// Dark mode:  Mono SVG mark (all-white) + white wordmark.
//
// alignItems: "center" replaces the old translateY hack. With lineHeight: 1 on
// the wordmark span, both elements' geometric centers align naturally.

export type LogoSize = "sm" | "md" | "lg";

const LOCKUP_SIZES: Record<LogoSize, { iconSize: number; fontSize: number; gap: number }> = {
  // sm: 22px icon  / 15px type  — pricing page, tight contexts
  sm: { iconSize: 22, fontSize: 15, gap: 5 },
  // md: 26px icon  / 17px type  — app sidebar, TopBar, auth pages
  md: { iconSize: 26, fontSize: 17, gap: 6 },
  // lg: 30px icon  / 20px type  — landing navbar
  lg: { iconSize: 30, fontSize: 20, gap: 7 },
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
  const { iconSize, fontSize, gap } = LOCKUP_SIZES[size];
  const dark = on === "dark";
  const ink  = dark ? "#FFFFFF" : "#06101F";

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap,
        lineHeight: 1,
        userSelect: "none",
        ...style,
      }}
      role="img"
      aria-label="insic"
    >
      {dark ? (
        // Dark surfaces: SVG mark renders in mono white, no card background needed
        <InsicMark
          style={{
            // Mark viewBox is 70×106; scale so height matches icon slot
            width: Math.round(iconSize * 70 / 106),
            height: iconSize,
            flexShrink: 0,
            display: "block",
          }}
          mono={true}
        />
      ) : (
        // Light surfaces: PNG icon shows the full white-card app icon
        <Image
          src="/logos/insic-icon.png"
          alt=""
          width={iconSize}
          height={iconSize}
          aria-hidden="true"
          style={{
            borderRadius: Math.round(iconSize * 0.21),
            display: "block",
            flexShrink: 0,
            filter: "drop-shadow(0 1px 4px rgba(6,16,31,0.10))",
          }}
        />
      )}
      <span
        style={{
          fontFamily: "var(--font-sans, Inter, ui-sans-serif, sans-serif)",
          fontSize: `${fontSize}px`,
          fontWeight: 760,
          letterSpacing: `${(-0.045 * fontSize).toFixed(2)}px`,
          color: ink,
          lineHeight: 1,
          display: "block",
          flexShrink: 0,
        }}
      >
        insic
      </span>
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
