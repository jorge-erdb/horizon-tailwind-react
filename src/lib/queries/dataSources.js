import {
  unwrap,
  useWorkspaceQuery,
  useWorkspaceMutation,
} from "lib/queries/base";

/**
 * data_sources — backs the source tables and the "Data Sources" KPI.
 *
 * Columns are listed explicitly rather than `select("*")`: write_key_hash must
 * never reach the browser, and an explicit list means adding a secret column
 * later can't leak it by default.
 */
const COLUMNS =
  "id, name, kind, status, platforms, events_30d, health_pct, last_sync_at, write_key_hint, created_at";

export function useDataSources() {
  return useWorkspaceQuery("data_sources", async ({ workspaceId, supabase }) =>
    unwrap(
      await supabase
        .from("data_sources")
        .select(COLUMNS)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
    )
  );
}

export function useCreateDataSource() {
  return useWorkspaceMutation(
    "data_sources",
    async ({ workspaceId, supabase, ...values }) =>
      unwrap(
        await supabase
          .from("data_sources")
          .insert({ ...values, workspace_id: workspaceId })
          .select(COLUMNS)
          .single()
      )
  );
}

export function useUpdateDataSource() {
  return useWorkspaceMutation(
    "data_sources",
    async ({ workspaceId, supabase, id, ...values }) =>
      unwrap(
        await supabase
          .from("data_sources")
          .update(values)
          .eq("id", id)
          // Redundant under RLS, but it keeps an update from ever being a
          // full-table scan and makes the intent obvious at the call site.
          .eq("workspace_id", workspaceId)
          .select(COLUMNS)
          .single()
      )
  );
}

export function useDeleteDataSource() {
  return useWorkspaceMutation(
    "data_sources",
    async ({ workspaceId, supabase, id }) =>
      unwrap(
        await supabase
          .from("data_sources")
          .delete()
          .eq("id", id)
          .eq("workspace_id", workspaceId)
      )
  );
}
