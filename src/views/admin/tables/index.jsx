import { useMemo } from "react";
import CheckTable from "./components/CheckTable";

import {
  columnsDataDevelopment,
  columnsDataCheck,
  columnsDataColumns,
  columnsDataComplex,
} from "./variables/columnsData";
import DevelopmentTable from "./components/DevelopmentTable";
import ColumnsTable from "./components/ColumnsTable";
import ComplexTable from "./components/ComplexTable";
import Card from "components/card";
import QueryBoundary, { QueryEmpty } from "components/common/QueryState";
import { useDataSources } from "lib/queries/dataSources";
import { useReports } from "lib/queries/reports";
import {
  toCheckRows,
  toColumnsRows,
  toDevelopmentRows,
  toReportRows,
} from "lib/tableRows";

/**
 * Wraps a table in its own boundary so one slow or failing query does not
 * blank the other three. Both queries are shared across the four tables, so
 * this costs two requests, not four.
 */
const TablePanel = ({ query, empty, children }) => (
  <QueryBoundary
    query={query}
    empty={
      <Card extra="w-full h-full px-6 pb-6">
        <QueryEmpty title={empty.title} body={empty.body} />
      </Card>
    }
  >
    {children}
  </QueryBoundary>
);

const SOURCES_EMPTY = {
  title: "No data sources",
  body: "Connect a source to start collecting events.",
};

const Tables = () => {
  const dataSources = useDataSources();
  const reports = useReports();

  const sources = dataSources.data;
  const developmentRows = useMemo(() => toDevelopmentRows(sources), [sources]);
  const checkRows = useMemo(() => toCheckRows(sources), [sources]);
  const columnsRows = useMemo(() => toColumnsRows(sources), [sources]);
  const reportRows = useMemo(() => toReportRows(reports.data), [reports.data]);

  return (
    <div>
      <div className="mt-5 grid h-full grid-cols-1 gap-5 md:grid-cols-2">
        <TablePanel query={dataSources} empty={SOURCES_EMPTY}>
          {() => (
            <DevelopmentTable
              columnsData={columnsDataDevelopment}
              tableData={developmentRows}
            />
          )}
        </TablePanel>
        <TablePanel query={dataSources} empty={SOURCES_EMPTY}>
          {() => (
            <CheckTable
              columnsData={columnsDataCheck}
              tableData={checkRows}
            />
          )}
        </TablePanel>
      </div>

      <div className="mt-5 grid h-full grid-cols-1 gap-5 md:grid-cols-2">
        <TablePanel query={dataSources} empty={SOURCES_EMPTY}>
          {() => (
            <ColumnsTable
              columnsData={columnsDataColumns}
              tableData={columnsRows}
            />
          )}
        </TablePanel>
        <TablePanel
          query={reports}
          empty={{
            title: "No reports scheduled",
            body: "Scheduled reports and their last run appear here.",
          }}
        >
          {() => (
            <ComplexTable
              columnsData={columnsDataComplex}
              tableData={reportRows}
            />
          )}
        </TablePanel>
      </div>
    </div>
  );
};

export default Tables;
