/** @type {import('tailwindcss').Config} */

/**
 * Nova Analytics design tokens.
 *
 * Source of truth: nova_analytics_id/tokens/colors.json. The brand kit
 * specifies anchor values only; intermediate ramp steps (primary 50-400,
 * neutral 200/400/600/800, accent 600-900) are interpolated here to give
 * Tailwind a usable scale. If the brand kit later ships full ramps, replace
 * the interpolated steps rather than the anchors.
 */

// Brand anchors — these values come straight from the brand kit.
const nova = {
  indigo: "#4F46E5",
  indigoDark: "#3730A3",
  indigoDarker: "#1E1B4B",
  spark: "#22D3EE",
  sparkLight: "#67E8F9",
  amber: "#F5A623",
  ink: "#0F172A",
  gray700: "#334155",
  gray500: "#64748B",
  gray300: "#CBD3E1",
  gray100: "#EEF1F6",
  gray50: "#F8FAFC",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#DC2626",
  info: "#4F46E5",
};

// Primary — indigo. 500 = brand indigo, 700 = hover/pressed, 900 = dark surface.
const primary = {
  50: "#EEF2FF",
  100: "#E0E7FF",
  200: "#C7D2FE",
  300: "#A5B4FC",
  400: "#818CF8",
  500: nova.indigo,
  600: "#4338CA",
  700: nova.indigoDark,
  800: "#312E81",
  900: nova.indigoDarker,
};

// Accent — spark cyan. 300 = spark tint, 500 = spark.
const accent = {
  50: "#ECFEFF",
  100: "#CFFAFE",
  200: "#A5F3FC",
  300: nova.sparkLight,
  400: "#4AE0F5",
  500: nova.spark,
  600: "#06B6D4",
  700: "#0E7490",
  800: "#155E75",
  900: "#164E63",
};

// Neutral — Nova gray ramp. Anchors at 50/100/300/500/700/900.
const neutral = {
  50: nova.gray50,
  100: nova.gray100,
  200: "#DDE3EC",
  300: nova.gray300,
  400: "#94A3B8",
  500: nova.gray500,
  600: "#475569",
  700: nova.gray700,
  800: "#1E293B",
  900: nova.ink,
};

// Secondary accent — amber, used sparingly for warmth/callouts.
const amber = {
  50: "#FEF6E7",
  100: "#FDE9C4",
  200: "#FBD79B",
  300: "#F9C46B",
  400: "#F7B444",
  500: nova.amber,
  600: "#D98A15",
  700: "#B06D0F",
  800: "#8A540C",
  900: "#6B4109",
};

// Dark-mode surface ramp, running ink -> indigo-darker so dark cards pick up
// the brand's indigo tint while the page behind them stays near-ink. Retains
// the `navy` name because ~140 existing dashboard classes reference it.
const surfaceDark = {
  50: "#E4E7F2",
  100: "#C5CADF",
  200: "#9AA1C4",
  300: "#6E76A3",
  400: "#4A5081",
  500: "#343A66",
  600: "#272A56",
  700: nova.indigoDarker,
  800: "#171736",
  900: nova.ink,
};

// 1p .. 99p percentage widths, used by the dashboard progress/table components.
const percentWidths = Object.fromEntries(
  Array.from({ length: 99 }, (_, i) => [`${i + 1}p`, `${i + 1}%`])
);

module.exports = {
  darkMode: "class",
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      width: percentWidths,
      fontFamily: {
        // Display / headings
        display: ["Space Grotesk", "Sora", "system-ui", "sans-serif"],
        // Body / UI copy (also the default sans)
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        body: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        // Metrics / tables / code
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      boxShadow: {
        "3xl": "14px 17px 40px 4px",
        inset: "inset 0px 18px 22px",
        darkinset: "0px 4px 4px inset",
        nova: "0 18px 40px -12px rgba(79, 70, 229, 0.25)",
      },
      borderRadius: {
        primary: "20px",
      },
      backgroundImage: {
        "nova-gradient":
          "linear-gradient(135deg, #4F46E5 0%, #3730A3 55%, #1E1B4B 100%)",
        "nova-spark":
          "linear-gradient(135deg, #4F46E5 0%, #22D3EE 100%)",
      },
    },
    screens: {
      sm: "576px",
      "sm-max": { max: "576px" },
      md: "768px",
      "md-max": { max: "768px" },
      lg: "992px",
      "lg-max": { max: "992px" },
      xl: "1200px",
      "xl-max": { max: "1200px" },
      "2xl": "1320px",
      "2xl-max": { max: "1320px" },
      "3xl": "1600px",
      "3xl-max": { max: "1600px" },
      "4xl": "1850px",
      "4xl-max": { max: "1850px" },
    },
    colors: () => ({
      transparent: "transparent",
      current: "currentColor",
      white: "#ffffff",
      black: nova.ink,

      // --- Nova scales ---
      primary,
      accent,
      neutral,
      amber,

      // Semantic
      success: nova.success,
      warning: nova.warning,
      danger: nova.danger,
      info: nova.info,

      // --- Aliases kept for the inherited dashboard components ---
      // `brand-*` is the primary indigo scale.
      brand: primary,
      // `navy-*` is the dark-surface ramp (and deep headings in light mode).
      navy: surfaceDark,
      // `gray-*` maps onto the Nova neutral ramp. Note the inherited markup
      // uses gray-600 as its muted-text token (~100 usages), so 600 is pinned
      // to Nova's gray-500 muted value rather than the ramp's 600 step.
      gray: {
        ...neutral,
        600: nova.gray500,
      },
      // Filled chip / input / secondary-button surface on light cards.
      lightPrimary: nova.gray100,

      // Semantic color families the dashboard components reference by shade.
      red: {
        50: "#FEF2F2",
        100: "#FEE2E2",
        200: "#FECACA",
        300: "#FCA5A5",
        400: "#F87171",
        500: nova.danger,
        600: "#B91C1C",
        700: "#991B1B",
        800: "#7F1D1D",
        900: "#671717",
      },
      green: {
        50: "#F0FDF4",
        100: "#DCFCE7",
        200: "#BBF7D0",
        300: "#86EFAC",
        400: "#4ADE80",
        500: nova.success,
        600: "#15803D",
        700: "#166534",
        800: "#14532D",
        900: "#0F3D22",
      },
      yellow: {
        50: "#FFFBEB",
        100: "#FEF3C7",
        200: "#FDE68A",
        300: "#FCD34D",
        400: "#FBBF24",
        500: nova.warning,
        600: "#D97706",
        700: "#B45309",
        800: "#92400E",
        900: "#78350F",
      },
      // Cyan is the spark accent; indigo/blue/purple/teal fold onto the brand
      // scales so no stray off-palette hue can leak back into the UI.
      cyan: accent,
      teal: accent,
      indigo: primary,
      blue: primary,
      purple: primary,
      pink: primary,
      orange: amber,
      lime: accent,

      // Legacy single-value tokens from the template.
      blueSecondary: nova.indigo,
      brandLinear: primary[400],

      shadow: {
        500: "rgba(15, 23, 42, 0.08)",
      },
    }),
  },
  plugins: [],
};
