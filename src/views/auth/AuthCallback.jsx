import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import NovaLogo from "components/brand/NovaLogo";
import AuthFeedback from "views/auth/components/AuthFeedback";
import { useAuth } from "contexts/AuthContext";

/**
 * Landing page for every link Supabase emails out.
 *
 * Supabase's verify endpoint bounces the browser back here with either a
 * token payload in the URL fragment (implicit flow, which is the JS client's
 * default) or an error. `detectSessionInUrl` on the client consumes that
 * fragment and fires onAuthStateChange, so this view's job is to wait for
 * that to resolve and then route the user somewhere useful:
 *
 *   type=signup / magiclink / invite  -> straight into the dashboard
 *   type=recovery                     -> the set-a-new-password screen
 *   error in the URL                  -> explain it, offer a way forward
 *
 * Without this route the confirmation link dropped users on the sign-in form
 * with a session they couldn't see, which reads as "the link did nothing".
 */

// Supabase has already redirected once by the time we get here, so the
// fragment is either present immediately or never.
const RESOLVE_TIMEOUT_MS = 8000;

function readParams() {
  // Errors and tokens arrive in the fragment; PKCE-style codes in the query.
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const get = (key) => hash.get(key) ?? query.get(key);

  return {
    type: get("type"),
    error: get("error"),
    errorCode: get("error_code"),
    errorDescription: get("error_description"),
  };
}

function describeLinkError({ errorCode, errorDescription, error }) {
  if (/expired/i.test(errorCode ?? "") || /expired/i.test(errorDescription ?? "")) {
    return "That link has expired. Request a new one and try again — links are single-use and time-limited.";
  }
  if (/access_denied/i.test(error ?? "")) {
    return "That link is no longer valid. It may already have been used.";
  }
  return (
    (errorDescription && decodeURIComponent(errorDescription.replace(/\+/g, " "))) ||
    "We couldn't verify that link."
  );
}

export default function AuthCallback() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [failure, setFailure] = useState(null);

  useEffect(() => {
    const params = readParams();

    if (params.error) {
      setFailure(describeLinkError(params));
      return undefined;
    }

    if (loading) return undefined;

    if (session) {
      if (params.type === "recovery") {
        navigate("/auth/reset-password", { replace: true });
      } else {
        navigate("/admin/default", { replace: true });
      }
      return undefined;
    }

    // No session and no error yet — give detectSessionInUrl a moment to run
    // before concluding the link was bad.
    const timer = setTimeout(() => {
      setFailure(
        "We couldn't verify that link. It may have expired or already been used."
      );
    }, RESOLVE_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [session, loading, navigate]);

  return (
    <div className="mt-16 mb-16 flex h-full w-full items-center justify-center px-2 md:mx-0 md:px-0 lg:mb-10 lg:justify-start">
      <div className="mt-[10vh] w-full max-w-full md:pl-4 lg:pl-0 xl:max-w-[420px]">
        {failure ? (
          <>
            <h4 className="mb-2.5 font-display text-4xl font-bold text-navy-700 dark:text-white">
              Link didn't work
            </h4>
            <p className="mb-9 ml-1 text-base text-gray-600">
              Let's get you back on track.
            </p>
            <AuthFeedback tone="error">{failure}</AuthFeedback>
            <div className="flex flex-col gap-3">
              <Link
                to="/auth/sign-in"
                className="linear w-full rounded-xl bg-brand-500 py-[12px] text-center text-base font-medium text-white transition duration-200 hover:bg-brand-600 active:bg-brand-700"
              >
                Go to sign in
              </Link>
              <Link
                to="/auth/sign-up"
                className="w-full rounded-xl border border-gray-200 py-[12px] text-center text-base font-medium text-navy-700 transition-colors hover:bg-gray-100 dark:border-white/10 dark:text-white dark:hover:bg-white/10"
              >
                Create a new account
              </Link>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-start">
            <NovaLogo variant="mark" className="h-12 w-12 animate-pulse" />
            <h4 className="mt-6 font-display text-3xl font-bold text-navy-700 dark:text-white">
              Confirming your email…
            </h4>
            <p className="mt-2 text-base text-gray-600">
              One moment while we open your workspace.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
