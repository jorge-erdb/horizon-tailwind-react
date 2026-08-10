import React from "react";

// Admin Imports
import MainDashboard from "views/admin/default";
import Profile from "views/admin/profile";
import DataTables from "views/admin/tables";

// Auth Imports
import SignIn from "views/auth/SignIn";
import SignUp from "views/auth/SignUp";
import AuthCallback from "views/auth/AuthCallback";
import ResetPassword from "views/auth/ResetPassword";

// Icon Imports
import {
  MdHome,
  MdBarChart,
  MdPerson,
  MdLock,
  MdPersonAdd,
} from "react-icons/md";

const routes = [
  {
    name: "Main Dashboard",
    layout: "/admin",
    path: "default",
    icon: <MdHome className="h-6 w-6" />,
    component: <MainDashboard />,
  },
  {
    name: "Data Tables",
    layout: "/admin",
    icon: <MdBarChart className="h-6 w-6" />,
    path: "data-tables",
    component: <DataTables />,
  },
  {
    name: "Profile",
    layout: "/admin",
    path: "profile",
    icon: <MdPerson className="h-6 w-6" />,
    component: <Profile />,
  },
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
export default routes;
