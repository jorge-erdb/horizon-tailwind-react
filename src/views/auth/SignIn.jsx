import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import InputField from "components/fields/InputField";
import AuthFeedback from "views/auth/components/AuthFeedback";
import { useAuth, describeAuthError } from "contexts/AuthContext";

export default function SignIn() {
  const { signIn, resetPassword, isConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(location.state?.notice ?? null);
  const [submitting, setSubmitting] = useState(false);

  // Where the user was headed before ProtectedRoute intercepted them.
  const redirectTo = location.state?.from?.pathname ?? "/admin/default";

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!email || !password) {
      setError("Enter your email and password.");
      return;
    }

    setSubmitting(true);
    const { error: signInError } = await signIn({ email, password });
    setSubmitting(false);

    if (signInError) {
      setError(describeAuthError(signInError));
      return;
    }

    navigate(redirectTo, { replace: true });
  };

  const handleForgotPassword = async () => {
    setError(null);
    setNotice(null);

    if (!email) {
      setError("Enter your email address first, then choose Forgot password.");
      return;
    }

    setSubmitting(true);
    const { error: resetError } = await resetPassword(email);
    setSubmitting(false);

    if (resetError) {
      setError(describeAuthError(resetError));
      return;
    }
    // Worded so it doesn't confirm whether the address has an account.
    setNotice(
      `If ${email.trim()} has a Nova account, a password reset link is on its way.`
    );
  };

  return (
    <div className="mt-16 mb-16 flex h-full w-full items-center justify-center px-2 md:mx-0 md:px-0 lg:mb-10 lg:items-center lg:justify-start">
      <div className="mt-[10vh] w-full max-w-full flex-col items-center md:pl-4 lg:pl-0 xl:max-w-[420px]">
        <h4 className="mb-2.5 font-display text-4xl font-bold text-navy-700 dark:text-white">
          Sign in
        </h4>
        <p className="mb-9 ml-1 text-base text-gray-600">
          Welcome back. Enter your email and password to open your Nova
          workspace.
        </p>

        {!isConfigured && (
          <AuthFeedback tone="info">
            Supabase isn't configured yet, so sign-in is disabled. Add
            VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to
            .env.local and restart the dev server.
          </AuthFeedback>
        )}

        <AuthFeedback tone="success">{notice}</AuthFeedback>
        <AuthFeedback tone="error">{error}</AuthFeedback>

        <form onSubmit={handleSubmit} noValidate>
          <InputField
            variant="auth"
            extra="mb-3"
            label="Email*"
            placeholder="admin@novaanalytics.io"
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            state={error ? "error" : undefined}
          />

          <InputField
            variant="auth"
            extra="mb-3"
            label="Password*"
            placeholder="Min. 8 characters"
            id="password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            state={error ? "error" : undefined}
          />

          <div className="mb-4 flex justify-end px-2">
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={submitting || !isConfigured}
              className="text-sm font-medium text-brand-500 transition-colors hover:text-brand-600 disabled:opacity-60 dark:text-white"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting || !isConfigured}
            className="linear mt-2 w-full rounded-xl bg-brand-500 py-[12px] text-base font-medium text-white transition duration-200 hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-400 dark:hover:bg-brand-300 dark:active:bg-brand-200"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-4">
          <span className="text-sm font-medium text-navy-700 dark:text-gray-600">
            Not registered yet?
          </span>
          <Link
            to="/auth/sign-up"
            className="ml-1 text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-white"
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
