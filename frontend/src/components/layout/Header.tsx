import { useEffect, useState } from "react";
import { Languages, Menu, Moon, Sun, X } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

const navigation = [
  { key: "overview", path: "" },
  { key: "architecture", path: "architecture" },
  { key: "cognitive", path: "cognitive" },
  { key: "assets", path: "assets" },
  { key: "decisions", path: "decisions" },
  { key: "discipline", path: "discipline" },
  { key: "vault", path: "vault" },
  { key: "about", path: "about" },
] as const;

const themes = ["product", "architecture", "terminal"] as const;

export default function Header() {
  const { locale = "zh" } = useParams();
  const location = useLocation();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeIndex, setThemeIndex] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = themes[themeIndex];
  }, [themeIndex]);

  const alternateLocale = locale === "en" ? "zh" : "en";

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <Link
          to={`/${locale}`}
          className="shrink-0 text-sm font-semibold tracking-wide text-heading"
        >
          钱博士<span className="text-brand">Agent</span>
        </Link>

        <nav
          className="hidden items-center gap-1 lg:flex"
          aria-label="Primary navigation"
        >
          {navigation.map((item) => {
            const href = `/${locale}${item.path ? `/${item.path}` : ""}`;
            const active = location.pathname === href;

            return (
              <Link
                key={item.key}
                to={href}
                className={`px-3 py-2 text-sm transition-colors ${
                  active ? "text-brand" : "text-muted hover:text-heading"
                }`}
              >
                {t(`nav.${item.key}`)}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-1 sm:flex">
          <Link
            to={`/${alternateLocale}${location.pathname.replace(/^\/(zh|en)/, "")}`}
            className="inline-flex h-9 items-center gap-2 border border-line px-3 text-sm text-muted transition-colors hover:border-brand hover:text-brand"
            title={t("common.language")}
          >
            <Languages size={16} aria-hidden="true" />
            {alternateLocale === "en" ? "EN" : "中"}
          </Link>
          <button
            type="button"
            onClick={() =>
              setThemeIndex((index) => (index + 1) % themes.length)
            }
            className="inline-flex h-9 w-9 items-center justify-center border border-line text-muted transition-colors hover:border-brand hover:text-brand"
            title={`${t("common.theme")}: ${themes[themeIndex]}`}
            aria-label={`${t("common.theme")}: ${themes[themeIndex]}`}
          >
            {themeIndex === 0 ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center border border-line text-muted lg:hidden"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {menuOpen && (
        <nav
          className="border-t border-line px-5 py-3 lg:hidden"
          aria-label="Mobile navigation"
        >
          {navigation.map((item) => {
            const href = `/${locale}${item.path ? `/${item.path}` : ""}`;
            return (
              <Link
                key={item.key}
                to={href}
                onClick={() => setMenuOpen(false)}
                className="block border-b border-line py-3 text-sm text-text last:border-b-0"
              >
                {t(`nav.${item.key}`)}
              </Link>
            );
          })}
          <Link
            to={`/${alternateLocale}${location.pathname.replace(/^\/(zh|en)/, "")}`}
            onClick={() => setMenuOpen(false)}
            className="mt-2 inline-flex items-center gap-2 py-2 text-sm text-brand"
          >
            <Languages size={16} aria-hidden="true" />
            {alternateLocale === "en" ? "EN" : "中"}
          </Link>
        </nav>
      )}
    </header>
  );
}
