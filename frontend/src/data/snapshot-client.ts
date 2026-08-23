import { apiBaseUrl } from "@/app/config";
import {
  AboutData,
  ArchitectureData,
  AssetsData,
  BriefDetail,
  BriefItem,
  DecisionSummary,
  DisciplineData,
  MarketData,
  OverviewData,
} from "@/types";
import {
  emptyArchitecture,
  emptyAssets,
  emptyDecisions,
  emptyDiscipline,
  emptyMarket,
  mapArchitectureResponse,
  mapAssetsResponse,
  mapDecisionsResponse,
  mapDisciplineResponse,
  mapMarketResponse,
  mapOverviewResponse,
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
}