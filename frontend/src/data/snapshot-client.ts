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
  MarketData,
  NotesListData,
  RagData,
  RagSuggestionItem,
  VaultAssetsIndex,
  VaultNoteDetail,
  VaultSummary,
  OverviewData,
} from "@/types";
import {
  emptyArchitecture,
  emptyAssets,
  emptyDecisions,
  emptyDiscipline,
  emptyEvidencePack,
  emptyMarket,
  emptyNotesData,
  emptyRagData,
  emptyVaultSummary,
  mapArchitectureResponse,
  mapAssetsIndexResponse,
  mapAssetsResponse,
  mapDecisionsResponse,
  mapDisciplineResponse,
  mapEvidencePackResponse,
  mapMarketResponse,
  mapNoteDetailResponse,
  mapNotesResponse,
  mapOverviewResponse,
  mapRagResponse,
  mapVaultSummaryResponse,
} from "./api-client";
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

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberOrZero(value: unknown): number {
  return nullableNumber(value) ?? 0;
}

function recordArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function mapPagination(value: unknown, fallbackPage = 1, fallbackPageSize = 20) {
  const pagination = isRecord(value) ? value : {};

  return {
    page: numberOrZero(
      readField(pagination, "page", "page") ?? fallbackPage,
    ) || fallbackPage,
    pageSize:
      numberOrZero(
        readField(pagination, "page_size", "pageSize") ?? fallbackPageSize,
      ) || fallbackPageSize,
    total: numberOrZero(pagination.total),
    hasMore:
      typeof readField(pagination, "has_more", "hasMore") === "boolean"
        ? Boolean(readField(pagination, "has_more", "hasMore"))
        : false,
  };
}

function mapSuggestions(input: unknown): RagSuggestionItem[] {
  const payload = isRecord(input)
    ? Array.isArray(input.suggestions)
      ? input.suggestions
      : input
    : [];

  return (Array.isArray(payload) ? payload : []).flatMap((item) => {
    if (typeof item === "string") {
      return [{ label: item, query: item, assetId: null }];
    }

    if (!isRecord(item)) return [];

    const query = stringOrEmpty(item.query || item.text || item.label);
    if (!query) return [];

    return [
      {
        label: stringOrEmpty(item.label || query),
        query,
        assetId: nullableString(readField(item, "asset_id", "assetId")),
      },
    ];
  });
}

function mapAssetViewsResponse(
  input: unknown,
  fallbackPage = 1,
  fallbackPageSize = 20,
): AssetViewsData {
  if (!isRecord(input)) {
    return {
      data: [],
      pagination: {
        page: fallbackPage,
        pageSize: fallbackPageSize,
        total: 0,
        hasMore: false,
      },
    };
  }

  const payload = isRecord(input.views_data)
    ? input.views_data
    : isRecord(input.viewsData)
      ? input.viewsData
      : input;

  return {
    data: recordArray(payload.data ?? payload.views),
    pagination: mapPagination(
      payload.pagination,
      fallbackPage,
      fallbackPageSize,
    ),
  };
}

export class SnapshotClient implements DataProvider {
  private async read<T>(filename: string, fallback: T): Promise<T> {
    try {
      const url = filename.startsWith("/")
        ? filename
        : `${apiBaseUrl}/${filename}`;
      const response = await fetch(url);
      return response.ok ? ((await response.json()) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  async getOverview(): Promise<OverviewData> {
    const data = await this.read<unknown>("overview.json", null);
    return data === null ? emptyOverview : mapOverviewResponse(data);
  }

  async getArchitecture(): Promise<ArchitectureData> {
    const data = await this.read<unknown>("architecture.json", null);
    return data === null ? emptyArchitecture : mapArchitectureResponse(data);
  }

  async getAssets(): Promise<AssetsData> {
    const data = await this.read<unknown>("data-assets.json", null);
    return data === null ? emptyAssets : mapAssetsResponse(data);
  }

  async getDecisions(): Promise<DecisionSummary> {
    const data = await this.read<unknown>("decision-desk.json", null);
    return data === null ? emptyDecisions : mapDecisionsResponse(data);
  }

  async getDiscipline(): Promise<DisciplineData> {
    const data = await this.read<unknown>("discipline.json", null);
    return data === null ? emptyDiscipline : mapDisciplineResponse(data);
  }

  async getMarket(): Promise<MarketData> {
    const data = await this.read<unknown>("market.json", null);
    return data === null ? emptyMarket : mapMarketResponse(data);
  }

  getAbout(): Promise<AboutData> {
    return this.read("about.json", {
      meta: { status: "pending", updatedAt: null, source: "snapshot" },
      profile: null,
    });
  }

  async getBriefs(): Promise<BriefItem[]> {
    const data = await this.read<any>("briefs.json", { briefs: [] });

    return (data.briefs ?? []).flatMap((brief: any) =>
      brief.filename
        ? [
            {
              filename: brief.filename,
              date: brief.date ?? null,
              generatedAt: brief.generated_at ?? brief.generatedAt ?? null,
              sizeBytes: brief.size_bytes ?? brief.sizeBytes ?? null,
            },
          ]
        : [],
    );
  }

  async getBrief(filename: string): Promise<BriefDetail | null> {
    const data = await this.read<any>("briefs.json", { briefs: [] });
    const brief = (data.briefs ?? []).find(
      (item: any) => item.filename === filename,
    );

    if (!brief?.filename || typeof brief.content !== "string") {
      return null;
    }

    return {
      filename: brief.filename,
      content: brief.content,
      generatedAt: brief.generated_at ?? brief.generatedAt ?? null,
    };
  }

  async getVaultSummary(): Promise<VaultSummary> {
    const data = await this.read<unknown>("vault-summary.json", null);
    return data === null ? emptyVaultSummary : mapVaultSummaryResponse(data);
  }

  async listNotes(params: any = {}): Promise<NotesListData> {
    const page =
      typeof params.page === "number" && params.page > 0 ? params.page : 1;
    const pageSize =
      typeof params.pageSize === "number" && params.pageSize > 0
        ? params.pageSize
        : 20;

    const pageData = await this.read<unknown>(
      `notes/index-page-${page}.json`,
      null,
    );

    if (pageData !== null) {
      return mapNotesResponse(pageData);
    }

    const fullIndex = await this.read<unknown>("notes-index.json", null);
    if (fullIndex === null) return emptyNotesData;

    const mapped = mapNotesResponse(fullIndex);
    const query = stringOrEmpty(params.query).trim().toLowerCase();
    const dateFrom = stringOrEmpty(params.dateFrom);
    const dateTo = stringOrEmpty(params.dateTo);
    const source = stringOrEmpty(params.source).trim().toLowerCase();
    const tags = Array.isArray(params.tags)
      ? params.tags.filter((tag: unknown): tag is string => typeof tag === "string")
      : [];

    let notes = mapped.data.filter((note) => {
      const matchesQuery =
        !query ||
        `${note.title} ${note.excerpt} ${note.filename}`
          .toLowerCase()
          .includes(query);
      const matchesDateFrom = !dateFrom || (note.noteDate ?? "") >= dateFrom;
      const matchesDateTo = !dateTo || (note.noteDate ?? "") <= dateTo;
      const matchesTags =
        tags.length === 0 || tags.some((tag) => note.tags.includes(tag));
      const matchesSource =
        !source || (note.source ?? "").toLowerCase().includes(source);

      return (
        matchesQuery &&
        matchesDateFrom &&
        matchesDateTo &&
        matchesTags &&
        matchesSource
      );
    });

    const sort = stringOrEmpty(params.sort) || "date_desc";
    notes = [...notes].sort((left, right) => {
      if (sort === "title") return left.title.localeCompare(right.title);
      if (sort === "date_asc") {
        return (left.noteDate ?? "").localeCompare(right.noteDate ?? "");
      }
      return (right.noteDate ?? "").localeCompare(left.noteDate ?? "");
    });

    const start = (page - 1) * pageSize;
    const data = notes.slice(start, start + pageSize);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total: notes.length,
        hasMore: start + pageSize < notes.length,
      },
    };
  }

  async getNoteDetail(noteId: string): Promise<VaultNoteDetail | null> {
    const data = await this.read<unknown>(
      `notes/${encodeURIComponent(noteId)}.json`,
      null,
    );

    return data === null ? null : mapNoteDetailResponse(data);
  }

  async getVaultAssets(): Promise<VaultAssetsIndex> {
    const data = await this.read<unknown>("assets-index.json", null);
    return data === null ? { ...mapAssetsIndexResponse(null) } : mapAssetsIndexResponse(data);
  }

  async getAssetEvidencePack(
    assetId: string,
    horizon = "medium",
  ): Promise<AssetEvidencePack> {
    const data = await this.read<unknown>(
      `assets/${encodeURIComponent(assetId)}/evidence-pack-${encodeURIComponent(horizon)}.json`,
      null,
    );

    return data === null ? emptyEvidencePack : mapEvidencePackResponse(data);
  }

  async getAssetViews(
    assetId: string,
    page = 1,
  ): Promise<AssetViewsData> {
    const data = await this.read<unknown>(
      `assets/${encodeURIComponent(assetId)}/views-page-${page}.json`,
      null,
    );

    return data === null ? mapAssetViewsResponse(null, page) : mapAssetViewsResponse(data, page);
  }

  async getRagSuggestions(): Promise<RagSuggestionItem[]> {
    const data = await this.read<unknown>("rag/suggestions.json", null);
    return data === null ? [] : mapSuggestions(data);
  }

  async ragQuery(params: any = {}): Promise<RagData> {
    const text = stringOrEmpty(params.text).trim();
    if (!text) {
      return {
        ...emptyRagData,
        snapshotLimited: true,
      };
    }

    const suggestions = await this.getRagSuggestions();
    const suggestion = suggestions.find(
      (item) =>
        item.query.toLowerCase() === text.toLowerCase() ||
        item.label.toLowerCase() === text.toLowerCase(),
    );

    if (!suggestion) {
      return {
        ...emptyRagData,
        snapshotLimited: true,
        reason: "snapshot_limited",
      };
    }

    const presetId =
      suggestion.assetId ||
      suggestion.query
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "");

    const data = await this.read<unknown>(
      `rag/presets/${encodeURIComponent(presetId)}.json`,
      null,
    );

    if (data === null) {
      return {
        ...emptyRagData,
        snapshotLimited: true,
        reason: "snapshot_limited",
      };
    }

    const mapped = mapRagResponse(data);
    return {
      ...mapped,
      snapshotLimited: true,
    };
  }

  async openNoteLocal(_noteId: string): Promise<boolean> {
    return false;
  }
}