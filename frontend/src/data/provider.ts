import { runtimeMode } from "@/app/config";
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
import { ApiClient } from "./api-client";
import { SnapshotClient } from "./snapshot-client";

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
}

let provider: DataProvider | undefined;

export function getDataProvider(): DataProvider {
  if (!provider) {
    provider =
      runtimeMode === "snapshot" ? new SnapshotClient() : new ApiClient();
  }

  return provider;
}