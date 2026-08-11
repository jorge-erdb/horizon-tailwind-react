import {
  unwrap,
  useWorkspaceQuery,
  useWorkspaceMutation,
} from "lib/queries/base";

// reports — backs the "Scheduled reports" table.
const COLUMNS =
  "id, name, status, schedule, completion, last_run_at, created_at";

export function useReports() {
  return useWorkspaceQuery("reports", async ({ workspaceId, supabase }) =>
    unwrap(
      await supabase
        .from("reports")
        .select(COLUMNS)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
    )
  );
}

export function useCreateReport() {
  return useWorkspaceMutation(
    "reports",
    async ({ workspaceId, supabase, ...values }) =>
      unwrap(
        await supabase
          .from("reports")
          .insert({ ...values, workspace_id: workspaceId })
          .select(COLUMNS)
          .single()
      )
  );
}

export function useUpdateReport() {
  return useWorkspaceMutation(
    "reports",
    async ({ workspaceId, supabase, id, ...values }) =>
      unwrap(
        await supabase
          .from("reports")
          .update(values)
          .eq("id", id)
          .eq("workspace_id", workspaceId)
          .select(COLUMNS)
          .single()
      )
  );
}

export function useDeleteReport() {
  return useWorkspaceMutation(
    "reports",
    async ({ workspaceId, supabase, id }) =>
      unwrap(
        await supabase
          .from("reports")
          .delete()
          .eq("id", id)
          .eq("workspace_id", workspaceId)
      )
  );
}
