import { useState } from "react";
import { Link } from "react-router-dom";
import { MdClose, MdMenu } from "react-icons/md";
import NovaLogo from "components/brand/NovaLogo";

const sections = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
];

const LandingNav = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-navy-900/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
        <Link to="/" aria-label="Nova Analytics home">
          <NovaLogo variant="horizontal" className="h-8 w-auto text-white" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {sections.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/auth/sign-in"
            className="rounded-full px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            Sign in
          </Link>
          <Link
            to="/auth/sign-up"
            className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-nova transition-colors hover:bg-brand-400"
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="rounded-lg p-2 text-white md:hidden"
        >
          {open ? <MdClose className="h-6 w-6" /> : <MdMenu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 px-5 pb-6 pt-4 md:hidden">
          <nav className="flex flex-col gap-4">
            {sections.map((section) => (
              <a
                key={section.href}
                href={section.href}
                onClick={() => setOpen(false)}
                className="text-base font-medium text-white/80"
              >
                {section.label}
              </a>
            ))}
          </nav>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              to="/auth/sign-in"
              className="rounded-full border border-white/20 py-3 text-center text-sm font-medium text-white"
            >
              Sign in
            </Link>
            <Link
              to="/auth/sign-up"
              className="rounded-full bg-brand-500 py-3 text-center text-sm font-semibold text-white"
            >
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default LandingNav;
