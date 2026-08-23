import { useContext, useEffect, useState } from "react";
import { Activity, ArrowDown, ArrowRight, Box, Circle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { DataContext } from "@/app/providers";

type ArchitectureNode = {
  name: string;
  role: string;
  tech: string;
};

type ArchitectureLayer = {
  layerId: string;
  layerName: string;
  layerNameEn: string;
  description: string;
  nodes: ArchitectureNode[];
};

type PipelineStatus = {
  scheduler: string;
  lastChecked: string | null;
  detectedToday: number | null;
  processedTotal: number | null;
  queuePending: number | null;
  channels: {
    name: string;
    uid: string;
    lastCheck: string | null;
    totalVideos: number | null;
  }[];
};

type LifecycleStep = {
  step: string;
  detail: string;
};

type McpToolItem = {
  name: string;
  input: string;
  output: string;
  purpose: string;
};

type ArchitectureData = {
  meta?: {
    generatedAt: string | null;
    source: string | null;
  };
  summaryTags: string[];
  pipelineStatus: PipelineStatus;
  layers: ArchitectureLayer[];
  viewLifecycle: LifecycleStep[];
  mcpTools: McpToolItem[];
};

type OverviewMetrics = {
  structuredViews: number | null;
  predictionEvents: number | null;
  notes: number | null;
  ragChunks: number | null;
  analysts?: number | null;
  assetCards?: number | null;
};

const emptyPipelineStatus: PipelineStatus = {
  scheduler: "",
  lastChecked: null,
  detectedToday: null,
  processedTotal: null,
  queuePending: null,
  channels: [],
};

const emptyArchitecture: ArchitectureData = {
  meta: {
    generatedAt: null,
    source: null,
  },
  summaryTags: [],
  pipelineStatus: emptyPipelineStatus,
  layers: [],
  viewLifecycle: [],
  mcpTools: [],
};

const emptyMetrics: OverviewMetrics = {
  structuredViews: null,
  predictionEvents: null,
  notes: null,
  ragChunks: null,
  analysts: null,
  assetCards: null,
};

function displayValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "—" : value;
}

function formatCheckedAt(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="border border-line bg-surfaceSubtle px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-2 font-mono text-lg text-heading">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
    </div>
  );
}

export default function ArchitecturePage() {
  const { t } = useTranslation();
  const provider = useContext(DataContext);
  const [architecture, setArchitecture] =
    useState<ArchitectureData>(emptyArchitecture);
  const [metrics, setMetrics] = useState<OverviewMetrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(false);

    Promise.all([provider.getArchitecture(), provider.getOverview()])
      .then(([architectureData, overviewData]) => {
        if (!active) {
          return;
        }

        setArchitecture(architectureData);
        setMetrics({
          ...emptyMetrics,
          ...(overviewData.metrics as OverviewMetrics),
        });
      })
      .catch(() => {
        if (active) {
          setArchitecture(emptyArchitecture);
          setMetrics(emptyMetrics);
          setError(true);
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
  }, [provider]);

  const { pipelineStatus, layers, viewLifecycle, mcpTools } = architecture;
  const hasData = layers.length > 0 || mcpTools.length > 0;

  return (
    <main className="min-h-screen bg-surfaceSubtle text-text">
      <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <section className="border-b border-line pb-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-3 text-brand">
                <Activity size={18} aria-hidden="true" />
                <span className="font-mono text-xs uppercase tracking-[0.18em]">
                  System / Architecture
                </span>
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-heading sm:text-5xl">
                {t("pages.architecture.title", "System Architecture")}
              </h1>
              <p className="mt-3 max-w-2xl text-base text-muted sm:text-lg">
                {t(
                  "pages.architecture.subtitle",
                  "从内容采集到决策复盘的自动化投研流水线",
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted">
              <Circle
                size={8}
                fill="currentColor"
                className="text-market-negative"
                aria-hidden="true"
              />
              {loading
                ? t("pages.architecture.loading", "Loading...")
                : error
                  ? t(
                      "pages.architecture.unavailable",
                      "Live data unavailable",
                    )
                  : t("pages.architecture.live", "Live pipeline")}
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            {architecture.summaryTags.map((tag) => (
              <span
                key={tag}
                className="border border-line bg-surface px-3 py-1.5 font-mono text-xs text-brand"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-7 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label={t("pages.architecture.scheduler", "Scheduler")}
              value={
                pipelineStatus.scheduler
                  ? pipelineStatus.scheduler[0].toUpperCase() +
                    pipelineStatus.scheduler.slice(1)
                  : "—"
              }
              detail={t("pages.architecture.schedulerDetail", "Pipeline state")}
            />
            <Metric
              label={t("pages.architecture.lastChecked", "Last Checked")}
              value={formatCheckedAt(pipelineStatus.lastChecked)}
            />
            <Metric
              label={t("pages.architecture.queue", "Queue")}
              value={`${displayValue(pipelineStatus.queuePending)} pending`}
            />
            <Metric
              label={t("pages.architecture.activity", "Activity")}
              value={`${displayValue(pipelineStatus.detectedToday)} / ${displayValue(
                pipelineStatus.processedTotal,
              )}`}
              detail={t(
                "pages.architecture.activityDetail",
                "Detected today / processed total",
              )}
            />
          </div>
        </section>

        <section className="pt-10">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand">
                01 — Pipeline
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-heading">
                {t("pages.architecture.pipelineTitle", "七层流水线")}
              </h2>
            </div>
            <span className="font-mono text-xs text-muted">
              {layers.length ? `${layers.length} layers` : "—"}
            </span>
          </div>

          {layers.length ? (
            <div className="space-y-3">
              {layers.map((layer, layerIndex) => (
                <div key={layer.layerId} className="relative">
                  <article className="border border-line bg-surface p-4 transition-colors duration-200 hover:border-brand sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                      <div className="flex shrink-0 gap-4 lg:w-64">
                        <span className="font-mono text-sm text-brand">
                          {String(layerIndex + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <h3 className="font-semibold text-heading">
                            {layer.layerName}
                          </h3>
                          <p className="mt-1 font-mono text-[11px] text-brand">
                            {layer.layerNameEn}
                          </p>
                          <p className="mt-3 text-xs leading-5 text-muted">
                            {layer.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                        {layer.nodes.map((node, nodeIndex) => (
                          <div
                            key={`${layer.layerId}-${node.name}`}
                            className="flex min-w-[190px] flex-1 items-stretch gap-2"
                          >
                            <div className="min-w-0 flex-1 rounded-md border border-line bg-surfaceSubtle p-4 transition-colors duration-200 hover:border-brand">
                              <div className="flex items-start gap-2">
                                <Box
                                  size={14}
                                  className="mt-0.5 shrink-0 text-brand"
                                  aria-hidden="true"
                                />
                                <p className="font-medium text-heading">
                                  {node.name}
                                </p>
                              </div>
                              <p className="mt-3 font-mono text-[11px] text-brand">
                                {node.tech}
                              </p>
                              <p className="mt-2 text-xs leading-5 text-muted">
                                {node.role}
                              </p>
                            </div>
                            {nodeIndex < layer.nodes.length - 1 ? (
                              <ArrowRight
                                size={15}
                                className="mt-8 hidden shrink-0 text-muted xl:block"
                                aria-hidden="true"
                              />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                  {layerIndex < layers.length - 1 ? (
                    <div className="flex h-3 justify-center">
                      <ArrowDown
                        size={14}
                        className="text-brand"
                        aria-hidden="true"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="border border-line bg-surface p-8 text-sm text-muted">
              {loading
                ? t("pages.architecture.loading", "Loading...")
                : t("pages.architecture.empty", "暂无架构数据")}
            </p>
          )}
        </section>

        <section className="border-t border-line pt-10">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand">
            02 — Traceability
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-heading">
            {t("pages.architecture.lifecycleTitle", "单条观点的生命周期")}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {t(
              "pages.architecture.lifecycleSubtitle",
              "一条观点如何从视频变成可复盘的决策证据",
            )}
          </p>

          <div className="mt-6 flex flex-wrap items-stretch gap-2">
            {viewLifecycle.map((item, index) => (
              <div key={`${item.step}-${index}`} className="flex items-center gap-2">
                <div
                  className={`min-w-[150px] flex-1 rounded-md border bg-surface p-4 ${
                    index === 0
                      ? "border-brand"
                      : index === viewLifecycle.length - 1
                        ? "border-market-negative"
                        : "border-line"
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${
                      index === 0
                        ? "text-brand"
                        : index === viewLifecycle.length - 1
                          ? "text-market-negative"
                          : "text-heading"
                    }`}
                  >
                    {item.step}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-muted">
                    {item.detail}
                  </p>
                </div>
                {index < viewLifecycle.length - 1 ? (
                  <ArrowRight
                    size={15}
                    className="shrink-0 text-muted"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-6 border border-line bg-surface p-5 font-mono text-xs leading-7 text-muted sm:p-6">
            <p>
              <span className="text-brand">Asset</span>: Gold
            </p>
            <p>
              <span className="text-brand">Direction</span>: Bullish
            </p>
            <p>
              <span className="text-brand">Horizon</span>: 1-3 months
            </p>
            <p>
              <span className="text-brand">Source</span>: 钱博士直播
            </p>
            <p>
              <span className="text-brand">Published</span>: 2026-08-22
            </p>
            <p>
              <span className="text-brand">Outcome</span>: Pending
            </p>
          </div>
        </section>

        <section className="border-t border-line pt-10">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-brand">
            03 — Agent Interface
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-heading">
            {t("pages.architecture.mcpTitle", "MCP 工具")}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {t(
              "pages.architecture.mcpSubtitle",
              "把投研资产暴露给 Agent，9 个工具实时查询",
            )}
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {mcpTools.map((tool) => (
              <article
                key={tool.name}
                className="border border-line bg-surface p-5 transition-colors duration-200 hover:border-brand"
              >
                <h3 className="font-mono text-sm text-brand">{tool.name}</h3>
                <p className="mt-3 text-sm text-heading">{tool.purpose}</p>
                <div className="mt-4 grid gap-2 border-t border-line pt-3 text-xs text-muted sm:grid-cols-2">
                  <p>
                    <span className="text-heading">in</span> {tool.input}
                  </p>
                  <p>
                    <span className="text-heading">out</span> {tool.output}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 border-t border-line bg-surface px-5 py-8 sm:px-7">
          <div className="grid gap-px border border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Raw videos"
              value={`${displayValue(metrics.structuredViews ? pipelineStatus.processedTotal : null)} processed`}
            />
            <Metric
              label="Structured opinions"
              value={displayValue(metrics.structuredViews)}
            />
            <Metric
              label="Research assets"
              value={`${displayValue(metrics.analysts)} analysts / ${displayValue(
                metrics.assetCards,
              )} asset cards`}
            />
            <Metric
              label="Decision evidence"
              value={displayValue(metrics.predictionEvents)}
            />
          </div>
          <p className="mt-7 font-mono text-xs italic text-muted">
            Architecture is useful only when every layer produces an inspectable
            artifact.
          </p>
        </section>
      </div>
    </main>
  );
}