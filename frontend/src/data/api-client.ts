import { apiBaseUrl } from "@/app/config";
import {
  AboutData,
  ArchitectureData,
  AssetEvidencePack,
  AssetViewsData,
  AssetsData,
  BriefDetail,
  BriefItem,
  DecisionSummary,
  DisciplineData,
  ListNotesParams,
  MarketData,
  NotesListData,
  OverviewData,
  Pagination,
  RagData,
  RagQueryParams,
  RagSuggestionItem,
  VaultAssetsIndex,
  VaultNoteDetail,
  VaultSummary,
} from "@/types";
import { DataProvider } from "./provider";

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

export const emptyArchitecture: ArchitectureData = {
  meta: { status: "pending", updatedAt: null, source: "api" },
  summaryTags: [],
  pipelineStatus: {
    scheduler: "",
    lastChecked: null,
    detectedToday: null,
    processedTotal: null,
    queuePending: null,
    channels: [],
  },
  layers: [],
  viewLifecycle: [],
  mcpTools: [],
};

export const emptyAssets: AssetsData = {
  metrics: {
    structuredViews: null,
    predictionEvents: null,
    notes: null,
    ragChunks: null,
    analysts: null,
    assetCards: null,
    generatedAt: null,
  },
  stanceDist: [],
  horizonDist: [],
  sourceContrib: [],
  analystRank: [],
  debateCards: [],
  sampleViews: [],
};

export const emptyDecisions: DecisionSummary = {
  stats: {
    total: 0,
    open: 0,
    reviewed: 0,
    hit: 0,
    wrong: 0,
    generatedAt: null,
  },
  decisions: [],
  assetCards: [],
  reviews: [],
};

export const emptyDiscipline: DisciplineData = {
  meta: { status: "pending", updatedAt: null, source: "api" },
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

export const emptyMarket: MarketData = {
  meta: { status: "pending", updatedAt: null, source: "api" },
  dataAsOf: null,
  source: null,
  usIndices: [],
  usStocks: [],
  cnIndices: [],
  proxyAssets: [],
};

export const emptyVaultSummary: VaultSummary = {
  meta: { status: "pending", updatedAt: null, source: "api" },
  notesCount: null,
  viewsCount: null,
  chunksCount: null,
  assetsCount: null,
  latestNoteDate: null,
  modes: [],
};

export const emptyNotesData: NotesListData = {
  data: [],
  pagination: { page: 1, pageSize: 20, total: 0, hasMore: false },
};

export const emptyVaultAssets: VaultAssetsIndex = {
  data: [],
  generatedAt: null,
};

export const emptyRagData: RagData = {
  data: [],
  pagination: { page: 1, pageSize: 10, total: 0, hasMore: false },
  degraded: false,
};

export const emptyEvidencePack: AssetEvidencePack = {
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

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readField(
  record: JsonRecord,
  snakeCase: string,
  camelCase: string = snakeCase,
): unknown {
  return record[snakeCase] ?? record[camelCase];
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberOrZero(value: unknown): number {
  return nullableNumber(value) ?? 0;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function recordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function mapArchitectureResponse(input: unknown): ArchitectureData {
  if (!isRecord(input)) return emptyArchitecture;

  const payload = isRecord(input.architecture_data)
    ? input.architecture_data
    : isRecord(input.architectureData)
      ? input.architectureData
      : input;
  const meta = isRecord(payload.meta) ? payload.meta : {};
  const statusValue = readField(payload, "pipeline_status", "pipelineStatus");
  const status = isRecord(statusValue) ? statusValue : {};

  return {
    meta: {
      status:
        meta.status === "ready" || meta.status === "error"
          ? meta.status
          : "pending",
      updatedAt: nullableString(readField(meta, "updated_at", "updatedAt")),
      source:
        meta.source === "live" || meta.source === "snapshot"
          ? meta.source
          : "api",
    },
    summaryTags: Array.isArray(payload.summary_tags ?? payload.summaryTags)
      ? (payload.summary_tags ?? payload.summaryTags).filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    pipelineStatus: {
      scheduler: stringOrEmpty(status.scheduler),
      lastChecked: nullableString(
        readField(status, "last_checked", "lastChecked"),
      ),
      detectedToday: nullableNumber(
        readField(status, "detected_today", "detectedToday"),
      ),
      processedTotal: nullableNumber(
        readField(status, "processed_total", "processedTotal"),
      ),
      queuePending: nullableNumber(
        readField(status, "queue_pending", "queuePending"),
      ),
      channels: recordArray(status.channels).map((item) => ({
        name: stringOrEmpty(item.name),
        uid: stringOrEmpty(item.uid),
        lastCheck: nullableString(
          readField(item, "last_check", "lastCheck"),
        ),
        totalVideos: nullableNumber(
          readField(item, "total_videos", "totalVideos"),
        ),
      })),
    },
    layers: recordArray(payload.layers).map((layer) => ({
      layerId: stringOrEmpty(readField(layer, "layer_id", "layerId")),
      layerName: stringOrEmpty(readField(layer, "layer_name", "layerName")),
      layerNameEn: stringOrEmpty(
        readField(layer, "layer_name_en", "layerNameEn"),
      ),
      description: stringOrEmpty(layer.description),
      nodes: recordArray(layer.nodes).map((node) => ({
        name: stringOrEmpty(node.name),
        role: stringOrEmpty(node.role),
        tech: stringOrEmpty(node.tech),
      })),
    })),
    viewLifecycle: recordArray(
      readField(payload, "view_lifecycle", "viewLifecycle"),
    ).map((step) => ({
      step: stringOrEmpty(step.step),
      detail: stringOrEmpty(step.detail),
    })),
    mcpTools: recordArray(
      readField(payload, "mcp_tools", "mcpTools"),
    ).map((tool) => ({
      name: stringOrEmpty(tool.name),
      input: stringOrEmpty(tool.input),
      output: stringOrEmpty(tool.output),
      purpose: stringOrEmpty(tool.purpose),
    })),
  };
}

export function mapAssetsResponse(input: unknown): AssetsData {
  if (!isRecord(input)) return emptyAssets;
  const payload = isRecord(input.assets) ? input.assets : input;
  const metrics = isRecord(payload.metrics) ? payload.metrics : {};

  return {
    metrics: {
      structuredViews: nullableNumber(
        readField(metrics, "structured_views", "structuredViews"),
      ),
      predictionEvents: nullableNumber(
        readField(metrics, "prediction_events", "predictionEvents"),
      ),
      notes: nullableNumber(metrics.notes),
      ragChunks: nullableNumber(readField(metrics, "rag_chunks", "ragChunks")),
      analysts: nullableNumber(metrics.analysts),
      assetCards: nullableNumber(
        readField(metrics, "asset_cards", "assetCards"),
      ),
      generatedAt: nullableString(
        readField(metrics, "generated_at", "generatedAt"),
      ),
    },
    stanceDist: recordArray(
      readField(payload, "stance_dist", "stanceDist"),
    ).map((item) => ({
      name: stringOrEmpty(item.name),
      labelZh: stringOrEmpty(readField(item, "label_zh", "labelZh")),
      value: numberOrZero(item.value),
    })),
    horizonDist: recordArray(
      readField(payload, "horizon_dist", "horizonDist"),
    ).map((item) => ({
      name: stringOrEmpty(item.name),
      labelZh: stringOrEmpty(readField(item, "label_zh", "labelZh")),
      value: numberOrZero(item.value),
    })),
    sourceContrib: recordArray(
      readField(payload, "source_contrib", "sourceContrib"),
    ).map((item) => ({
      name: stringOrEmpty(item.name),
      views: numberOrZero(item.views),
    })),
    analystRank: recordArray(
      readField(payload, "analyst_rank", "analystRank"),
    ).map((item) => ({
      name: stringOrEmpty(item.name),
      hitRate: nullableNumber(readField(item, "hit_rate", "hitRate")),
      samples: nullableNumber(item.samples),
    })),
    debateCards: recordArray(
      readField(payload, "debate_cards", "debateCards"),
    ).map((item) => ({
      entity: stringOrEmpty(item.entity),
      bullish: numberOrZero(item.bullish),
      bearish: numberOrZero(item.bearish),
      neutral: numberOrZero(item.neutral),
      consensus: stringOrEmpty(item.consensus),
      disagreement: nullableNumber(item.disagreement),
      updated: nullableString(item.updated),
    })),
    sampleViews: recordArray(
      readField(payload, "sample_views", "sampleViews"),
    ).map((item) => ({
      analyst: stringOrEmpty(item.analyst),
      date: nullableString(item.date),
      stance: stringOrEmpty(item.stance),
      claim: stringOrEmpty(item.claim),
    })),
  };
}

export function mapDecisionsResponse(input: unknown): DecisionSummary {
  if (!isRecord(input)) return emptyDecisions;

  const payload = isRecord(input.decisions_data)
    ? input.decisions_data
    : isRecord(input.decisionsData)
      ? input.decisionsData
      : input;
  const stats = isRecord(payload.stats) ? payload.stats : {};

  return {
    stats: {
      total: numberOrZero(stats.total),
      open: numberOrZero(stats.open),
      reviewed: numberOrZero(stats.reviewed),
      hit: numberOrZero(stats.hit),
      wrong: numberOrZero(stats.wrong),
      generatedAt: nullableString(
        readField(stats, "generated_at", "generatedAt"),
      ),
    },
    decisions: recordArray(payload.decisions).map((item) => ({
      decisionId: stringOrEmpty(
        readField(item, "decision_id", "decisionId"),
      ),
      assetName: stringOrEmpty(readField(item, "asset_name", "assetName")),
      assetType: stringOrEmpty(readField(item, "asset_type", "assetType")),
      decisionDate: nullableString(
        readField(item, "decision_date", "decisionDate"),
      ),
      horizon: stringOrEmpty(item.horizon),
      direction: stringOrEmpty(item.direction),
      conviction: nullableNumber(item.conviction),
      thesis: stringOrEmpty(item.thesis),
      status: stringOrEmpty(item.status),
      reviewResult: nullableString(
        readField(item, "review_result", "reviewResult"),
      ),
    })),
    assetCards: recordArray(
      readField(payload, "asset_cards", "assetCards"),
    ).map((item) => ({
      assetId: stringOrEmpty(readField(item, "asset_id", "assetId")),
      assetName: stringOrEmpty(readField(item, "asset_name", "assetName")),
      assetType: stringOrEmpty(readField(item, "asset_type", "assetType")),
      description: stringOrEmpty(item.description),
      factors: recordArray(item.factors).map((factor) => ({
        factorName: stringOrEmpty(
          readField(factor, "factor_name", "factorName"),
        ),
        currentState: stringOrEmpty(
          readField(factor, "current_state", "currentState"),
        ),
        impactDirection: stringOrEmpty(
          readField(factor, "impact_direction", "impactDirection"),
        ),
        impactStrength: stringOrEmpty(
          readField(factor, "impact_strength", "impactStrength"),
        ),
      })),
    })),
    reviews: recordArray(payload.reviews).map((item) => ({
      decisionId: stringOrEmpty(
        readField(item, "decision_id", "decisionId"),
      ),
      assetName: stringOrEmpty(readField(item, "asset_name", "assetName")),
      direction: stringOrEmpty(item.direction),
      reviewDate: nullableString(
        readField(item, "review_date", "reviewDate"),
      ),
      resultLabel: stringOrEmpty(
        readField(item, "result_label", "resultLabel"),
      ),
      outcomeReturn: nullableNumber(
        readField(item, "outcome_return", "outcomeReturn"),
      ),
      horizonDays: nullableNumber(
        readField(item, "horizon_days", "horizonDays"),
      ),
      newRuleLearned: nullableString(
        readField(item, "new_rule_learned", "newRuleLearned"),
      ),
    })),
  };
}

export function mapDisciplineResponse(input: unknown): DisciplineData {
  if (!isRecord(input)) return emptyDiscipline;

  const payload = isRecord(input.discipline_data)
    ? input.discipline_data
    : isRecord(input.disciplineData)
      ? input.disciplineData
      : input;
  const meta = isRecord(payload.meta) ? payload.meta : {};
  const stats = isRecord(payload.stats) ? payload.stats : {};

  return {
    meta: {
      status:
        meta.status === "ready" || meta.status === "error"
          ? meta.status
          : "pending",
      updatedAt: nullableString(readField(meta, "updated_at", "updatedAt")),
      source:
        meta.source === "live" || meta.source === "snapshot"
          ? meta.source
          : "api",
    },
    principles: recordArray(payload.principles).map((item) => ({
      id: stringOrEmpty(item.id),
      title: stringOrEmpty(item.title),
      description: stringOrEmpty(item.description),
    })),
    stats: {
      totalDecisions: nullableNumber(
        readField(stats, "total_decisions", "totalDecisions"),
      ),
      open: nullableNumber(stats.open),
      reviewed: nullableNumber(stats.reviewed),
      hit: nullableNumber(stats.hit),
      wrong: nullableNumber(stats.wrong),
      reviewCoveragePct: nullableNumber(
        readField(stats, "review_coverage_pct", "reviewCoveragePct"),
      ),
      generatedAt: nullableString(
        readField(stats, "generated_at", "generatedAt"),
      ),
    },
    framework: recordArray(payload.framework).map((item) => ({
      ruleId: stringOrEmpty(readField(item, "rule_id", "ruleId")),
      title: stringOrEmpty(item.title),
      description: stringOrEmpty(item.description),
      status: stringOrEmpty(item.status),
    })),
    timeline: recordArray(payload.timeline).map((item) => ({
      date: nullableString(item.date),
      actionType: stringOrEmpty(readField(item, "action_type", "actionType")),
      summary: stringOrEmpty(item.summary),
      ruleIds: Array.isArray(readField(item, "rule_ids", "ruleIds"))
        ? (readField(item, "rule_ids", "ruleIds") as unknown[]).filter(
            (value): value is string => typeof value === "string",
          )
        : [],
    })),
    decisionLogs: recordArray(
      readField(payload, "decision_logs", "decisionLogs"),
    ).map((item) => {
      const reviewValue = readField(item, "review");
      const review = isRecord(reviewValue)
        ? {
            reviewDate: nullableString(
              readField(reviewValue, "review_date", "reviewDate"),
            ),
            resultLabel: stringOrEmpty(
              readField(reviewValue, "result_label", "resultLabel"),
            ),
            outcomeReturn: nullableNumber(
              readField(reviewValue, "outcome_return", "outcomeReturn"),
            ),
            horizonDays: nullableNumber(
              readField(reviewValue, "horizon_days", "horizonDays"),
            ),
          }
        : null;

      return {
        decisionId: stringOrEmpty(
          readField(item, "decision_id", "decisionId"),
        ),
        date: nullableString(item.date),
        assetName: stringOrEmpty(
          readField(item, "asset_name", "assetName"),
        ),
        direction: stringOrEmpty(item.direction),
        horizon: stringOrEmpty(item.horizon),
        conviction: nullableNumber(item.conviction),
        thesis: stringOrEmpty(item.thesis),
        keyReasons: Array.isArray(
          readField(item, "key_reasons", "keyReasons"),
        )
          ? (
              readField(item, "key_reasons", "keyReasons") as unknown[]
            ).filter((value): value is string => typeof value === "string")
          : [],
        status: stringOrEmpty(item.status),
        review,
      };
    }),
  };
}

export function mapMarketResponse(input: unknown): MarketData {
  if (!isRecord(input)) return emptyMarket;

  const payload = isRecord(input.market_data)
    ? input.market_data
    : isRecord(input.marketData)
      ? input.marketData
      : input;
  const meta = isRecord(payload.meta) ? payload.meta : {};

  const mapQuote = (item: unknown): MarketQuote | null => {
    if (!isRecord(item)) return null;
    return {
      symbol: stringOrEmpty(item.symbol),
      name: stringOrEmpty(item.name),
      nameEn: stringOrEmpty(readField(item, "name_en", "nameEn")),
      price: nullableNumber(item.price),
      changePct: nullableNumber(readField(item, "change_pct", "changePct")),
      trend: recordArray(item.trend)
        .map((point) => {
          if (!isRecord(point)) return null;
          return {
            date: stringOrEmpty(point.date),
            price: nullableNumber(point.price) ?? 0,
          };
        })
        .filter((point): point is MarketTrendPoint => point !== null),
    };
  };

  return {
    meta: {
      status:
        meta.status === "ready" || meta.status === "error"
          ? meta.status
          : "pending",
      updatedAt: nullableString(readField(meta, "updated_at", "updatedAt")),
      source:
        meta.source === "live" || meta.source === "snapshot"
          ? meta.source
          : "api",
    },
    dataAsOf: nullableString(
      readField(meta, "data_as_of", "dataAsOf") ??
        readField(payload, "data_as_of", "dataAsOf"),
    ),
    source: nullableString(payload.source),
    usIndices: recordArray(
      readField(payload, "us_indices", "usIndices"),
    )
      .map(mapQuote)
      .filter((quote): quote is MarketQuote => quote !== null),
    usStocks: recordArray(
      readField(payload, "us_stocks", "usStocks"),
    )
      .map(mapQuote)
      .filter((quote): quote is MarketQuote => quote !== null),
    cnIndices: recordArray(
      readField(payload, "cn_indices", "cnIndices"),
    )
      .map(mapQuote)
      .filter((quote): quote is MarketQuote => quote !== null),
    proxyAssets: recordArray(
      readField(payload, "proxy_assets", "proxyAssets"),
    )
      .map((item) => {
        if (!isRecord(item)) return null;
        const quote = mapQuote(item);
        if (!quote) return null;
        const decision = isRecord(item.linked_decision)
          ? item.linked_decision
          : isRecord(item.linkedDecision)
            ? item.linkedDecision
            : null;
        return {
          ...quote,
          linkedDecision: decision
            ? {
                asset: nullableString(decision.asset),
                direction: nullableString(decision.direction),
                status: nullableString(decision.status),
                reviewDate: nullableString(
                  readField(decision, "review_date", "reviewDate"),
                ),
              }
            : null,
        };
      })
      .filter(
        (item): item is MarketProxyAsset => item !== null,
      ),
  };
}

function mapPagination(value: unknown): Pagination {
  const p = isRecord(value) ? value : {};
  return {
    page: numberOrZero(p.page),
    pageSize: numberOrZero(readField(p, "page_size", "pageSize")),
    total: numberOrZero(p.total),
    hasMore: Boolean(readField(p, "has_more", "hasMore")),
  };
}

export function mapVaultSummaryResponse(input: unknown): VaultSummary {
  if (!isRecord(input)) return emptyVaultSummary;
  const payload = isRecord(input.vault_summary)
    ? input.vault_summary
    : isRecord(input.vaultSummary)
      ? input.vaultSummary
      : input;
  const meta = isRecord(payload.meta) ? payload.meta : {};
  return {
    meta: {
      status:
        meta.status === "ready" || meta.status === "error"
          ? meta.status
          : "pending",
      updatedAt: nullableString(readField(meta, "updated_at", "updatedAt")),
      source:
        meta.source === "live" || meta.source === "snapshot"
          ? meta.source
          : "api",
    },
    notesCount: nullableNumber(readField(payload, "notes_count", "notesCount")),
    viewsCount: nullableNumber(readField(payload, "views_count", "viewsCount")),
    chunksCount: nullableNumber(
      readField(payload, "chunks_count", "chunksCount"),
    ),
    assetsCount: nullableNumber(
      readField(payload, "assets_count", "assetsCount"),
    ),
    latestNoteDate: nullableString(
      readField(payload, "latest_note_date", "latestNoteDate"),
    ),
    modes: recordArray(payload.modes).map(stringOrEmpty),
  };
}

export function mapNotesResponse(input: unknown): NotesListData {
  if (!isRecord(input)) return emptyNotesData;
  const payload = isRecord(input.notes_data) ? input.notes_data : input;
  return {
    data: recordArray(payload.data).map((item) => ({
      noteId: stringOrEmpty(readField(item, "note_id", "noteId")),
      filename: stringOrEmpty(item.filename),
      title: stringOrEmpty(item.title),
      noteDate: nullableString(readField(item, "note_date", "noteDate")),
      createdAt: nullableString(readField(item, "created_at", "createdAt")),
      tags: recordArray(item.tags).map(stringOrEmpty),
      source: nullableString(item.source),
      excerpt: stringOrEmpty(item.excerpt),
      structuredViewCount: nullableNumber(
        readField(item, "structured_view_count", "structuredViewCount"),
      ),
      sizeBytes: nullableNumber(readField(item, "size_bytes", "sizeBytes")),
    })),
    pagination: mapPagination(payload.pagination),
  };
}

export function mapNoteDetailResponse(input: unknown): VaultNoteDetail | null {
  if (!isRecord(input)) return null;
  const note = isRecord(input.note) ? input.note : input;
  if (!stringOrEmpty(readField(note, "note_id", "noteId"))) return null;
  return {
    noteId: stringOrEmpty(readField(note, "note_id", "noteId")),
    filename: stringOrEmpty(note.filename),
    title: stringOrEmpty(note.title),
    noteDate: nullableString(readField(note, "note_date", "noteDate")),
    createdAt: nullableString(readField(note, "created_at", "createdAt")),
    tags: recordArray(note.tags).map(stringOrEmpty),
    source: nullableString(note.source),
    excerpt: stringOrEmpty(note.excerpt),
    structuredViewCount: nullableNumber(
      readField(note, "structured_view_count", "structuredViewCount"),
    ),
    sizeBytes: nullableNumber(readField(note, "size_bytes", "sizeBytes")),
    content: stringOrEmpty(note.content),
    relatedViews: recordArray(
      readField(note, "related_views", "relatedViews"),
    ).map((view) => ({
      viewId: stringOrEmpty(readField(view, "view_id", "viewId")),
      analyst: stringOrEmpty(view.analyst),
      claim: stringOrEmpty(view.claim),
      date: nullableString(view.date),
      stance: stringOrEmpty(view.stance),
      confidence: nullableNumber(view.confidence),
      section: nullableString(view.section),
      evidence: stringOrEmpty(view.evidence),
    })),
  };
}

export function mapVaultAssetsResponse(input: unknown): VaultAssetsIndex {
  if (!isRecord(input)) return emptyVaultAssets;
  const payload = isRecord(input.assets_index) ? input.assets_index : input;
  return {
    data: recordArray(payload.data).map((item) => ({
      assetId: stringOrEmpty(readField(item, "asset_id", "assetId")),
      assetName: stringOrEmpty(readField(item, "asset_name", "assetName")),
      assetType: stringOrEmpty(readField(item, "asset_type", "assetType")),
      description: stringOrEmpty(item.description),
      factors: recordArray(item.factors).map((factor) => ({
        factorName: stringOrEmpty(readField(factor, "factor_name", "factorName")),
        currentState: stringOrEmpty(readField(factor, "current_state", "currentState")),
        impactDirection: stringOrEmpty(readField(factor, "impact_direction", "impactDirection")),
        impactStrength: stringOrEmpty(readField(factor, "impact_strength", "impactStrength")),
      })),
      factorCount: numberOrZero(readField(item, "factor_count", "factorCount")),
      bullishCount: numberOrZero(readField(item, "bullish_count", "bullishCount")),
      bearishCount: numberOrZero(readField(item, "bearish_count", "bearishCount")),
      neutralCount: numberOrZero(readField(item, "neutral_count", "neutralCount")),
      consensusDirection: nullableString(
        readField(item, "consensus_direction", "consensusDirection"),
      ),
      disagreementLevel: nullableNumber(
        readField(item, "disagreement_level", "disagreementLevel"),
      ),
    })),
    generatedAt: nullableString(readField(payload, "generated_at", "generatedAt")),
  };
}

// 别名：snapshot-client 兼容命名
export const mapAssetsIndexResponse = mapVaultAssetsResponse;

export function mapEvidencePackResponse(input: unknown): AssetEvidencePack | null {
  if (!isRecord(input)) return null;
  const pack = isRecord(input.evidence_pack) ? input.evidence_pack : input;
  if (!stringOrEmpty(readField(pack, "asset_id", "assetId"))) return null;
  const result: AssetEvidencePack = {
    assetId: stringOrEmpty(readField(pack, "asset_id", "assetId")),
    assetName: stringOrEmpty(readField(pack, "asset_name", "assetName")),
    asOfDate: nullableString(readField(pack, "as_of_date", "asOfDate")),
    assetCard: isRecord(pack.asset_card) ? (pack.asset_card as Record<string, unknown>) : isRecord(readField(pack, "asset_card", "assetCard")) ? (readField(pack, "asset_card", "assetCard") as Record<string, unknown>) : null,
    factorStates: recordArray(readField(pack, "factor_states", "factorStates")),
    debateCard: isRecord(pack.debate_card) ? (pack.debate_card as Record<string, unknown>) : isRecord(readField(pack, "debate_card", "debateCard")) ? (readField(pack, "debate_card", "debateCard") as Record<string, unknown>) : null,
    latestViews: recordArray(readField(pack, "latest_views", "latestViews")),
    analystScores: recordArray(readField(pack, "analyst_scores", "analystScores")),
    marketSnapshot: isRecord(pack.market_snapshot) ? (pack.market_snapshot as Record<string, unknown>) : isRecord(readField(pack, "market_snapshot", "marketSnapshot")) ? (readField(pack, "market_snapshot", "marketSnapshot") as Record<string, unknown>) : null,
    userDecisionHistory: recordArray(readField(pack, "user_decision_history", "userDecisionHistory")),
    ragEvidence: recordArray(readField(pack, "rag_evidence", "ragEvidence")),
    summary: nullableString(pack.summary),
  };
  return result;
}

export function mapRagResponse(input: unknown): RagData {
  if (!isRecord(input)) return emptyRagData;
  const payload = isRecord(input.rag_data) ? input.rag_data : input;
  return {
    data: recordArray(payload.data).map((item) => ({
      rank: numberOrZero(item.rank),
      content: stringOrEmpty(item.content),
      source: stringOrEmpty(item.source),
      section: nullableString(item.section),
      score: nullableNumber(item.score) ?? 0,
      rawScore: nullableNumber(readField(item, "raw_score", "rawScore")) ?? 0,
      type: stringOrEmpty(item.type),
    })),
    pagination: mapPagination(payload.pagination),
    degraded: Boolean(payload.degraded),
    reason: nullableString(payload.reason),
    snapshotLimited: Boolean(
      readField(payload, "snapshot_limited", "snapshotLimited"),
    ),
  };
}

export function mapOverviewResponse(input: unknown): OverviewData {
  if (!isRecord(input)) return emptyOverview;
  const metrics = isRecord(input.metrics) ? input.metrics : {};
  const status = isRecord(input.status) ? input.status : {};
  const latestBrief = isRecord(input.latest_brief)
    ? input.latest_brief
    : isRecord(input.latestBrief)
      ? input.latestBrief
      : {};

  return {
    metrics: {
      structuredViews: nullableNumber(
        readField(metrics, "structured_views", "structuredViews"),
      ),
      predictionEvents: nullableNumber(
        readField(metrics, "prediction_events", "predictionEvents"),
      ),
      notes: nullableNumber(metrics.notes),
      ragChunks: nullableNumber(readField(metrics, "rag_chunks", "ragChunks")),
      sourceCount: nullableNumber(
        readField(metrics, "source_count", "sourceCount"),
      ),
      generatedAt: nullableString(
        readField(metrics, "generated_at", "generatedAt"),
      ),
    },
    status: {
      lastChecked: nullableString(
        readField(status, "last_checked", "lastChecked"),
      ),
      detectedToday: nullableNumber(
        readField(status, "detected_today", "detectedToday"),
      ),
      sourceCount: nullableNumber(
        readField(status, "source_count", "sourceCount"),
      ),
      pipelineRunning: nullableBoolean(
        readField(status, "pipeline_running", "pipelineRunning"),
      ),
    },
    latestBrief: {
      filename: nullableString(latestBrief.filename),
      generatedAt: nullableString(
        readField(latestBrief, "generated_at", "generatedAt"),
      ),
      summary: nullableString(latestBrief.summary),
      sectionCount: nullableNumber(
        readField(latestBrief, "section_count", "sectionCount"),
      ),
    },
  };
}

export class ApiClient implements DataProvider {
  private async get<T>(path: string, fallback: T): Promise<T> {
    try {
      const response = await fetch(`${apiBaseUrl}${path}`);
      return response.ok ? ((await response.json()) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  async getOverview(): Promise<OverviewData> {
    const data = await this.get<unknown>("/v1/overview", null);
    return data === null ? emptyOverview : mapOverviewResponse(data);
  }

  async getArchitecture(): Promise<ArchitectureData> {
    try {
      const response = await fetch(`${apiBaseUrl}/v1/architecture`);
      return response.ok
        ? mapArchitectureResponse(await response.json())
        : emptyArchitecture;
    } catch {
      return emptyArchitecture;
    }
  }

  async getAssets(): Promise<AssetsData> {
    const data = await this.get<unknown>("/v1/assets", null);
    return data === null ? emptyAssets : mapAssetsResponse(data);
  }

  async getDecisions(): Promise<DecisionSummary> {
    const data = await this.get<unknown>("/v1/decisions", null);
    return data === null ? emptyDecisions : mapDecisionsResponse(data);
  }

  async getDiscipline(): Promise<DisciplineData> {
    const data = await this.get<unknown>("/v1/discipline", null);
    return data === null ? emptyDiscipline : mapDisciplineResponse(data);
  }

  async getMarket(): Promise<MarketData> {
    const data = await this.get<unknown>("/v1/market", null);
    return data === null ? emptyMarket : mapMarketResponse(data);
  }

  getAbout(): Promise<AboutData> {
    return this.get("/v1/about", {
      meta: { status: "pending", updatedAt: null, source: "api" },
      profile: null,
    });
  }

  async getBriefs(): Promise<BriefItem[]> {
    const data = await this.get<any>("/v1/briefs", { briefs: [] });
    return (data.briefs ?? []).flatMap((brief: any) =>
      brief.filename
        ? [{
            filename: brief.filename,
            date: brief.date ?? null,
            generatedAt: brief.generated_at ?? brief.generatedAt ?? null,
            sizeBytes: brief.size_bytes ?? brief.sizeBytes ?? null,
          }]
        : [],
    );
  }

  async getBrief(filename: string): Promise<BriefDetail | null> {
    const data = await this.get<any>(
      `/v1/briefs/${encodeURIComponent(filename)}`,
      {},
    );
    if (!data.brief?.filename || typeof data.brief.content !== "string") {
      return null;
    }

    return {
      filename: data.brief.filename,
      content: data.brief.content,
      generatedAt: data.brief.generated_at ?? data.brief.generatedAt ?? null,
    };
  }

  async getVaultSummary(): Promise<VaultSummary> {
    const data = await this.get<unknown>("/v1/vault/summary", null);
    return data === null ? emptyVaultSummary : mapVaultSummaryResponse(data);
  }

  async listNotes(params: ListNotesParams = {}): Promise<NotesListData> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("page_size", String(params.pageSize));
    if (params.query) query.set("query", params.query);
    if (params.dateFrom) query.set("date_from", params.dateFrom);
    if (params.dateTo) query.set("date_to", params.dateTo);
    if (params.tags?.length) query.set("tags", params.tags.join(","));
    if (params.source) query.set("source", params.source);
    if (params.sort) query.set("sort", params.sort);
    const qs = query.toString();
    const data = await this.get<unknown>(
      `/v1/notes${qs ? `?${qs}` : ""}`,
      null,
    );
    return data === null ? emptyNotesData : mapNotesResponse(data);
  }

  async getNoteDetail(noteId: string): Promise<VaultNoteDetail | null> {
    const data = await this.get<unknown>(
      `/v1/notes/${encodeURIComponent(noteId)}`,
      null,
    );
    if (data === null) return null;
    return mapNoteDetailResponse(data);
  }

  async getVaultAssets(): Promise<VaultAssetsIndex> {
    const data = await this.get<unknown>("/v1/vault/assets", null);
    return data === null ? emptyVaultAssets : mapVaultAssetsResponse(data);
  }

  async getAssetEvidencePack(
    assetId: string,
    horizon: string = "medium",
  ): Promise<AssetEvidencePack | null> {
    const data = await this.get<unknown>(
      `/v1/vault/assets/${encodeURIComponent(assetId)}/evidence-pack?horizon=${encodeURIComponent(horizon)}`,
      null,
    );
    if (data === null) return null;
    return mapEvidencePackResponse(data);
  }

  async getAssetViews(
    assetId: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<AssetViewsData> {
    const data = await this.get<unknown>(
      `/v1/vault/assets/${encodeURIComponent(assetId)}/views?page=${page}&page_size=${pageSize}`,
      null,
    );
    if (data === null) return { data: [], pagination: { page: 1, pageSize, total: 0, hasMore: false } };
    return {
      data: (data as any).data ?? [],
      pagination: (data as any).pagination ?? { page, pageSize, total: 0, hasMore: false },
    };
  }

  async ragQuery(params: RagQueryParams): Promise<RagData> {
    const body = {
      text: params.text,
      top_k: params.topK ?? 10,
      score_threshold: params.scoreThreshold ?? 0,
      max_days: params.maxDays ?? null,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 10,
    };
    try {
      const response = await fetch(`${apiBaseUrl}/v1/rag/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) return emptyRagData;
      return mapRagResponse(await response.json());
    } catch {
      return emptyRagData;
    }
  }

  async getRagSuggestions(): Promise<RagSuggestionItem[]> {
    const data = await this.get<unknown>("/v1/rag/suggestions", null);
    if (data === null) return [];
    const items = (data as any).suggestions ?? [];
    return items.map((item: any) => ({
      label: String(item.label ?? ""),
      query: String(item.query ?? ""),
      assetId: item.asset_id ?? item.assetId ?? null,
    }));
  }

  async openNoteLocal(noteId: string): Promise<{ opened: boolean; noteId: string }> {
    try {
      const response = await fetch(
        `${apiBaseUrl}/v1/notes/${encodeURIComponent(noteId)}/open-local`,
        { method: "POST" },
      );
      if (!response.ok) return { opened: false, noteId };
      return { opened: true, noteId };
    } catch {
      return { opened: false, noteId };
    }
  }
}