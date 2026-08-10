import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import InputField from "components/fields/InputField";
import AuthFeedback from "views/auth/components/AuthFeedback";
import { useAuth, describeAuthError } from "contexts/AuthContext";

const MIN_PASSWORD_LENGTH = 8;

export default function SignUp() {
  const { signUp, resendConfirmation, isConfigured } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingEmail, setPendingEmail] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!email || !password) {
      setError("Enter an email address and a password.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }

    setSubmitting(true);
    const result = await signUp({ email, password, fullName });
    setSubmitting(false);

    if (result.error) {
      setError(describeAuthError(result.error));
      return;
    }

    if (result.needsEmailConfirmation) {
      // Email confirmation is on in the Supabase project, so there's no
      // session yet — keep them here with instructions instead of bouncing
      // them into a dashboard they can't load.
      setPendingEmail(email.trim());
      setNotice(
        `We sent a confirmation link to ${email.trim()}. Open it and you'll land straight in your workspace.`
      );
      setPassword("");
      setConfirmPassword("");
      return;
    }

    // Email confirmation is off: signUp returned a session, so they're in.
    navigate("/admin/default", { replace: true });
  };

  const handleResend = async () => {
    setError(null);
    setSubmitting(true);
    const { error: resendError } = await resendConfirmation(pendingEmail);
    setSubmitting(false);

    if (resendError) {
      setError(describeAuthError(resendError));
      return;
    }
    setNotice(`Sent another confirmation link to ${pendingEmail}.`);
  };

  return (
    <div className="mt-16 mb-16 flex h-full w-full items-center justify-center px-2 md:mx-0 md:px-0 lg:mb-10 lg:items-center lg:justify-start">
      <div className="mt-[10vh] w-full max-w-full flex-col items-center md:pl-4 lg:pl-0 xl:max-w-[420px]">
        <h4 className="mb-2.5 font-display text-4xl font-bold text-navy-700 dark:text-white">
          Create your workspace
        </h4>
        <p className="mb-9 ml-1 text-base text-gray-600">
          Start your 14-day trial. No credit card required.
        </p>

        {!isConfigured && (
          <AuthFeedback tone="info">
            Supabase isn't configured yet, so sign-up is disabled. Add
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
            label="Full name"
            placeholder="Alex Rivera"
            id="full-name"
            type="text"
            name="fullName"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />

          <InputField
            variant="auth"
            extra="mb-3"
            label="Work email*"
            placeholder="you@company.com"
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
            placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`}
            id="password"
            type="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            state={error ? "error" : undefined}
          />

          <InputField
            variant="auth"
            extra="mb-5"
            label="Confirm password*"
            placeholder="Re-enter your password"
            id="confirm-password"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            state={error ? "error" : undefined}
          />

          <button
            type="submit"
            disabled={submitting || !isConfigured}
            className="linear mt-2 w-full rounded-xl bg-brand-500 py-[12px] text-base font-medium text-white transition duration-200 hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-400 dark:hover:bg-brand-300 dark:active:bg-brand-200"
          >
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        {pendingEmail && (
          <button
            type="button"
            onClick={handleResend}
            disabled={submitting}
            className="mt-4 text-sm font-medium text-brand-500 transition-colors hover:text-brand-600 disabled:opacity-60"
          >
            Didn't get it? Send the link again
          </button>
        )}

        <p className="mt-4 text-xs leading-relaxed text-gray-600">
          By creating an account you agree to Nova Analytics'{" "}
          <a href="/legal/terms" className="text-brand-500 hover:underline">
            Terms of Use
          </a>{" "}
          and{" "}
          <a href="/legal/privacy" className="text-brand-500 hover:underline">
            Privacy Policy
          </a>
          .
        </p>

        <div className="mt-4">
          <span className="text-sm font-medium text-navy-700 dark:text-gray-600">
            Already have an account?
          </span>
          <Link
            to="/auth/sign-in"
            className="ml-1 text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-white"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
