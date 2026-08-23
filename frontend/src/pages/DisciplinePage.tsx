import {
  AlertCircle,
  BookMarked,
  CheckCircle2,
  ClipboardCheck,
  Timer,
} from "lucide-react";
import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DataContext } from "@/app/providers";
import {
  DisciplineData,
  DisciplineFrameworkRule,
  DisciplineLogItem,
} from "@/types";

const emptyData: DisciplineData = {
  meta: { generatedAt: null, source: null },
  principles: [],
  stats: {
    totalDecisions: null,
    open: null,
    reviewed: null,
    hit: null,
    wrong: null,
    reviewCoveragePct: null,
    generatedAt: null,
  },
  framework: [],
  timeline: [],
  decisionLogs: [],
};

const directionStyles: Record<string, string> = {
  bullish: "bg-market-positive/10 text-market-positive",
  bearish: "bg-market-negative/10 text-market-negative",
  neutral: "bg-surfaceSubtle text-muted",
};

const frameworkIcons = [BookMarked, Timer, ClipboardCheck];

function valueOrDash(value: number | null): number | string {
  return value === null ? "—" : value;
}

function formatReturn(value: number | null): string {
  return value === null || !Number.isFinite(value)
    ? "—"
    : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function DisciplinePage() {
  const { t } = useTranslation();
  const provider = useContext(DataContext);
  const [data, setData] = useState<DisciplineData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const result = await provider?.getDiscipline();
        if (active) setData(result ?? emptyData);
      } catch {
        if (active) {
          setData(emptyData);
          setError(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [provider]);

  const hasData =
    data.principles.length > 0 ||
    data.framework.length > 0 ||
    data.decisionLogs.length > 0 ||
    data.timeline.length > 0;

  const directionLabel = (direction: string) =>
    t(`pages.discipline.direction${titleCase(direction)}`, direction);
  const horizonLabel = (horizon: string) =>
    t(`pages.discipline.horizon${titleCase(horizon)}`, horizon);

  function renderFrameworkRule(rule: DisciplineFrameworkRule) {
    return (
      <article className="rounded-lg border border-line bg-surface p-5" key={rule.ruleId}>
        <div className="flex items-start justify-between gap-4">
          <span className="font-mono text-xs text-brand">{rule.ruleId}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-market-positive/10 px-2.5 py-1 text-xs text-market-positive">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {t("pages.discipline.active")}
          </span>
        </div>
        <h3 className="mt-5 font-medium text-heading">{rule.title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{rule.description}</p>
      </article>
    );
  }

  function renderLog(log: DisciplineLogItem) {
    const conviction = log.conviction === null ? null : Math.round(log.conviction * 100);
    const review = log.review;
    return (
      <article className="rounded-lg border border-line bg-surface p-5 sm:p-6" key={log.decisionId}>
        <div className="flex flex-wrap items-center gap-2">
          <time className="font-mono text-xs text-brand">{log.date ?? "—"}</time>
          <h3 className="mr-auto font-medium text-heading">{log.assetName}</h3>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${directionStyles[log.direction] ?? directionStyles.neutral}`}>
            {directionLabel(log.direction)}
          </span>
          <span className="rounded-full bg-surfaceSubtle px-2.5 py-1 text-xs text-muted">
            {horizonLabel(log.horizon)}
          </span>
          <span className="font-mono text-xs tabular-nums text-muted">
            {t("pages.discipline.conviction")}: {conviction === null ? "—" : `${conviction}%`}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${log.status === "reviewed" ? "bg-info/10 text-info" : "bg-warning/10 text-warning"}`}>
            {t(log.status === "reviewed" ? "pages.discipline.statusReviewed" : "pages.discipline.statusOpen")}
          </span>
        </div>
        <p className="mt-5 text-sm leading-6 text-text">{log.thesis || t("pages.discipline.noThesis")}</p>
        {log.keyReasons.length > 0 ? (
          <ul className="mt-4 space-y-1 text-sm leading-6 text-muted">
            {log.keyReasons.slice(0, 3).map((reason) => <li key={reason}>• {reason}</li>)}
          </ul>
        ) : null}
        {review ? (
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4 text-sm text-muted">
            <span>{t("pages.discipline.review")} {review.reviewDate ?? "—"}</span>
            <span className={review.resultLabel === "hit" ? "text-market-positive" : "text-market-negative"}>
              {t(`pages.discipline.result${titleCase(review.resultLabel)}`)}
            </span>
            <span>{t("pages.discipline.return")} {formatReturn(review.outcomeReturn)}</span>
            <span>{review.horizonDays === null ? "—" : t("pages.discipline.window", { count: review.horizonDays })}</span>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <header>
        <h1 className="display-title text-4xl text-heading sm:text-5xl">{t("pages.discipline.title", "Trading Discipline")}</h1>
        <p className="mt-4 text-lg leading-8 text-text">{t("pages.discipline.subtitle", "记录观点，不追逐结果；到期复盘，不修改历史")}</p>
      </header>
      {loading ? (
        <div className="mt-12 border-y border-line py-16 text-center text-sm text-muted" role="status">{t("pages.discipline.loading")}</div>
      ) : error ? (
        <div className="mt-12 flex items-center gap-3 border-y border-line py-8 text-sm text-muted" role="alert"><AlertCircle className="h-5 w-5 text-warning" />{t("pages.discipline.error")}</div>
      ) : !hasData ? (
        <div className="mt-12 border-y border-line py-16 text-center text-sm text-muted">{t("pages.discipline.empty")}</div>
      ) : (
        <>
          <section className="mt-10 grid gap-4 lg:grid-cols-3" aria-label={t("pages.discipline.principlesLabel")}>
            {data.principles.slice(0, 3).map((principle, index) => {
              const Icon = frameworkIcons[index] ?? ClipboardCheck;
              return <article className="rounded-lg border border-line bg-surface p-6 shadow-card" key={principle.id}><Icon className="h-5 w-5 text-brand" aria-hidden="true" /><h2 className="mt-5 font-medium text-heading">{principle.title}</h2><p className="mt-2 text-sm leading-6 text-muted">{principle.description}</p></article>;
            })}
          </section>
          <section className="mt-10 grid grid-cols-2 border-y border-line sm:grid-cols-5" aria-label={t("pages.discipline.statsLabel")}>
            {[
              ["statTotal", data.stats.totalDecisions, "text-heading"],
              ["statOpen", data.stats.open, "text-heading"],
              ["statReviewed", data.stats.reviewed, "text-heading"],
              ["statHit", data.stats.hit, "text-market-positive"],
              ["statWrong", data.stats.wrong, "text-market-negative"],
            ].map(([label, value, color]) => (
              <div className="border-b border-line px-4 py-5 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0" key={label as string}>
                <p className="text-xs text-muted">{t(`pages.discipline.${label}`)}</p>
                <p className={`mt-2 text-3xl font-medium tabular-nums ${color}`}>{valueOrDash(value as number | null)}</p>
              </div>
            ))}
          </section>
          <p className="mt-4 text-xs text-muted">{t("pages.discipline.coverage", { value: data.stats.reviewCoveragePct ?? "—" })} · {t("pages.discipline.dataSource")}</p>
          <section className="mt-14" aria-labelledby="framework-title"><h2 className="text-xl font-medium text-heading" id="framework-title">{t("pages.discipline.frameworkTitle")}</h2><p className="mt-2 text-sm text-muted">{t("pages.discipline.frameworkSubtitle")}</p><div className="mt-6 grid gap-4 sm:grid-cols-2">{data.framework.map(renderFrameworkRule)}</div></section>
          <section className="mt-14" aria-labelledby="logs-title"><h2 className="text-xl font-medium text-heading" id="logs-title">{t("pages.discipline.logsTitle")}</h2><p className="mt-2 text-sm text-muted">{t("pages.discipline.logsSubtitle")}</p><div className="mt-6 space-y-4">{data.decisionLogs.map(renderLog)}</div></section>
          <section className="mt-14 border-t border-line bg-surfaceSubtle px-5 py-8 sm:px-6" aria-labelledby="timeline-title"><h2 className="text-xl font-medium text-heading" id="timeline-title">{t("pages.discipline.timelineTitle")}</h2><div className="mt-6 space-y-6">{data.timeline.map((item) => <div className="grid gap-3 border-l-2 border-brand pl-5 sm:grid-cols-[9rem_1fr]" key={`${item.date}-${item.actionType}`}><time className="font-mono text-xs text-brand">{item.date ?? "—"}</time><div><p className="text-sm leading-6 text-text">{item.summary}</p><div className="mt-2 flex gap-2">{item.ruleIds.map((id) => <span className="rounded-full bg-surface px-2 py-1 font-mono text-xs text-brand" key={id}>{id}</span>)}</div></div></div>)}</div></section>
        </>
      )}
    </main>
  );
}