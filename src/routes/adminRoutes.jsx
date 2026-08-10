import { MdHome, MdBarChart, MdPerson } from "react-icons/md";

import MainDashboard from "views/admin/default";
import Profile from "views/admin/profile";
import DataTables from "views/admin/tables";

/**
 * Dashboard routes. This is also the sidebar's nav source — order here is the
 * order in the sidebar. See authRoutes.jsx for the unauthenticated screens;
 * they are deliberately a separate module so the auth bundle stays small.
 */
const adminRoutes = [
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
];

export default adminRoutes;
