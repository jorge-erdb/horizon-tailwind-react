import { useEffect } from "react";
import LandingNav from "views/landing/components/LandingNav";
import LandingFooter from "views/landing/components/LandingFooter";

// The frame shared by every standalone marketing-side page (legal, docs, 404).
// It reuses the landing page's header and footer so these pages read as part
// of the same site rather than as bare error screens.
const PageShell = ({ title, children }) => {
  // Matches the landing page: the dashboard's `dark` class on <body> should
  // not bleed into the marketing pages, which have their own composition.
  useEffect(() => {
    const hadDark = document.body.classList.contains("dark");
    document.body.classList.remove("dark");
    return () => {
      if (hadDark) {
        document.body.classList.add("dark");
      }
    };
  }, []);

  // A single-page app keeps the previous route's <title> otherwise, which is
  // how a 404 ends up announcing itself as the page the visitor just left.
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} — Nova Analytics` : "Nova Analytics";
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <LandingNav onLanding={false} />
      <main className="flex-1">{children}</main>
      <LandingFooter onLanding={false} />
    </div>
  );
};

export default PageShell;
