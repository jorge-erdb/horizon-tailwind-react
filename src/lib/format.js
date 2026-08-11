/**
 * Display formatting for values coming out of Postgres.
 *
 * Centralised because the dashboard shows the same number in two places more
 * than once — the "Data Sources" tile and the table beneath it, the revenue
 * total and the chart it sits next to. Two call sites rounding differently is
 * a support ticket that looks like a data bug.
 *
 * Every helper tolerates null/undefined: numeric columns are nullable, and an
 * unseeded workspace legitimately has nothing to show.
 */

const num = (value) => {
  // Postgres numeric arrives as a string over PostgREST to preserve precision.
  const parsed = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : null;
};

/** Compact currency: $1.2K, $340.5K, $1.4M. */
export function formatCurrency(value, { currency = "USD" } = {}) {
  const n = num(value);
  if (n === null) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

/** Compact count: 1,766 → 1.8K, 4,608,657 → 4.6M. */
export function formatCompact(value) {
  const n = num(value);
  if (n === null) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

/** Exact count with thousands separators, for tables. */
export function formatCount(value) {
  const n = num(value);
  if (n === null) return "—";
  return new Intl.NumberFormat().format(n);
}

export function formatPercent(value, { digits = 1 } = {}) {
  const n = num(value);
  if (n === null) return "—";
  return `${n.toFixed(digits)}%`;
}

/**
 * A period-over-period change, or null when there is nothing to compare to.
 *
 * Returns null rather than "+0.00%" for a missing delta: a workspace with one
 * month of history has no previous period, and showing a flat zero implies
 * "no change" when the truth is "no basis for comparison". The RPC returns 0
 * in both cases, which is why callers get null only for genuinely absent
 * input — see the comment in get_dashboard_kpis about that ambiguity.
 */
export function formatDelta(value) {
  const n = num(value);
  if (n === null) return null;
  const rounded = Math.abs(n) < 0.005 ? 0 : n;
  return {
    positive: rounded >= 0,
    label: `${rounded >= 0 ? "+" : ""}${rounded.toFixed(2)}%`,
  };
}

/** "Apr 26, 2026" — the format the existing tables already render. */
export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Relative time for notification rows: "2h ago", "3d ago". */
export function formatRelative(value, now = Date.now()) {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.round((then - now) / 1000);
  const units = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
    ["week", 4.35],
    ["month", 12],
    ["year", Infinity],
  ];

  let scaled = seconds;
  for (const [unit, span] of units) {
    if (Math.abs(scaled) < span || span === Infinity) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
        Math.round(scaled),
        unit
      );
    }
    scaled /= span;
  }
  return "";
}
