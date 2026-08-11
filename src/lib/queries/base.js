import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "lib/supabase";
import { useWorkspace } from "contexts/WorkspaceContext";

/**
 * Shared plumbing for every workspace-scoped query.
 *
 * Two things every module here needs and none should re-implement:
 *
 *   1. Queries must not run before the active workspace is known. Firing with
 *      `workspace_id = undefined` returns an empty result that looks exactly
 *      like a genuinely empty workspace, so the UI would render "no data" for
 *      a moment on every load.
 *   2. supabase-js resolves rather than rejects on a database error. Left
 *      alone, react-query treats a permission failure as a successful fetch of
 *      `null`. `unwrap` converts it into a thrown error so `isError` means
 *      what it says.
 */

export function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

/**
 * Query keys are always `[entity, workspaceId, ...rest]`. Keeping workspaceId
 * in the key is what makes switching workspaces safe: the cache can't hand one
 * tenant's rows to another, and the previous workspace's data stays cached for
 * a quick switch back.
 */
export function workspaceKey(entity, workspaceId, ...rest) {
  return [entity, workspaceId, ...rest];
}

export function useWorkspaceQuery(entity, queryFn, options = {}) {
  const { workspaceId } = useWorkspace();
  const { keyExtras = [], enabled = true, ...rest } = options;

  return useQuery({
    queryKey: workspaceKey(entity, workspaceId, ...keyExtras),
    queryFn: () => queryFn({ workspaceId, supabase }),
    enabled: Boolean(workspaceId) && enabled,
    ...rest,
  });
}

/**
 * Mutations invalidate by entity within the current workspace only, so saving
 * a task doesn't refetch the charts.
 */
export function useWorkspaceMutation(entities, mutationFn, options = {}) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const list = Array.isArray(entities) ? entities : [entities];

  return useMutation({
    mutationFn: (variables) => mutationFn({ ...variables, workspaceId, supabase }),
    onSuccess: (...args) => {
      list.forEach((entity) => {
        queryClient.invalidateQueries({ queryKey: [entity, workspaceId] });
      });
      options.onSuccess?.(...args);
    },
    ...options,
  });
}

/**
 * Turns a Postgres/PostgREST error into something a user can act on. The codes
 * that matter here are schema-level: they mean a migration hasn't been run,
 * which is the single most likely failure when someone first clones this repo.
 */
export function describeQueryError(error) {
  if (!error) return null;

  switch (error.code) {
    case "42P01":
      return "That table doesn't exist yet. Run the migrations in supabase/migrations against your project.";
    case "42883":
    case "PGRST202":
      // Deliberately not naming a single file: RPCs are defined across 0005,
      // 0009 and 0010, and pointing at the wrong one sends people to a file
      // they have already run and leaves them stuck.
      return "A required database function is missing. Run the migrations in supabase/migrations against your project.";
    case "42501":
      return "You don't have permission to read this. Check that you're still a member of this workspace.";
    case "P0001":
      // Raised by get_dashboard_kpis' membership guard. Reachable if access is
      // revoked while the dashboard is open, or a stale workspace id survives
      // in local storage.
      return /not a member/i.test(error.message || "")
        ? "You're no longer a member of this workspace. Sign out and back in to refresh your access."
        : error.message;
    default:
      break;
  }

  if (/failed to fetch|network/i.test(error.message || "")) {
    return "Couldn't reach the database. Check your connection and try again.";
  }
  return error.message || "Something went wrong loading this data.";
}
