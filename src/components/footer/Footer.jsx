const Footer = () => {
  return (
    <div className="flex w-full flex-col items-center justify-between px-1 pb-8 pt-3 lg:px-8 xl:flex-row">
      <p className="mb-4 text-center text-sm text-gray-600 sm:!mb-0 md:text-base">
        © {new Date().getFullYear()} Nova Analytics. All rights reserved.
      </p>
      <div>
        <ul className="flex flex-wrap items-center gap-3 sm:flex-nowrap md:gap-10">
          <li>
            <a
              href="mailto:support@novaanalytics.io"
              className="text-base font-medium text-gray-600 transition-colors hover:text-brand-500"
            >
              Support
            </a>
          </li>
          <li>
            <a
              href="/legal/privacy"
              className="text-base font-medium text-gray-600 transition-colors hover:text-brand-500"
            >
              Privacy
            </a>
          </li>
          <li>
            <a
              href="/legal/terms"
              className="text-base font-medium text-gray-600 transition-colors hover:text-brand-500"
            >
              Terms of Use
            </a>
          </li>
          <li>
            <a
              href="/docs"
              className="text-base font-medium text-gray-600 transition-colors hover:text-brand-500"
            >
              Docs
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Footer;
