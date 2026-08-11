import Card from "components/card";
import { useAuth } from "contexts/AuthContext";
import { useWorkspace } from "contexts/WorkspaceContext";

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

// workspaces.plan and .data_residency are constrained to these values by the
// schema. Labels rather than raw values, but derived from the row -- the card
// used to claim "Nova Scale" and "EU (Frankfurt)" for every workspace,
// including a trial on US infrastructure.
const PLAN_LABEL = {
  trial: "Trial",
  starter: "Nova Starter",
  scale: "Nova Scale",
  enterprise: "Nova Enterprise",
};

const RESIDENCY_LABEL = {
  us: "US (N. Virginia)",
  eu: "EU (Frankfurt)",
};

const General = () => {
  const { user, profile } = useAuth();
  const { workspace, role } = useWorkspace();

  return (
    <Card extra={"w-full h-full p-3"}>
      {/* Header */}
      <div className="mt-2 mb-8 w-full">
        <h4 className="px-2 text-xl font-bold text-navy-700 dark:text-white">
          General Information
        </h4>
        <p className="mt-2 px-2 text-base text-gray-600">
          Your Nova Analytics account details. Role, team and plan are read
          from your workspace profile.
        </p>
      </div>
      {/* Cards */}
      <div className="grid grid-cols-2 gap-4 px-2">
        <div className="flex flex-col items-start justify-center rounded-2xl bg-white bg-clip-border px-3 py-4 shadow-3xl shadow-shadow-500 dark:!bg-navy-700 dark:shadow-none">
          <p className="text-sm text-gray-600">Role</p>
          <p className="text-base font-medium capitalize text-navy-700 dark:text-white">
            {/* workspace_members.role, not profiles.role. The latter is an
                account-level default that stays 'member' even for the owner
                of the workspace, which is what this card is describing. */}
            {role ?? profile?.role ?? "Member"}
          </p>
        </div>

        <div className="flex flex-col justify-center rounded-2xl bg-white bg-clip-border px-3 py-4 shadow-3xl shadow-shadow-500 dark:!bg-navy-700 dark:shadow-none">
          <p className="text-sm text-gray-600">Plan</p>
          <p className="text-base font-medium text-navy-700 dark:text-white">
            {PLAN_LABEL[workspace?.plan] ?? "—"}
          </p>
        </div>

        <div className="flex flex-col items-start justify-center rounded-2xl bg-white bg-clip-border px-3 py-4 shadow-3xl shadow-shadow-500 dark:!bg-navy-700 dark:shadow-none">
          <p className="text-sm text-gray-600">Team</p>
          <p className="text-base font-medium text-navy-700 dark:text-white">
            {profile?.team ?? "Unassigned"}
          </p>
        </div>

        <div className="flex flex-col justify-center rounded-2xl bg-white bg-clip-border px-3 py-4 shadow-3xl shadow-shadow-500 dark:!bg-navy-700 dark:shadow-none">
          <p className="text-sm text-gray-600">Data residency</p>
          <p className="text-base font-medium text-navy-700 dark:text-white">
            {RESIDENCY_LABEL[workspace?.data_residency] ?? "—"}
          </p>
        </div>

        <div className="flex flex-col items-start justify-center rounded-2xl bg-white bg-clip-border px-3 py-4 shadow-3xl shadow-shadow-500 dark:!bg-navy-700 dark:shadow-none">
          <p className="text-sm text-gray-600">Workspace</p>
          <p className="text-base font-medium text-navy-700 dark:text-white">
            {workspace?.name ?? "—"}
          </p>
        </div>

        <div className="flex flex-col justify-center rounded-2xl bg-white bg-clip-border px-3 py-4 shadow-3xl shadow-shadow-500 dark:!bg-navy-700 dark:shadow-none">
          <p className="text-sm text-gray-600">Member since</p>
          <p className="text-base font-medium text-navy-700 dark:text-white">
            {formatDate(profile?.created_at ?? user?.created_at)}
          </p>
        </div>
      </div>
    </Card>
  );
};

export default General;
