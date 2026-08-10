import NovaLogo from "components/brand/NovaLogo";

/**
 * Shown while a lazily-loaded route chunk is in flight. Deliberately the same
 * treatment ProtectedRoute uses for its session check, so a cold load into the
 * dashboard reads as one continuous wait rather than two different spinners.
 */
const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-navy-900">
    <NovaLogo
      variant="mark"
      className="h-12 w-12 animate-pulse"
      aria-label="Loading"
    />
  </div>
);

export default RouteFallback;
