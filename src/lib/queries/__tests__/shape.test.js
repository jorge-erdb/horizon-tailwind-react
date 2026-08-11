import { describe, it, expect } from "vitest";
import {
  pivot,
  totalsByDim,
  hourLabel,
  dayLabel,
  monthLabel,
  isCurrentMonth,
  startOfTodayIso,
} from "lib/queries/shape";
import fixture from "./metric-points.fixture.json";

/**
 * The fixture is real output from supabase/migrations/0006_seed.sql, captured
 * from the same throwaway Postgres the migration tests use. Hand-written rows
 * would have been tidier and would have missed the thing that actually
 * matters: PostgREST returns metric rows interleaved, not grouped by series.
 */

describe("pivot", () => {
  it("aligns interleaved series against a shared bucket axis", () => {
    const { buckets, series } = pivot(fixture.monthly, (row) => row.metric_key);

    expect(series).toHaveLength(2);
    // The failure this guards: a per-series push would give each series
    // whatever count its own rows happened to have, silently shifting points.
    series.forEach((entry) => {
      expect(entry.data).toHaveLength(buckets.length);
    });

    // Buckets must come out sorted ascending — the chart reads left to right.
    expect([...buckets]).toEqual([...buckets].sort());
  });

  it("puts each value against its own bucket, not its arrival order", () => {
    const revenue = fixture.monthly.filter((r) => r.metric_key === "revenue");
    const { buckets, series } = pivot(fixture.monthly, (row) => row.metric_key);
    const revenueSeries = series.find((s) => s.name === "revenue");

    revenue.forEach((row) => {
      expect(revenueSeries.data[buckets.indexOf(row.bucket)]).toBe(
        Number(row.value)
      );
    });
  });

  it("fills a missing point with zero instead of shifting the series", () => {
    const rows = [
      { bucket: "2026-01-01T00:00:00Z", dims: { stream: "usage" }, value: 10 },
      { bucket: "2026-01-02T00:00:00Z", dims: { stream: "usage" }, value: 20 },
      // No 'services' row on Jan 1 — the day it did not report.
      { bucket: "2026-01-02T00:00:00Z", dims: { stream: "services" }, value: 5 },
    ];

    const { series } = pivot(rows, (row) => row.dims?.stream);
    const services = series.find((s) => s.name === "services");

    // The bug: [5] instead of [0, 5], which draws Jan 2's revenue on Jan 1.
    expect(services.data).toEqual([0, 5]);
  });

  it("ignores rows whose series key is absent rather than bucketing them under undefined", () => {
    const rows = [
      { bucket: "2026-01-01T00:00:00Z", dims: {}, value: 10 },
      { bucket: "2026-01-01T00:00:00Z", dims: { stream: "usage" }, value: 20 },
    ];
    const { series } = pivot(rows, (row) => row.dims?.stream);

    expect(series.map((s) => s.name)).toEqual(["usage"]);
  });

  it("handles an empty workspace without throwing", () => {
    expect(pivot([], (row) => row.metric_key)).toEqual({
      buckets: [],
      series: [],
    });
  });

  it("keeps the three seeded revenue streams aligned across seven days", () => {
    const { buckets, series } = pivot(fixture.streams, (r) => r.dims?.stream);

    expect(series.map((s) => s.name).sort()).toEqual([
      "services",
      "subscriptions",
      "usage",
    ]);
    series.forEach((entry) => {
      expect(entry.data).toHaveLength(buckets.length);
      // Seeded revenue is positive every day; a zero here means a dropped row.
      expect(entry.data.every((value) => value > 0)).toBe(true);
    });
  });
});

describe("totalsByDim", () => {
  it("sums the seeded sessions by platform, largest first", () => {
    const { labels, series, percentages, total } = totalsByDim(
      fixture.sessions,
      "platform"
    );

    expect(labels).toEqual(["Web", "Mobile", "Api"]);
    expect([...series]).toEqual([...series].sort((a, b) => b - a));
    expect(total).toBe(series.reduce((sum, value) => sum + value, 0));
    // Rounding can cost a point; anything further off is a real bug.
    expect(Math.abs(percentages.reduce((a, b) => a + b, 0) - 100)).toBeLessThanOrEqual(1);
  });

  it("returns zeros rather than NaN when there is nothing to divide by", () => {
    expect(totalsByDim([], "platform")).toEqual({
      labels: [],
      series: [],
      percentages: [],
      total: 0,
    });
  });
});

/**
 * The suite runs in America/Monterrey (UTC-6), pinned in vite.config.mjs.
 *
 * These assertions are only meaningful at a negative offset: a UTC-midnight
 * bucket formatted in local time lands on the previous day, so in UTC the
 * correct and incorrect implementations agree and every one of these passes
 * either way. Timestamps below carry an explicit Z for the same reason --
 * a bare "2026-08-01T00:00:00" is parsed as local and quietly re-introduces
 * the frame the code is supposed to be free of.
 */

describe("timezone handling", () => {
  it("labels a UTC month bucket as that month, not the previous one", () => {
    // 2026-08-01T00:00:00Z is 2026-07-31 18:00 in UTC-6.
    expect(monthLabel("2026-08-01T00:00:00Z")).toBe("Aug");
  });

  it("labels a UTC day bucket as that weekday", () => {
    // 2026-08-05 is a Wednesday; local time would render it as Tuesday.
    expect(dayLabel("2026-08-05T00:00:00Z")).toBe("Wed");
  });

  it("labels an hour bucket by its UTC hour", () => {
    expect(hourLabel("2026-01-01T09:00:00Z")).toBe("09:00");
  });

  it("zero-pads so the axis does not jump from 9:00 to 10:00 width", () => {
    expect(hourLabel("2026-01-01T09:00:00Z")).toHaveLength(5);
  });

  it("starts the traffic window at UTC midnight", () => {
    const iso = startOfTodayIso(new Date("2026-08-10T15:30:00Z"));
    expect(iso).toBe("2026-08-10T00:00:00.000Z");
  });
});

describe("isCurrentMonth", () => {
  // Guards the revenue delta: the current month is still accumulating, so
  // including it reports a collapse that is really just the month being young.
  // Observed live as "-62.36%" on the 10th of the month.
  const now = new Date("2026-08-10T12:00:00Z");

  it("recognises the still-accumulating month", () => {
    // The regression: in UTC-6 this bucket's local month is July, so a
    // local-time check called August's partial month "complete" and compared
    // ten days of revenue against a full July.
    expect(isCurrentMonth("2026-08-01T00:00:00Z", now)).toBe(true);
  });

  it("treats the previous month as complete", () => {
    expect(isCurrentMonth("2026-07-01T00:00:00Z", now)).toBe(false);
  });

  it("does not match the same month a year earlier", () => {
    expect(isCurrentMonth("2025-08-01T00:00:00Z", now)).toBe(false);
  });

  it("returns false for an unparseable bucket rather than throwing", () => {
    expect(isCurrentMonth("not a date", now)).toBe(false);
  });
});
