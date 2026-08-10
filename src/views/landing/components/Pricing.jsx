import { Link } from "react-router-dom";
import { MdCheck } from "react-icons/md";

const plans = [
  {
    name: "Starter",
    price: "$0",
    cadence: "for 14 days",
    blurb: "Everything you need to see whether Nova fits.",
    features: [
      "Up to 3 data sources",
      "1M events / month",
      "Unlimited dashboards",
      "Email support",
    ],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Scale",
    price: "$390",
    cadence: "per month",
    blurb: "For teams running the business on their numbers.",
    features: [
      "Unlimited data sources",
      "50M events / month",
      "Anomaly detection & alerts",
      "SSO and audit logs",
      "Priority support",
    ],
    cta: "Start free trial",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "annual",
    blurb: "Governance, residency and volume on your terms.",
    features: [
      "Custom event volume",
      "EU or US data residency",
      "Row-level permissions",
      "Dedicated success manager",
    ],
    cta: "Talk to sales",
    featured: false,
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-500">
            Pricing
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-700 sm:text-4xl">
            Priced on volume, not per seat
          </h2>
          <p className="mt-4 text-base text-gray-600 sm:text-lg">
            Invite everyone who needs the numbers. You are never charged for
            another viewer.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-primary border p-7 ${
                plan.featured
                  ? "border-brand-500 bg-navy-700 text-white shadow-nova lg:-mt-4 lg:mb-4"
                  : "border-neutral-200 bg-white"
              }`}
            >
              {plan.featured && (
                <span className="mb-4 inline-flex w-fit rounded-full bg-accent-500/20 px-3 py-1 text-xs font-semibold text-accent-300">
                  Most popular
                </span>
              )}
              <h3
                className={`font-display text-lg font-bold ${
                  plan.featured ? "text-white" : "text-navy-700"
                }`}
              >
                {plan.name}
              </h3>
              <p
                className={`mt-1 text-sm ${
                  plan.featured ? "text-white/70" : "text-gray-600"
                }`}
              >
                {plan.blurb}
              </p>

              <p className="mt-6 flex items-baseline gap-2">
                <span
                  className={`font-mono text-4xl font-bold ${
                    plan.featured ? "text-white" : "text-navy-700"
                  }`}
                >
                  {plan.price}
                </span>
                <span
                  className={`text-sm ${
                    plan.featured ? "text-white/60" : "text-gray-600"
                  }`}
                >
                  {plan.cadence}
                </span>
              </p>

              <ul className="mt-7 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <MdCheck
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        plan.featured ? "text-accent-300" : "text-brand-500"
                      }`}
                    />
                    <span
                      className={`text-sm ${
                        plan.featured ? "text-white/85" : "text-gray-600"
                      }`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                to="/auth/sign-up"
                className={`mt-8 rounded-full py-3 text-center text-sm font-semibold transition-colors ${
                  plan.featured
                    ? "bg-white text-navy-700 hover:bg-neutral-100"
                    : "bg-brand-500 text-white hover:bg-brand-600"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
