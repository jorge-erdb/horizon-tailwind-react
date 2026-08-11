import BarChart from "components/charts/BarChart";
import { barChartOptionsDailyTraffic, withCategories } from "variables/charts";
import Card from "components/card";
import QueryBoundary, { QueryEmpty } from "components/common/QueryState";
import { useDailyTraffic } from "lib/queries/metrics";
import { formatCount } from "lib/format";

const DailyTraffic = () => {
  const query = useDailyTraffic();

  return (
    <Card extra="pb-7 p-[20px]">
      <QueryBoundary
        query={query}
        isEmpty={(data) => !data || data.categories.length === 0}
        empty={
          <QueryEmpty
            title="No traffic today"
            body="Hourly visitors appear here as events arrive."
          />
        }
      >
        {(data) => (
          <>
            <div className="flex flex-row justify-between">
              <div className="ml-1 pt-2">
                <p className="text-sm font-medium leading-4 text-gray-600">
                  Daily Traffic
                </p>
                <p className="text-[34px] font-bold text-navy-700 dark:text-white">
                  {formatCount(data.total)}{" "}
                  <span className="text-sm font-medium leading-6 text-gray-600">
                    Visitors
                  </span>
                </p>
              </div>
            </div>

            <div className="h-[300px] w-full pt-10 pb-0">
              <BarChart
                chartData={data.series}
                chartOptions={withCategories(
                  barChartOptionsDailyTraffic,
                  data.categories
                )}
              />
            </div>
          </>
        )}
      </QueryBoundary>
    </Card>
  );
};

export default DailyTraffic;
