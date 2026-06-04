import * as React from "react";

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
  const ink = "currentColor";
  const olive = mono ? "currentColor" : "#5F790B";

  if (variant === "mark") {
    return (
      <svg className={className} style={style} width="124" height="160" viewBox="0 0 124 160" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={title}>
        <title>{title}</title>
        <circle cx="62.6" cy="24.2" r="12.15" fill={olive} />
        <rect x="36.95" y="53.9" width="51.3" height="9.45" rx="1.69" fill={ink} />
        <rect x="36.95" y="72.8" width="51.3" height="9.45" rx="1.69" fill={ink} />
        <rect x="36.95" y="91.7" width="62.1" height="9.45" rx="1.69" fill={ink} />
        <rect x="36.95" y="110.6" width="56.7" height="9.45" rx="1.69" fill={ink} />
        <rect x="36.95" y="129.5" width="45.9" height="9.45" rx="1.69" fill={ink} />
      </svg>
    );
  }

  if (variant === "wordmark") {
    return (
      <svg className={className} style={style} width="230" height="100" viewBox="0 0 230 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={title}>
        <title>{title}</title>
        <text x="10" y="70" fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" fontSize="62" fontWeight="760" letterSpacing="-2.5" fill={ink}>insic</text>
      </svg>
    );
  }

  return (
    <svg className={className} style={style} width="340" height="120" viewBox="0 0 340 120" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={title}>
      <title>{title}</title>
      <circle cx="54" cy="27" r="9" fill={olive} />
      <rect x="35" y="49" width="38" height="7" rx="1.25" fill={ink} />
      <rect x="35" y="63" width="38" height="7" rx="1.25" fill={ink} />
      <rect x="35" y="77" width="46" height="7" rx="1.25" fill={ink} />
      <rect x="35" y="91" width="42" height="7" rx="1.25" fill={ink} />
      <rect x="35" y="105" width="34" height="7" rx="1.25" fill={ink} />
      <text x="104" y="75" fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" fontSize="62" fontWeight="760" letterSpacing="-2.5" fill={ink}>insic</text>
    </svg>
  );
}
