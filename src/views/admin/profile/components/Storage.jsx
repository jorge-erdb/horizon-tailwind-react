import Card from "components/card";
import { BsCloudCheck, BsCloudSlash } from "react-icons/bs";
import { useDataSources } from "lib/queries/dataSources";
import { QueryLoading, QueryError } from "components/common/QueryState";
import { formatPercent } from "lib/format";

/**
 * Was a storage gauge showing "25.6 GB of 50 GB" for every account.
 *
 * There is no storage table and no per-plan quota column, so any number here
 * would have been invented. Pipeline health fits the same progress bar
 * honestly: health_pct is already a real 0-100 per source, and the mean
 * across a workspace is the number someone opening this card actually wants.
 */
const Storage = () => {
  const query = useDataSources();
  const sources = query.data ?? [];

  const healthy = sources.filter((source) => source.status !== "error");
  const failing = sources.length - healthy.length;
  const average =
    sources.length === 0
      ? null
      : sources.reduce((sum, source) => sum + Number(source.health_pct), 0) /
        sources.length;

  return (
    <Card extra={"w-full h-full p-4"}>
      {query.isPending ? (
        <QueryLoading />
      ) : query.isError ? (
        <QueryError error={query.error} />
      ) : (
        <>
          <div className="mb-auto flex flex-col items-center justify-center">
            <div
              className={`mt-2 flex items-center justify-center rounded-full bg-lightPrimary p-[26px] text-5xl font-bold dark:!bg-navy-700 dark:text-white ${
                failing > 0 ? "text-amber-500" : "text-brand-500"
              }`}
            >
              {failing > 0 ? <BsCloudSlash /> : <BsCloudCheck />}
            </div>
            <h4 className="mb-px mt-3 text-2xl font-bold text-navy-700 dark:text-white">
              Pipeline health
            </h4>
            <p className="px-5 text-center text-base font-normal text-gray-600 md:!px-0 xl:!px-8">
              {sources.length === 0
                ? "No sources connected yet"
                : failing > 0
                ? `${failing} of ${sources.length} sources need attention`
                : `All ${sources.length} sources reporting normally`}
            </p>
          </div>

          <div className="flex flex-col">
            <div className="flex justify-between">
              <p className="text-sm font-medium text-gray-600">
                {average === null ? "—" : formatPercent(average)}
              </p>
              <p className="text-sm font-medium text-gray-600">100%</p>
            </div>
            <div className="mt-2 flex h-3 w-full items-center rounded-full bg-lightPrimary dark:!bg-navy-700">
              <span
                className={`h-full rounded-full ${
                  failing > 0 ? "bg-amber-500" : "bg-brand-500 dark:!bg-white"
                }`}
                style={{ width: `${average ?? 0}%` }}
              />
            </div>
          </div>
        </>
      )}
    </Card>
  );
};

export default Storage;
