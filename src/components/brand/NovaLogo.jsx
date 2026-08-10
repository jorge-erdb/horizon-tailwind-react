/**
 * Nova Analytics logo.
 *
 * Rendered as inline SVG rather than <img> so the wordmark can inherit
 * theme-aware colors — the static files in assets/img/layout/nova hardcode
 * ink (#0F172A) for the wordmark, which disappears on dark surfaces.
 *
 * variant: "mark" | "horizontal" | "stacked"
 */

const Bars = ({ markColor, sparkColor }) => (
  <>
    <rect x="14" y="62" width="14" height="24" rx="3" fill={markColor} />
    <rect x="36" y="46" width="14" height="40" rx="3" fill={markColor} />
    <rect x="58" y="30" width="14" height="56" rx="3" fill={markColor} />
    <path
      d="M65 8 L68.5 16.5 L77 20 L68.5 23.5 L65 32 L61.5 23.5 L53 20 L61.5 16.5 Z"
      fill={sparkColor}
    />
  </>
);

const NovaLogo = ({
  variant = "horizontal",
  className = "",
  markColor = "#4F46E5",
  sparkColor = "#22D3EE",
  // Wordmark colors default to currentColor so the parent controls light/dark.
  wordColor = "currentColor",
  subColor = "currentColor",
}) => {
  const title = "Nova Analytics";

  if (variant === "mark") {
    return (
      <svg
        viewBox="0 0 100 100"
        className={className}
        role="img"
        aria-label={title}
        xmlns="http://www.w3.org/2000/svg"
      >
        <Bars markColor={markColor} sparkColor={sparkColor} />
      </svg>
    );
  }

  if (variant === "stacked") {
    return (
      <svg
        viewBox="0 0 200 170"
        className={className}
        role="img"
        aria-label={title}
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform="translate(50, 0)">
          <Bars markColor={markColor} sparkColor={sparkColor} />
        </g>
        <text
          x="100"
          y="130"
          textAnchor="middle"
          fontFamily="'Space Grotesk', 'Sora', system-ui, sans-serif"
          fontWeight="700"
          fontSize="30"
          fill={wordColor}
          letterSpacing="0.5"
        >
          Nova
        </text>
        <text
          x="100"
          y="156"
          textAnchor="middle"
          fontFamily="'Space Grotesk', 'Sora', system-ui, sans-serif"
          fontWeight="500"
          fontSize="18"
          fill={subColor}
          letterSpacing="3"
          opacity="0.7"
        >
          ANALYTICS
        </text>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 360 100"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <Bars markColor={markColor} sparkColor={sparkColor} />
      <text
        x="100"
        y="58"
        fontFamily="'Space Grotesk', 'Sora', system-ui, sans-serif"
        fontWeight="700"
        fontSize="34"
        fill={wordColor}
        letterSpacing="0.5"
      >
        Nova
      </text>
      <text
        x="185"
        y="58"
        fontFamily="'Space Grotesk', 'Sora', system-ui, sans-serif"
        fontWeight="500"
        fontSize="34"
        fill={subColor}
        letterSpacing="0.5"
        opacity="0.7"
      >
        Analytics
      </text>
    </svg>
  );
};

export default NovaLogo;
