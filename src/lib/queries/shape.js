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

export function startOfTodayIso(now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
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
  new Date(iso).toLocaleDateString(undefined, { month: "short" });

export const dayLabel = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short" });

export const hourLabel = (iso) =>
  `${String(new Date(iso).getHours()).padStart(2, "0")}:00`;

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
