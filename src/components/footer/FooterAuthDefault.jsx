import React from "react";

const links = [
  { label: "Support", href: "mailto:support@novaanalytics.io" },
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Terms of Use", href: "/legal/terms" },
  { label: "Docs", href: "/docs" },
];

export default function Footer() {
  return (
    <div className="z-[5] flex w-full flex-col items-center justify-between gap-3 px-[20px] pb-4 xl:mb-2 xl:pb-6 3xl:flex-row">
      <p className="text-center text-sm text-gray-600">
        © {new Date().getFullYear()} Nova Analytics. All rights reserved.
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="whitespace-nowrap text-sm text-gray-600 transition-colors hover:text-brand-500"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
