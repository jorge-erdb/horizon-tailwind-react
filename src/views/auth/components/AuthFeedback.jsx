import { MdCheckCircle, MdErrorOutline, MdInfoOutline } from "react-icons/md";

const tones = {
  error: {
    icon: MdErrorOutline,
    className:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  },
  success: {
    icon: MdCheckCircle,
    className:
      "border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300",
  },
  info: {
    icon: MdInfoOutline,
    className:
      "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-400/30 dark:bg-brand-400/10 dark:text-brand-200",
  },
};

const AuthFeedback = ({ tone = "error", children }) => {
  if (!children) return null;

  const { icon: Icon, className } = tones[tone] ?? tones.error;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mb-5 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
};

export default AuthFeedback;
