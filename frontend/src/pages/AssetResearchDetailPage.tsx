import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  ChevronRight,
  FileSearch,
  History,
  Layers3,
  MessageSquareText,
  Scale,
} from "lucide-react";
import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DataContext } from "@/app/providers";
import type { RagHitItem } from "@/types";

type AnyRecord = Record<string, any>;

const emptyPack: AnyRecord = {
  assetId: "",
  assetName: "",
  asOfDate: null,
  assetCard: null,
  factorStates: [],
  debateCard: null,
  latestViews: [],
  analystScores: [],
  marketSnapshot: null,
  userDecisionHistory: [],
  ragEvidence: [],
  summary: null,
};

const directionStyles: Record<string, string> = {
  bullish: "text-market-positive",
  bear: "text-market-negative",
  bearish: "text-market-negative",
  positive: "text-market-positive",
  negative: "text-market-negative",
  neutral: "text-muted",
};

function valueOf(item: AnyRecord, ...keys: string[]) {
  for (const key of keys) {
    // 支持点路径：counts.bullish / metrics.consensus_direction
    const value = key.split(".").reduce<unknown>(
      (acc, part) => (acc && typeof acc === "object" ? (acc as AnyRecord)[part] : undefined),
      item,
    );
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return null;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString() : "—";
  }

  return String(value);
}

function formatPercent(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return String(value);
  }

  return `${(number <= 1 ? number * 100 : number).toFixed(1)}%`;
}

function getEntities(view: AnyRecord): string[] {
  const entities = valueOf(view, "entities");
  if (!entities) {
    return [];
  }

  if (Array.isArray(entities)) {
    return entities.map(String).filter(Boolean);
  }

  if (typeof entities === "object") {
    return Object.values(entities)
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .map(String)
      .filter(Boolean);
  }

  return [String(entities)];
}

function directionLabel(direction: unknown, t: (key: string) => string) {
  const normalized = String(direction ?? "").toLowerCase();

  if (normalized.includes("bull") || normalized.includes("positive")) {
    return t("vault.bullish");
  }

  if (normalized.includes("bear") || normalized.includes("negative")) {
    return t("vault.bearish");
  }

  return t("vault.neutral");
}

function directionClass(direction: unknown) {
  const normalized = String(direction ?? "").toLowerCase();

  if (normalized.includes("bull") || normalized.includes("positive")) {
    return directionStyles.bullish;
  }

  if (normalized.includes("bear") || normalized.includes("negative")) {
    return directionStyles.bearish;
  }

  return directionStyles.neutral;
}

export default function AssetResearchDetailPage() {
  const { t } = useTranslation();
  const provider = useContext(DataContext);
  const navigate = useNavigate();
  const { assetId = "" } = useParams<{ assetId: string }>();

  const [pack, setPack] = useState<AnyRecord>(emptyPack);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [views, setViews] = useState<AnyRecord[]>([]);
  const [viewsLoading, setViewsLoading] = useState(false);
  const [showAllViews, setShowAllViews] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadPack() {
      if (!provider || !assetId) {
        setPack(emptyPack);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(false);

      try {
        const result = await provider.getAssetEvidencePack(assetId, "medium");
        if (active) {
          setPack(result ?? { ...emptyPack, assetId });
        }
      } catch {
        if (active) {
          setPack({ ...emptyPack, assetId });
          setError(true);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPack();

    return () => {
      active = false;
    };
  }, [assetId, provider]);

  async function loadAllViews() {
    if (!provider || viewsLoading) {
      return;
    }

    setViewsLoading(true);

    try {
      const result = await provider.getAssetViews(assetId, 1);
      const data = valueOf(result, "data", "views") ?? [];
      setViews(Array.isArray(data) ? data : []);
      setShowAllViews(true);
    } catch {
      setViews([]);
    } finally {
      setViewsLoading(false);
    }
  }

  const assetCard = valueOf(pack, "assetCard") ?? {};
  const factorStates = Array.isArray(valueOf(pack, "factorStates"))
    ? valueOf(pack, "factorStates")
    : [];
  const debateCard = valueOf(pack, "debateCard") ?? {};
  const latestViews = Array.isArray(valueOf(pack, "latestViews"))
    ? valueOf(pack, "latestViews")
    : [];
  const analystScores = Array.isArray(valueOf(pack, "analystScores"))
    ? valueOf(pack, "analystScores")
    : [];
  const ragEvidence = Array.isArray(valueOf(pack, "ragEvidence"))
    ? valueOf(pack, "ragEvidence")
    : [];
  const decisions = Array.isArray(valueOf(pack, "userDecisionHistory"))
    ? valueOf(pack, "userDecisionHistory")
    : [];

  const displayedViews = showAllViews ? views : latestViews;
  const assetName =
    valueOf(pack, "assetName") ?? valueOf(assetCard, "assetName") ?? assetId;
  const summary =
    valueOf(pack, "summary") ?? valueOf(assetCard, "description") ?? "—";
  const asOfDate = valueOf(pack, "asOfDate", "as_of_date");

  const hasData =
    Boolean(assetName) &&
    (factorStates.length > 0 ||
      latestViews.length > 0 ||
      ragEvidence.length > 0 ||
      Boolean(valueOf(assetCard, "description")));

  const factorRows = useMemo(
    () => factorStates.filter((factor: AnyRecord) => factor),
    [factorStates],
  );

  function renderView(view: AnyRecord, index: number) {
    const claim = valueOf(view, "claim", "content") ?? "—";
    const analyst = valueOf(view, "analyst") ?? "—";
    const date = valueOf(view, "date", "viewDate");
    const stance = valueOf(view, "stance", "direction");
    const confidence = valueOf(view, "confidence");
    const evidence = valueOf(view, "evidence");
    const entities = getEntities(view);

    return (
      <article
        className="border-b border-line py-5 first:pt-0 last:border-b-0 last:pb-0"
        key={String(valueOf(view, "viewId", "view_id") ?? index)}
      >
        <div className="flex flex-wrap items-start gap-2">
          <p className="min-w-0 flex-1 text-sm leading-6 text-text">{claim}</p>
          <span
            className={`rounded-full bg-surfaceSubtle px-2.5 py-1 text-xs font-medium ${directionClass(
              stance,
            )}`}
          >
            {directionLabel(stance, t)}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
          <span>{analyst}</span>
          <span>{formatValue(date)}</span>
          <span>
            {t("vault.confidence")}: {formatValue(confidence)}
          </span>
        </div>
        {entities.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {entities.slice(0, 8).map((entity) => (
              <span
                className="rounded-full border border-line px-2 py-1 text-xs text-muted"
                key={entity}
              >
                {entity}
              </span>
            ))}
          </div>
        ) : null}
        {evidence ? (
          <p className="mt-3 border-l-2 border-brand/50 pl-3 text-xs leading-5 text-muted">
            {String(evidence).slice(0, 240)}
          </p>
        ) : null}
      </article>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8 lg:py-12">
      <nav className="flex items-center gap-2 text-sm text-muted" aria-label="Breadcrumb">
        <button
          className="inline-flex items-center gap-1.5 transition-colors hover:text-heading"
          onClick={() => navigate("/vault?mode=assets")}
          type="button"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("vault.title")}
        </button>
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
        <span className="truncate text-text">{assetName}</span>
      </nav>

      {loading ? (
        <div className="border-y border-line py-20 text-center text-sm text-muted" role="status">
          {t("vault.loading")}
        </div>
      ) : error ? (
        <div className="mt-8 flex items-center gap-3 border-y border-line py-10 text-sm text-muted" role="alert">
          <AlertCircle className="h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
          {t("vault.error")}
        </div>
      ) : !hasData ? (
        <div className="mt-8 border-y border-line py-20 text-center text-sm text-muted">
          {t("vault.empty")}
        </div>
      ) : (
        <>
          <header className="mt-10 border-b border-line pb-8">
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-medium uppercase text-brand">
                    {assetId}
                  </span>
                  {valueOf(assetCard, "assetType", "asset_type") ? (
                    <span className="rounded-full bg-surfaceSubtle px-2.5 py-1 text-xs text-muted">
                      {valueOf(assetCard, "assetType", "asset_type")}
                    </span>
                  ) : null}
                </div>
                <h1 className="display-title mt-3 text-4xl text-heading">
                  {assetName}
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-text">{summary}</p>
              </div>
              <div className="text-right text-xs text-muted">
                <p>{t("vault.asOfDate")}</p>
                <p className="mt-1 font-mono text-text">{formatValue(asOfDate)}</p>
              </div>
            </div>
          </header>

          <section className="mt-10" aria-labelledby="factor-states-title">
            <div className="flex items-center gap-3">
              <Layers3 className="h-5 w-5 text-brand" aria-hidden="true" />
              <h2 className="text-xl font-medium text-heading" id="factor-states-title">
                {t("vault.factorStates")}
              </h2>
            </div>
            {factorRows.length > 0 ? (
              <div className="mt-5 overflow-x-auto border-y border-line">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="border-b border-line text-xs text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">{t("vault.factor")}</th>
                      <th className="px-4 py-3 font-medium">{t("vault.currentState")}</th>
                      <th className="px-4 py-3 font-medium">{t("vault.impactDirection")}</th>
                      <th className="px-4 py-3 font-medium">{t("vault.impactStrength")}</th>
                      <th className="px-4 py-3 font-medium">{t("vault.asOfDate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {factorRows.map((factor: AnyRecord, index: number) => {
                      const direction = valueOf(factor, "impactDirection", "impact_direction");
                      return (
                        <tr className="border-b border-line last:border-0" key={`${valueOf(factor, "factorName", "factor_name")}-${index}`}>
                          <td className="px-4 py-4 font-medium text-heading">
                            {formatValue(valueOf(factor, "factorName", "factor_name"))}
                          </td>
                          <td className="px-4 py-4 text-text">
                            {formatValue(valueOf(factor, "currentState", "current_state"))}
                          </td>
                          <td className={`px-4 py-4 font-medium ${directionClass(direction)}`}>
                            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-current" />
                            {directionLabel(direction, t)}
                          </td>
                          <td className="px-4 py-4 text-text">
                            {formatValue(valueOf(factor, "impactStrength", "impact_strength"))}
                          </td>
                          <td className="px-4 py-4 font-mono text-xs text-muted">
                            {formatValue(valueOf(factor, "asOfDate", "as_of_date"))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-5 text-sm text-muted">{t("vault.noFactors")}</p>
            )}
          </section>

          <section className="mt-12" aria-labelledby="debate-title">
            <div className="flex items-center gap-3">
              <Scale className="h-5 w-5 text-brand" aria-hidden="true" />
              <h2 className="text-xl font-medium text-heading" id="debate-title">
                {t("vault.debate")}
              </h2>
            </div>
            <div className="mt-5 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-3">
              {[
                ["bullishCount", "counts.bullish", "bullish", "market-positive"],
                ["bearishCount", "counts.bearish", "bearish", "market-negative"],
                ["neutralCount", "counts.neutral", "neutral", "muted"],
              ].map(([countKey, countPath, labelKey, color], index) => (
                <div className="bg-surface px-5 py-5" key={String(countKey)}>
                  <p className="text-xs text-muted">{t(`vault.${labelKey}`)}</p>
                  <p className={`mt-2 text-3xl font-medium tabular-nums text-${color}`}>
                    {formatValue(valueOf(debateCard, String(countKey), String(countPath)))}
                  </p>
                  {index === 2 ? null : <p className="mt-1 text-xs text-muted">{t("vault.views")}</p>}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text">
              <span>
                {t("vault.consensus")}:{" "}
                <strong className={directionClass(valueOf(debateCard, "metrics.consensus_direction", "consensusDirection", "consensus_direction"))}>
                  {directionLabel(valueOf(debateCard, "metrics.consensus_direction", "consensusDirection", "consensus_direction"), t)}
                </strong>
              </span>
              <span>
                {t("vault.disagreement")}:{" "}
                {formatValue(valueOf(debateCard, "metrics.disagreement_level", "disagreementLevel", "disagreement_level"))}
              </span>
            </div>
          </section>

          <section className="mt-12" aria-labelledby="latest-views-title">
            <div className="flex flex-wrap items-center gap-3">
              <MessageSquareText className="h-5 w-5 text-brand" aria-hidden="true" />
              <h2 className="mr-auto text-xl font-medium text-heading" id="latest-views-title">
                {t("vault.latestViews")}
              </h2>
              {!showAllViews ? (
                <button
                  className="text-sm font-medium text-brand hover:underline"
                  onClick={() => void loadAllViews()}
                  type="button"
                >
                  {viewsLoading ? t("vault.loading") : t("vault.viewAll")}
                </button>
              ) : null}
            </div>
            <div className="mt-5 border-y border-line py-5">
              {displayedViews.length > 0 ? (
                displayedViews.map(renderView)
              ) : (
                <p className="text-sm text-muted">{t("vault.noViews")}</p>
              )}
            </div>
          </section>

          <section className="mt-12" aria-labelledby="evidence-title">
            <div className="flex items-center gap-3">
              <FileSearch className="h-5 w-5 text-brand" aria-hidden="true" />
              <h2 className="text-xl font-medium text-heading" id="evidence-title">
                {t("vault.evidenceChain")}
              </h2>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {ragEvidence.length > 0 ? (
                ragEvidence.map((item: RagHitItem | AnyRecord, index: number) => {
                  const source = valueOf(item, "source");
                  return (
                    <article className="border border-line bg-surface px-5 py-4" key={`${source}-${index}`}>
                      <p className="text-sm leading-6 text-text">
                        {String(valueOf(item, "content") ?? "—").slice(0, 360)}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                        <span>{formatValue(source)}</span>
                        <span>{formatValue(valueOf(item, "section"))}</span>
                        <span className="font-mono">
                          {t("vault.relevanceScore")}: {formatValue(valueOf(item, "score"))}
                        </span>
                      </div>
                    </article>
                  );
                })
              ) : (
                <p className="text-sm text-muted">{t("vault.noEvidence")}</p>
              )}
            </div>
          </section>

          <section className="mt-12" aria-labelledby="analyst-scores-title">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-brand" aria-hidden="true" />
              <h2 className="text-xl font-medium text-heading" id="analyst-scores-title">
                {t("vault.analystHistory")}
              </h2>
            </div>
            <div className="mt-5 overflow-x-auto border-y border-line">
              {analystScores.length > 0 ? (
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="border-b border-line text-xs text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">{t("vault.analyst")}</th>
                      <th className="px-4 py-3 font-medium">{t("vault.entity")}</th>
                      <th className="px-4 py-3 font-medium">{t("vault.windowDays")}</th>
                      <th className="px-4 py-3 font-medium">{t("vault.sampleCount")}</th>
                      <th className="px-4 py-3 font-medium">{t("vault.hitRate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analystScores.map((score: AnyRecord, index: number) => {
                      const samples = Number(valueOf(score, "sampleCount", "sample_count"));
                      const enoughSamples = Number.isFinite(samples) && samples >= 3;
                      return (
                        <tr className="border-b border-line last:border-0" key={`${valueOf(score, "analyst")}-${index}`}>
                          <td className="px-4 py-4 font-medium text-heading">{formatValue(valueOf(score, "analyst"))}</td>
                          <td className="px-4 py-4 text-text">{formatValue(valueOf(score, "entity"))}</td>
                          <td className="px-4 py-4 font-mono text-xs text-muted">
                            {(() => {
                              const days = valueOf(score, "windowDays", "window_days");
                              return days === null || days === undefined || days === ""
                                ? "—"
                                : `${days}d`;
                            })()}
                          </td>
                          <td className="px-4 py-4 tabular-nums text-text">{formatValue(samples)}</td>
                          <td className="px-4 py-4 tabular-nums text-text">
                            {enoughSamples ? formatPercent(valueOf(score, "hitRate", "hit_rate")) : t("vault.insufficientSample")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="px-4 py-5 text-sm text-muted">{t("vault.noAnalystScores")}</p>
              )}
            </div>
          </section>

          <section className="mt-12" aria-labelledby="decision-history-title">
            <div className="flex items-center gap-3">
              <History className="h-5 w-5 text-brand" aria-hidden="true" />
              <h2 className="text-xl font-medium text-heading" id="decision-history-title">
                {t("vault.decisionHistory")}
              </h2>
            </div>
            <div className="mt-5 border-y border-line">
              {decisions.length > 0 ? (
                decisions.map((decision: AnyRecord, index: number) => (
                  <article className="border-b border-line px-4 py-4 last:border-0" key={index}>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
                      <span>{formatValue(valueOf(decision, "date", "decisionDate", "decision_date"))}</span>
                      <span className={directionClass(valueOf(decision, "stance", "direction"))}>
                        {directionLabel(valueOf(decision, "stance", "direction"), t)}
                      </span>
                      <span>{formatValue(valueOf(decision, "horizon"))}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-text">
                      {String(valueOf(decision, "thesis", "reason", "summary", "claim") ?? "—").slice(0, 300)}
                    </p>
                  </article>
                ))
              ) : (
                <p className="px-4 py-5 text-sm text-muted">{t("vault.noDecisionHistory")}</p>
              )}
            </div>
          </section>

          <footer className="mt-12 border-t border-line pt-5">
            <Link className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline" to="/vault?mode=assets">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t("vault.backToVault")}
            </Link>
          </footer>
        </>
      )}
    </main>
  );
}