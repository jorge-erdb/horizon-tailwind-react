import React from "react";

const links = [
  { label: "Support", href: "mailto:support@novaanalytics.io" },
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms of Use", href: "/legal/terms" },
  { label: "Docs", href: "/docs" },
];

export default function Footer() {
  return (
    <div className="z-[5] mx-auto flex w-full max-w-screen-sm flex-col items-center justify-between px-[20px] pb-4 lg:mb-6 lg:max-w-[100%] lg:flex-row xl:mb-2 xl:w-[1310px] xl:pb-6">
      <p className="mb-6 text-center text-sm text-gray-600 md:text-base lg:mb-0">
        © {new Date().getFullYear()} Nova Analytics. All rights reserved.
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-2 sm:flex-nowrap">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="text-sm text-gray-600 transition-colors hover:text-brand-500 md:text-base"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
