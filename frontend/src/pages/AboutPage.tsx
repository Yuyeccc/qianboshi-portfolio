import {
  BotMessageSquare,
  Braces,
  CircleDot,
  Database,
  Github,
  GraduationCap,
  MessagesSquare,
  Users,
  Wrench,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const scopeIcons = [Braces, Wrench, Database];
const stackGroupIcons = [CircleDot, BotMessageSquare, Database, MessagesSquare, GraduationCap];

export default function AboutPage() {
  const { t } = useTranslation();

  const scopeGroups = (["ai", "engineering", "data"] as const).map((key, index) => ({
    key,
    Icon: scopeIcons[index],
    title: t(`pages.about.scope.${key}.title`),
    items: t(`pages.about.scope.${key}.items`, { returnObjects: true }) as string[],
  }));

  const stackGroups = (
    ["acquisition", "speechLlm", "storage", "agent", "frontend"] as const
  ).map((key, index) => ({
    key,
    Icon: stackGroupIcons[index],
    label: t(`pages.about.stack.${key}.label`),
    items: t(`pages.about.stack.${key}.items`, { returnObjects: true }) as string[],
  }));

  const tradeoffKeys = ["whisper", "sqlite", "chromadb", "review"] as const;

  const limits = t("pages.about.limits.items", { returnObjects: true }) as string[];
  const roadmap = t("pages.about.limits.roadmap", { returnObjects: true }) as string[];

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <header>
        <p className="font-mono text-sm text-brand">About &amp; Stack</p>
        <h1 className="display-title mt-3 text-4xl text-heading sm:text-5xl">
          {t("pages.about.title")}
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-text">{t("pages.about.subtitle")}</p>
      </header>

      {/* 1. 项目概述 */}
      <section className="mt-10 border border-line bg-surface p-6 shadow-card sm:p-8" aria-labelledby="about-overview-title">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <h2 className="text-xl font-medium text-heading" id="about-overview-title">
            {t("pages.about.overview.title")}
          </h2>
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
            <div className="flex gap-2">
              <dt className="font-medium">{t("pages.about.overview.typeLabel")}</dt>
              <dd>{t("pages.about.overview.type")}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">{t("pages.about.overview.statusLabel")}</dt>
              <dd className="inline-flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-market-positive" aria-hidden="true" />
                {t("pages.about.overview.status")}
              </dd>
            </div>
          </dl>
        </div>
        <blockquote className="mt-5 border-l-2 border-brand pl-4 text-base leading-7 text-text">
          {t("pages.about.overview.problem")}
        </blockquote>
      </section>

      {/* 2. 我的工作范围 */}
      <section className="mt-14" aria-labelledby="about-scope-title">
        <h2 className="text-xl font-medium text-heading" id="about-scope-title">
          {t("pages.about.scope.title")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("pages.about.scope.subtitle")}</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {scopeGroups.map(({ key, Icon, title, items }) => (
            <article className="rounded-lg border border-line bg-surface p-6" key={key}>
              <Icon className="h-5 w-5 text-brand" aria-hidden="true" />
              <h3 className="mt-4 font-medium text-heading">{title}</h3>
              <ul className="mt-3 space-y-1.5 text-sm leading-6 text-muted">
                {items.map((item) => (
                  <li key={item}>· {item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* 3. 技术栈地图 */}
      <section className="mt-14" aria-labelledby="about-stack-title">
        <h2 className="text-xl font-medium text-heading" id="about-stack-title">
          {t("pages.about.stack.title")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("pages.about.stack.subtitle")}</p>
        <div className="mt-6 space-y-3">
          {stackGroups.map(({ key, Icon, label, items }) => (
            <div className="grid gap-3 border-b border-line py-4 sm:grid-cols-[13rem_1fr]" key={key}>
              <div className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                <span className="font-mono text-sm text-heading">{label}</span>
              </div>
              <ul className="flex flex-wrap gap-2">
                {items.map((item) => (
                  <li className="rounded-full border border-line bg-surfaceSubtle px-3 py-1 text-xs text-text" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* 4. 工程取舍 */}
      <section className="mt-14" aria-labelledby="about-tradeoffs-title">
        <h2 className="text-xl font-medium text-heading" id="about-tradeoffs-title">
          {t("pages.about.tradeoffs.title")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("pages.about.tradeoffs.subtitle")}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {tradeoffKeys.map((key) => (
            <article className="rounded-lg border border-line bg-surface p-5 sm:p-6" key={key}>
              <p className="font-mono text-xs text-brand">WHY</p>
              <h3 className="mt-3 font-medium text-heading">{t(`pages.about.tradeoffs.${key}.question`)}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{t(`pages.about.tradeoffs.${key}.answer`)}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 5. 项目边界与后续方向 */}
      <section className="mt-14 grid gap-4 lg:grid-cols-2" aria-labelledby="about-limits-title">
        <article className="border border-line bg-surface p-6" >
          <h2 className="text-xl font-medium text-heading" id="about-limits-title">{t("pages.about.limits.title")}</h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-muted">
            {limits.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        </article>
        <article className="border border-line bg-surface p-6">
          <h2 className="text-xl font-medium text-heading">{t("pages.about.limits.roadmapTitle")}</h2>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-muted">
            {roadmap.map((item) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        </article>
      </section>

      {/* 6. 联系区 */}
      <section className="mt-14 border-t border-line bg-surfaceSubtle px-5 py-10 sm:px-8" aria-labelledby="about-contact-title">
        <h2 className="text-xl font-medium text-heading" id="about-contact-title">
          {t("pages.about.contact.title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("pages.about.contact.subtitle")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="https://github.com/Yuyeccc"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-heading px-4 py-2.5 text-sm font-medium text-surface transition-opacity hover:opacity-90"
          >
            <Github size={16} strokeWidth={1.8} aria-hidden="true" />
            GitHub · Yuyeccc
          </a>
          <a
            href="https://yuyeccc.github.io/qianboshi-portfolio/#/zh/architecture"
            className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-4 py-2.5 text-sm font-medium text-heading transition-colors hover:border-brand hover:text-brand"
          >
            {t("pages.about.contact.architectureLink")}
          </a>
          <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-dashed border-line px-4 py-2.5 text-sm text-muted" title={t("pages.about.contact.groupPending")}>
            <Users size={16} strokeWidth={1.8} aria-hidden="true" />
            {t("pages.about.contact.group")}
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs text-warning">
              {t("pages.about.contact.groupBadge")}
            </span>
          </span>
        </div>
        <p className="mt-4 font-mono text-xs text-muted">{t("pages.about.contact.privacyNote")}</p>
      </section>
    </main>
  );
}
