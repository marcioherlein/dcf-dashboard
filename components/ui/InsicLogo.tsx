import * as React from "react";

// ─── Mark SVG (pure geometry — no text, no image load) ───────────────────────

type MarkProps = {
  className?: string;
  style?: React.CSSProperties;
  mono?: boolean;
  title?: string;
};

function InsicMark({ className, style, mono = false, title = "insic" }: MarkProps) {
  const olive = mono ? "currentColor" : "#5F790B";
  const ink = mono ? "currentColor" : "#06101F";
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 124 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      aria-hidden={title === "" ? true : undefined}
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

// ─── Lockup component ─────────────────────────────────────────────────────────
//
// The mark viewBox is 124×160. At rendered size 24×34 (scale 0.2125):
//   · Olive dot bottom  ≈  7.7 px from top of SVG
//   · Bars top          ≈ 11.5 px
//   · Bars bottom       ≈ 29.5 px   (center ≈ 20.5 px)
//
// Inter 22px: cap-height ≈ 73% of em = 16px  → cap center ≈ 8px from text top.
// To align cap-center with bars-center:  translateY(20.5 - 8) ≈ translateY(12px)
//
// align-items: flex-start so the full lockup height is driven by the mark (34px),
// and the wordmark shifts down into the bars zone, leaving the dot clearly above.

type LockupSize = "sm" | "md" | "lg";

const SIZES: Record<LockupSize, {
  markW: number; markH: number;
  fontSize: number; translateY: number;
  gap: number;
}> = {
  //  sm — pricing breadcrumb header, compact contexts
  sm: { markW: 18, markH: 26, fontSize: 17, translateY: 9,  gap: 6 },
  //  md — app TopBar, Sidebar (default)
  md: { markW: 24, markH: 34, fontSize: 22, translateY: 12, gap: 8 },
  //  lg — landing navbar, redeem page hero
  lg: { markW: 29, markH: 41, fontSize: 27, translateY: 15, gap: 9 },
};

export type InsicLogoLockupProps = {
  size?: LockupSize;
  mono?: boolean;
  /** Dark backgrounds: pass "white" to flip ink + dot to white */
  on?: "light" | "dark";
  className?: string;
  style?: React.CSSProperties;
};

export function InsicLogoLockup({
  size = "md",
  mono = false,
  on = "light",
  className,
  style,
}: InsicLogoLockupProps) {
  const s = SIZES[size];
  const ink = on === "dark" ? "#FFFFFF" : "#06101F";

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "flex-start",
        gap: s.gap,
        lineHeight: 1,
        userSelect: "none",
        ...style,
      }}
      aria-label="insic"
      role="img"
    >
      {/* Mark — fixed pixel size so scaling is explicit, not implicit */}
      <InsicMark
        style={{ width: s.markW, height: s.markH, flexShrink: 0, display: "block" }}
        mono={mono || on === "dark"}
        title=""
      />
      {/* Wordmark — shifted down so cap-height aligns with bars center */}
      <span
        aria-hidden
        style={{
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
          fontSize: s.fontSize,
          fontWeight: 780,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          color: ink,
          transform: `translateY(${s.translateY}px)`,
          display: "block",
        }}
      >
        insic
      </span>
    </span>
  );
}

// ─── Legacy variant API (kept for any callers that still use it) ──────────────

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
      <InsicMark className={className} style={style} mono={mono} title={title} />
    );
  }

  // horizontal / wordmark → delegate to lockup (horizontal = md by default)
  return (
    <InsicLogoLockup
      size="md"
      mono={mono}
      className={className}
      style={style}
    />
  );
}
