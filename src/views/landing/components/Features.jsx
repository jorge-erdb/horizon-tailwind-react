import {
  MdAutoAwesome,
  MdBolt,
  MdGroups,
  MdInsights,
  MdLock,
  MdSync,
} from "react-icons/md";

const features = [
  {
    icon: MdSync,
    title: "Every source, one model",
    body: "Connect Postgres, Stripe, your product SDK and ad platforms. Nova reconciles them into a single event model — no warehouse project required.",
  },
  {
    icon: MdBolt,
    title: "Answers in seconds",
    body: "Queries run against a columnar store tuned for event data. Cohorts and funnels over hundreds of millions of rows return before you lose your train of thought.",
  },
  {
    icon: MdAutoAwesome,
    title: "Anomalies find you",
    body: "Nova watches every metric you track and tells you when something breaks its pattern — before it shows up in a monthly review.",
  },
  {
    icon: MdInsights,
    title: "Funnels and retention built in",
    body: "Drop-off analysis, cohort retention and attribution ship as first-class views, not dashboards you have to assemble by hand.",
  },
  {
    icon: MdGroups,
    title: "Shared definitions",
    body: "Define a metric once and every dashboard, alert and export uses it. When someone changes it, everyone sees the change and who made it.",
  },
  {
    icon: MdLock,
    title: "Governed by default",
    body: "Row-level permissions, SSO, audit logs and EU or US data residency — set once at the workspace level and enforced everywhere.",
  },
];

const Features = () => {
  return (
    <section id="features" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-500">
            Why Nova
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-700 sm:text-4xl">
            Everything the numbers meeting was missing
          </h2>
          <p className="mt-4 text-base leading-relaxed text-gray-600 sm:text-lg">
            Most teams have plenty of data and no agreement on what it means.
            Nova closes that gap with shared definitions, fast queries and
            alerts that reach people before the damage does.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-primary border border-neutral-200 bg-neutral-50 p-6 transition-all hover:-translate-y-1 hover:border-brand-200 hover:shadow-nova"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-navy-700">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
