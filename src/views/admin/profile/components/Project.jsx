import { Link } from "react-router-dom";
import {
  MdLanguage,
  MdPhoneIphone,
  MdApi,
  MdCreditCard,
  MdMailOutline,
  MdStorage,
  MdCampaign,
  MdSupportAgent,
} from "react-icons/md";
import Card from "components/card";
import { useDataSources } from "lib/queries/dataSources";
import QueryBoundary, { QueryEmpty } from "components/common/QueryState";
import { formatCount, formatRelative } from "lib/format";

/**
 * Was three hardcoded copies of "Technology behind the Blockchain" from the
 * Horizon template. Nova has no "projects" entity; connected sources are the
 * closest real thing and are what someone looks for on a profile page.
 */

// data_sources.kind is constrained to these eight by the schema.
const KIND_ICON = {
  web: MdLanguage,
  mobile: MdPhoneIphone,
  api: MdApi,
  billing: MdCreditCard,
  email: MdMailOutline,
  warehouse: MdStorage,
  ads: MdCampaign,
  support: MdSupportAgent,
};

const STATUS_TONE = {
  active: "text-green-500",
  paused: "text-gray-500",
  error: "text-red-500",
};

const Project = () => {
  const query = useDataSources();

  return (
    <Card extra={"w-full p-4 h-full"}>
      <div className="mb-8 w-full">
        <h4 className="text-xl font-bold text-navy-700 dark:text-white">
          Connected sources
        </h4>
        <p className="mt-2 text-base text-gray-600">
          Every source reporting into this workspace, with its most recent sync.
        </p>
      </div>

      <QueryBoundary
        query={query}
        empty={
          <QueryEmpty
            title="No sources connected"
            body="Connect a source to start collecting events."
          />
        }
      >
        {(sources) =>
          sources.map((source, index) => {
            const Icon = KIND_ICON[source.kind] ?? MdApi;
            return (
              <div
                key={source.id}
                className={`flex w-full items-center justify-between rounded-2xl bg-white p-3 shadow-3xl shadow-shadow-500 dark:!bg-navy-700 dark:shadow-none ${
                  index > 0 ? "mt-3" : ""
                }`}
              >
                <div className="flex items-center">
                  <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-lg bg-lightPrimary text-3xl text-brand-500 dark:bg-navy-800 dark:text-white">
                    <Icon />
                  </div>
                  <div className="ml-4">
                    <p className="text-base font-medium text-navy-700 dark:text-white">
                      {source.name}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {formatCount(source.events_30d)} events · 30 days
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {source.last_sync_at
                        ? `Synced ${formatRelative(source.last_sync_at)}`
                        : "Never synced"}
                    </p>
                  </div>
                </div>
                <div className="mr-2 flex flex-col items-end">
                  <span
                    className={`text-sm font-bold capitalize ${
                      STATUS_TONE[source.status] ?? "text-gray-500"
                    }`}
                  >
                    {source.status}
                  </span>
                  <Link
                    to="/admin/data-tables"
                    className="mt-1 text-xs font-medium text-brand-500 hover:underline dark:text-white"
                  >
                    View details
                  </Link>
                </div>
              </div>
            );
          })
        }
      </QueryBoundary>
    </Card>
  );
};

export default Project;
