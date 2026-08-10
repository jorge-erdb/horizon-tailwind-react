import { useEffect } from "react";
import LandingNav from "./components/LandingNav";
import Hero from "./components/Hero";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import Pricing from "./components/Pricing";
import CallToAction from "./components/CallToAction";
import LandingFooter from "./components/LandingFooter";

const Landing = () => {
  // The dashboard toggles `dark` on <body>; the marketing page has its own
  // light/dark composition and should not inherit that state.
  useEffect(() => {
    const hadDark = document.body.classList.contains("dark");
    document.body.classList.remove("dark");
    return () => {
      if (hadDark) {
        document.body.classList.add("dark");
      }
    };
  }, []);

  return (
    <div className="min-h-screen scroll-smooth bg-white">
      <LandingNav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <CallToAction />
      </main>
      <LandingFooter />
    </div>
  );
};

export default Landing;
