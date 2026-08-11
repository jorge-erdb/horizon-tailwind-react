import {
  unwrap,
  useWorkspaceQuery,
  useWorkspaceMutation,
} from "lib/queries/base";

// alerts — backs the "Active Alerts" KPI and the alert list.
const COLUMNS =
  "id, name, metric_key, comparator, threshold, is_active, triggered_at, created_at";

export function useAlerts({ activeOnly = false } = {}) {
  return useWorkspaceQuery(
    "alerts",
    async ({ workspaceId, supabase }) => {
      let query = supabase
        .from("alerts")
        .select(COLUMNS)
        .eq("workspace_id", workspaceId);

      if (activeOnly) query = query.eq("is_active", true);

      return unwrap(
        await query
          // Alerts that have fired matter more than ones that haven't, so they
          // sort first; nullsFirst: false keeps never-triggered alerts below.
          .order("triggered_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
      );
    },
    { keyExtras: [activeOnly ? "active" : "all"] }
  );
}

export function useCreateAlert() {
  return useWorkspaceMutation(
    "alerts",
    async ({ workspaceId, supabase, ...values }) =>
      unwrap(
        await supabase
          .from("alerts")
          .insert({ ...values, workspace_id: workspaceId })
          .select(COLUMNS)
          .single()
      )
  );
}

export function useUpdateAlert() {
  return useWorkspaceMutation(
    "alerts",
    async ({ workspaceId, supabase, id, ...values }) =>
      unwrap(
        await supabase
          .from("alerts")
          .update(values)
          .eq("id", id)
          .eq("workspace_id", workspaceId)
          .select(COLUMNS)
          .single()
      )
  );
}

export function useDeleteAlert() {
  return useWorkspaceMutation(
    "alerts",
    async ({ workspaceId, supabase, id }) =>
      unwrap(
        await supabase
          .from("alerts")
          .delete()
          .eq("id", id)
          .eq("workspace_id", workspaceId)
      )
  );
}
