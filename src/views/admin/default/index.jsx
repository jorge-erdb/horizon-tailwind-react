import { useMemo } from "react";
import MiniCalendar from "components/calendar/MiniCalendar";
import WeeklyRevenue from "views/admin/default/components/WeeklyRevenue";
import TotalSpent from "views/admin/default/components/TotalSpent";
import PieChartCard from "views/admin/default/components/PieChartCard";
import { IoMdHome } from "react-icons/io";
import { IoDocuments } from "react-icons/io5";
import { MdBarChart, MdDashboard, MdNotificationsActive } from "react-icons/md";

import { columnsDataCheck, columnsDataComplex } from "./variables/columnsData";

import Widget from "components/widget/Widget";
import CheckTable from "views/admin/default/components/CheckTable";
import ComplexTable from "views/admin/default/components/ComplexTable";
import DailyTraffic from "views/admin/default/components/DailyTraffic";
import TaskCard from "views/admin/default/components/TaskCard";
import Card from "components/card";
import QueryBoundary, { QueryEmpty } from "components/common/QueryState";
import { useDashboardKpis } from "lib/queries/metrics";
import { useDataSources } from "lib/queries/dataSources";
import { useReports } from "lib/queries/reports";
import {
  formatCurrency,
  formatCompact,
  formatCount,
  formatPercent,
  formatDate,
} from "lib/format";

// reports.status is lower case in the database; ComplexTable switches on these
// exact capitalised strings to pick its icon. Mapped explicitly rather than
// title-casing, because 'disabled' has to become 'Disable' to match.
const REPORT_STATUS = {
  approved: "Approved",
  disabled: "Disable",
  error: "Error",
};

const Dashboard = () => {
  const kpis = useDashboardKpis(30);
  const dataSources = useDataSources();
  const reports = useReports();

  const k = kpis.data;
  const kpiLoading = kpis.isPending;

  const checkTableData = useMemo(
    () =>
      (dataSources.data ?? []).map((source) => ({
        // CheckTable renders `name` as a [label, checked] tuple; the checkbox
        // reflects whether the source is actively reporting.
        name: [source.name, source.status === "active"],
        progress: Number(source.health_pct),
        quantity: Number(source.events_30d),
        date: formatDate(source.last_sync_at),
      })),
    [dataSources.data]
  );

  const complexTableData = useMemo(
    () =>
      (reports.data ?? []).map((report) => ({
        name: report.name,
        status: REPORT_STATUS[report.status] ?? "Error",
        date: formatDate(report.last_run_at),
        progress: Number(report.completion),
      })),
    [reports.data]
  );

  return (
    <div>
      {/* Card widget */}

      <div className="mt-3 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-3 3xl:grid-cols-6">
        <Widget
          icon={<MdBarChart className="h-7 w-7" />}
          title={"Monthly Revenue"}
          subtitle={formatCurrency(k?.monthly_revenue)}
          delta={k?.monthly_revenue_delta}
          loading={kpiLoading}
        />
        <Widget
          icon={<IoDocuments className="h-6 w-6" />}
          title={"Active Users"}
          subtitle={formatCompact(k?.active_users)}
          delta={k?.active_users_delta}
          loading={kpiLoading}
        />
        <Widget
          icon={<MdBarChart className="h-7 w-7" />}
          title={"Events Tracked"}
          subtitle={formatCompact(k?.events_tracked)}
          delta={k?.events_tracked_delta}
          loading={kpiLoading}
        />
        <Widget
          icon={<MdDashboard className="h-6 w-6" />}
          title={"Conversion Rate"}
          subtitle={formatPercent(k?.conversion_rate)}
          delta={k?.conversion_rate_delta}
          loading={kpiLoading}
        />
        <Widget
          icon={<MdNotificationsActive className="h-6 w-6" />}
          title={"Active Alerts"}
          // A count of currently-firing alerts has no period to compare
          // against, so no delta is passed.
          subtitle={formatCount(k?.active_alerts)}
          loading={kpiLoading}
        />
        <Widget
          icon={<IoMdHome className="h-6 w-6" />}
          title={"Data Sources"}
          subtitle={formatCount(k?.data_sources)}
          loading={kpiLoading}
        />
      </div>

      {/* Charts */}

      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
        <TotalSpent />
        <WeeklyRevenue />
      </div>

      {/* Tables & Charts */}

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Data sources table */}
        <div>
          <QueryBoundary
            query={dataSources}
            empty={
              <Card extra="w-full h-full px-6 pb-6">
                <QueryEmpty
                  title="No data sources"
                  body="Connect a source to start collecting events."
                />
              </Card>
            }
          >
            {() => (
              <CheckTable
                columnsData={columnsDataCheck}
                tableData={checkTableData}
              />
            )}
          </QueryBoundary>
        </div>

        {/* Traffic chart & Pie Chart */}

        <div className="grid grid-cols-1 gap-5 rounded-[20px] md:grid-cols-2">
          <DailyTraffic />
          <PieChartCard />
        </div>

        {/* Scheduled reports */}

        <QueryBoundary
          query={reports}
          empty={
            <Card extra="w-full h-full px-6 pb-6">
              <QueryEmpty
                title="No reports scheduled"
                body="Scheduled reports and their last run appear here."
              />
            </Card>
          }
        >
          {() => (
            <ComplexTable
              columnsData={columnsDataComplex}
              tableData={complexTableData}
            />
          )}
        </QueryBoundary>

        {/* Task chart & Calendar */}

        <div className="grid grid-cols-1 gap-5 rounded-[20px] md:grid-cols-2">
          <TaskCard />
          <div className="grid grid-cols-1 rounded-[20px]">
            <MiniCalendar />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
