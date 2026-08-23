import { UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function AboutPage() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto max-w-7xl px-6 py-16 lg:px-8 lg:py-24">
      <div className="max-w-3xl">
        <UserRound className="h-7 w-7 text-brand" aria-hidden="true" />
        <h1 className="display-title mt-6 text-4xl text-heading sm:text-5xl">
          {t("pages.about.title", "关于项目")}
        </h1>
        <p className="mt-5 text-lg leading-8 text-text">
          {t(
            "pages.about.description",
            "钱博士Agent 的项目背景、技术取舍与持续演进记录。",
          )}
        </p>
      </div>
      <div className="mt-12 border border-line bg-surface p-8">
        <p className="font-mono text-sm text-brand">PHASE 1</p>
        <p className="mt-4 text-heading">
          {t("pages.phaseOne", "Phase 1 实现")}
        </p>
        <p className="mt-2 text-sm text-muted">
          {t("pages.about.placeholder", "项目说明将在下一阶段补充。")}
        </p>
      </div>
    </main>
  );
}
