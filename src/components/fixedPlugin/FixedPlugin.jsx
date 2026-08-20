import { RiMoonFill, RiSunFill } from "react-icons/ri";
import { useTheme } from "contexts/ThemeContext";

// The floating theme switch on the auth pages. The dashboard navbar has its
// own trigger; both read the same provider, so switching theme on the sign-in
// page and then landing in the dashboard shows the theme you actually chose.
export default function FixedPlugin(props) {
  const { isDark, toggleTheme } = useTheme();
  const { ...rest } = props;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="border-px fixed bottom-[30px] right-[35px] !z-[99] flex h-[60px] w-[60px] cursor-pointer items-center justify-center rounded-full border-[#4F46E5] bg-gradient-to-br from-brandLinear to-blueSecondary p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
      {...rest}
    >
      {isDark ? (
        <RiSunFill className="h-4 w-4 text-white" aria-hidden="true" />
      ) : (
        <RiMoonFill className="h-4 w-4 text-white" aria-hidden="true" />
      )}
    </button>
  );
}
