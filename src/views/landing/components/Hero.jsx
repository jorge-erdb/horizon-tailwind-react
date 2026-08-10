import { Link } from "react-router-dom";
import { MdArrowForward, MdCheck } from "react-icons/md";

const proofPoints = ["No credit card required", "14-day trial", "SOC 2 Type II"];

const sparkline = [38, 52, 44, 61, 57, 74, 69, 88, 82, 96];

const Hero = () => {
  const max = Math.max(...sparkline);

  return (
    <section className="relative overflow-hidden bg-nova-gradient">
      {/* Spark accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-24 h-[420px] w-[420px] rounded-full bg-accent-500/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -left-32 h-[380px] w-[380px] rounded-full bg-brand-400/25 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pt-16 pb-20 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8 lg:pt-24 lg:pb-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-accent-300">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
            Real-time pipelines now in beta
          </span>

          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Turn your product data into{" "}
            <span className="text-accent-300">decisions</span>, not dashboards.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
            Nova Analytics unifies product, marketing and revenue data in one
            workspace — so your team stops arguing about the numbers and starts
            acting on them.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/auth/sign-up"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-navy-700 shadow-nova transition-transform hover:-translate-y-0.5"
            >
              Start free
              <MdArrowForward className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/auth/sign-in"
              className="inline-flex items-center justify-center rounded-full border border-white/25 px-7 py-3.5 text-base font-medium text-white transition-colors hover:bg-white/10"
            >
              Sign in
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
            {proofPoints.map((point) => (
              <li
                key={point}
                className="flex items-center gap-1.5 text-sm text-white/60"
              >
                <MdCheck className="h-4 w-4 text-accent-500" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Product preview */}
        <div className="relative">
          <div className="rounded-primary border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-sm sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-white/50">
                  Monthly recurring revenue
                </p>
                <p className="mt-2 font-mono text-3xl font-semibold text-white sm:text-4xl">
                  $340,512
                </p>
              </div>
              <span className="rounded-full bg-success/15 px-2.5 py-1 font-mono text-xs font-medium text-green-400">
                +12.4%
              </span>
            </div>

            <div
              className="mt-8 flex h-32 items-end gap-1.5 sm:h-40 sm:gap-2"
              aria-hidden="true"
            >
              {sparkline.map((value, index) => (
                <div
                  key={index}
                  style={{ height: `${(value / max) * 100}%` }}
                  className={`flex-1 rounded-t-sm ${
                    index === sparkline.length - 1
                      ? "bg-accent-500"
                      : "bg-white/25"
                  }`}
                />
              ))}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
              {[
                { label: "Active users", value: "64,239" },
                { label: "Conversion", value: "3.8%" },
                { label: "Sources", value: "24" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="font-mono text-lg font-semibold text-white">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 text-xs text-white/50">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
