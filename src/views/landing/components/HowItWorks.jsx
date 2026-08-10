const steps = [
  {
    step: "01",
    title: "Connect your sources",
    body: "Point Nova at your database, Stripe account and product SDK. First sync typically completes in under an hour.",
  },
  {
    step: "02",
    title: "Agree on the metrics",
    body: "Define activation, churn and MRR once. Every chart, alert and export in the workspace reads from those definitions.",
  },
  {
    step: "03",
    title: "Act on what changes",
    body: "Nova surfaces movement worth your attention and routes it to the people who own it, in Slack or email.",
  },
];

const stats = [
  { value: "5.7M", label: "events ingested daily" },
  { value: "<400ms", label: "median query time" },
  { value: "24", label: "native integrations" },
  { value: "99.98%", label: "platform uptime" },
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
              <span className="font-mono text-sm font-semibold text-accent-600">
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

        <dl className="mt-16 grid grid-cols-2 gap-6 rounded-primary bg-white p-8 shadow-3xl shadow-shadow-500 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="sr-only">{stat.label}</dt>
              <dd>
                <p className="font-mono text-2xl font-bold text-brand-500 sm:text-3xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-gray-600">{stat.label}</p>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};

export default HowItWorks;
