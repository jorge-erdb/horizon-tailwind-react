import Dropdown from "components/dropdown";
import { IoMdNotificationsOutline } from "react-icons/io";
import {
  MdInfoOutline,
  MdCheckCircleOutline,
  MdWarningAmber,
  MdErrorOutline,
} from "react-icons/md";
import {
  useNotifications,
  useMarkAllNotificationsRead,
} from "lib/queries/notifications";
import { QueryLoading, QueryError, QueryEmpty } from "components/common/QueryState";
import { formatRelative } from "lib/format";

// notifications.kind is constrained to these four by the schema; the fallback
// covers a kind added in a later migration without a matching icon here.
const KIND = {
  info: { icon: MdInfoOutline, tint: "bg-brand-500" },
  success: { icon: MdCheckCircleOutline, tint: "bg-green-500" },
  warning: { icon: MdWarningAmber, tint: "bg-amber-500" },
  danger: { icon: MdErrorOutline, tint: "bg-red-500" },
};
const kindOf = (kind) => KIND[kind] ?? KIND.info;

const NotificationsMenu = () => {
  const query = useNotifications({ limit: 20 });
  const markAllRead = useMarkAllNotificationsRead();

  const items = query.data ?? [];
  const unread = items.filter((item) => !item.read_at).length;

  return (
    <Dropdown
      button={
        <p className="relative cursor-pointer">
          <IoMdNotificationsOutline className="h-4 w-4 text-gray-600 dark:text-white" />
          {unread > 0 && (
            <span
              className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
              aria-label={`${unread} unread notifications`}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </p>
      }
      animation="origin-[65%_0%] md:origin-top-right transition-all duration-300 ease-in-out"
      classNames={"py-2 top-4 -left-[230px] md:-left-[440px] w-max"}
    >
      <div className="flex w-[360px] flex-col gap-3 rounded-[20px] bg-white p-4 shadow-xl shadow-shadow-500 dark:!bg-navy-700 dark:text-white dark:shadow-none sm:w-[460px]">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-navy-700 dark:text-white">
            Notifications
          </p>
          <button
            type="button"
            // Disabled with nothing unread so the click cannot fire an update
            // that matches no rows and still invalidates the cache.
            disabled={unread === 0 || markAllRead.isPending}
            onClick={() => markAllRead.mutate({})}
            className="text-sm font-bold text-brand-500 disabled:cursor-not-allowed disabled:text-gray-400 dark:disabled:text-gray-500"
          >
            {markAllRead.isPending ? "Marking…" : "Mark all read"}
          </button>
        </div>

        {markAllRead.isError && <QueryError error={markAllRead.error} />}

        {query.isPending ? (
          <QueryLoading />
        ) : query.isError ? (
          <QueryError error={query.error} />
        ) : items.length === 0 ? (
          <QueryEmpty
            title="Nothing yet"
            body="Alerts and report runs show up here."
          />
        ) : (
          items.map((item) => {
            const { icon: Icon, tint } = kindOf(item.kind);
            return (
              <div
                key={item.id}
                className={`flex w-full items-center rounded-lg ${
                  item.read_at ? "opacity-60" : ""
                }`}
              >
                <div
                  className={`flex h-full w-[85px] shrink-0 items-center justify-center rounded-xl py-4 text-2xl text-white ${tint}`}
                >
                  <Icon />
                </div>
                <div className="ml-2 flex h-full w-full flex-col justify-center rounded-lg px-1 text-sm">
                  <p className="mb-1 text-left text-base font-bold text-gray-900 dark:text-white">
                    {item.title}
                  </p>
                  {item.body && (
                    <p className="font-base text-left text-xs text-gray-900 dark:text-white">
                      {item.body}
                    </p>
                  )}
                  <p className="mt-1 text-left text-xs text-gray-500 dark:text-gray-400">
                    {formatRelative(item.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Dropdown>
  );
};

export default NotificationsMenu;
