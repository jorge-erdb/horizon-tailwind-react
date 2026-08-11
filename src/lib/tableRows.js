import { formatCount, formatDate } from "lib/format";

/**
 * Adapters from database rows to the shapes the Horizon table components
 * already expect.
 *
 * The tables themselves are untouched — they take a `tableData` prop and
 * render whatever is in it. What they do *not* do is document their expected
 * shape, and each one wants something slightly different from the same
 * data_sources row: CheckTable needs `name` as a [label, checked] tuple,
 * ColumnsTable wants a plain string in the same field. Getting that wrong
 * renders "[object Object]" or throws inside the cell renderer.
 *
 * Both the dashboard and the Data Tables view map the same two entities, so
 * these live here rather than being duplicated and drifting.
 */

/** data_sources → CheckTable: `name` is a [label, checked] tuple. */
export const toCheckRows = (sources = []) =>
  sources.map((source) => ({
    // The checkbox reflects whether the source is actively reporting.
    name: [source.name, source.status === "active"],
    progress: Number(source.health_pct),
    // Formatted here because CheckTable renders the cell verbatim, and a raw
    // 2458000 is unreadable beside a health percentage.
    quantity: formatCount(source.events_30d),
    date: formatDate(source.last_sync_at),
  }));

/** data_sources → ColumnsTable: same columns, but `name` is a bare string. */
export const toColumnsRows = (sources = []) =>
  sources.map((source) => ({
    name: source.name,
    progress: Number(source.health_pct),
    quantity: formatCount(source.events_30d),
    date: formatDate(source.last_sync_at),
  }));

/**
 * data_sources → DevelopmentTable, whose TECH column renders one icon per
 * entry and silently drops anything it does not recognise. The seed uses the
 * same apple/android/windows vocabulary, so `platforms` passes through.
 */
export const toDevelopmentRows = (sources = []) =>
  sources.map((source) => ({
    name: source.name,
    tech: source.platforms ?? [],
    date: formatDate(source.created_at),
    progress: Number(source.health_pct),
  }));

// reports.status is lower case in the database; ComplexTable switches on these
// exact capitalised strings to pick its icon. Mapped explicitly rather than
// title-cased, because 'disabled' has to become 'Disable' to match.
const REPORT_STATUS = {
  approved: "Approved",
  disabled: "Disable",
  error: "Error",
};

/** reports → ComplexTable. */
export const toReportRows = (reports = []) =>
  reports.map((report) => ({
    name: report.name,
    status: REPORT_STATUS[report.status] ?? "Error",
    date: formatDate(report.last_run_at),
    progress: Number(report.completion),
  }));
