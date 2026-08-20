import Banner from "./components/Banner";
import General from "./components/General";
import Project from "./components/Project";
import Storage from "./components/Storage";

// Two cards used to sit here — an upload dropzone and a notification
// preferences panel — and both were untouched template: no handler behind
// either, and copy describing a different product. They were removed rather
// than left in place looking functional. FUTURE_PLANS.md carries the design
// for building them properly, and what the schema needs first.
const ProfileOverview = () => {
  return (
    <div className="flex w-full flex-col gap-5">
      <div className="mt-3 flex h-fit w-full flex-col gap-5 lg:grid lg:grid-cols-12">
        <div className="col-span-7 lg:!mb-0">
          <Banner />
        </div>

        <div className="col-span-5 lg:!mb-0">
          <Storage />
        </div>
      </div>

      <div className="grid h-full grid-cols-1 gap-5 lg:!grid-cols-12">
        <div className="col-span-6 lg:mb-0">
          <Project />
        </div>

        <div className="col-span-6 lg:mb-0">
          <General />
        </div>
      </div>
    </div>
  );
};

export default ProfileOverview;
