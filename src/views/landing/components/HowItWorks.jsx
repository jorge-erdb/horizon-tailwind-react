const steps = [
  {
    step: "01",
    title: "Create your workspace",
    body: "Sign up and you get an isolated workspace with a dashboard already wired to it. No setup call, no onboarding project.",
  },
  {
    step: "02",
    title: "Agree on the metrics",
    body: "Name what you measure once. Every chart, report and alert in the workspace reads from those definitions rather than its own copy.",
  },
  {
    step: "03",
    title: "Bring the team in",
    body: "Invite everyone who argues about the numbers. They see the same figures, with the same definitions behind them.",
  },
];

/**
 * This band replaced a stats strip that claimed "5.7M events ingested daily",
 * "<400ms median query time", "24 native integrations" and "99.98% platform
 * uptime". None of those were measured or true, and an uptime figure in
 * particular reads as an SLA.
 *
 * Everything below is explicitly future work. Keep it that way: an item only
 * moves out of this list and into Features once it actually ships.
 */
const roadmap = [
  {
    title: "Event ingestion API",
    body: "A write key per source, so Nova collects your events directly.",
  },
  {
    title: "SSO and audit logs",
    body: "SAML sign-in and a record of who changed which definition.",
  },
  {
    title: "SOC 2 Type II",
    body: "Not yet certified. On the path, not a claim we make today.",
  },
  {
    title: "EU / US data residency",
    body: "Choose where a workspace's data is stored and processed.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="bg-neutral-50 py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-500">
            How it works
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-700 sm:text-4xl">
            Live in an afternoon, not a quarter
          </h2>
        </div>

        <ol className="mt-14 grid gap-8 md:grid-cols-3">
          {steps.map((item) => (
            <li key={item.step} className="relative">
              <span className="font-mono text-sm font-semibold text-accent-700">
                {item.step}
              </span>
              <div className="mt-3 h-px w-full bg-neutral-200" />
              <h3 className="mt-5 font-display text-xl font-bold text-navy-700">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {item.body}
              </p>
            </li>
          ))}
        </ol>

        {/* Roadmap — deliberately separated from anything we claim today. */}
        <div className="mt-16 rounded-primary bg-white p-8 shadow-3xl shadow-shadow-500">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="font-display text-lg font-bold text-navy-700">
              On the roadmap
            </h3>
            <p className="text-sm text-gray-600">
              Not available yet — listed so you can judge whether Nova is going
              where you need it to.
            </p>
          </div>

          <ul className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {roadmap.map((item) => (
              <li key={item.title}>
                <span className="inline-flex rounded-full bg-amber-500/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                  Planned
                </span>
                <p className="mt-3 font-display text-base font-bold text-navy-700">
                  {item.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
