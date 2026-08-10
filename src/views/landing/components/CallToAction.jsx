import { Link } from "react-router-dom";
import { MdArrowForward } from "react-icons/md";

const CallToAction = () => {
  return (
    <section className="bg-white pb-20 lg:pb-28">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="relative overflow-hidden rounded-primary bg-nova-gradient px-6 py-14 text-center sm:px-12 lg:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-[320px] w-[320px] -translate-x-1/2 rounded-full bg-accent-500/20 blur-3xl"
          />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Stop reconciling spreadsheets. Start reading the business.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/75 sm:text-lg">
              Create your workspace in under a minute, and bring the team in
              whenever you're ready.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/auth/sign-up"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-navy-700 transition-transform hover:-translate-y-0.5"
              >
                Create free account
                <MdArrowForward className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/auth/sign-in"
                className="inline-flex items-center justify-center rounded-full border border-white/25 px-8 py-3.5 text-base font-medium text-white transition-colors hover:bg-white/10"
              >
                I already have an account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;
