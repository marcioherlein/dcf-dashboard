import * as React from "react";
import Image from "next/image";

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
  const olive = mono ? "currentColor" : "#5F790B";
  const ink = "currentColor";

  if (variant === "mark") {
    return (
      <svg
        className={className}
        style={style}
        viewBox="0 0 124 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={title}
      >
        <title>{title}</title>
        <circle cx="62.6" cy="24.2" r="12.15" fill={olive} />
        <rect x="36.95" y="53.9"  width="51.3" height="9.45" rx="1.69" fill={ink} />
        <rect x="36.95" y="72.8"  width="51.3" height="9.45" rx="1.69" fill={ink} />
        <rect x="36.95" y="91.7"  width="62.1" height="9.45" rx="1.69" fill={ink} />
        <rect x="36.95" y="110.6" width="56.7" height="9.45" rx="1.69" fill={ink} />
        <rect x="36.95" y="129.5" width="45.9" height="9.45" rx="1.69" fill={ink} />
      </svg>
    );
  }

  if (variant === "wordmark") {
    // 230×100 viewBox — wordmark only, no mark icon
    const src = mono
      ? "/brand/insic-wordmark.png"
      : "/brand/insic-wordmark.png";
    return (
      <Image
        src={src}
        alt={title}
        width={230}
        height={100}
        className={className}
        style={{ width: "auto", ...style }}
        priority
      />
    );
  }

  // horizontal — mark + wordmark side by side (340×120 → 17:6)
  const src = mono
    ? "/brand/insic-logo-horizontal-mono.png"
    : "/brand/insic-logo-horizontal.png";

  return (
    <Image
      src={src}
      alt={title}
      width={340}
      height={120}
      className={className}
      style={{ width: "auto", ...style }}
      priority
    />
  );
}
