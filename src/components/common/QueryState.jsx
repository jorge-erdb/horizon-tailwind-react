import NovaLogo from "components/brand/NovaLogo";
import AuthFeedback from "views/auth/components/AuthFeedback";
import { describeQueryError } from "lib/queries/base";

/**
 * The three states every data-backed card has to handle, in one place.
 *
 * Without this each card grows its own version, they drift, and the ones
 * written last quietly render `undefined.map` on a slow connection. The
 * render-prop shape means `children` only ever runs with settled data.
 */

export function QueryLoading({ className = "" }) {
  return (
    <div
      className={`flex min-h-[140px] items-center justify-center ${className}`}
      role="status"
      aria-live="polite"
    >
      <NovaLogo
        variant="mark"
        className="h-8 w-8 animate-pulse"
        aria-label="Loading"
      />
    </div>
  );
}

export function QueryEmpty({ title, body, action, className = "" }) {
  return (
    <div
      className={`flex min-h-[140px] flex-col items-center justify-center px-6 py-8 text-center ${className}`}
    >
      <p className="font-display text-base font-bold text-navy-700 dark:text-white">
        {title}
      </p>
      {body && (
        <p className="mt-1 max-w-xs text-sm text-gray-600 dark:text-gray-400">
          {body}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function QueryError({ error, className = "" }) {
  return (
    <div className={className}>
      <AuthFeedback tone="error">{describeQueryError(error)}</AuthFeedback>
    </div>
  );
}

/**
 * `isEmpty` defaults to treating an empty array as empty, which covers the
 * table and list cards. Charts pass their own predicate, since a chart's data
 * is an object whose `series` may be present but flat.
 */
const defaultIsEmpty = (data) =>
  data == null || (Array.isArray(data) && data.length === 0);

export function QueryBoundary({
  query,
  children,
  empty,
  isEmpty = defaultIsEmpty,
  loadingClassName,
  className,
}) {
  const { data, isPending, isError, error } = query;

  // isPending rather than isLoading: a query disabled until the workspace
  // resolves is pending but not loading, and rendering "no data" during that
  // window is the exact flicker this component exists to prevent.
  if (isPending) return <QueryLoading className={loadingClassName} />;
  if (isError) return <QueryError error={error} className={className} />;
  if (empty && isEmpty(data)) return empty;

  return children(data);
}

export default QueryBoundary;
