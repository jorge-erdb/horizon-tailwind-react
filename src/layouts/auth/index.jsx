import { Link, Routes, Route, Navigate } from "react-router-dom";
import { MdArrowBack } from "react-icons/md";
import Footer from "components/footer/FooterAuthDefault";
import NovaLogo from "components/brand/NovaLogo";
import FixedPlugin from "components/fixedPlugin/FixedPlugin";
import routes from "routes.js";

const highlights = [
  "Every source reconciled into one event model",
  "Funnels, cohorts and retention out of the box",
  "Alerts that reach the person who owns the metric",
];

export default function Auth() {
  const getRoutes = (routes) => {
    return routes.map((prop, key) => {
      if (prop.layout === "/auth") {
        return (
          <Route path={`/${prop.path}`} element={prop.component} key={key} />
        );
      }
      return null;
    });
  };

  document.documentElement.dir = "ltr";

  return (
    <div className="relative float-right h-full min-h-screen w-full !bg-white dark:!bg-navy-900">
      <FixedPlugin />
      <main className="mx-auto min-h-screen">
        <div className="relative flex">
          <div className="mx-auto flex min-h-full w-full flex-col justify-start pt-12 md:max-w-[75%] lg:max-w-[1013px] lg:px-8 lg:pt-0 xl:min-h-[100vh] xl:max-w-[1383px] xl:px-0 xl:pl-[70px]">
            <div className="mb-auto flex flex-col pl-5 pr-5 md:pr-0 md:pl-12 lg:max-w-[48%] lg:pl-0 xl:max-w-full">
              <Link to="/" className="mt-0 w-max lg:pt-10">
                <div className="mx-auto flex h-fit w-fit items-center hover:cursor-pointer">
                  <MdArrowBack className="h-4 w-4 text-gray-600" />
                  <p className="ml-2 text-sm text-gray-600">
                    Back to Nova Analytics
                  </p>
                </div>
              </Link>

              <Routes>
                {getRoutes(routes)}
                <Route
                  path="/"
                  element={<Navigate to="/auth/sign-in" replace />}
                />
              </Routes>

              {/* Brand panel */}
              <div className="absolute right-0 hidden h-full min-h-screen md:block lg:w-[49vw] 2xl:w-[44vw]">
                <div className="absolute flex h-full w-full flex-col items-center justify-center overflow-hidden bg-nova-gradient px-12 lg:rounded-bl-[120px] xl:rounded-bl-[200px]">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-24 -right-16 h-[360px] w-[360px] rounded-full bg-accent-500/20 blur-3xl"
                  />
                  <div className="relative max-w-md">
                    <NovaLogo
                      variant="stacked"
                      className="mx-auto h-32 w-auto text-white"
                    />
                    <p className="mt-8 text-center font-display text-2xl font-bold leading-snug text-white">
                      The numbers your whole team agrees on.
                    </p>
                    <ul className="mt-8 space-y-3">
                      {highlights.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2.5 text-sm text-white/70"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:max-w-[48%]">
              <Footer />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
