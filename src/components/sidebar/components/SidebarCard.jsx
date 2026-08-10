import { MdAutoAwesome } from "react-icons/md";
import { Link } from "react-router-dom";

const SidebarCard = () => {
  return (
    <div className="relative mt-14 flex w-[256px] justify-center rounded-[20px] bg-nova-gradient pb-5">
      <div className="absolute -top-9 flex h-[72px] w-[72px] items-center justify-center rounded-full border-[4px] border-white bg-gradient-to-b from-brand-400 to-brand-600 dark:!border-navy-800">
        <MdAutoAwesome className="h-8 w-8 text-accent-300" />
      </div>

      <div className="mt-14 flex h-fit flex-col items-center">
        <p className="font-display text-lg font-bold text-white">
          Nova Insights
        </p>
        <p className="mt-1 px-5 text-center text-sm text-white/80">
          Automatic anomaly detection across every metric you track.
        </p>

        <Link
          className="mt-6 block rounded-full bg-white/15 py-3 px-10 text-center text-base font-medium text-white transition-colors hover:bg-white/25"
          to="/admin/default"
        >
          Explore
        </Link>
      </div>
    </div>
  );
};

export default SidebarCard;
