import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Flame,
  GitFork,
  Lightbulb,
  ListChecks,
  Scale,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import type { DemoReport } from "@/data/demoReport";

const sideStyles = {
  bull: { dot: "bg-market-positive", text: "text-market-positive", label: "偏多" },
  bear: { dot: "bg-market-negative", text: "text-market-negative", label: "偏空" },
  neutral: { dot: "bg-muted", text: "text-muted", label: "中性" },
} as const;

function SectionTitle({
  index,
  icon,
  title,
  tone,
}: {
  index: string;
  icon: React.ReactNode;
  title: string;
  tone?: string;
}) {
  return (
    <h3 className={`flex items-center gap-2 text-sm font-semibold ${tone ?? ""}`}>
      <span className="font-mono text-[10px] opacity-50">{index}</span>
      <span className={`${tone ? "" : "text-primary"}`}>{icon}</span>
      {title}
    </h3>
  );
}

interface Props {
  report: Omit<DemoReport, "matchKeywords">;
  /** live=true 为后端实时研究报告（badge 文案区分演示/实时） */
  live?: boolean;
}

export default function ReportView({ report, live = false }: Props) {
  const { t } = useTranslation();
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  return (
    <article className="border border-line bg-surface shadow-card">
      {/* 头部 */}
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          <FileText size={11} />
          {live ? t("agent.liveBadge") : t("agent.demoReport.badge")}
        </span>
        <span className="text-xs text-muted">
          {t("agent.demoReport.goal")}：{report.goal}
        </span>
        <span className="ml-auto text-[11px] text-muted">
          {t("agent.demoReport.generatedAt")}：{report.generatedAt}
        </span>
      </header>

      <div className="space-y-6 px-5 py-5">
        {/* 01 核心矛盾 */}
        <section aria-labelledby="report-issue" className="rounded-md border border-line bg-surfaceSubtle px-4 py-3">
          <h3 id="report-issue" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="font-mono text-[10px] opacity-50">01</span>
            <Target size={14} className="text-primary" />
            {t("agent.demoReport.coreIssueTitle")}
          </h3>
          <p className="mt-2 text-sm font-medium leading-relaxed">{report.coreIssue}</p>
        </section>

        {/* 02 结论摘要 */}
        <section aria-labelledby="report-summary">
          <SectionTitle index="02" icon={<Scale size={14} />} title={t("agent.demoReport.summaryTitle")} />
          <p className="mt-2 rounded-md bg-surfaceSubtle px-3 py-2.5 text-sm leading-relaxed">
            {report.summary}
          </p>
        </section>

        {/* 03 事实基础 */}
        <section aria-labelledby="report-facts">
          <SectionTitle
            index="03"
            icon={<span className="h-3 w-1 rounded-full bg-market-positive" />}
            title={t("agent.demoReport.factsTitle")}
            tone="text-market-positive"
          />
          <ul className="mt-2.5 space-y-2">
            {report.facts.map((f, i) => (
              <li
                key={i}
                className="border-l-2 border-l-market-positive pl-3 text-sm leading-relaxed"
              >
                {f.text}
                <span className="mt-0.5 block text-[11px] text-muted">
                  {t("agent.demoReport.source")}：{f.source} · {f.date}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 04 观点光谱 + 交叉验证 */}
        <section aria-labelledby="report-opinions">
          <SectionTitle
            index="04"
            icon={<span className="h-3 w-1 rounded-full bg-primary" />}
            title={t("agent.demoReport.opinionsTitle")}
            tone="text-primary"
          />
          <ul className="mt-2.5 space-y-2">
            {report.opinions.map((o, i) => {
              const s = sideStyles[o.side ?? "neutral"];
              return (
                <li key={i} className="border-l-2 border-l-primary pl-3 text-sm leading-relaxed">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${s.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                    {o.analyst}
                    <span className="text-[11px] text-muted">· {o.date}</span>
                  </span>
                  <p className="mt-1">{o.text}</p>
                </li>
              );
            })}
          </ul>
          {/* 交叉验证 */}
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-market-positive/25 bg-market-positive/5 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-market-positive">
                <GitFork size={12} />
                {t("agent.demoReport.consensusTitle")}
              </p>
              <ul className="mt-1.5 space-y-1">
                {report.crossCheck.consensus.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-market-positive" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-market-negative/25 bg-market-negative/5 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-market-negative">
                <X size={12} />
                {t("agent.demoReport.disagreementTitle")}
              </p>
              <ul className="mt-1.5 space-y-1">
                {report.crossCheck.disagreements.map((d, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-market-negative" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 05 预期差 */}
        <section aria-labelledby="report-expectations">
          <SectionTitle
            index="05"
            icon={<Lightbulb size={14} />}
            title={t("agent.demoReport.expectationsTitle")}
          />
          <div className="mt-2.5 grid gap-3 lg:grid-cols-3">
            <div className="rounded-md border border-line bg-surfaceSubtle px-3 py-2.5">
              <p className="text-xs font-semibold">{t("agent.demoReport.pricedInTitle")}</p>
              <ul className="mt-1.5 space-y-1">
                {report.expectations.pricedIn.map((p, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-market-positive/25 bg-market-positive/5 px-3 py-2.5">
              <p className="flex items-center gap-1 text-xs font-semibold text-market-positive">
                <TrendingUp size={11} />
                {t("agent.demoReport.upsideTitle")}
              </p>
              <ul className="mt-1.5 space-y-1">
                {report.expectations.upsideVars.map((p, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-market-positive" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-market-negative/25 bg-market-negative/5 px-3 py-2.5">
              <p className="flex items-center gap-1 text-xs font-semibold text-market-negative">
                <TrendingDown size={11} />
                {t("agent.demoReport.downsideTitle")}
              </p>
              <ul className="mt-1.5 space-y-1">
                {report.expectations.downsideVars.map((p, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-market-negative" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 06 情景推演 */}
        <section aria-labelledby="report-scenarios">
          <SectionTitle
            index="06"
            icon={<Flame size={14} />}
            title={t("agent.demoReport.scenariosTitle")}
            tone="text-market-negative"
          />
          <p className="mt-1 text-[11px] text-muted">{t("agent.demoReport.scenarioPrefix")}</p>
          <ul className="mt-2.5 space-y-3">
            {report.scenarios.map((s, i) => (
              <li key={i} className="rounded-md border border-line bg-surfaceSubtle p-3.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{s.name}</p>
                  <span className="rounded-full border border-market-negative/30 bg-market-negative/10 px-2 py-0.5 text-xs font-semibold text-market-negative tabular-nums">
                    P={Math.round(s.probability * 100)}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">{s.condition}</p>
                <p className="mt-1.5 leading-relaxed">{s.outcome}</p>
                <p className="mt-2 flex items-start gap-1.5 rounded bg-surface px-2.5 py-1.5 text-xs leading-relaxed text-muted">
                  <Sparkles size={12} className="mt-0.5 shrink-0 text-primary" />
                  <span>
                    <span className="font-medium text-foreground">{t("agent.demoReport.rationaleTitle")}：</span>
                    {s.rationale}
                  </span>
                </p>
                <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0 text-market-negative" />
                  失效条件：{s.invalidation}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* 07 观察清单 */}
        <section aria-labelledby="report-watchlist">
          <SectionTitle
            index="07"
            icon={<ListChecks size={14} />}
            title={t("agent.demoReport.watchlistTitle")}
          />
          <ul className="mt-2.5 space-y-1.5">
            {report.watchlist.map((w, i) => (
              <li key={i} className="flex items-start justify-between gap-3 text-sm leading-relaxed">
                <span className="flex items-start gap-1.5">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  {w.text}
                </span>
                <span className="shrink-0 text-[11px] text-muted">
                  {t("agent.demoReport.triggerTitle")}：{w.trigger}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 08 证据链 */}
        <section aria-labelledby="report-evidence">
          <button
            type="button"
            onClick={() => setEvidenceOpen((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-foreground"
            aria-expanded={evidenceOpen}
          >
            <span className="font-mono text-[10px] opacity-50">08</span>
            <Eye size={14} />
            {t("agent.demoReport.evidenceTitle")}
            {evidenceOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          {evidenceOpen && (
            <ul className="mt-2 space-y-1.5">
              {report.evidence.map((e) => (
                <li
                  key={e.id}
                  className="rounded border border-line bg-surfaceSubtle px-3 py-2 text-xs leading-relaxed"
                >
                  <span className="font-mono text-[10px] text-muted">{e.id}</span>
                  <p className="mt-0.5">{e.claim}</p>
                  <p className="mt-0.5 text-[10px] text-muted">
                    {e.source} · {e.date}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 合规 */}
        <footer className="flex items-start gap-2 rounded-md border border-line bg-surfaceSubtle px-3 py-2.5 text-xs leading-relaxed text-muted">
          <ShieldAlert size={14} className="mt-0.5 shrink-0 text-market-negative" />
          {t("agent.demoReport.complianceNote")}
        </footer>
      </div>
    </article>
  );
}
