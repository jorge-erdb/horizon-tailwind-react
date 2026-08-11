import { QueryClient } from "@tanstack/react-query";

/**
 * One QueryClient for the app.
 *
 * Defaults are tuned for a dashboard rather than a feed: the numbers behind a
 * chart change on a rollup schedule, not per second, so refetching on every
 * window focus produces flicker and load without telling anyone anything new.
 *
 * Retries are deliberately conservative. A failing Supabase query is usually a
 * permission or schema problem, and those fail identically three times over —
 * retrying only turns a fast error state into a slow one. Genuine network
 * blips are the one case worth a second attempt.
 */

const NON_RETRYABLE = new Set([
  "42501", // insufficient_privilege
  "42P01", // undefined_table — migration not run
  "42883", // undefined_function — RPC missing
  "PGRST116", // no rows where exactly one was expected
  "PGRST202", // RPC not found in the schema cache
]);

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (NON_RETRYABLE.has(error?.code)) return false;
          return failureCount < 1;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export default createQueryClient;
