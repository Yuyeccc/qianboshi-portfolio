import { useEffect } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "./Header";
import Footer from "./Footer";

export default function SiteShell() {
  const { locale } = useParams();
  const { i18n } = useTranslation();

  useEffect(() => {
    const nextLocale = locale === "en" ? "en" : "zh";
    if (i18n.language !== nextLocale) {
      void i18n.changeLanguage(nextLocale);
    }
  }, [i18n, locale]);

  return (
    <div className="min-h-screen bg-page text-text">
      <Header />
      <main className="mx-auto min-h-[calc(100vh-9rem)] w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
