import {
  MdBolt,
  MdGroups,
  MdInsights,
  MdLock,
  MdStorage,
  MdVerified,
} from "react-icons/md";

/**
 * Every claim here describes behaviour that exists in the product today.
 *
 * Anything not yet built — event ingestion, anomaly detection, SSO, audit
 * logs, SOC 2, data residency — belongs in the roadmap band in HowItWorks,
 * where it is explicitly labelled as planned. Adding a capability here means
 * it ships first.
 */
const features = [
  {
    icon: MdVerified,
    title: "One workspace, one set of numbers",
    body: "Every chart, table and KPI reads from the same metric definitions. Two people looking at revenue see the same figure, because it is the same figure.",
  },
  {
    icon: MdLock,
    title: "Isolated at the database, not the app",
    body: "Each workspace is separated by Postgres row-level security, enforced on every single query. A bug in application code cannot leak another tenant's rows.",
  },
  {
    icon: MdInsights,
    title: "A dashboard that arrives configured",
    body: "Revenue trend, traffic by platform, conversion and source health land already wired to your workspace — not an empty canvas and a chart builder.",
  },
  {
    icon: MdStorage,
    title: "Every source in one register",
    body: "Each connected source with its platforms, health and last sync in one view, so a pipeline that quietly stopped is visible now rather than at month end.",
  },
  {
    icon: MdBolt,
    title: "Reports and alerts, defined once",
    body: "Capture the reports your team needs and the thresholds worth interrupting someone for. Scheduled delivery is on the roadmap; the definitions live in the workspace today.",
  },
  {
    icon: MdGroups,
    title: "Priced for the whole team",
    body: "Invite everyone who needs the numbers. Membership and roles sit on the workspace, and you are never charged for another viewer.",
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
            Nova closes that gap with shared definitions and a workspace
            everyone reads from.
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
