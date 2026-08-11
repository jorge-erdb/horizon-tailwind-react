import {
  unwrap,
  useWorkspaceQuery,
  useWorkspaceMutation,
} from "lib/queries/base";

// notifications — backs the navbar bell dropdown.
const COLUMNS = "id, title, body, kind, read_at, created_at";

export function useNotifications({ limit = 20 } = {}) {
  return useWorkspaceQuery(
    "notifications",
    async ({ workspaceId, supabase }) =>
      unwrap(
        await supabase
          .from("notifications")
          .select(COLUMNS)
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(limit)
      ),
    { keyExtras: [limit] }
  );
}

/**
 * Marks every unread notification in the workspace as read.
 *
 * The `is("read_at", null)` filter matters: without it the update rewrites
 * already-read rows and resets their read timestamp to now.
 */
export function useMarkAllNotificationsRead() {
  return useWorkspaceMutation(
    "notifications",
    async ({ workspaceId, supabase }) =>
      unwrap(
        await supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("workspace_id", workspaceId)
          .is("read_at", null)
      )
  );
}

export function useMarkNotificationRead() {
  return useWorkspaceMutation(
    "notifications",
    async ({ workspaceId, supabase, id }) =>
      unwrap(
        await supabase
          .from("notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", id)
          .eq("workspace_id", workspaceId)
          .is("read_at", null)
      )
  );
}
