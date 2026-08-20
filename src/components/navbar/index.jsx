import React from "react";
import Dropdown from "components/dropdown";
import { FiAlignJustify } from "react-icons/fi";
import { Link } from "react-router-dom";
import { FiSearch } from "react-icons/fi";
import { RiMoonFill, RiSunFill } from "react-icons/ri";
import { IoMdInformationCircleOutline } from "react-icons/io";
import { useNavigate } from "react-router-dom";
import NovaLogo from "components/brand/NovaLogo";
import NotificationsMenu from "components/navbar/NotificationsMenu";
import { useAuth } from "contexts/AuthContext";
import { useTheme } from "contexts/ThemeContext";
import avatar from "assets/img/avatars/avatar4.png";

const Navbar = (props) => {
  const { onOpenSidenav, brandText } = props;
  const { isDark, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Supabase email/password sign-up collects no display name, so greet with
  // the local part of the address until a profile record exists.
  const displayName = user?.email ? user.email.split("@")[0] : "there";

  const handleSignOut = async (event) => {
    event.preventDefault();
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <nav className="sticky top-4 z-40 flex flex-row flex-wrap items-center justify-between rounded-xl bg-white/10 p-2 backdrop-blur-xl dark:bg-[#0F172A4d]">
      <div className="ml-[6px]">
        <div className="h-6 w-[224px] pt-1">
          <a
            className="text-sm font-normal text-navy-700 hover:underline dark:text-white dark:hover:text-white"
            href=" "
          >
            Pages
            <span className="mx-1 text-sm text-navy-700 hover:text-navy-700 dark:text-white">
              {" "}
              /{" "}
            </span>
          </a>
          <Link
            className="text-sm font-normal capitalize text-navy-700 hover:underline dark:text-white dark:hover:text-white"
            to="#"
          >
            {brandText}
          </Link>
        </div>
        <p className="shrink text-[33px] capitalize text-navy-700 dark:text-white">
          <Link
            to="#"
            className="font-bold capitalize hover:text-navy-700 dark:hover:text-white"
          >
            {brandText}
          </Link>
        </p>
      </div>

      <div className="relative mt-[3px] flex h-[61px] w-[355px] flex-grow items-center justify-around gap-2 rounded-full bg-white px-2 py-2 shadow-xl shadow-shadow-500 dark:!bg-navy-800 dark:shadow-none md:w-[365px] md:flex-grow-0 md:gap-1 xl:w-[365px] xl:gap-2">
        <div className="flex h-full items-center rounded-full bg-lightPrimary text-navy-700 dark:bg-navy-900 dark:text-white xl:w-[225px]">
          <p className="pl-3 pr-2 text-xl">
            <FiSearch className="h-4 w-4 text-gray-400 dark:text-white" />
          </p>
          <input
            type="text"
            placeholder="Search..."
            class="block h-full w-full rounded-full bg-lightPrimary text-sm font-medium text-navy-700 outline-none placeholder:!text-gray-400 dark:bg-navy-900 dark:text-white dark:placeholder:!text-white sm:w-fit"
          />
        </div>
        <span
          className="flex cursor-pointer text-xl text-gray-600 dark:text-white xl:hidden"
          onClick={onOpenSidenav}
        >
          <FiAlignJustify className="h-5 w-5" />
        </span>
        {/* start Notification */}
        <NotificationsMenu />
        {/* start Help & resources */}
        <Dropdown
          button={
            <p className="cursor-pointer">
              <IoMdInformationCircleOutline className="h-4 w-4 text-gray-600 dark:text-white" />
            </p>
          }
          children={
            <div className="flex w-[320px] flex-col gap-2 rounded-[20px] bg-white p-4 shadow-xl shadow-shadow-500 dark:!bg-navy-700 dark:text-white dark:shadow-none">
              <div className="mb-2 flex flex-col justify-center rounded-lg bg-nova-gradient p-5">
                <NovaLogo
                  variant="mark"
                  className="h-9 w-9"
                  markColor="#FFFFFF"
                  sparkColor="#67E8F9"
                />
                <p className="mt-3 font-display text-base font-bold text-white">
                  Need a hand?
                </p>
                <p className="mt-1 text-xs text-white/80">
                  Guides, API reference and support for your Nova workspace.
                </p>
              </div>
              <a
                href="/docs"
                className="px-full linear flex cursor-pointer items-center justify-center rounded-xl bg-brand-500 py-[11px] font-bold text-white transition duration-200 hover:bg-brand-600 active:bg-brand-700 dark:bg-brand-400 dark:hover:bg-brand-300 dark:active:bg-brand-200"
              >
                Documentation
              </a>
              <a
                href="/docs/api"
                className="px-full linear flex cursor-pointer items-center justify-center rounded-xl border py-[11px] font-bold text-navy-700 transition duration-200 hover:bg-gray-200 dark:!border-white/10 dark:text-white dark:hover:bg-white/20 dark:active:bg-white/10"
              >
                API reference
              </a>
              <a
                href="mailto:support@novaanalytics.io"
                className="px-full linear flex cursor-pointer items-center justify-center rounded-xl py-[11px] font-bold text-navy-700 transition duration-200 hover:bg-gray-100 dark:text-white dark:hover:bg-white/10"
              >
                Contact support
              </a>
            </div>
          }
          classNames={"py-2 top-6 -left-[250px] md:-left-[330px] w-max"}
          animation="origin-[75%_0%] md:origin-top-right transition-all duration-300 ease-in-out"
        />
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          aria-pressed={isDark}
          title={isDark ? "Switch to light theme" : "Switch to dark theme"}
          className="cursor-pointer rounded text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {isDark ? (
            <RiSunFill
              className="h-4 w-4 text-gray-600 dark:text-white"
              aria-hidden="true"
            />
          ) : (
            <RiMoonFill
              className="h-4 w-4 text-gray-600 dark:text-white"
              aria-hidden="true"
            />
          )}
        </button>
        {/* Profile & Dropdown */}
        <Dropdown
          button={
            <img
              className="h-10 w-10 rounded-full"
              src={avatar}
              alt={user?.email ?? "Account"}
            />
          }
          children={
            <div className="flex w-56 flex-col justify-start rounded-[20px] bg-white bg-cover bg-no-repeat shadow-xl shadow-shadow-500 dark:!bg-navy-700 dark:text-white dark:shadow-none">
              <div className="p-4">
                <p className="text-sm font-bold text-navy-700 dark:text-white">
                  👋 Hey, {displayName}
                </p>
                {user?.email && (
                  <p className="mt-1 truncate text-xs text-gray-600 dark:text-white/60">
                    {user.email}
                  </p>
                )}
              </div>
              <div className="h-px w-full bg-gray-200 dark:bg-white/20 " />

              <div className="flex flex-col p-4">
                <Link
                  to="/admin/profile"
                  className="text-sm text-gray-800 dark:text-white hover:dark:text-white"
                >
                  Profile Settings
                </Link>
                <Link
                  to="/admin/profile"
                  className="mt-3 text-sm text-gray-800 dark:text-white hover:dark:text-white"
                >
                  Workspace Settings
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="mt-3 text-left text-sm font-medium text-red-500 transition duration-150 ease-out hover:ease-in"
                >
                  Sign out
                </button>
              </div>
            </div>
          }
          classNames={"py-2 top-8 -left-[180px] w-max"}
        />
      </div>
    </nav>
  );
};

export default Navbar;
