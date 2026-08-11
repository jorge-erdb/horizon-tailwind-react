/**
 * Chart *presentation* only — palette, fonts, axis styling.
 *
 * The series used to live here too, as fixtures. They now come from
 * metric_points via src/lib/queries/metrics.js, so anything resembling data
 * has been removed: a leftover fixture export is the kind of thing a card
 * silently falls back to, and a dashboard showing convincing hardcoded
 * numbers is worse than one showing none.
 *
 * Category axes move with the data (a workspace seeded last week has fewer
 * buckets than one seeded last year), so options carry an empty `categories`
 * and every consumer merges the real one through `withCategories`.
 */

/**
 * Returns options with the x-axis categories replaced.
 *
 * Apex mutates the options object it is handed in some code paths, so this
 * builds a new object rather than assigning into the shared export — two
 * cards reading the same options export would otherwise fight over the axis.
 */
export const withCategories = (options, categories) => ({
  ...options,
  xaxis: { ...options.xaxis, categories },
});

export const barChartOptionsDailyTraffic = {
  chart: {
    toolbar: {
      show: false,
    },
  },
  tooltip: {
    style: {
      fontSize: "12px",
      fontFamily: "'JetBrains Mono', 'SFMono-Regular', Menlo, monospace",
      backgroundColor: "#0F172A"
    },
    onDatasetHover: {
      style: {
        fontSize: "12px",
        fontFamily: "'JetBrains Mono', 'SFMono-Regular', Menlo, monospace",
      },
    },
    theme: "dark",
  },
  xaxis: {
    categories: [],
    show: false,
    labels: {
      show: true,
      style: {
        colors: "#64748B",
        fontSize: "14px",
        fontWeight: "500",
      },
    },
    axisBorder: {
      show: false,
    },
    axisTicks: {
      show: false,
    },
  },
  yaxis: {
    show: false,
    color: "black",
    labels: {
      show: true,
      style: {
        colors: "#CBD3E1",
        fontSize: "14px",
      },
    },
  },
  grid: {
    show: false,
    strokeDashArray: 5,
    yaxis: {
      lines: {
        show: true,
      },
    },
    xaxis: {
      lines: {
        show: false,
      },
    },
  },
  fill: {
    type: "gradient",
    gradient: {
      type: "vertical",
      shadeIntensity: 1,
      opacityFrom: 0.7,
      opacityTo: 0.9,
      colorStops: [
        [
          {
            offset: 0,
            color: "#4F46E5",
            opacity: 1,
          },
          {
            offset: 100,
            color: "rgba(67, 24, 255, 1)",
            opacity: 0.28,
          },
        ],
      ],
    },
  },
  dataLabels: {
    enabled: false,
  },
  plotOptions: {
    bar: {
      borderRadius: 10,
      columnWidth: "40px",
    },
  },
};

export const pieChartOptions = {
  // `labels` is overridden by PieChartCard from the query. It stays here as a
  // sane default for a chart rendered without data.
  labels: ["Web", "Mobile", "API"],
  // Four colours for four platforms. events.platform allows 'server' as well
  // as web/mobile/api, so a workspace ingesting server-side events gets a
  // fourth donut segment -- with three colours Apex leaves it unpainted.
  colors: ["#4F46E5", "#22D3EE", "#F5A623", "#A78BFA"],
  chart: {
    width: "50px",
  },
  states: {
    hover: {
      filter: {
        type: "none",
      },
    },
  },
  legend: {
    show: false,
  },
  dataLabels: {
    enabled: false,
  },
  hover: { mode: null },
  plotOptions: {
    donut: {
      expandOnClick: false,
      donut: {
        labels: {
          show: false,
        },
      },
    },
  },
  fill: {
    colors: ["#4F46E5", "#22D3EE", "#F5A623", "#A78BFA"],
  },
  tooltip: {
    enabled: true,
    theme: "dark",
    style: {
      fontSize: "12px",
      fontFamily: "'JetBrains Mono', 'SFMono-Regular', Menlo, monospace",
      backgroundColor: "#0F172A"
    },
  },
};

export const barChartOptionsWeeklyRevenue = {
  chart: {
    stacked: true,
    toolbar: {
      show: false,
    },
  },
  tooltip: {
    style: {
      fontSize: "12px",
      fontFamily: "'JetBrains Mono', 'SFMono-Regular', Menlo, monospace",
      backgroundColor: "#0F172A"
    },
    theme: 'dark',
    onDatasetHover: {
      style: {
        fontSize: "12px",
        fontFamily: "'JetBrains Mono', 'SFMono-Regular', Menlo, monospace",
      },
    },
  },
  xaxis: {
    categories: [],
    show: false,
    labels: {
      show: true,
      style: {
        colors: "#64748B",
        fontSize: "14px",
        fontWeight: "500",
      },
    },
    axisBorder: {
      show: false,
    },
    axisTicks: {
      show: false,
    },
  },
  yaxis: {
    show: false,
    color: "black",
    labels: {
      show: false,
      style: {
        colors: "#64748B",
        fontSize: "14px",
        fontWeight: "500",
      },
    },
  },

  grid: {
    borderColor: "rgba(163, 174, 208, 0.3)",
    show: true,
    yaxis: {
      lines: {
        show: false,
        opacity: 0.5,
      },
    },
    row: {
      opacity: 0.5,
    },
    xaxis: {
      lines: {
        show: false,
      },
    },
  },
  fill: {
    type: "solid",
    colors: ["#4F46E5", "#22D3EE", "#F5A623"],
  },
  legend: {
    show: false,
  },
  colors: ["#4F46E5", "#22D3EE", "#F5A623"],
  dataLabels: {
    enabled: false,
  },
  plotOptions: {
    bar: {
      borderRadius: 10,
      columnWidth: "20px",
    },
  },
};

export const lineChartOptionsTotalSpent = {
  legend: {
    show: false,
  },

  // Revenue, then Profit. These used to ride on the series objects; with the
  // series coming from the database the palette has to live here, and
  // useRevenueTrend returns the two in this fixed order so the colours stay
  // put even in a workspace that has profit rows but no revenue rows.
  colors: ["#4F46E5", "#22D3EE"],

  theme: {
    mode: "light",
  },
  chart: {
    type: "line",

    toolbar: {
      show: false,
    },
  },

  dataLabels: {
    enabled: false,
  },
  stroke: {
    curve: "smooth",
  },

  tooltip: {
    style: {
      fontSize: "12px",
      fontFamily: "'JetBrains Mono', 'SFMono-Regular', Menlo, monospace",
      backgroundColor: "#0F172A"
    },
    theme: 'dark',
    x: {
      format: "dd/MM/yy HH:mm",
    },
  },
  grid: {
    show: false,
  },
  xaxis: {
    axisBorder: {
      show: false,
    },
    axisTicks: {
      show: false,
    },
    labels: {
      style: {
        colors: "#64748B",
        fontSize: "12px",
        fontWeight: "500",
      },
    },
    type: "text",
    range: undefined,
    categories: [],
  },

  yaxis: {
    show: false,
  },
};
