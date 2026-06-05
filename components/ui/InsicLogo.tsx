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
// Icon + "insic" wordmark. Font matches brand spec: Inter 760 weight, -0.04em tracking.

export type LogoSize = "sm" | "md" | "lg";

const LOCKUP_SIZES: Record<LogoSize, { iconSize: number; fontSize: number; gap: number }> = {
  sm: { iconSize: 24, fontSize: 15, gap: 7  },
  md: { iconSize: 28, fontSize: 17, gap: 8  },
  lg: { iconSize: 34, fontSize: 21, gap: 10 },
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
  const textColor = on === "dark" ? "#FFFFFF" : "#06101F";

  return (
    <span
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap, lineHeight: 1, userSelect: "none", ...style }}
      role="img"
      aria-label="insic"
    >
      <Image
        src="/logos/insic-app-icon-cropped.png"
        alt=""
        aria-hidden="true"
        width={iconSize}
        height={iconSize}
        style={{ display: "block", flexShrink: 0 }}
      />
      <span
        style={{
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          fontWeight: 760,
          fontSize,
          letterSpacing: "-0.04em",
          color: textColor,
          lineHeight: 1,
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
    return <InsicMark className={className} style={style} mono={mono} title={title} />;
  }
  return (
    <InsicLogoLockup size="md" on={mono ? "dark" : "light"} className={className} style={style} />
  );
}
