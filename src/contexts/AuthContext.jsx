import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase, isSupabaseConfigured } from "lib/supabase";

const AuthContext = createContext(null);

const NOT_CONFIGURED = {
  message:
    "Authentication is not configured yet. Add your Supabase URL and anon key to .env.local, then restart the dev server.",
};

/**
 * Maps Supabase auth errors onto messages a user can act on. Supabase
 * deliberately returns the same "Invalid login credentials" for a wrong
 * password and an unknown email so the endpoint can't be used to enumerate
 * accounts — the copy below keeps that property.
 */
export function describeAuthError(error) {
  if (!error) return null;
  const message = error.message || "";

  if (/invalid login credentials/i.test(message)) {
    return "That email and password don't match an account.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Check your inbox and confirm your email address before signing in.";
  }
  if (/user already registered|already been registered/i.test(message)) {
    return "An account with that email already exists. Try signing in instead.";
  }
  if (/password should be at least/i.test(message)) {
    return "Password must be at least 6 characters.";
  }
  if (/rate limit|too many requests/i.test(message)) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (/unable to validate email address|invalid format/i.test(message)) {
    return "That doesn't look like a valid email address.";
  }
  if (/failed to fetch|network/i.test(message)) {
    return "Couldn't reach the authentication service. Check your connection.";
  }
  return message || "Something went wrong. Please try again.";
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  // Starts true so protected routes wait for the initial session lookup
  // instead of bouncing an already-signed-in user back to sign-in.
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async ({ email, password }) => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return { data, error };
  }, []);

  const signUp = useCallback(async ({ email, password }) => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/sign-in`,
      },
    });

    // With "Confirm email" enabled, signing up with an address that already
    // exists returns a success payload with an obfuscated user and no
    // identities, rather than an error — again to avoid leaking which
    // addresses are registered. Surface it as a duplicate for the UI.
    if (!error && data?.user && data.user.identities?.length === 0) {
      return {
        data,
        error: { message: "User already registered" },
        alreadyRegistered: true,
      };
    }

    // No session back means Supabase sent a confirmation email.
    return { data, error, needsEmailConfirmation: !error && !data?.session };
  }, []);

  const resetPassword = useCallback(async (email) => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/sign-in`,
    });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return { error: NOT_CONFIGURED };
    const { error } = await supabase.auth.signOut();
    return { error };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      isConfigured: isSupabaseConfigured,
      signIn,
      signUp,
      signOut,
      resetPassword,
    }),
    [session, loading, signIn, signUp, signOut, resetPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return context;
}

export default AuthContext;
