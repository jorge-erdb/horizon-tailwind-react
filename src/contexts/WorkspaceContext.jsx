import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase, isSupabaseConfigured } from "lib/supabase";
import { useAuth } from "contexts/AuthContext";

const WorkspaceContext = createContext(null);

// Which workspace the user last looked at. Only a hint — the value is always
// checked against the memberships the server actually returns, so a stale or
// hand-edited entry resolves back to a workspace they belong to rather than
// leaving the dashboard pointed at an id that will fail every query.
const STORAGE_KEY = "nova.activeWorkspaceId";

function readStoredWorkspaceId() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Safari in private mode, or storage disabled by policy.
    return null;
  }
}

function storeWorkspaceId(id) {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* non-fatal — the session just loses its workspace preference */
  }
}

export function WorkspaceProvider({ children }) {
  const { session, profile } = useAuth();
  const userId = session?.user?.id ?? null;

  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) {
      setMemberships([]);
      setSelectedId(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError(null);

    // RLS already limits this to the caller's rows; the user_id filter is here
    // so the query uses the primary-key index rather than scanning.
    supabase
      .from("workspace_members")
      .select(
        "role, created_at, workspace:workspaces (id, name, slug, plan, data_residency, trial_ends_at, created_at)"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .then(({ data, error: queryError }) => {
        if (!active) return;

        if (queryError) {
          // Most likely 0002_workspaces.sql hasn't been run. Degrade the same
          // way AuthContext does for a missing profiles table: the app stays
          // usable and says what to do.
          // eslint-disable-next-line no-console
          console.warn(
            "[Nova] Couldn't load workspaces — has supabase/migrations/0002_workspaces.sql been run?",
            queryError.message
          );
          setError(queryError);
          setMemberships([]);
        } else {
          // A membership whose workspace row is missing would be a broken FK,
          // but filtering costs nothing and keeps `.id` access safe downstream.
          setMemberships(
            (data ?? [])
              .filter((row) => row.workspace)
              .map((row) => ({ ...row.workspace, role: row.role }))
          );
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId]);

  // Resolve the active workspace once memberships are known:
  //   explicit choice  ->  last used  ->  profile default  ->  first membership
  // Each candidate has to appear in `memberships`, so an id the user no longer
  // has access to can never end up active.
  const activeWorkspace = useMemo(() => {
    if (memberships.length === 0) return null;

    const byId = (id) =>
      id ? memberships.find((workspace) => workspace.id === id) : undefined;

    return (
      byId(selectedId) ??
      byId(readStoredWorkspaceId()) ??
      byId(profile?.default_workspace_id) ??
      memberships[0]
    );
  }, [memberships, selectedId, profile?.default_workspace_id]);

  useEffect(() => {
    storeWorkspaceId(activeWorkspace?.id ?? null);
  }, [activeWorkspace?.id]);

  const selectWorkspace = useCallback(
    (workspaceId) => {
      if (memberships.some((workspace) => workspace.id === workspaceId)) {
        setSelectedId(workspaceId);
      }
    },
    [memberships]
  );

  const value = useMemo(
    () => ({
      workspace: activeWorkspace,
      workspaceId: activeWorkspace?.id ?? null,
      workspaces: memberships,
      role: activeWorkspace?.role ?? null,
      loading,
      error,
      // A signed-in user with no workspace means the handle_new_user trigger
      // didn't fire — worth distinguishing from "still loading" in the UI.
      isMissingWorkspace: Boolean(userId) && !loading && !error && !activeWorkspace,
      isConfigured: isSupabaseConfigured,
      selectWorkspace,
    }),
    [activeWorkspace, memberships, loading, error, userId, selectWorkspace]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a <WorkspaceProvider>");
  }
  return context;
}

export default WorkspaceContext;
