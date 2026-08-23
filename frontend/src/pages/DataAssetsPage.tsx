import ChartFrame from "@/components/charts/ChartFrame";
import { ApiClient, emptyAssets } from "@/data/api-client";
import { SnapshotClient } from "@/data/snapshot-client";
import { AssetsData } from "@/types";
import * as echarts from "echarts";
import { Database } from "lucide-react";
import { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const provider =
  import.meta.env.VITE_DATA_MODE === "snapshot"
    ? new SnapshotClient()
    : new ApiClient();

const STANCE_COLORS: Record<string, string> = {
  bullish: "#E05252",
  bearish: "#26A269",
  neutral: "#8793A0",
  watch: "#D99A2B",
  risk: "#4D91E8",
};

interface ChartPalette {
  heading: string;
  muted: string;
  line: string;
  surface: string;
  brand: string;
}

interface AssetChartProps {
  option: (palette: ChartPalette) => echarts.EChartsOption;
  label: string;
}

function readChartPalette(): ChartPalette {
  const styles = getComputedStyle(document.documentElement);
  const read = (primary: string, secondary: string, fallback: string) =>
    styles.getPropertyValue(primary).trim() ||
    styles.getPropertyValue(secondary).trim() ||
    fallback;

  return {
    heading: read("--color-heading", "--color-text-heading", "#E6EDF3"),
    muted: read("--color-muted", "--color-text-muted", "#8793A0"),
    line: read("--color-line", "--color-border", "#2A3540"),
    surface: read("--color-surface-raised", "--color-surface", "#111820"),
    brand: read("--color-brand", "--color-brand-strong", "#0B7A75"),
  };
}

function AssetChart({ option, label }: AssetChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const chart = echarts.init(containerRef.current);

    const render = () => {
      chart.setOption(option(readChartPalette()), true);
      chart.resize();
    };

    const handleResize = () => chart.resize();
    const observer = new MutationObserver(render);

    render();
    window.addEventListener("resize", handleResize);
    // 只监听 documentElement 自身的 data-theme/class 变化（主题切换），
    // 禁止 subtree:true —— ECharts 渲染自身会改 DOM，subtree 监听会无限循环
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [option]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      role="img"
      aria-label={label}
    />
  );
}

function formatNumber(value: number | null, locale: string): string {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat(locale).format(value);
}

function formatDate(value: string | null, locale: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function truncateClaim(claim: string): string {
  const normalized = claim.trim();

  if (normalized.length <= 80) {
    return normalized;
  }

  return `${normalized.slice(0, 80)}…`;
}

function stanceStyle(stance: string): CSSProperties {
  const color = STANCE_COLORS[stance] ?? STANCE_COLORS.neutral;

  return {
    color,
    borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
    backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
  };
}

export default function DataAssetsPage() {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<AssetsData>(emptyAssets);
  const [loading, setLoading] = useState(true);

  const isZh = (i18n.resolvedLanguage ?? i18n.language).startsWith("zh");
  const locale = isZh ? "zh-CN" : "en-US";

  useEffect(() => {
    let active = true;

    setLoading(true);
    provider
      .getAssets()
      .then((assets) => {
        if (active) {
          setData(assets);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const metrics = [
    {
      key: "structured",
      label: t("dataAssets.metricsStructured"),
      hint: t("dataAssets.metricsStructuredHint"),
      value: data.metrics.structuredViews,
    },
    {
      key: "events",
      label: t("dataAssets.metricsEvents"),
      hint: t("dataAssets.metricsEventsHint"),
      value: data.metrics.predictionEvents,
    },
    {
      key: "notes",
      label: t("dataAssets.metricsNotes"),
      hint: t("dataAssets.metricsNotesHint"),
      value: data.metrics.notes,
    },
    {
      key: "chunks",
      label: t("dataAssets.metricsChunks"),
      hint: t("dataAssets.metricsChunksHint"),
      value: data.metrics.ragChunks,
    },
    {
      key: "analysts",
      label: t("dataAssets.metricsAnalysts"),
      hint: t("dataAssets.metricsAnalystsHint"),
      value: data.metrics.analysts,
    },
    {
      key: "cards",
      label: t("dataAssets.metricsCards"),
      hint: t("dataAssets.metricsCardsHint"),
      value: data.metrics.assetCards,
    },
  ];

  const stanceOption = useMemo(
    () =>
      (palette: ChartPalette): echarts.EChartsOption => {
        const chartData = data.stanceDist.map((item) => ({
          name: isZh ? item.labelZh || item.name : item.name,
          value: item.value,
          itemStyle: {
            color: STANCE_COLORS[item.name] ?? palette.muted,
          },
        }));

        return {
          animationDuration: 350,
          textStyle: {
            color: palette.heading,
            fontFamily: "inherit",
          },
          tooltip: {
            trigger: "item",
            formatter: "{b}<br/>{c} ({d}%)",
            backgroundColor: palette.surface,
            borderColor: palette.line,
            textStyle: { color: palette.heading },
          },
          legend: {
            bottom: 0,
            left: "center",
            textStyle: { color: palette.muted },
            itemWidth: 10,
            itemHeight: 10,
          },
          series: [
            {
              type: "pie",
              radius: ["48%", "72%"],
              center: ["50%", "43%"],
              avoidLabelOverlap: true,
              label: { show: false },
              emphasis: {
                scaleSize: 4,
                label: {
                  show: true,
                  color: palette.heading,
                  formatter: "{b}\n{d}%",
                },
              },
              data: chartData,
            },
          ],
        };
      },
    [data.stanceDist, isZh],
  );

  const horizonOption = useMemo(
    () =>
      (palette: ChartPalette): echarts.EChartsOption => ({
        animationDuration: 350,
        textStyle: {
          color: palette.heading,
          fontFamily: "inherit",
        },
        grid: {
          top: 8,
          right: 30,
          bottom: 12,
          left: 76,
        },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          backgroundColor: palette.surface,
          borderColor: palette.line,
          textStyle: { color: palette.heading },
        },
        xAxis: {
          type: "value",
          axisLabel: { color: palette.muted },
          splitLine: { lineStyle: { color: palette.line } },
        },
        yAxis: {
          type: "category",
          inverse: true,
          data: data.horizonDist.map((item) =>
            isZh ? item.labelZh || item.name : item.name,
          ),
          axisLabel: { color: palette.muted },
          axisTick: { show: false },
          axisLine: { show: false },
        },
        series: [
          {
            type: "bar",
            barMaxWidth: 18,
            data: data.horizonDist.map((item) => item.value),
            itemStyle: {
              color: palette.brand,
              borderRadius: [0, 2, 2, 0],
            },
          },
        ],
      }),
    [data.horizonDist, isZh],
  );

  const sourceOption = useMemo(
    () =>
      (palette: ChartPalette): echarts.EChartsOption => ({
        animationDuration: 350,
        textStyle: {
          color: palette.heading,
          fontFamily: "inherit",
        },
        grid: {
          top: 6,
          right: 40,
          bottom: 12,
          left: 118,
        },
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          backgroundColor: palette.surface,
          borderColor: palette.line,
          textStyle: { color: palette.heading },
        },
        xAxis: {
          type: "value",
          axisLabel: { color: palette.muted },
          splitLine: { lineStyle: { color: palette.line } },
        },
        yAxis: {
          type: "category",
          inverse: true,
          data: data.sourceContrib.map((item) => item.name),
          axisLabel: {
            color: palette.muted,
            width: 105,
            overflow: "truncate",
          },
          axisTick: { show: false },
          axisLine: { show: false },
        },
        series: [
          {
            type: "bar",
            barMaxWidth: 14,
            data: data.sourceContrib.map((item) => item.views),
            itemStyle: {
              color: palette.brand,
              borderRadius: [0, 2, 2, 0],
            },
          },
        ],
      }),
    [data.sourceContrib],
  );

  const rankOption = useMemo(
    () =>
      (palette: ChartPalette): echarts.EChartsOption => ({
        animationDuration: 350,
        textStyle: {
          color: palette.heading,
          fontFamily: "inherit",
        },
        grid: {
          top: 6,
          right: 52,
          bottom: 12,
          left: 118,
        },
        tooltip: {
          trigger: "item",
          backgroundColor: palette.surface,
          borderColor: palette.line,
          textStyle: { color: palette.heading },
        },
        xAxis: {
          type: "value",
          min: 0,
          max: 100,
          axisLabel: {
            color: palette.muted,
            formatter: "{value}%",
          },
          splitLine: { lineStyle: { color: palette.line } },
        },
        yAxis: {
          type: "category",
          inverse: true,
          data: data.analystRank.map((item) => item.name),
          axisLabel: {
            color: palette.muted,
            width: 105,
            overflow: "truncate",
          },
          axisTick: { show: false },
          axisLine: { show: false },
        },
        series: [
          {
            type: "bar",
            barMaxWidth: 14,
            label: {
              show: true,
              position: "right",
              color: palette.heading,
            },
            data: data.analystRank.map((item) => {
              const percentage =
                item.hitRate === null
                  ? 0
                  : Number((item.hitRate * 100).toFixed(2));
              const name = echarts.format.encodeHTML(item.name);
              const rateLabel = item.hitRate === null ? "—" : `${percentage}%`;
              const samples =
                item.samples === null
                  ? "—"
                  : new Intl.NumberFormat(locale).format(item.samples);

              return {
                value: percentage,
                label: { formatter: rateLabel },
                tooltip: {
                  formatter:
                    `${name}<br/>${t("dataAssets.hitRate")}: ${rateLabel}` +
                    `<br/>${t("dataAssets.samples")}: ${samples}`,
                },
              };
            }),
            itemStyle: {
              color: palette.brand,
              borderRadius: [0, 2, 2, 0],
            },
          },
        ],
      }),
    [data.analystRank, locale, t],
  );

  const emptyLabel = t("dataAssets.noData");

  const consensusLabel = (value: string) =>
    t(`dataAssets.directions.${value}`, {
      defaultValue: value || "—",
    });

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <header className="max-w-3xl">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-brand" aria-hidden="true" />
          <p className="font-mono text-xs font-medium uppercase text-brand">
            DATA ASSETS
          </p>
        </div>
        <h1 className="display-title mt-5 text-4xl text-heading sm:text-5xl">
          {t("dataAssets.title")}
        </h1>
        <p className="mt-4 text-base leading-7 text-text sm:text-lg">
          {t("dataAssets.description")}
        </p>
      </header>

      {loading ? (
        <div className="mt-10 border-y border-line py-10 text-sm text-muted">
          {t("overview.loading")}
        </div>
      ) : (
        <>
          <section
            className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
            aria-label={t("dataAssets.metricsLabel")}
          >
            {metrics.map((metric) => (
              <article
                key={metric.key}
                className="min-w-0 rounded-lg border border-line bg-surface p-4 shadow-card"
              >
                <p className="truncate text-xs text-muted">{metric.label}</p>
                <p className="mt-3 font-mono text-2xl font-semibold tabular-nums text-heading">
                  {formatNumber(metric.value, locale)}
                </p>
                <p className="mt-2 min-h-8 text-xs leading-4 text-muted">
                  {metric.hint}
                </p>
              </article>
            ))}
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <ChartFrame title={t("dataAssets.stanceTitle")}>
              {data.stanceDist.length > 0 ? (
                <AssetChart
                  option={stanceOption}
                  label={t("dataAssets.stanceTitle")}
                />
              ) : (
                <EmptyState label={emptyLabel} />
              )}
            </ChartFrame>

            <ChartFrame title={t("dataAssets.horizonTitle")}>
              {data.horizonDist.length > 0 ? (
                <AssetChart
                  option={horizonOption}
                  label={t("dataAssets.horizonTitle")}
                />
              ) : (
                <EmptyState label={emptyLabel} />
              )}
            </ChartFrame>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <ChartFrame title={t("dataAssets.sourceTitle")}>
              {data.sourceContrib.length > 0 ? (
                <AssetChart
                  option={sourceOption}
                  label={t("dataAssets.sourceTitle")}
                />
              ) : (
                <EmptyState label={emptyLabel} />
              )}
            </ChartFrame>

            <ChartFrame title={t("dataAssets.rankTitle")}>
              {data.analystRank.length > 0 ? (
                <AssetChart
                  option={rankOption}
                  label={t("dataAssets.rankTitle")}
                />
              ) : (
                <EmptyState label={emptyLabel} />
              )}
            </ChartFrame>
          </section>

          <section className="mt-6 rounded-lg border border-line bg-surface shadow-card">
            <header className="border-b border-line px-5 py-4">
              <h2 className="text-sm font-medium text-heading">
                {t("dataAssets.debateTitle")}
              </h2>
            </header>

            {data.debateCards.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs text-muted">
                      <th className="px-5 py-3 font-medium">
                        {t("dataAssets.debateCols.entity")}
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        {t("dataAssets.debateCols.bullish")}
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        {t("dataAssets.debateCols.bearish")}
                      </th>
                      <th className="px-4 py-3 text-right font-medium">
                        {t("dataAssets.debateCols.neutral")}
                      </th>
                      <th className="px-4 py-3 font-medium">
                        {t("dataAssets.debateCols.consensus")}
                      </th>
                      <th className="px-5 py-3 text-right font-medium">
                        {t("dataAssets.debateCols.disagreement")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.debateCards.map((card, index) => (
                      <tr
                        key={`${card.entity}-${card.updated ?? index}`}
                        className="border-b border-line last:border-b-0"
                      >
                        <td className="px-5 py-3 font-medium text-heading">
                          {card.entity || "—"}
                        </td>
                        <td
                          className="px-4 py-3 text-right font-mono tabular-nums"
                          style={{ color: STANCE_COLORS.bullish }}
                        >
                          {formatNumber(card.bullish, locale)}
                        </td>
                        <td
                          className="px-4 py-3 text-right font-mono tabular-nums"
                          style={{ color: STANCE_COLORS.bearish }}
                        >
                          {formatNumber(card.bearish, locale)}
                        </td>
                        <td
                          className="px-4 py-3 text-right font-mono tabular-nums"
                          style={{ color: STANCE_COLORS.neutral }}
                        >
                          {formatNumber(card.neutral, locale)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="inline-flex rounded border px-2 py-1 text-xs"
                            style={stanceStyle(card.consensus)}
                          >
                            {consensusLabel(card.consensus)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-mono tabular-nums text-text">
                          {card.disagreement === null
                            ? "—"
                            : `${(card.disagreement * 100).toFixed(1)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="h-32">
                <EmptyState label={emptyLabel} />
              </div>
            )}
          </section>

          <section className="mt-6 rounded-lg border border-line bg-surface shadow-card">
            <header className="border-b border-line px-5 py-4">
              <h2 className="text-sm font-medium text-heading">
                {t("dataAssets.samplesTitle")}
              </h2>
            </header>

            {data.sampleViews.length > 0 ? (
              <ol className="divide-y divide-line">
                {data.sampleViews.map((view, index) => (
                  <li
                    key={`${view.analyst}-${view.date ?? index}`}
                    className="px-5 py-4"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span className="text-sm font-medium text-heading">
                        {view.analyst || "—"}
                      </span>
                      <time className="font-mono text-xs tabular-nums text-muted">
                        {formatDate(view.date, locale)}
                      </time>
                      <span
                        className="inline-flex rounded border px-2 py-0.5 text-xs"
                        style={stanceStyle(view.stance)}
                      >
                        {t(`dataAssets.directions.${view.stance}`, {
                          defaultValue: view.stance || "—",
                        })}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-text">
                      {truncateClaim(view.claim) || "—"}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="h-32">
                <EmptyState label={emptyLabel} />
              </div>
            )}
          </section>

          <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-xs text-muted">
            <p>
              {t("dataAssets.updatedAt")}{" "}
              <span className="font-mono tabular-nums">
                {formatDate(data.metrics.generatedAt, locale)}
              </span>
            </p>
            <p>{t("dataAssets.methodologyNote")}</p>
          </footer>
        </>
      )}
    </main>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted">
      {label}
    </div>
  );
}
