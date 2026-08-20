import { Link } from "react-router-dom";
import { MdArrowBack, MdArrowForward } from "react-icons/md";
import PageShell from "views/marketing/PageShell";

// Pages the footer and sign-up copy link to that are not written yet.
//
// These exist rather than being deleted because the links around them are
// real product surface: a analytics tool does need a privacy policy and an
// API reference, and pretending otherwise would misrepresent the shape of
// the thing. What they must not do is dead-end — the previous behaviour sent
// every one of these paths to a catch-all redirect, so a visitor clicking
// "Privacy" landed silently back on the homepage with no explanation.
const ComingSoon = ({ title, summary, detail }) => {
  return (
    <PageShell title={title}>
      <section className="mx-auto max-w-3xl px-5 py-20 lg:px-8 lg:py-28">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
          Not written yet
        </p>

        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-navy-900 lg:text-5xl">
          {title}
        </h1>

        <p className="mt-5 text-lg leading-relaxed text-neutral-600">
          {summary}
        </p>

        <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
          <p className="text-sm leading-relaxed text-neutral-700">{detail}</p>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-nova transition-colors hover:bg-brand-600"
          >
            <MdArrowBack className="h-4 w-4" aria-hidden="true" />
            Back to the homepage
          </Link>
          <Link
            to="/auth/sign-up"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold text-navy-900 transition-colors hover:bg-neutral-100"
          >
            Create a workspace
            <MdArrowForward className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </PageShell>
  );
};

export default ComingSoon;
