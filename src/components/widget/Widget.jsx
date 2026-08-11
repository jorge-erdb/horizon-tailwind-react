import Card from "components/card";
import { MdArrowDropUp, MdArrowDropDown } from "react-icons/md";
import { formatDelta } from "lib/format";

/**
 * `delta` is the raw period-over-period percentage, or null/undefined when
 * there is none to show. Passing null renders no delta at all rather than a
 * "+0.00%", because a workspace with no prior period has no comparison to
 * make and a green zero would imply otherwise.
 *
 * `loading` renders the tile's own skeleton instead of hiding the whole row
 * behind one boundary: the six tiles share a single query, and collapsing the
 * grid while it settles makes the page jump.
 */
const Widget = ({ icon, title, subtitle, delta, loading = false }) => {
  const change = formatDelta(delta);

  return (
    <Card extra="!flex-row flex-grow items-center rounded-[20px]">
      <div className="ml-[18px] flex h-[90px] w-auto flex-row items-center">
        <div className="rounded-full bg-lightPrimary p-3 dark:bg-navy-700">
          <span className="flex items-center text-brand-500 dark:text-white">
            {icon}
          </span>
        </div>
      </div>

      <div className="h-50 ml-4 flex w-auto flex-col justify-center">
        <p className="font-dm text-sm font-medium text-gray-600">{title}</p>
        {loading ? (
          <div
            className="mt-1 h-6 w-20 animate-pulse rounded bg-gray-200 dark:bg-navy-700"
            role="status"
            aria-label={`Loading ${title}`}
          />
        ) : (
          <div className="flex items-center gap-2">
            <h4 className="text-xl font-bold text-navy-700 dark:text-white">
              {subtitle}
            </h4>
            {change && (
              <span
                className={`flex items-center text-sm font-bold ${
                  change.positive ? "text-green-500" : "text-red-500"
                }`}
              >
                {change.positive ? (
                  <MdArrowDropUp className="h-4 w-4" />
                ) : (
                  <MdArrowDropDown className="h-4 w-4" />
                )}
                {change.label}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default Widget;
