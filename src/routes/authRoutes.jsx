import { MdLock, MdPersonAdd } from "react-icons/md";

import SignIn from "views/auth/SignIn";
import SignUp from "views/auth/SignUp";
import AuthCallback from "views/auth/AuthCallback";
import ResetPassword from "views/auth/ResetPassword";

/**
 * Auth routes are kept in their own module so the auth layout never pulls in
 * the admin views. Sharing one route table meant the sign-in page shipped
 * ApexCharts and every dashboard component — a few hundred KB on the critical
 * signup path, for a screen with two inputs.
 *
 * These are all hideInSidebar; the sidebar only ever renders admin routes.
 */
const authRoutes = [
  {
    name: "Sign In",
    layout: "/auth",
    path: "sign-in",
    icon: <MdLock className="h-6 w-6" />,
    component: <SignIn />,
    hideInSidebar: true,
  },
  {
    name: "Sign Up",
    layout: "/auth",
    path: "sign-up",
    icon: <MdPersonAdd className="h-6 w-6" />,
    component: <SignUp />,
    hideInSidebar: true,
  },
  {
    // Landing route for every link Supabase emails (confirmation, recovery).
    name: "Confirm",
    layout: "/auth",
    path: "callback",
    icon: <MdLock className="h-6 w-6" />,
    component: <AuthCallback />,
    hideInSidebar: true,
  },
  {
    name: "Reset Password",
    layout: "/auth",
    path: "reset-password",
    icon: <MdLock className="h-6 w-6" />,
    component: <ResetPassword />,
    hideInSidebar: true,
  },
];

export default authRoutes;
