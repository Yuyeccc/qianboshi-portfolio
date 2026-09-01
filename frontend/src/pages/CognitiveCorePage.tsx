import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DataContext } from "@/app/providers";
import ChartFrame from "@/components/charts/ChartFrame";
import { MetricCard } from "@/components/data/MetricCard";
import type { CognitiveData } from "@/types";

/** 数字格式化：null/undefined → "—" */
function nf(value: unknown): string {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

/** 百分比 */
function pct(value: unknown, total: number): string {
  if (typeof value !== "number" || !total) return "—";
  return `${((value / total) * 100).toFixed(1)}%`;
}

/** 事实卡（带口径来源小字） */
function FactCard({ label, value, source }: { label: string; value: string; source?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="font-mono text-[11px] uppercase tracking-wider text-brand">{label}</p>
      <p className="mt-2 text-xl font-semibold text-heading">{value}</p>
      {source ? <p className="mt-1 text-[11px] leading-4 text-muted">{source}</p> : null}
    </div>
  );
}

/** 横向占比条 */
function RatioBar({ label, value, total, colorClass = "bg-brand" }: { label: string; value: number; total: number; colorClass?: string }) {
  const width = total ? Math.max(2, Math.min(100, (value / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-xs text-muted">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surfaceSubtle">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${width}%` }} />
      </div>
      <span className="w-20 shrink-0 text-right text-xs text-heading">{nf(value)}</span>
      <span className="w-14 shrink-0 text-right font-mono text-[11px] text-muted">{pct(value, total)}</span>
    </div>
  );
}

const CLAIM_LEVEL_META: Record<string, { icon: string; colorClass: string }> = {
  fact: { icon: "📖", colorClass: "bg-emerald-500" },
  interpretation: { icon: "🧩", colorClass: "bg-sky-500" },
  causal_claim: { icon: "🔗", colorClass: "bg-violet-500" },
  correlation: { icon: "〰️", colorClass: "bg-amber-500" },
  hypothesis: { icon: "❓", colorClass: "bg-orange-500" },
  forecast: { icon: "🔮", colorClass: "bg-rose-500" },
};

const LAYER_META: Record<string, { label: string; colorClass: string }> = {
  primary: { label: "🅰 一手", colorClass: "bg-emerald-500" },
  secondary: { label: "🅱 二手", colorClass: "bg-amber-500" },
  inferred: { label: "🅳 推断", colorClass: "bg-rose-500" },
  unknown: { label: "🅽 待分层", colorClass: "bg-muted" },
};

/** B7：EN 模式下的 source 小字翻译映射（数据层 source 为中文透传） */
const SOURCE_EN: Record<string, string> = {
  "claim 确定性回填，73 号校验（7484+252）": "claim certainty backfill, verified per doc #73 (7,484+252)",
  "evidence 库 transcript_segment（33 蓝图，2026-08-29）": "evidence DB transcript_segment (blueprint #33, 2026-08-29)",
  "export_dimensions 实测 463 topic 零打满（36 蓝图附录D）": "export_dimensions: 463 topics, zero over-crowded (blueprint #36 App. D)",
  "output_gate 红队全过（63 号）": "output_gate red-team all passed (doc #63)",
  "permutation_test.py 置换检验 OOS 显著（9-01）": "permutation_test.py: OOS significance (09-01)",
  "position_ledger.py realized 对账（git 9e24412）": "position_ledger.py realized reconciliation (git 9e24412)",
  "prediction_confidence.py authority×tuple_status（67 号）": "prediction_confidence.py authority × tuple_status (doc #67)",
  "quality 库 view_raw（immutable，md5 留底）": "quality DB view_raw (immutable, md5 kept)",
  "reasoning_unit 五元组全量覆盖 7476/7484（43 号执行记录）": "reasoning_unit 5-tuple full coverage 7,476/7,484 (doc #43)",
  "view_evidence_annotation 全量标注，73 号校验（7484+252）": "view_evidence_annotation fully annotated, verified per doc #73 (7,484+252)",
  "view_evidence_link 观点↔segment 下钻关联（33 蓝图）": "view_evidence_link view↔segment drill-down (blueprint #33)",
  "view_provenance anchored，73 号校验 2026-09-01": "view_provenance anchored, verified per doc #73 2026-09-01",
  "主题仓位/单标的上限/回撤开关（#17v2，51 号）": "position caps / per-asset limits / drawdown switch (#17v2, doc #51)",
  "占位锚点修复：假锚定→真实锚定+诚实降级（72 号）": "placeholder anchor fix: fake→real anchors + honest downgrade (doc #72)",
  "存量错配批量修复三轮（49 号）": "legacy mismatch batch fix, 3 rounds (doc #49)",
  "行情补拉复跑 resolved（69 号）": "market data backfill re-run resolved (doc #69)",
  "dimensions_export.json 8-31 + conflicts_export.json 8-31 + qianboshi_decision.db + 73 号校验口径": "dimensions_export.json 8-31 + conflicts_export.json 8-31 + qianboshi_decision.db + doc #73 verified scope",
};

function translateSource(source: string | undefined, locale: string): string | undefined {
  if (!source) return undefined;
  if (locale.startsWith("en")) {
    return SOURCE_EN[source] ?? source;
  }
  return source;
}

export default function CognitiveCorePage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "zh";
  const provider = useContext(DataContext);
  const [data, setData] = useState<CognitiveData | null>(null);
  // P1-C：冲突中心 topic 筛选器 + 成员下钻（展开原文证据卡 → 跳 B 站）
  const [conflictTopic, setConflictTopic] = useState<string>("all");
  const [expandedView, setExpandedView] = useState<string | null>(null);

  useEffect(() => {
    provider?.getCognitive().then((d) => setData(d ?? null));
  }, [provider]);

  if (!data) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-16 text-muted">
        {t("cognitive.loading")}
      </main>
    );
  }

  const fact = (key: string) => data.facts[key] as { value?: unknown; unit?: string; source?: string } | undefined;

  const dims = data.dimensions as {
    total?: number;
    topics?: number;
    crowded_topics?: number;
    exported_at?: string;
    source_layers?: Record<string, number>;
    verification?: Record<string, number>;
    supported?: Record<string, number>;
    claim_levels?: Record<string, number>;
    confidence_bands?: Record<string, number>;
    min_dimensions?: Record<string, number>;
    uncertainty_tags?: Record<string, number>;
    tuple_status?: Record<string, number>;
    reasoning_filled?: Record<string, number>;
    pointers?: { ok?: number; missing?: number; mismatch?: number };
    match_quality_avg?: number | null;
  };
  const total = dims.total ?? 0;
  const reasoningFields: Array<[string, string]> = [
    ["conclusion", t("cognitive.ruConclusion")],
    ["premise", t("cognitive.ruPremise")],
    ["mechanism", t("cognitive.ruMechanism")],
    ["trigger_condition", t("cognitive.ruTrigger")],
    ["invalid_condition", t("cognitive.ruInvalid")],
  ];

  const bt = data.backtest;
  const btRows = (bt.rows ?? {}) as Record<
    string,
    { segment?: string; layer?: string; sample_type?: string; window_days?: number; total?: number; hits?: number; hit_rate?: number }
  >;
  // test 段 view 级，取 w3/w5 为主对照（后端字段为 snake_case，原样透传未映射）
  const backtestRows = Object.values(btRows)
    .filter((r) => r.segment === "test" && r.sample_type === "view")
    .sort((a, b) => (a.window_days ?? 0) - (b.window_days ?? 0));
  const layerLabel: Record<string, string> = {
    ok: t("cognitive.layerOk"),
    partial_anchor: t("cognitive.layerPartial"),
    template_only: t("cognitive.layerTemplate"),
    no_ru: t("cognitive.layerNoRu"),
  };

  const conflicts = data.conflicts;
  const conflictSummary = (conflicts.summary ?? []) as Array<{
    group_id?: string;
    topic?: string;
    subject_entity?: string;
    level?: string;
    n_bull?: number;
    n_bear?: number;
    n_template?: number;
    date_min?: string;
    date_max?: string;
    members?: Array<{
      view_id?: string;
      stance?: string;
      claim?: string;
      date?: string;
      analyst?: string;
      materiality?: string;
      bv_id?: string;
      ts_display?: string;
    }>;
  }>;

  // P1-C：冲突中心 topic 筛选器 + 成员下钻（展开原文证据卡 → 跳 B 站）
  const topicOptions = Array.from(
    new Set(conflictSummary.map((g) => g.topic).filter((t): t is string => !!t)),
  ).sort((a, b) => a.localeCompare(b, "zh-CN"));
  const filteredConflicts =
    conflictTopic === "all"
      ? conflictSummary
      : conflictSummary.filter((g) => g.topic === conflictTopic);

  const biliUrl = (bv: string | undefined, ts: string | undefined): string | null => {
    if (!bv) return null;
    // ts_display 两种格式：① "01:16:50-01:17:05"（HH:MM:SS 区间）② "789.62s-791.42s"（纯秒）
    // 统一取起点换算秒数跳转
    let sec = 0;
    const hms = /^(\d{1,2}):(\d{1,2}):(\d{1,2})/.exec(ts ?? "");
    if (hms) {
      sec = Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);
    } else {
      const secMatch = /^(\d+(?:\.\d+)?)s?/.exec(ts ?? "");
      if (secMatch) sec = Math.floor(Number(secMatch[1]));
    }
    return `https://www.bilibili.com/video/${bv}?t=${sec}`;
  };

  const factsList: Array<{ key: string; label: string; render: () => string }> = [
    {
      key: "fifo_realized",
      label: t("cognitive.factFifo"),
      render: () => `${nf(fact("fifo_realized")?.value)} ${fact("fifo_realized")?.unit ?? ""}`,
    },
    {
      key: "permutation",
      label: t("cognitive.factPermutation"),
      render: () => {
        const v = fact("permutation")?.value as { w3?: number; w5?: number } | undefined;
        return v ? `w3 p=${v.w3} / w5 p=${v.w5}` : "—";
      },
    },
    {
      key: "history_fix",
      label: t("cognitive.factHistory"),
      render: () => `${fact("history_fix")?.value ?? "—"} (${fact("history_fix")?.unit ?? ""})`,
    },
    {
      key: "placeholder_fix",
      label: t("cognitive.factPlaceholder"),
      render: () => {
        const v = fact("placeholder_fix")?.value as { fake_anchored?: number; real_anchored?: number; honest_downgrade?: number } | undefined;
        return v ? `${v.fake_anchored} → ${v.real_anchored} 真实锚定 + ${v.honest_downgrade} 诚实降级` : "—";
      },
    },
    {
      key: "mismatch_fix",
      label: t("cognitive.factMismatch"),
      render: () => {
        const v = fact("mismatch_fix")?.value as { before?: string; after?: string } | undefined;
        return v ? `${v.before} → ${v.after}` : "—";
      },
    },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-14 px-5 py-12 sm:px-8">
      {/* ===== Hero ===== */}
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-brand">{t("cognitive.eyebrow")}</p>
        <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight text-heading sm:text-4xl">{t("cognitive.title")}</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted">{t("cognitive.subtitle")}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 font-mono text-xs text-brand">
            {nf(data.blueprint.completed)}/{nf(data.blueprint.total)} {t("cognitive.blueprint")}
          </span>
          <span className="text-xs text-muted">{t("cognitive.snapshotNote", { date: dims.exported_at ?? "—" })}</span>
        </div>
      </header>

      {/* ===== 关键数字条 ===== */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" aria-label={t("cognitive.metrics")}>
        {(
          [
            ["transcript_segments", t("cognitive.transcripts")],
            ["claims", t("cognitive.claims")],
            ["anchored", t("cognitive.anchored")],
            ["reasoning_units", t("cognitive.reasoning")],
            ["evidence_links", t("cognitive.evidence")],
          ] as Array<[string, string]>
        ).map(([key, label]) => {
          const f = fact(key);
          return <MetricCard key={key} label={label} value={typeof f?.value === "number" ? f.value : null} hint={translateSource(f?.source, locale)} />;
        })}
        {/* 预测事件来自 decisions（facts 常量不含） */}
        <MetricCard
          key="prediction_events"
          label={t("cognitive.predictions")}
          value={data.decisions.predictionEvents}
          hint={t("cognitive.predictionEventsSource")}
        />
      </section>

      {/* ===== 模块 A 证据链保真 ===== */}
      <section className="space-y-6" aria-labelledby="evidence-title">
        <div>
          <h2 className="text-xl font-medium text-heading" id="evidence-title">① {t("cognitive.evidenceChain")}</h2>
          <p className="mt-1 text-sm text-muted">{t("cognitive.evidenceChainSub")}</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartFrame title={t("cognitive.sourceLayers")}>
            <div className="space-y-3">
              {Object.entries(dims.source_layers ?? {}).map(([key, value]) => {
                const meta = LAYER_META[key] ?? { label: key, colorClass: "bg-muted" };
                return <RatioBar key={key} label={meta.label} value={value} total={total} colorClass={meta.colorClass} />;
              })}
              <div className="mt-3 flex flex-wrap gap-4 border-t border-line pt-3 text-xs text-muted">
                <span>{t("cognitive.verified")}: {nf(dims.verification?.verified)} / {t("cognitive.unverified")}: {nf(dims.verification?.unverified)}</span>
                <span>{t("cognitive.matchQuality")}: {typeof dims.match_quality_avg === "number" ? dims.match_quality_avg.toFixed(3) : "—"}</span>
              </div>
            </div>
          </ChartFrame>
          <ChartFrame title={t("cognitive.pointers")}>
            <div className="space-y-3">
              <RatioBar label={t("cognitive.pointerOk")} value={dims.pointers?.ok ?? 0} total={total} colorClass="bg-emerald-500" />
              <RatioBar label={t("cognitive.pointerMissing")} value={dims.pointers?.missing ?? 0} total={total} colorClass="bg-amber-500" />
              <RatioBar label={t("cognitive.pointerMismatch")} value={dims.pointers?.mismatch ?? 0} total={total} colorClass="bg-rose-500" />
              <p className="mt-3 border-t border-line pt-3 text-xs leading-5 text-muted">{t("cognitive.pointerNote")}</p>
            </div>
          </ChartFrame>
        </div>

        {/* 冲突中心（P1-C：topic 筛选 + 成员下钻 → 展开原文证据卡 → 跳 B 站） */}
        <ChartFrame
          title={`${t("cognitive.conflicts")} · ${nf(filteredConflicts.length)}/${nf(conflictSummary.length)}`}
        >
          <div className="grid gap-4 md:grid-cols-[auto_1fr]">
            <div className="grid grid-cols-3 gap-3 self-start text-center">
              {(
                [
                  [t("cognitive.exact"), conflicts.exact],
                  [t("cognitive.divergences"), conflicts.divergences],
                  [t("cognitive.mapped"), conflicts.mappedViews],
                ] as Array<[string, number | null]>
              ).map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-line bg-surfaceSubtle p-3">
                  <div className="text-2xl font-semibold text-heading">{nf(value)}</div>
                  <div className="mt-1 text-[11px] text-muted">{label}</div>
                </div>
              ))}
            </div>
            <div className="min-w-0 space-y-2">
              {/* topic 筛选器 */}
              {topicOptions.length > 1 ? (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConflictTopic("all")}
                    className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                      conflictTopic === "all"
                        ? "bg-brand text-white"
                        : "border border-line bg-surfaceSubtle text-muted hover:border-brand/50 hover:text-heading"
                    }`}
                  >
                    {t("cognitive.conflictFilterAll")}
                  </button>
                  {topicOptions.map((topic) => (
                    <button
                      type="button"
                      key={topic}
                      onClick={() => setConflictTopic(topic)}
                      className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                        conflictTopic === topic
                          ? "bg-brand text-white"
                          : "border border-line bg-surfaceSubtle text-muted hover:border-brand/50 hover:text-heading"
                      }`}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              ) : null}

              {filteredConflicts.length === 0 ? (
                <p className="rounded-lg border border-line bg-surface p-3 text-sm text-muted">
                  {t("cognitive.noData")}
                </p>
              ) : (
                filteredConflicts.map((g, idx) => (
                  <div key={g.group_id ?? `${g.topic}-${idx}`} className="rounded-lg border border-line bg-surface p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded bg-warning/10 px-2 py-0.5 font-mono text-warning">{g.topic ?? "—"}</span>
                      <span className="text-muted">{g.subject_entity ?? ""}</span>
                      {g.date_min || g.date_max ? (
                        <span className="font-mono text-muted/70">
                          {g.date_min ?? ""} ~ {g.date_max ?? ""}
                        </span>
                      ) : null}
                      <span className="ml-auto font-mono text-muted">
                        bull {nf(g.n_bull)} / bear {nf(g.n_bear)}
                        {typeof g.n_template === "number" && g.n_template > 0 ? ` / tpl ${nf(g.n_template)}` : ""}
                      </span>
                    </div>
                    {(g.members ?? []).map((m) => {
                      const expanded = expandedView === m.view_id;
                      const url = biliUrl(m.bv_id, m.ts_display);
                      return (
                        <div key={m.view_id ?? `${g.group_id}-${m.claim}`} className="mt-1.5">
                          <button
                            type="button"
                            onClick={() => setExpandedView(expanded ? null : (m.view_id ?? null))}
                            className="flex w-full items-start gap-2 rounded-md px-1 py-1 text-left text-xs leading-5 text-muted transition hover:bg-surfaceSubtle hover:text-heading"
                            title={t("cognitive.conflictExpandHint")}
                          >
                            <span className="mt-0.5 shrink-0">
                              {m.stance === "bullish" ? "🟢" : m.stance === "bearish" ? "🔴" : "⚪"}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-2">{m.claim ?? "—"}</span>
                              <span className="font-mono text-muted/70">
                                {m.analyst ?? ""}
                                {m.date ? ` · ${m.date}` : ""}
                                {m.materiality ? ` · ${m.materiality}` : ""}
                              </span>
                            </span>
                            <span className="mt-0.5 shrink-0 text-muted/60">
                              {expanded ? t("cognitive.conflictCollapse") : t("cognitive.conflictExpand")}
                            </span>
                          </button>
                          {/* 下钻证据卡：第二次点击跳 B 站原文 */}
                          {expanded ? (
                            <div className="ml-6 mt-1 rounded-md border border-line bg-surfaceSubtle px-3 py-2">
                              <p className="whitespace-pre-wrap text-xs leading-5 text-heading">{m.claim ?? "—"}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
                                <span>view {m.view_id ?? "—"}</span>
                                {m.ts_display ? <span>{m.ts_display}</span> : null}
                                {m.bv_id ? <span>{m.bv_id}</span> : null}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {url ? (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-brandStrong"
                                  >
                                    {t("cognitive.conflictGoSource")} ↗
                                  </a>
                                ) : (
                                  <span className="inline-flex items-center rounded-md border border-line px-2.5 py-1 text-[11px] text-muted">
                                    {t("cognitive.conflictNoAnchor")}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
              <p className="text-xs leading-5 text-muted">{t("cognitive.conflictNote")}</p>
            </div>
          </div>
        </ChartFrame>
      </section>

      {/* ===== 模块 B 维度增补 ===== */}
      <section className="space-y-6" aria-labelledby="dimension-title">
        <div>
          <h2 className="text-xl font-medium text-heading" id="dimension-title">② {t("cognitive.dimensions")}</h2>
          <p className="mt-1 text-sm text-muted">{t("cognitive.dimensionsSub")}</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartFrame title={t("cognitive.claimLevels")}>
            <div className="space-y-3">
              {Object.entries(dims.claim_levels ?? {})
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .map(([key, value]) => {
                  const meta = CLAIM_LEVEL_META[key] ?? { icon: "❔", colorClass: "bg-muted" };
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 truncate text-xs text-muted">{meta.icon} {t(`cognitive.level_${key}`)}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surfaceSubtle">
                        <div className={`h-full rounded-full ${meta.colorClass}`} style={{ width: `${Math.max(2, ((value as number) / total) * 100)}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right text-xs text-heading">{nf(value)}</span>
                      <span className="w-14 shrink-0 text-right font-mono text-[11px] text-muted">{pct(value, total)}</span>
                    </div>
                  );
                })}
            </div>
          </ChartFrame>
          <div className="space-y-6">
            <ChartFrame title={t("cognitive.confidence")}>
              <div className="space-y-3">
                <RatioBar label={t("cognitive.confHigh")} value={dims.confidence_bands?.high ?? 0} total={total} colorClass="bg-emerald-500" />
                <RatioBar label={t("cognitive.confMedium")} value={dims.confidence_bands?.medium ?? 0} total={total} colorClass="bg-sky-500" />
                <RatioBar label={t("cognitive.confLow")} value={dims.confidence_bands?.low ?? 0} total={total} colorClass="bg-rose-500" />
                <p className="mt-3 border-t border-line pt-3 text-xs leading-5 text-muted">{t("cognitive.confidenceRule")}</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(dims.min_dimensions ?? {}).map(([k, v]) => (
                    <span key={k} className="rounded-full border border-line bg-surfaceSubtle px-2.5 py-1 text-[11px] text-muted">
                      {t(`cognitive.minDim_${k}`)} {nf(v)}
                    </span>
                  ))}
                </div>
              </div>
            </ChartFrame>
            <ChartFrame title={t("cognitive.uncertaintyTags")}>
              <div className="flex flex-wrap gap-2">
                {Object.entries(dims.uncertainty_tags ?? {}).map(([k, v]) => (
                  <span key={k} className="rounded-full border border-warning/30 bg-warning/5 px-2.5 py-1 text-[11px] text-warning">
                    {t(`cognitive.tag_${k}`)} · {nf(v)}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-muted">{t("cognitive.staleNote")}</p>
            </ChartFrame>
          </div>
        </div>

        {/* 推理五元组 */}
        <ChartFrame title={t("cognitive.reasoningUnits")}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              {reasoningFields.map(([key, label]) => (
                <RatioBar key={key} label={label} value={dims.reasoning_filled?.[key] ?? 0} total={total} colorClass="bg-violet-500" />
              ))}
            </div>
            <div className="space-y-3">
              <p className="text-xs leading-5 text-muted">{t("cognitive.reasoningHonest")}</p>
              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                {Object.entries(dims.tuple_status ?? {}).map(([k, v]) => (
                  <span key={k} className="rounded-full border border-line bg-surfaceSubtle px-2.5 py-1 text-[11px] text-muted">
                    {t(`cognitive.tuple_${k}`)} · {nf(v)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </ChartFrame>
      </section>

      {/* ===== 模块 C 预测约束与回测 ===== */}
      <section className="space-y-6" aria-labelledby="forecast-title">
        <div>
          <h2 className="text-xl font-medium text-heading" id="forecast-title">③ {t("cognitive.forecast")}</h2>
          <p className="mt-1 text-sm text-muted">{t("cognitive.forecastSub")}</p>
        </div>
        <ChartFrame title={t("cognitive.backtest")}>
          {bt.available ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="py-2 pr-4 font-normal">{t("cognitive.window")}</th>
                      {["ok", "partial_anchor", "template_only", "no_ru"].map((layer) => (
                        <th key={layer} className="px-3 py-2 font-normal">{layerLabel[layer]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 3, 5, 10, 20].map((w) => (
                      <tr key={w} className="border-b border-line/60 last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs text-muted">w{w}</td>
                        {["ok", "partial_anchor", "template_only", "no_ru"].map((layer) => {
                          const row = backtestRows.find((r) => r.window_days === w && r.layer === layer);
                          return (
                            <td key={layer} className="px-3 py-2">
                              {row ? (
                                <span className="flex items-baseline gap-2">
                                  <span className={layer === "ok" ? "font-semibold text-emerald-500" : "text-heading"}>
                                    {typeof row.hit_rate === "number" ? `${(row.hit_rate * 100).toFixed(1)}%` : "—"}
                                  </span>
                                  <span className="font-mono text-[10px] text-muted">n={nf(row.total)}</span>
                                </span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted">{t("cognitive.backtestNote", { runId: bt.runId ?? "—" })}</p>
            </>
          ) : (
            <p className="text-sm text-muted">{t("cognitive.noData")}</p>
          )}
        </ChartFrame>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartFrame title={t("cognitive.crowding")}>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-semibold text-heading">{nf(dims.topics)}</span>
              <span className="text-sm text-muted">{t("cognitive.crowdingTopics")}</span>
              <span className="ml-auto rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-xs text-emerald-500">
                {t("cognitive.crowdingZero")}
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">{t("cognitive.crowdingRule")}</p>
          </ChartFrame>
          <ChartFrame title={t("cognitive.predictionConfidence")}>
            {(() => {
              const range = fact("prediction_confidence_range")?.value as [number, number] | undefined;
              return (
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-3xl font-semibold text-heading">
                    {Array.isArray(range) ? `${range[0].toFixed(2)} – ${range[1].toFixed(2)}` : "—"}
                  </span>
                  <span className="text-sm text-muted">{t("cognitive.predictionConfidenceUnit")}</span>
                </div>
              );
            })()}
            <p className="mt-3 text-xs leading-5 text-muted">{fact("prediction_confidence_range")?.source ?? ""}</p>
          </ChartFrame>
        </div>
      </section>

      {/* ===== 模块 D 认知闭环与实盘验证 ===== */}
      <section className="space-y-6" aria-labelledby="loop-title">
        <div>
          <h2 className="text-xl font-medium text-heading" id="loop-title">④ {t("cognitive.closedLoop")}</h2>
          <p className="mt-1 text-sm text-muted">{t("cognitive.closedLoopSub")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FactCard label={t("cognitive.decisionLogs")} value={nf(data.decisions.decisionLogs)} />
          <FactCard label={t("cognitive.reviews")} value={nf(data.decisions.reviews)} />
          <FactCard label={t("cognitive.assetCards")} value={nf(data.decisions.assetCards)} />
          <FactCard label={t("cognitive.predictionEvents")} value={nf(data.decisions.predictionEvents)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {factsList.map(({ key, label, render }) => (
            <FactCard key={key} label={label} value={render()} source={translateSource(fact(key)?.source, locale)} />
          ))}
        </div>
        <div className="flex flex-wrap gap-4 rounded-lg border border-line bg-surfaceSubtle px-5 py-4 text-sm">
          <span className="inline-flex items-center gap-2">
            <span className="font-mono text-xs text-brand">{t("cognitive.outputGate")}</span>
            {(() => {
              const v = fact("output_gate")?.value as [number, number] | undefined;
              return <span className="font-mono text-heading">{Array.isArray(v) ? `${v[0]}/${v[1]}` : "—"}</span>;
            })()}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="font-mono text-xs text-brand">{t("cognitive.discipline")}</span>
            <span className="font-mono text-heading">{nf(fact("discipline_layers")?.value)} {t("cognitive.disciplineLayers")}</span>
          </span>
          <span className="text-xs text-muted">{t("cognitive.complianceNote")}</span>
        </div>
      </section>

      {/* ===== 页脚口径 ===== */}
      <footer className="border-t border-line pt-6">
        <p className="font-mono text-[11px] leading-5 text-muted">{t("cognitive.footnote")}</p>
        <p className="mt-1 font-mono text-[11px] text-muted/70">{translateSource(data.meta.source ?? undefined, locale)}</p>
      </footer>
    </main>
  );
}
