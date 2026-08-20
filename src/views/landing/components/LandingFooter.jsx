import { Link } from "react-router-dom";
import NovaLogo from "components/brand/NovaLogo";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "API reference", href: "/docs/api" },
      { label: "Support", href: "mailto:support@novaanalytics.io" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Terms", href: "/legal/terms" },
      { label: "Security", href: "/legal/security" },
    ],
  },
];

// See LandingNav: off the marketing page the Product column's in-page
// anchors have to navigate home first.
const LandingFooter = ({ onLanding = true }) => {
  const resolve = (href) =>
    !onLanding && href.startsWith("#") ? `/${href}` : href;

  return (
    <footer className="bg-navy-900 py-14">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" aria-label="Nova Analytics home">
              <NovaLogo
                variant="horizontal"
                className="h-8 w-auto text-white"
              />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/50">
              Turn product and revenue data into decisions your team can act on.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="font-display text-sm font-semibold text-white">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={resolve(link.href)}
                      className="text-sm text-white/50 transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p className="text-sm text-white/50">
            © {new Date().getFullYear()} Nova Analytics. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              to="/auth/sign-in"
              className="text-sm text-white/50 transition-colors hover:text-white"
            >
              Sign in
            </Link>
            <Link
              to="/auth/sign-up"
              className="text-sm text-white/50 transition-colors hover:text-white"
            >
              Get started
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;
