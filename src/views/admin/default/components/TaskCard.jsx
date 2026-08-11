import CardMenu from "components/card/CardMenu";
import Checkbox from "components/checkbox";
import { MdDragIndicator, MdCheckCircle } from "react-icons/md";
import Card from "components/card";
import QueryBoundary, { QueryEmpty, QueryError } from "components/common/QueryState";
import { useTasks, useToggleTask } from "lib/queries/tasks";

const TaskCard = () => {
  const query = useTasks();
  const toggle = useToggleTask();

  return (
    <Card extra="pb-7 p-[20px]">
      {/* task header */}
      <div className="relative flex flex-row justify-between">
        <div className="flex items-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-100 dark:bg-white/5">
            <MdCheckCircle className="h-6 w-6 text-brand-500 dark:text-white" />
          </div>
          <h4 className="ml-4 text-xl font-bold text-navy-700 dark:text-white">
            Tasks
          </h4>
        </div>
        <CardMenu />
      </div>

      {/* A failed toggle is rolled back in the cache, so the box visibly
          un-ticks. Without a message that looks like the click was ignored. */}
      {toggle.isError && (
        <div className="mt-4">
          <QueryError error={toggle.error} />
        </div>
      )}

      <div className="h-full w-full">
        <QueryBoundary
          query={query}
          empty={
            <QueryEmpty
              title="No tasks"
              body="Tasks assigned to this workspace show up here."
            />
          }
        >
          {(tasks) =>
            tasks.map((task, index) => (
              <label
                key={task.id}
                className={`flex items-center justify-between p-2 hover:cursor-pointer ${
                  index === 0 ? "mt-5" : "mt-2"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Checkbox
                    checked={task.is_done}
                    onChange={(event) =>
                      toggle.mutate({ id: task.id, isDone: event.target.checked })
                    }
                  />
                  <p
                    className={`text-base font-bold ${
                      task.is_done
                        ? "text-gray-400 line-through dark:text-gray-500"
                        : "text-navy-700 dark:text-white"
                    }`}
                  >
                    {task.title}
                  </p>
                </div>
                <MdDragIndicator className="h-6 w-6 text-navy-700 dark:text-white" />
              </label>
            ))
          }
        </QueryBoundary>
      </div>
    </Card>
  );
};

export default TaskCard;
