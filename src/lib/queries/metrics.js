import { unwrap, useWorkspaceQuery } from "lib/queries/base";
import {
  isoDaysAgo,
  startOfTodayIso,
  pivot,
  totalsByDim,
  titleCase,
  monthLabel,
  dayLabel,
  hourLabel,
} from "lib/queries/shape";

/**
 * metric_points — the one table behind every chart, sliced four ways.
 *
 * Each hook returns a shape the chart can hand straight to ApexCharts:
 * `{ categories, series }`, where `series` is `[{ name, data }]`. Pivoting
 * here rather than in the components means the four charts share one
 * definition of "a gap in the data is a zero, not a missing point", and the
 * chart components stay presentational.
 *
 * The shaping itself lives in ./shape.js so it can be tested without React.
 */

// --- the six KPI tiles, in one round trip -----------------------------------

export function useDashboardKpis(windowDays = 30) {
  return useWorkspaceQuery(
    "dashboard_kpis",
    async ({ workspaceId, supabase }) => {
      const rows = unwrap(
        await supabase.rpc("get_dashboard_kpis", {
          target_workspace: workspaceId,
          window_days: windowDays,
        })
      );
      // The function returns `setof`, so supabase-js hands back an array even
      // though there is exactly one row.
      return rows?.[0] ?? null;
    },
    { keyExtras: [windowDays] }
  );
}

// --- revenue and profit by month (line chart) -------------------------------

export function useRevenueTrend(months = 12) {
  return useWorkspaceQuery(
    "metrics_revenue_trend",
    async ({ workspaceId, supabase }) => {
      const rows = unwrap(
        await supabase
          .from("metric_points")
          .select("bucket, metric_key, value")
          .eq("workspace_id", workspaceId)
          .eq("grain", "month")
          .in("metric_key", ["revenue", "profit"])
          .order("bucket", { ascending: true })
      );

      const { buckets, series } = pivot(rows, (row) => row.metric_key);
      // Trim after pivoting: slicing the flat rows first could cut a month's
      // revenue row while keeping its profit row, misaligning the two series.
      const keep = Math.min(months, buckets.length);
      const start = buckets.length - keep;

      const trimmed = ["revenue", "profit"]
        .map((key) => series.find((entry) => entry.name === key))
        .filter(Boolean)
        .map((entry) => ({
          // Fixed order so revenue always takes the primary brand colour, even
          // in a workspace that has profit rows and no revenue rows yet.
          name: entry.name === "revenue" ? "Revenue" : "Profit",
          data: entry.data.slice(start),
        }));

      return {
        categories: buckets.slice(start).map(monthLabel),
        series: trimmed,
        total:
          trimmed
            .find((entry) => entry.name === "Revenue")
            ?.data.reduce((sum, value) => sum + value, 0) ?? 0,
      };
    },
    { keyExtras: [months] }
  );
}

// --- revenue by stream, last 7 days (stacked bar) ---------------------------

export function useRevenueByStream(days = 7) {
  return useWorkspaceQuery(
    "metrics_revenue_by_stream",
    async ({ workspaceId, supabase }) => {
      const rows = unwrap(
        await supabase
          .from("metric_points")
          .select("bucket, dims, value")
          .eq("workspace_id", workspaceId)
          .eq("grain", "day")
          .eq("metric_key", "revenue")
          .gte("bucket", isoDaysAgo(days))
          .order("bucket", { ascending: true })
      );

      const { buckets, series } = pivot(rows, (row) => row.dims?.stream);

      return {
        categories: buckets.map(dayLabel),
        series: series.map((entry) => ({
          ...entry,
          name: titleCase(entry.name),
        })),
      };
    },
    { keyExtras: [days] }
  );
}

// --- visitors by hour, today (bar chart) ------------------------------------

export function useDailyTraffic() {
  return useWorkspaceQuery(
    "metrics_daily_traffic",
    async ({ workspaceId, supabase }) => {
      const rows = unwrap(
        await supabase
          .from("metric_points")
          .select("bucket, value")
          .eq("workspace_id", workspaceId)
          .eq("grain", "hour")
          .eq("metric_key", "visitors")
          .gte("bucket", startOfTodayIso())
          .order("bucket", { ascending: true })
      );

      return {
        categories: rows.map((row) => hourLabel(row.bucket)),
        series: [
          { name: "Visitors", data: rows.map((row) => Number(row.value)) },
        ],
        total: rows.reduce((sum, row) => sum + Number(row.value), 0),
      };
    }
  );
}

// --- sessions by platform (donut) -------------------------------------------

export function useSessionsByPlatform(days = 30) {
  return useWorkspaceQuery(
    "metrics_sessions_by_platform",
    async ({ workspaceId, supabase }) => {
      const rows = unwrap(
        await supabase
          .from("metric_points")
          .select("dims, value")
          .eq("workspace_id", workspaceId)
          .eq("grain", "day")
          .eq("metric_key", "sessions")
          .gte("bucket", isoDaysAgo(days))
      );

      return totalsByDim(rows, "platform");
    },
    { keyExtras: [days] }
  );
}
