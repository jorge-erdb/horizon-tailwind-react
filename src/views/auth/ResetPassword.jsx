import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import InputField from "components/fields/InputField";
import AuthFeedback from "views/auth/components/AuthFeedback";
import { useAuth, describeAuthError } from "contexts/AuthContext";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Where a password-recovery link lands, via /auth/callback.
 *
 * Supabase signs the user in with a short-lived recovery session before
 * redirecting, so updateUser can set the new password directly. Reaching this
 * page without that session means the link wasn't followed.
 */
export default function ResetPassword() {
  const { session, loading, updatePassword, isConfigured } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Those passwords don't match.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    setSubmitting(false);

    if (updateError) {
      setError(describeAuthError(updateError));
      return;
    }

    navigate("/admin/default", { replace: true });
  };

  const hasRecoverySession = Boolean(session);

  return (
    <div className="mt-16 mb-16 flex h-full w-full items-center justify-center px-2 md:mx-0 md:px-0 lg:mb-10 lg:justify-start">
      <div className="mt-[10vh] w-full max-w-full md:pl-4 lg:pl-0 xl:max-w-[420px]">
        <h4 className="mb-2.5 font-display text-4xl font-bold text-navy-700 dark:text-white">
          Set a new password
        </h4>
        <p className="mb-9 ml-1 text-base text-gray-600">
          Choose a new password for your Nova workspace.
        </p>

        {!loading && !hasRecoverySession && (
          <AuthFeedback tone="info">
            Open this page from the password reset link we emailed you — it's
            what authorises the change.{" "}
            <Link to="/auth/sign-in" className="underline">
              Back to sign in
            </Link>
          </AuthFeedback>
        )}

        <AuthFeedback tone="error">{error}</AuthFeedback>

        <form onSubmit={handleSubmit} noValidate>
          <InputField
            variant="auth"
            extra="mb-3"
            label="New password*"
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
            label="Confirm new password*"
            placeholder="Re-enter your new password"
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
            disabled={submitting || !isConfigured || !hasRecoverySession}
            className="linear mt-2 w-full rounded-xl bg-brand-500 py-[12px] text-base font-medium text-white transition duration-200 hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-400 dark:hover:bg-brand-300 dark:active:bg-brand-200"
          >
            {submitting ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
