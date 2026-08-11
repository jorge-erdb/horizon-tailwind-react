/**
 * Pure shaping helpers for metric_points.
 *
 * Split out from metrics.js so they can be exercised without React, a
 * Supabase session or a network. The pivot is the one piece of real logic in
 * the data layer — everything else is a select — and its failure mode is
 * silent: a chart that renders happily with points attached to the wrong day.
 */

const DAY = 24 * 60 * 60 * 1000;

export function isoDaysAgo(days, now = Date.now()) {
  return new Date(now - days * DAY).toISOString();
}

/**
 * Every label below is rendered in UTC, and that is not a stylistic choice.
 *
 * Buckets come from date_trunc(...) in Postgres, so they are UTC boundaries:
 * August's revenue arrives as 2026-08-01T00:00:00Z. Formatting that in local
 * time west of Greenwich yields "Jul" — the axis label disagrees with the
 * bucket the value belongs to, and every point silently slides one position.
 * Observed live in America/Monterrey (UTC-6): a four-month chart of May–Aug
 * was labelled Apr–Jul, and a week starting Wednesday was labelled from
 * Tuesday.
 *
 * The honest fix is to label the bucket as the database defined it. A viewer
 * in UTC-6 reading "Aug" gets the month Postgres aggregated, which is the
 * number they can reconcile against a SQL query.
 */

/**
 * True when an ISO bucket falls in the current UTC month.
 *
 * Used to exclude the still-accumulating month from period-over-period
 * comparisons.
 */
export function isCurrentMonth(iso, now = new Date()) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth()
  );
}

/**
 * Midnight UTC today, matching the UTC hour buckets the traffic chart reads.
 *
 * Local midnight would cut the window at 06:00Z in UTC-6, dropping the first
 * six bars of the UTC day while the axis still labelled the rest in UTC — a
 * chart missing its morning for no visible reason.
 */
export function startOfTodayIso(now = new Date()) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  return today.toISOString();
}

/**
 * Pivots flat metric rows into aligned series.
 *
 * Every series is filled against the full sorted set of buckets, so a stream
 * that reported nothing on a given day draws a zero rather than shifting the
 * rest of its points one position to the left — which is how a stacked bar
 * chart ends up quietly lying about which day a number belongs to.
 */
export function pivot(rows, seriesNameOf) {
  const buckets = [...new Set(rows.map((row) => row.bucket))].sort();
  const bucketIndex = new Map(buckets.map((bucket, index) => [bucket, index]));

  const bySeries = new Map();
  rows.forEach((row) => {
    const name = seriesNameOf(row);
    if (name == null) return;
    if (!bySeries.has(name)) {
      bySeries.set(name, new Array(buckets.length).fill(0));
    }
    bySeries.get(name)[bucketIndex.get(row.bucket)] = Number(row.value);
  });

  return {
    buckets,
    series: [...bySeries.entries()].map(([name, data]) => ({ name, data })),
  };
}

export const titleCase = (value) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export const monthLabel = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    timeZone: "UTC",
  });

export const dayLabel = (iso) =>
  new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    timeZone: "UTC",
  });

export const hourLabel = (iso) =>
  `${String(new Date(iso).getUTCHours()).padStart(2, "0")}:00`;

/** Sums `sessions` rows by platform and converts to display percentages. */
export function totalsByDim(rows, dimKey) {
  const totals = new Map();
  rows.forEach((row) => {
    const key = row.dims?.[dimKey];
    if (!key) return;
    totals.set(key, (totals.get(key) ?? 0) + Number(row.value));
  });

  // Largest first, so colour order matches legend order regardless of which
  // platforms a given workspace actually reports.
  const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  return {
    labels: entries.map(([key]) => titleCase(key)),
    series: entries.map(([, value]) => value),
    percentages: entries.map(([, value]) =>
      total === 0 ? 0 : Math.round((value / total) * 100)
    ),
    total,
  };
}
