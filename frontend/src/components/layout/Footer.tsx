import { Github, Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-6 py-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-heading">钱博士Agent</span>
          <span aria-hidden="true">·</span>
          <span>{t("footer.copyright", "AI 金融投研系统作品集")}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="inline-flex items-center gap-2">
            <Clock3 size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>{t("footer.dataFreshness", "数据时效：待接入")}</span>
          </span>

          <a
            href="#"
            aria-label={t("footer.github", "GitHub 项目地址")}
            className="inline-flex items-center gap-2 text-text transition-colors hover:text-brand"
            onClick={(event) => event.preventDefault()}
          >
            <Github size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>{t("footer.github", "GitHub")}</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
