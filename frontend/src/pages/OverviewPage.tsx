import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { MetricCard } from "@/components/data/MetricCard";
import { LatestBriefCard } from "@/components/brief/LatestBriefCard";
import { DataContext } from "@/app/providers";
import { CognitiveData, OverviewData } from "@/types";

const emptyOverview: OverviewData = {
  metrics: {
    structuredViews: null,
    predictionEvents: null,
    notes: null,
    ragChunks: null,
    sourceCount: null,
    generatedAt: null,
  },
  status: {
    lastChecked: null,
    detectedToday: null,
    sourceCount: null,
    pipelineRunning: null,
  },
  latestBrief: {
    filename: null,
    generatedAt: null,
    summary: null,
    sectionCount: null,
  },
};

function formatLocalTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function getBriefDate(filename: string | null, generatedAt: string | null) {
  const match = filename?.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? generatedAt?.slice(0, 10) ?? null;
}

export default function OverviewPage() {
  const { t } = useTranslation();
  const { locale = "zh" } = useParams();
  const provider = useContext(DataContext);
  const [overview, setOverview] = useState<OverviewData>(emptyOverview);
  const [cognitive, setCognitive] = useState<CognitiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(false);

    provider
      .getOverview()
      .then((data) => {
        if (active) {
          setOverview(data);
        }
      })
      .catch(() => {
        if (active) {
          setOverview(emptyOverview);
          setError(true);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    // P1-A：认知内核入口卡数据（失败不阻塞主流程）
    provider
      ?.getCognitive?.()
      .then((data) => {
        if (active) {
          setCognitive(data ?? null);
        }
      })
      .catch(() => {
        if (active) {
          setCognitive(null);
        }
      });

    return () => {
      active = false;
    };
  }, [provider]);

  const { metrics, status, latestBrief } = overview;

  return (
    <div className="space-y-10">
      <section className="border-b border-line pb-8">
        <p className="text-sm text-muted">{t("overview.heroStatus")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-heading">
          {t("overview.title")}
        </h1>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          <span>
            {status.pipelineRunning === null
              ? "—"
              : status.pipelineRunning
                ? t("overview.pipelineRunning")
                : t("overview.pipelineStopped")}
          </span>
          <span>
            {t("overview.lastChecked")}: {formatLocalTime(status.lastChecked)}
          </span>
          <span>
            {t("overview.detectedToday", {
              count: status.detectedToday ?? "—",
            })}
          </span>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-heading">
            {t("overview.trustData")}
          </h2>
          {loading ? (
            <span className="text-sm text-muted">{t("overview.loading")}</span>
          ) : error ? (
            <span className="text-sm text-muted">—</span>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label={t("metrics.structuredViews.label")}
            value={metrics.structuredViews}
            hint={t("metrics.structuredViews.hint")}
          />
          <MetricCard
            label={t("metrics.predictionEvents.label")}
            value={metrics.predictionEvents}
            hint={t("metrics.predictionEvents.hint")}
          />
          <MetricCard
            label={t("metrics.notes.label")}
            value={metrics.notes}
            hint={t("metrics.notes.hint")}
          />
          <MetricCard
            label={t("metrics.ragChunks.label")}
            value={metrics.ragChunks}
            hint={t("metrics.ragChunks.hint")}
          />
        </div>
      </section>

      {/* P1-A：认知内核入口卡 */}
      <section className="rounded-lg border border-line bg-surface shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand">
              {t("overview.cognitiveEntry")}
            </p>
            <h2 className="mt-2 text-xl font-medium text-heading">
              {t("overview.cognitiveEntrySub")}
            </h2>
          </div>
          <Link
            to={`/${locale}/cognitive`}
            className="inline-flex items-center gap-1 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brandStrong"
          >
            {t("overview.cognitiveEnter")}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>

        {cognitive ? (
          <div className="grid gap-px overflow-hidden bg-line sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: t("overview.cognitiveAnchored"),
                value: cognitive.facts.anchored?.value,
              },
              {
                label: t("overview.cognitiveClaims"),
                value: cognitive.facts.annotations?.value,
              },
              {
                label: t("overview.cognitiveConflicts"),
                value: cognitive.conflicts.exact,
              },
              {
                label: t("overview.cognitiveBacktest"),
                value: (() => {
                  // 与 CognitiveCorePage 同口径：test 集 × view 层 × w3 窗口
                  const rows = cognitive.backtest?.rows ?? {};
                  const row = Object.values(rows).find(
                    (r) =>
                      r?.segment === "test" &&
                      r?.sample_type === "view" &&
                      r?.layer === "ok" &&
                      r?.window_days === 3,
                  );
                  return typeof row?.hit_rate === "number"
                    ? `${(row.hit_rate * 100).toFixed(1)}%`
                    : null;
                })(),
              },
            ].map((item) => (
              <div className="bg-surface px-5 py-4" key={item.label}>
                <p className="text-xs text-muted">{item.label}</p>
                <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-heading">
                  {typeof item.value === "number"
                    ? item.value.toLocaleString()
                    : item.value ?? "—"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-5 py-4 text-sm text-muted">{t("overview.cognitiveLoading")}</p>
        )}

        {cognitive ? (
          <p className="border-t border-line px-5 py-2.5 text-[11px] leading-4 text-muted">
            {t("overview.cognitiveEnterHint")} · {cognitive.meta.source}
          </p>
        ) : null}
      </section>

      <section className="border-t border-line pt-6">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand">
              {t("briefs.preview")}
            </p>
            <h2 className="mt-2 text-2xl font-medium text-heading">
              {t("overview.latestBrief")}
            </h2>
          </div>
          <Link
            to={`/${locale}/briefs`}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brandStrong"
          >
            {t("briefs.all")}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>

        {latestBrief.filename ? (
          <LatestBriefCard
            locale={locale}
            brief={{
              filename: latestBrief.filename,
              date: getBriefDate(
                latestBrief.filename,
                latestBrief.generatedAt,
              ),
              generatedAt: latestBrief.generatedAt,
              summary: latestBrief.summary,
              sectionCount: latestBrief.sectionCount,
            }}
          />
        ) : (
          <p className="text-sm text-muted">—</p>
        )}
      </section>
    </div>
  );
}