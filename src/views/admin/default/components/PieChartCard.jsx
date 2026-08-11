import { Fragment } from "react";
import PieChart from "components/charts/PieChart";
import { pieChartOptions } from "variables/charts";
import Card from "components/card";
import QueryBoundary, { QueryEmpty } from "components/common/QueryState";
import { useSessionsByPlatform } from "lib/queries/metrics";

// Matches pieChartOptions.colors / fill.colors by index. The chart assigns
// colours in series order and totalsByDim sorts largest-first, so the legend
// swatch under a slice is the same colour as the slice.
const SWATCHES = ["bg-brand-500", "bg-accent-500", "bg-amber-500"];

const PieChartCard = () => {
  const query = useSessionsByPlatform(30);

  return (
    <Card extra="rounded-[20px] p-3">
      <div className="flex flex-row justify-between px-3 pt-2">
        <div>
          <h4 className="text-lg font-bold text-navy-700 dark:text-white">
            Traffic by platform
          </h4>
        </div>
        <p className="mb-6 mr-2 text-sm font-bold text-gray-600">Last 30 days</p>
      </div>

      <QueryBoundary
        query={query}
        isEmpty={(data) => !data || data.series.length === 0}
        empty={
          <QueryEmpty
            title="No sessions yet"
            body="Platform breakdown appears once sessions are recorded."
          />
        }
      >
        {(data) => (
          <>
            <div className="mb-auto flex h-[220px] w-full items-center justify-center">
              <PieChart
                options={{ ...pieChartOptions, labels: data.labels }}
                series={data.series}
              />
            </div>
            <div className="flex flex-row !justify-between rounded-2xl px-6 py-3 shadow-2xl shadow-shadow-500 dark:!bg-navy-700 dark:shadow-none">
              {data.labels.map((label, index) => (
                <Fragment key={label}>
                  {index > 0 && (
                    <div className="h-11 w-px bg-gray-300 dark:bg-white/10" />
                  )}
                  <div className="flex flex-col items-center justify-center">
                    <div className="flex items-center justify-center">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          SWATCHES[index % SWATCHES.length]
                        }`}
                      />
                      <p className="ml-1 text-sm font-normal text-gray-600">
                        {label}
                      </p>
                    </div>
                    <p className="mt-px font-mono text-xl font-bold text-navy-700 dark:text-white">
                      {data.percentages[index]}%
                    </p>
                  </div>
                </Fragment>
              ))}
            </div>
          </>
        )}
      </QueryBoundary>
    </Card>
  );
};

export default PieChartCard;
