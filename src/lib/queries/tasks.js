import { useQueryClient } from "@tanstack/react-query";
import {
  unwrap,
  workspaceKey,
  useWorkspaceQuery,
  useWorkspaceMutation,
} from "lib/queries/base";
import { useWorkspace } from "contexts/WorkspaceContext";

// tasks — backs the checklist card on the dashboard.
const COLUMNS = "id, title, is_done, position, assignee_id, created_at";

export function useTasks() {
  return useWorkspaceQuery("tasks", async ({ workspaceId, supabase }) =>
    unwrap(
      await supabase
        .from("tasks")
        .select(COLUMNS)
        .eq("workspace_id", workspaceId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true })
    )
  );
}

/**
 * Toggling a checkbox is the one mutation in the app where the round trip is
 * visible: without an optimistic update the tick lags the click by whatever
 * the network costs, which reads as a broken checkbox. The cache is rolled
 * back on failure so a rejected write doesn't leave the box silently ticked.
 */
export function useToggleTask() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const key = workspaceKey("tasks", workspaceId);

  return useWorkspaceMutation(
    "tasks",
    async ({ workspaceId: ws, supabase, id, isDone }) =>
      unwrap(
        await supabase
          .from("tasks")
          .update({ is_done: isDone })
          .eq("id", id)
          .eq("workspace_id", ws)
          .select(COLUMNS)
          .single()
      ),
    {
      onMutate: async ({ id, isDone }) => {
        await queryClient.cancelQueries({ queryKey: key });
        const previous = queryClient.getQueryData(key);
        queryClient.setQueryData(key, (rows) =>
          rows?.map((row) => (row.id === id ? { ...row, is_done: isDone } : row))
        );
        return { previous };
      },
      onError: (_error, _variables, context) => {
        if (context?.previous) queryClient.setQueryData(key, context.previous);
      },
    }
  );
}

export function useCreateTask() {
  return useWorkspaceMutation(
    "tasks",
    async ({ workspaceId, supabase, title, position = 0 }) =>
      unwrap(
        await supabase
          .from("tasks")
          .insert({ workspace_id: workspaceId, title, position })
          .select(COLUMNS)
          .single()
      )
  );
}

export function useDeleteTask() {
  return useWorkspaceMutation(
    "tasks",
    async ({ workspaceId, supabase, id }) =>
      unwrap(
        await supabase
          .from("tasks")
          .delete()
          .eq("id", id)
          .eq("workspace_id", workspaceId)
      )
  );
}
