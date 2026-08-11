import Chart from "react-apexcharts";

/**
 * Was a class component that copied props into state in componentDidMount and
 * never read them again. With fixture data that was invisible — the props
 * never changed. Driven by a query it renders once from the empty initial
 * state, leaves Apex to reconcile a 0-series chart into a 3-series one (which
 * it does badly: the bars collapse onto the first category), and then ignores
 * every refetch and workspace switch afterwards.
 *
 * Pass-through, matching LineChart and PieChart, which never had the bug.
 */
const BarChart = ({ chartData, chartOptions }) => (
  <Chart
    options={chartOptions}
    series={chartData}
    type="bar"
    width="100%"
    height="100%"
  />
);

export default BarChart;
