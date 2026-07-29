type BrandLogoProps = {
  compact?: boolean;
  light?: boolean;
};

export function BrandLogo({ compact = false, light = false }: BrandLogoProps) {
  const textColor = light ? "#ffffff" : "#0f6a3a";

  return (
    <div className={`brand-logo ${compact ? "brand-logo--compact" : ""}`} aria-label="سلامت اول">
      <svg viewBox="0 0 92 76" role="img" aria-hidden="true">
        <path
          d="M42 68C26 55 14 40 14 25C14 12 23 5 34 5C46 5 54 14 58 22"
          fill="none"
          stroke="#e51e27"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <circle cx="64" cy="13" r="8" fill="#13713f" />
        <path
          d="M53 25L61 35L69 24C75 18 82 16 88 17"
          fill="none"
          stroke="#13713f"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {!compact && (
        <div className="brand-logo__text">
          <strong style={{ color: textColor }}>
            سلامت <span>اول</span>
          </strong>
          <small style={{ color: light ? "rgba(255,255,255,.76)" : "#0f6a3a" }}>
            کرامت، آرامش، کامیابی
          </small>
        </div>
      )}
    </div>
  );
}
