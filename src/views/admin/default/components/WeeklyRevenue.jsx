import Card from "components/card";
import BarChart from "components/charts/BarChart";
import { barChartOptionsWeeklyRevenue, withCategories } from "variables/charts";
import { MdBarChart } from "react-icons/md";
import QueryBoundary, { QueryEmpty } from "components/common/QueryState";
import { useRevenueByStream } from "lib/queries/metrics";

const WeeklyRevenue = () => {
  const query = useRevenueByStream(7);

  return (
    <Card extra="flex flex-col bg-white w-full rounded-3xl py-6 px-2 text-center">
      <div className="mb-auto flex items-center justify-between px-6">
        <h2 className="text-lg font-bold text-navy-700 dark:text-white">
          Weekly Revenue
        </h2>
        <button className="!linear z-[1] flex items-center justify-center rounded-lg bg-lightPrimary p-2 text-brand-500 !transition !duration-200 hover:bg-gray-100 active:bg-gray-200 dark:bg-navy-700 dark:text-white dark:hover:bg-white/20 dark:active:bg-white/10">
          <MdBarChart className="h-6 w-6" />
        </button>
      </div>

      <div className="md:mt-16 lg:mt-0">
        <QueryBoundary
          query={query}
          isEmpty={(data) => !data || data.series.length === 0}
          empty={
            <QueryEmpty
              title="No revenue this week"
              body="Daily revenue by stream shows up here once billing events arrive."
            />
          }
        >
          {(data) => (
            <div className="h-[250px] w-full xl:h-[350px]">
              <BarChart
                chartData={data.series}
                chartOptions={withCategories(
                  barChartOptionsWeeklyRevenue,
                  data.categories
                )}
              />
            </div>
          )}
        </QueryBoundary>
      </div>
    </Card>
  );
};

export default WeeklyRevenue;
