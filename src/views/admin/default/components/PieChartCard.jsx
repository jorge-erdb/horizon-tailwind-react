import { Fragment } from "react";
import PieChart from "components/charts/PieChart";
import { pieChartData, pieChartOptions } from "variables/charts";
import Card from "components/card";

// Kept in step with pieChartData / pieChartOptions.labels in variables/charts.
const legend = [
  { label: "Web", value: "63%", swatch: "bg-brand-500" },
  { label: "Mobile", value: "25%", swatch: "bg-accent-500" },
  { label: "API", value: "12%", swatch: "bg-amber-500" },
];

const PieChartCard = () => {
  return (
    <Card extra="rounded-[20px] p-3">
      <div className="flex flex-row justify-between px-3 pt-2">
        <div>
          <h4 className="text-lg font-bold text-navy-700 dark:text-white">
            Traffic by platform
          </h4>
        </div>

        <div className="mb-6 flex items-center justify-center">
          <select className="mb-3 mr-2 flex items-center justify-center text-sm font-bold text-gray-600 hover:cursor-pointer dark:!bg-navy-800 dark:text-white">
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
      </div>

      <div className="mb-auto flex h-[220px] w-full items-center justify-center">
        <PieChart options={pieChartOptions} series={pieChartData} />
      </div>
      <div className="flex flex-row !justify-between rounded-2xl px-6 py-3 shadow-2xl shadow-shadow-500 dark:!bg-navy-700 dark:shadow-none">
        {legend.map((item, index) => (
          <Fragment key={item.label}>
            {index > 0 && (
              <div className="h-11 w-px bg-gray-300 dark:bg-white/10" />
            )}
            <div className="flex flex-col items-center justify-center">
              <div className="flex items-center justify-center">
                <div className={`h-2 w-2 rounded-full ${item.swatch}`} />
                <p className="ml-1 text-sm font-normal text-gray-600">
                  {item.label}
                </p>
              </div>
              <p className="mt-px font-mono text-xl font-bold text-navy-700 dark:text-white">
                {item.value}
              </p>
            </div>
          </Fragment>
        ))}
      </div>
    </Card>
  );
};

export default PieChartCard;
