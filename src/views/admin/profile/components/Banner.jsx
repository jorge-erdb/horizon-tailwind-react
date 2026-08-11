import avatar from "assets/img/avatars/avatar11.png";
import banner from "assets/img/profile/banner.png";
import Card from "components/card";
import { useAuth } from "contexts/AuthContext";
import { useDataSources } from "lib/queries/dataSources";
import { useReports } from "lib/queries/reports";
import { useAlerts } from "lib/queries/alerts";
import { useWorkspace } from "contexts/WorkspaceContext";

const Banner = () => {
  const { user, profile } = useAuth();
  const { role: workspaceRole } = useWorkspace();
  const dataSources = useDataSources();
  const reports = useReports();
  const alerts = useAlerts({ activeOnly: true });

  // An em dash while a query is settling, so a zero never reads as "you have
  // none" before the answer is actually known.
  const count = (query) => (query.isPending ? "—" : (query.data ?? []).length);
  const counts = {
    sources: count(dataSources),
    reports: count(reports),
    alerts: count(alerts),
  };

  const name =
    profile?.full_name || user?.email?.split("@")[0] || "Your account";
  // Workspace membership role rather than profiles.role — see General.jsx.
  const rawRole = workspaceRole ?? profile?.role;
  const role = rawRole
    ? rawRole.charAt(0).toUpperCase() + rawRole.slice(1)
    : "Member";

  return (
    <Card extra={"items-center w-full h-full p-[16px] bg-cover"}>
      {/* Background and profile */}
      <div
        className="relative mt-1 flex h-32 w-full justify-center rounded-xl bg-cover"
        style={{ backgroundImage: `url(${banner})` }}
      >
        <div className="absolute -bottom-12 flex h-[87px] w-[87px] items-center justify-center rounded-full border-[4px] border-white bg-pink-400 dark:!border-navy-700">
          <img className="h-full w-full rounded-full" src={profile?.avatar_url || avatar} alt="" />
        </div>
      </div>

      {/* Name and position */}
      <div className="mt-16 flex flex-col items-center">
        <h4 className="text-xl font-bold capitalize text-navy-700 dark:text-white">
          {name}
        </h4>
        <p className="text-base font-normal text-gray-600">
          {role}
          {user?.email ? ` · ${user.email}` : ""}
        </p>
      </div>

      {/* Workspace counts.
          Was "42 Dashboards / 1.2K Saved queries / 24 Data sources". Nova has
          no dashboards or saved-queries tables, so those two were replaced
          rather than wired -- there is nothing behind them to read. These
          three each map to a real table. */}
      <div className="mt-6 mb-3 flex gap-4 md:!gap-14">
        <div className="flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-navy-700 dark:text-white">
            {counts.sources}
          </p>
          <p className="text-sm font-normal text-gray-600">Data sources</p>
        </div>
        <div className="flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-navy-700 dark:text-white">
            {counts.reports}
          </p>
          <p className="text-sm font-normal text-gray-600">Reports</p>
        </div>
        <div className="flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-navy-700 dark:text-white">
            {counts.alerts}
          </p>
          <p className="text-sm font-normal text-gray-600">Active alerts</p>
        </div>
      </div>
    </Card>
  );
};

export default Banner;
