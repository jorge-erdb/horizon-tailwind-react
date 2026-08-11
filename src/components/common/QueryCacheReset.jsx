import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "contexts/AuthContext";

/**
 * Drops the entire query cache whenever the signed-in user changes.
 *
 * Query keys are workspace-scoped, which stops one tenant's rows being served
 * to another. It does not cover two users of the *same* workspace on the same
 * machine: notifications are filtered per user by RLS, so a cached list from
 * the previous account would still be sitting under an identical key. Clearing
 * on identity change closes that, and frees the memory on sign-out.
 *
 * Skips the first run — there is nothing cached before the initial session
 * resolves, and clearing then would throw away in-flight queries.
 */
const QueryCacheReset = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const previousUserId = useRef(null);
  const initialised = useRef(false);

  useEffect(() => {
    const userId = session?.user?.id ?? null;

    if (!initialised.current) {
      initialised.current = true;
      previousUserId.current = userId;
      return;
    }

    if (previousUserId.current !== userId) {
      previousUserId.current = userId;
      queryClient.clear();
    }
  }, [session?.user?.id, queryClient]);

  return null;
};

export default QueryCacheReset;
