// The pages the footer, the sign-up consent copy and the dashboard's help
// menu link to. Each one states plainly what is missing and why, rather than
// implying the section exists.
const marketingRoutes = [
  {
    path: "docs",
    title: "Documentation",
    summary:
      "Nova's guides are not written yet. The project's technical documentation lives in the repository README instead.",
    detail:
      "The README covers setup, the database schema and its migrations, the event contract that decides which events move which charts, and the row-level security model that keeps one workspace's rows out of another's queries.",
  },
  {
    path: "docs/api",
    title: "API reference",
    summary:
      "There is no generated API reference yet, though the ingest API it would document is real and running.",
    detail:
      "The ingest endpoint accepts a batch of events authenticated by a per-source write key, and the dashboard has a Connect a source flow that issues a key and generates a correctly shaped example request for the source kind you pick. That flow is the working reference until this page is written.",
  },
  {
    path: "legal/privacy",
    title: "Privacy policy",
    summary:
      "Nova Analytics is a university project, not a company, and it has no privacy policy because it is not offered as a service.",
    detail:
      "It is worth being exact about what that means for data. An account here stores the email address you sign up with and whatever events you send to your own workspace. Nothing is shared with a third party, and no analytics or tracking is run on this site itself. If you deploy your own instance, the data is in your own Supabase project and never reaches anyone else.",
  },
  {
    path: "legal/terms",
    title: "Terms of use",
    summary:
      "There are no terms of service, because nothing here is being sold or offered as a service.",
    detail:
      "The pricing shown on the homepage illustrates a plausible commercial model for the product; no payment is ever taken and no plan can be purchased. The source code is covered by the licence in the repository. Treat the hosted instance as a demonstration that may be reset or taken down without notice.",
  },
  {
    path: "legal/security",
    title: "Security",
    summary:
      "There is no formal security programme, but the isolation claims the homepage makes are real and are tested.",
    detail:
      "Every table is protected by Postgres row-level security rather than by checks in application code, so a bug in the frontend cannot read another tenant's rows. Those policies are asserted directly against Postgres in supabase/tests/, which run in CI on every push. The SOC 2 and data-residency items on the homepage are explicitly marked as planned, and are not claims about what exists today.",
  },
];

export default marketingRoutes;
