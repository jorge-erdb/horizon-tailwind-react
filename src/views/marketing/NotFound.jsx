import { Link } from "react-router-dom";
import { MdArrowBack } from "react-icons/md";
import PageShell from "views/marketing/PageShell";

const destinations = [
  { label: "Homepage", to: "/", note: "What Nova does and how it is priced" },
  {
    label: "Sign in",
    to: "/auth/sign-in",
    note: "Open the dashboard for an existing workspace",
  },
  {
    label: "Create an account",
    to: "/auth/sign-up",
    note: "A new workspace, empty and yours",
  },
];

// Replaces a catch-all `<Navigate to="/">`, which sent every unknown URL to
// the homepage without saying anything. A silent redirect is indistinguishable
// from a working link that happens to go home, so a mistyped or stale URL gave
// no signal that it was wrong.
const NotFound = () => {
  return (
    <PageShell title="Page not found">
      <section className="mx-auto max-w-3xl px-5 py-20 lg:px-8 lg:py-28">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
          Error 404
        </p>

        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-navy-900 lg:text-5xl">
          We could not find that page.
        </h1>

        <p className="mt-5 text-lg leading-relaxed text-neutral-600">
          The link may be out of date, or the address may have a typo in it.
          Nothing is wrong with your account.
        </p>

        <ul className="mt-10 divide-y divide-neutral-200 border-y border-neutral-200">
          {destinations.map((destination) => (
            <li key={destination.to}>
              <Link
                to={destination.to}
                className="group flex items-center justify-between gap-4 py-4 transition-colors hover:bg-neutral-50"
              >
                <span>
                  <span className="block text-base font-semibold text-navy-900">
                    {destination.label}
                  </span>
                  <span className="mt-0.5 block text-sm text-neutral-500">
                    {destination.note}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-neutral-400 transition-transform group-hover:translate-x-1"
                >
                  &rarr;
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <Link
          to="/"
          className="mt-10 inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-nova transition-colors hover:bg-brand-600"
        >
          <MdArrowBack className="h-4 w-4" aria-hidden="true" />
          Back to the homepage
        </Link>
      </section>
    </PageShell>
  );
};

export default NotFound;
