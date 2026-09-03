import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  FileText,
  Layers,
  ListChecks,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Target,
} from "lucide-react";
import type { RiskReport } from "@/data/research-client";

const SEVERITY_STYLES: Record<string, { badge: string; dot: string; labelKey: string }> = {
  high: {
    badge: "border-market-negative/30 bg-market-negative/10 text-market-negative",
    dot: "bg-market-negative",
    labelKey: "agent.riskReport.severityHigh",
  },
  medium: {
    badge: "border-warning/30 bg-warning/10 text-warning",
    dot: "bg-warning",
    labelKey: "agent.riskReport.severityMedium",
  },
  low: {
    badge: "border-line bg-surfaceSubtle text-muted",
    dot: "bg-muted",
    labelKey: "agent.riskReport.severityLow",
  },
};

const fallbackSeverity = {
  badge: "border-line bg-surfaceSubtle text-muted",
  dot: "bg-muted",
  labelKey: "agent.riskReport.severityLow",
};

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

/** 千分位 + 单位显示（金额类字段，缺省显示 —） */
function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

/**
 * 百分比字段（31_risk 协议实测口径：weightPct/positionPct 为百分点数值，
 * 如 9.53 表示 9.53%——勿再乘 100）
 */
function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}%`;
}

interface Props {
  report: RiskReport;
  /** live=true 为后端实时产物（badge 文案区分演示/实时） */
  live?: boolean;
}

export default function RiskReportView({ report, live = false }: Props) {
  const { t } = useTranslation();
  const exposure = report.holdingsExposure;
  const exposed = exposure?.exposed ?? [];
  const portfolio = exposure?.portfolio ?? null;
  const riskPoints = report.riskPoints ?? [];
  const watchlist = report.watchlist ?? [];
  const compliance = report.compliance;

  return (
    <article className="border border-line bg-surface shadow-card">
      {/* 头部 */}
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          <FileText size={11} />
          {live ? t("agent.liveBadge") : t("agent.demoReport.badge")}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surfaceSubtle px-2 py-0.5 text-[11px] font-medium text-foreground">
          <Layers size={11} />
          {t("agent.riskReport.agentName")}
        </span>
        {report.entity && (
          <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
            <Target size={11} />
            {report.entity}
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted">
          {t("agent.demoReport.generatedAt")}：{report.generatedAt}
        </span>
      </header>

      <div className="space-y-6 px-5 py-5">
        {/* 01 结论摘要 */}
        <section aria-labelledby="risk-summary">
          <SectionTitle
            index="01"
            icon={<Scale size={14} />}
            title={t("agent.riskReport.summaryTitle")}
          />
          <p className="mt-2 rounded-md bg-surfaceSubtle px-3 py-2.5 text-sm leading-relaxed">
            {report.summary || t("agent.riskReport.noSummary")}
          </p>
        </section>

        {/* 02 持仓暴露 */}
        <section aria-labelledby="risk-exposure">
          <SectionTitle
            index="02"
            icon={<span className="h-3 w-1 rounded-full bg-primary" />}
            title={t("agent.riskReport.exposureTitle")}
            tone="text-primary"
          />
          {exposed.length > 0 ? (
            <div className="mt-2.5 overflow-x-auto rounded-md border border-line">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-surfaceSubtle text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-medium">{t("agent.riskReport.colCode")}</th>
                    <th className="px-3 py-2 font-medium">{t("agent.riskReport.colName")}</th>
                    <th className="px-3 py-2 font-medium">{t("agent.riskReport.colRelation")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("agent.riskReport.colValue")}</th>
                    <th className="px-3 py-2 text-right font-medium">{t("agent.riskReport.colWeight")}</th>
                  </tr>
                </thead>
                <tbody>
                  {exposed.map((h, i) => (
                    <tr key={i} className="border-b border-line/60 last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{h.marketCode ?? h.code ?? "—"}</td>
                      <td className="px-3 py-2 font-medium">{h.name ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted">{h.relation ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtNum(h.value)}
                        {h.valueNote && (
                          <span className="block text-[10px] text-muted">{h.valueNote}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtPct(h.weightPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-2 rounded-md border border-dashed border-line bg-surfaceSubtle px-3 py-2.5 text-sm text-muted">
              {t("agent.riskReport.noExposure")}
            </p>
          )}
          {portfolio && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-md bg-surfaceSubtle px-3 py-2 text-xs text-muted">
              <span>
                {t("agent.riskReport.totalAssets")}：
                <b className="tabular-nums text-foreground">{fmtNum(portfolio.totalAssets)}</b>
              </span>
              <span>
                {t("agent.riskReport.onMarketValue")}：
                <b className="tabular-nums text-foreground">{fmtNum(portfolio.onMarketValue)}</b>
              </span>
              <span>
                {t("agent.riskReport.cashAvailable")}：
                <b className="tabular-nums text-foreground">{fmtNum(portfolio.cashAvailable)}</b>
              </span>
              <span>
                {t("agent.riskReport.positionPct")}：
                <b className="tabular-nums text-foreground">{fmtPct(portfolio.positionPct)}</b>
              </span>
              {portfolio.asOf && (
                <span className="ml-auto text-[10px] opacity-70">
                  {t("agent.riskReport.asOf")}：{portfolio.asOf}
                </span>
              )}
            </div>
          )}
        </section>

        {/* 03 风险点 */}
        <section aria-labelledby="risk-points">
          <SectionTitle
            index="03"
            icon={<ShieldAlert size={14} />}
            title={t("agent.riskReport.riskPointsTitle")}
            tone="text-market-negative"
          />
          {riskPoints.length > 0 ? (
            <ul className="mt-2.5 space-y-2.5">
              {riskPoints.map((rp, i) => {
                const sev =
                  SEVERITY_STYLES[String(rp.severity ?? "").toLowerCase()] ?? fallbackSeverity;
                return (
                  <li key={i} className="rounded-md border border-line bg-surfaceSubtle px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${sev.badge}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                        {t(sev.labelKey)}
                      </span>
                      <p className="text-sm font-semibold">{rp.risk}</p>
                    </div>
                    {rp.rationale && (
                      <p className="mt-1.5 text-xs leading-relaxed text-muted">{rp.rationale}</p>
                    )}
                    {rp.watch && (
                      <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
                        <AlertTriangle size={11} className="mt-0.5 shrink-0 text-warning" />
                        <span>
                          <span className="font-medium text-foreground">
                            {t("agent.riskReport.watchLabel")}：
                          </span>
                          {rp.watch}
                        </span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 rounded-md border border-dashed border-line bg-surfaceSubtle px-3 py-2.5 text-sm text-muted">
              {t("agent.riskReport.noRiskPoints")}
            </p>
          )}
        </section>

        {/* 04 观察清单 */}
        {watchlist.length > 0 && (
          <section aria-labelledby="risk-watchlist">
            <SectionTitle
              index="04"
              icon={<ListChecks size={14} />}
              title={t("agent.riskReport.watchlistTitle")}
            />
            <ul className="mt-2.5 space-y-1.5">
              {watchlist.map((w, i) => (
                <li key={i} className="border-l-2 border-l-warning pl-3 text-sm leading-relaxed">
                  {w.text}
                  {w.trigger && (
                    <span className="mt-0.5 block text-[11px] text-muted">
                      {t("agent.riskReport.watchTrigger")}：{w.trigger}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 05 合规断言 + 降级说明 */}
        <section aria-labelledby="risk-compliance" className="space-y-2">
          {compliance && (
            <div
              className={`flex items-start gap-2 rounded-md border px-3 py-2.5 ${
                compliance.passed
                  ? "border-market-positive/25 bg-market-positive/5"
                  : "border-market-negative/30 bg-market-negative/5"
              }`}
            >
              {compliance.passed ? (
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-market-positive" />
              ) : (
                <ShieldAlert size={15} className="mt-0.5 shrink-0 text-market-negative" />
              )}
              <p className="text-xs leading-relaxed text-muted">
                <span
                  className={`font-semibold ${
                    compliance.passed ? "text-market-positive" : "text-market-negative"
                  }`}
                >
                  {compliance.passed
                    ? t("agent.riskReport.compliancePassed")
                    : t("agent.riskReport.complianceFailed")}
                </span>
                {compliance.note ? `：${compliance.note}` : ""}
              </p>
            </div>
          )}
          {report.analysisNote && (
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-warning" />
              {report.analysisNote}
            </p>
          )}
        </section>
      </div>
    </article>
  );
}
