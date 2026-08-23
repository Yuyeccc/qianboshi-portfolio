import { runtimeMode } from "@/app/config";
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
  MarketData,
  NotesListData,
  RagData,
  RagSuggestionItem,
  VaultAssetsIndex,
  VaultNoteDetail,
  VaultSummary,
} from "@/types";
import { ApiClient } from "./api-client";
import { SnapshotClient } from "./snapshot-client";

export interface ListNotesParams {
  page?: number;
  pageSize?: number;
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  source?: string;
  sort?: "date_desc" | "date_asc" | "title";
}

export interface RagQueryParams {
  text: string;
  topK?: number;
  scoreThreshold?: number;
  maxDays?: number | null;
  page?: number;
  pageSize?: number;
}

export interface DataProvider {
  getOverview(): Promise<OverviewData>;
  getArchitecture(): Promise<ArchitectureData>;
  getAssets(): Promise<AssetsData>;
  getDecisions(): Promise<DecisionSummary>;
  getDiscipline(): Promise<DisciplineData>;
  getMarket(): Promise<MarketData>;
  getAbout(): Promise<AboutData>;
  getBriefs(): Promise<BriefItem[]>;
  getBrief(filename: string): Promise<BriefDetail | null>;

  getVaultSummary(): Promise<VaultSummary>;
  listNotes(params?: ListNotesParams): Promise<NotesListData>;
  getNoteDetail(noteId: string): Promise<VaultNoteDetail | null>;
  getVaultAssets(): Promise<VaultAssetsIndex>;
  getAssetEvidencePack(
    assetId: string,
    horizon?: string,
  ): Promise<AssetEvidencePack>;
  getAssetViews(
    assetId: string,
    page?: number,
    pageSize?: number,
  ): Promise<AssetViewsData>;
  ragQuery(params: RagQueryParams): Promise<RagData>;
  getRagSuggestions(): Promise<RagSuggestionItem[]>;
  openNoteLocal(noteId: string): Promise<{ opened: boolean; noteId: string }>;
}

const emptyMeta = (source: "api" | "snapshot"): VaultSummary["meta"] => ({
  status: "ready",
  updatedAt: null,
  source,
});

export const emptyVaultSummary = (source: "api" | "snapshot"): VaultSummary => ({
  meta: emptyMeta(source),
  notesCount: null,
  viewsCount: null,
  chunksCount: null,
  assetsCount: null,
  latestNoteDate: null,
  modes: ["notes", "search", "assets"],
});

export const emptyNotesData: NotesListData = {
  data: [],
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: false,
  },
};

export const emptyEvidencePack = (assetId: string): AssetEvidencePack => ({
  assetId,
  assetName: assetId,
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
});

export const emptyRagData: RagData = {
  data: [],
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    hasMore: false,
  },
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object"
    ? (value as UnknownRecord)
    : {};
}

function value<T>(source: UnknownRecord, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (source[key] !== undefined) {
      return source[key] as T;
    }
  }
  return undefined;
}

function mapPagination(input: unknown, fallbackPage = 1, fallbackPageSize = 20): {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
} {
  const data = record(input);
  return {
    page: Number(value(data, "page") ?? fallbackPage),
    pageSize: Number(value(data, "page_size", "pageSize") ?? fallbackPageSize),
    total: Number(value(data, "total") ?? 0),
    hasMore: Boolean(value(data, "has_more", "hasMore") ?? false),
  };
}

function mapNoteItem(input: unknown) {
  const item = record(input);
  return {
    noteId: String(value(item, "note_id", "noteId") ?? ""),
    filename: String(value(item, "filename") ?? ""),
    title: String(value(item, "title") ?? ""),
    noteDate: value<string | null>(item, "note_date", "noteDate") ?? null,
    createdAt: value<string | null>(item, "created_at", "createdAt") ?? null,
    tags: Array.isArray(value(item, "tags")) ? (value(item, "tags") as string[]) : [],
    source: value<string | null>(item, "source") ?? null,
    excerpt: String(value(item, "excerpt") ?? ""),
    structuredViewCount:
      value<number | null>(item, "structured_view_count", "structuredViewCount") ??
      null,
    sizeBytes: value<number | null>(item, "size_bytes", "sizeBytes") ?? null,
  };
}

export function mapVaultSummaryResponse(
  response: unknown,
  source: "api" | "snapshot",
): VaultSummary {
  const root = record(response);
  const input = record(root.vault_summary ?? root.vaultSummary ?? root);
  return {
    meta: {
      status: "ready",
      updatedAt:
        value<string | null>(input, "updated_at", "updatedAt") ?? null,
      source,
    },
    notesCount: value<number | null>(input, "notes_count", "notesCount") ?? null,
    viewsCount: value<number | null>(input, "views_count", "viewsCount") ?? null,
    chunksCount:
      value<number | null>(input, "chunks_count", "chunksCount") ?? null,
    assetsCount:
      value<number | null>(input, "assets_count", "assetsCount") ?? null,
    latestNoteDate:
      value<string | null>(input, "latest_note_date", "latestNoteDate") ?? null,
    modes: Array.isArray(value(input, "modes"))
      ? (value(input, "modes") as string[])
      : ["notes", "search", "assets"],
  };
}

export function mapNotesResponse(response: unknown): NotesListData {
  const root = record(response);
  const input = record(root.notes_data ?? root.notesData ?? root);
  const items = Array.isArray(input.data) ? input.data.map(mapNoteItem) : [];
  return {
    data: items,
    pagination: mapPagination(input.pagination),
  };
}

export function mapNoteDetailResponse(response: unknown): VaultNoteDetail | null {
  const root = record(response);
  const input = record(root.note ?? root);
  if (!input.filename && !input.note_id && !input.noteId) {
    return null;
  }

  const relatedViews = Array.isArray(input.related_views ?? input.relatedViews)
    ? (input.related_views ?? input.relatedViews) as unknown[]
    : [];

  return {
    ...mapNoteItem(input),
    content: String(value(input, "content") ?? ""),
    relatedViews: relatedViews.map((view) => {
      const item = record(view);
      return {
        viewId: String(value(item, "view_id", "viewId") ?? ""),
        analyst: String(value(item, "analyst") ?? ""),
        claim: String(value(item, "claim") ?? ""),
        date: value<string | null>(item, "date") ?? null,
        stance: String(value(item, "stance") ?? ""),
        confidence: value<number | null>(item, "confidence") ?? null,
        section: value<string | null>(item, "section") ?? null,
        evidence: String(value(item, "evidence") ?? ""),
      };
    }),
  };
}

export function mapEvidencePackResponse(response: unknown): AssetEvidencePack {
  const root = record(response);
  const input = record(root.evidence_pack ?? root.evidencePack ?? root);
  return {
    ...input,
    assetId: String(value(input, "asset_id", "assetId") ?? ""),
    assetName: String(value(input, "asset_name", "assetName") ?? ""),
    asOfDate: value<string | null>(input, "as_of_date", "asOfDate") ?? null,
    assetCard: (value(input, "asset_card", "assetCard") as Record<string, unknown>) ?? null,
    factorStates: (value(input, "factor_states", "factorStates") as Record<string, unknown>[]) ?? [],
    debateCard: (value(input, "debate_card", "debateCard") as Record<string, unknown>) ?? null,
    latestViews: (value(input, "latest_views", "latestViews") as Record<string, unknown>[]) ?? [],
    analystScores: (value(input, "analyst_scores", "analystScores") as Record<string, unknown>[]) ?? [],
    marketSnapshot:
      (value(input, "market_snapshot", "marketSnapshot") as Record<string, unknown>) ?? null,
    userDecisionHistory:
      (value(input, "user_decision_history", "userDecisionHistory") as Record<string, unknown>[]) ?? [],
    ragEvidence:
      (value(input, "rag_evidence", "ragEvidence") as Record<string, unknown>[]) ?? [],
    summary: value<string | null>(input, "summary") ?? null,
  };
}

export function mapRagResponse(response: unknown): RagData {
  const root = record(response);
  const input = record(root.rag_data ?? root.ragData ?? root);
  const items = Array.isArray(input.data) ? input.data : [];
  return {
    data: items.map((hit, index) => {
      const item = record(hit);
      return {
        rank: Number(value(item, "rank") ?? index + 1),
        content: String(value(item, "content") ?? ""),
        source: String(value(item, "source") ?? ""),
        section: value<string | null>(item, "section") ?? null,
        score: Number(value(item, "score") ?? 0),
        rawScore: Number(value(item, "raw_score", "rawScore") ?? 0),
        type: String(value(item, "type") ?? ""),
      };
    }),
    pagination: mapPagination(input.pagination, 1, 10),
    degraded: Boolean(value(input, "degraded") ?? false),
    reason: value<string>(input, "reason"),
    snapshotLimited: Boolean(
      value(input, "snapshot_limited", "snapshotLimited") ?? false,
    ),
  };
}

export function mapAssetsIndexResponse(response: unknown): VaultAssetsIndex {
  const root = record(response);
  const input = record(root.assets_index ?? root.assetsIndex ?? root);
  const items = Array.isArray(input.data) ? input.data : [];
  return {
    data: items.map((asset) => {
      const item = record(asset);
      return {
        assetId: String(value(item, "asset_id", "assetId") ?? ""),
        assetName: String(value(item, "asset_name", "assetName") ?? ""),
        assetType: String(value(item, "asset_type", "assetType") ?? ""),
        description: String(value(item, "description") ?? ""),
        factors: Array.isArray(value(item, "factors"))
          ? (value(item, "factors") as AssetCardItem["factors"])
          : [],
        factorCount: Number(value(item, "factor_count", "factorCount") ?? 0),
        bullishCount: Number(value(item, "bullish_count", "bullishCount") ?? 0),
        bearishCount: Number(value(item, "bearish_count", "bearishCount") ?? 0),
        neutralCount: Number(value(item, "neutral_count", "neutralCount") ?? 0),
        consensusDirection:
          value<string | null>(
            item,
            "consensus_direction",
            "consensusDirection",
          ) ?? null,
        disagreementLevel:
          value<number | null>(
            item,
            "disagreement_level",
            "disagreementLevel",
          ) ?? null,
      };
    }),
    generatedAt: value<string | null>(input, "generated_at", "generatedAt") ?? null,
  };
}

interface VaultClientMethods {
  getVaultSummary?: () => Promise<unknown>;
  listNotes?: (params?: ListNotesParams) => Promise<unknown>;
  getNoteDetail?: (noteId: string) => Promise<unknown>;
  getVaultAssets?: () => Promise<unknown>;
  getAssetEvidencePack?: (assetId: string, horizon?: string) => Promise<unknown>;
  getAssetViews?: (
    assetId: string,
    page?: number,
    pageSize?: number,
  ) => Promise<unknown>;
  ragQuery?: (params: RagQueryParams) => Promise<unknown>;
  getRagSuggestions?: () => Promise<unknown>;
  openNoteLocal?: (
    noteId: string,
  ) => Promise<{ opened: boolean; note_id?: string; noteId?: string }>;
}

function vaultMethods(client: ApiClient | SnapshotClient): VaultClientMethods {
  return client as unknown as VaultClientMethods;
}

class ExtendedDataProvider implements DataProvider {
  constructor(
    private readonly client: ApiClient | SnapshotClient,
    private readonly source: "api" | "snapshot",
  ) {}

  getOverview() {
    return this.client.getOverview();
  }

  getArchitecture() {
    return this.client.getArchitecture();
  }

  getAssets() {
    return this.client.getAssets();
  }

  getDecisions() {
    return this.client.getDecisions();
  }

  getDiscipline() {
    return this.client.getDiscipline();
  }

  getMarket() {
    return this.client.getMarket();
  }

  getAbout() {
    return this.client.getAbout();
  }

  getBriefs() {
    return this.client.getBriefs();
  }

  getBrief(filename: string) {
    return this.client.getBrief(filename);
  }

  getVaultSummary(): Promise<VaultSummary> {
    return this.client.getVaultSummary();
  }

  listNotes(params: ListNotesParams = {}): Promise<NotesListData> {
    return this.client.listNotes(params);
  }

  getNoteDetail(noteId: string): Promise<VaultNoteDetail | null> {
    return this.client.getNoteDetail(noteId);
  }

  getVaultAssets(): Promise<VaultAssetsIndex> {
    return this.client.getVaultAssets();
  }

  async getAssetEvidencePack(
    assetId: string,
    horizon = "medium",
  ): Promise<AssetEvidencePack> {
    return this.client.getAssetEvidencePack(assetId, horizon);
  }

  getAssetViews(
    assetId: string,
    page = 1,
    pageSize = 20,
  ): Promise<AssetViewsData> {
    return this.client.getAssetViews(assetId, page, pageSize);
  }

  ragQuery(params: RagQueryParams): Promise<RagData> {
    return this.client.ragQuery(params);
  }

  getRagSuggestions(): Promise<RagSuggestionItem[]> {
    return this.client.getRagSuggestions();
  }

  openNoteLocal(noteId: string): Promise<{ opened: boolean; noteId: string }> {
    return this.client.openNoteLocal(noteId);
  }
}

let provider: DataProvider | undefined;

export function getDataProvider(): DataProvider {
  if (!provider) {
    const client =
      runtimeMode === "snapshot" ? new SnapshotClient() : new ApiClient();
    provider = new ExtendedDataProvider(
      client,
      runtimeMode === "snapshot" ? "snapshot" : "api",
    );
  }

  return provider;
}