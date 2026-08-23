export type DataMode = "live" | "snapshot";

export interface DataMeta {
  status: "pending" | "ready" | "error";
  updatedAt: string | null;
  source: DataMode | "api" | "snapshot";
}

export interface Metric {
  id: string;
  label: string;
  value: string | number | null;
  unit?: string;
  description?: string;
}

export interface PipelineStep {
  id: string;
  name: string;
  description?: string;
  status?: "planned" | "active" | "complete";
}

export interface OverviewMetrics {
  structuredViews: number | null;
  predictionEvents: number | null;
  notes: number | null;
  ragChunks: number | null;
  sourceCount: number | null;
  generatedAt: string | null;
}

export interface SystemStatus {
  lastChecked: string | null;
  detectedToday: number | null;
  sourceCount: number | null;
  pipelineRunning: boolean | null;
}

export interface LatestBrief {
  filename: string | null;
  generatedAt: string | null;
  summary: string | null;
  sectionCount: number | null;
}

export interface OverviewData {
  metrics: OverviewMetrics;
  status: SystemStatus;
  latestBrief: LatestBrief;
}

export interface BriefItem {
  filename: string;
  date: string | null;
  generatedAt: string | null;
  sizeBytes: number | null;
}

export interface BriefDetail {
  filename: string;
  content: string;
  generatedAt: string | null;
}

export interface ArchitectureNode {
  name: string;
  role: string;
  tech: string;
}

export interface ArchitectureLayer {
  layerId: string;
  layerName: string;
  layerNameEn: string;
  description: string;
  nodes: ArchitectureNode[];
}

export interface PipelineStatus {
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
}

export interface ArchitectureData {
  meta: DataMeta;
  summaryTags: string[];
  pipelineStatus: PipelineStatus;
  layers: ArchitectureLayer[];
  viewLifecycle: LifecycleStep[];
  mcpTools: McpToolItem[];
}

export interface DistItem {
  name: string;
  labelZh: string;
  value: number;
}

export interface SourceContribItem {
  name: string;
  views: number;
}

export interface AnalystRankItem {
  name: string;
  hitRate: number | null;
  samples: number | null;
}

export interface DebateCardItem {
  entity: string;
  bullish: number;
  bearish: number;
  neutral: number;
  consensus: string;
  disagreement: number | null;
  updated: string | null;
}

export interface SampleViewItem {
  analyst: string;
  date: string | null;
  stance: string;
  claim: string;
}

export interface AssetsData {
  metrics: {
    structuredViews: number | null;
    predictionEvents: number | null;
    notes: number | null;
    ragChunks: number | null;
    analysts: number | null;
    assetCards: number | null;
    generatedAt: string | null;
  };
  stanceDist: DistItem[];
  horizonDist: DistItem[];
  sourceContrib: SourceContribItem[];
  analystRank: AnalystRankItem[];
  debateCards: DebateCardItem[];
  sampleViews: SampleViewItem[];
}

export interface DecisionItem {
  decisionId: string;
  assetName: string;
  assetType: string;
  decisionDate: string | null;
  horizon: string;
  direction: string;
  conviction: number | null;
  thesis: string;
  status: string;
  reviewResult: string | null;
}

export interface AssetCardFactor {
  factorName: string;
  currentState: string;
  impactDirection: string;
  impactStrength: string;
}

export interface AssetCardItem {
  assetId: string;
  assetName: string;
  assetType: string;
  description: string;
  factors: AssetCardFactor[];
}

export interface DecisionReviewItem {
  decisionId: string;
  assetName: string;
  direction: string;
  reviewDate: string | null;
  resultLabel: string;
  outcomeReturn: number | null;
  horizonDays: number | null;
  newRuleLearned: string | null;
}

export interface DecisionStats {
  total: number;
  open: number;
  reviewed: number;
  hit: number;
  wrong: number;
  generatedAt: string | null;
}

export interface DecisionSummary {
  stats: DecisionStats;
  decisions: DecisionItem[];
  assetCards: AssetCardItem[];
  reviews: DecisionReviewItem[];
}

export interface DisciplinePrinciple {
  id: string;
  title: string;
  description: string;
}

export interface DisciplineStats {
  totalDecisions: number | null;
  open: number | null;
  reviewed: number | null;
  hit: number | null;
  wrong: number | null;
  reviewCoveragePct: number | null;
  generatedAt: string | null;
}

export interface DisciplineFrameworkRule {
  ruleId: string;
  title: string;
  description: string;
  status: string;
}

export interface DisciplineTimelineItem {
  date: string | null;
  actionType: string;
  summary: string;
  ruleIds: string[];
}

export interface DisciplineReview {
  reviewDate: string | null;
  resultLabel: string;
  outcomeReturn: number | null;
  horizonDays: number | null;
}

export interface DisciplineLogItem {
  decisionId: string;
  date: string | null;
  assetName: string;
  direction: string;
  horizon: string;
  conviction: number | null;
  thesis: string;
  keyReasons: string[];
  status: string;
  review: DisciplineReview | null;
}

export interface DisciplineData {
  meta: DataMeta;
  principles: DisciplinePrinciple[];
  stats: DisciplineStats;
  framework: DisciplineFrameworkRule[];
  timeline: DisciplineTimelineItem[];
  decisionLogs: DisciplineLogItem[];
}

export interface AboutProfile {
  name?: string;
  title?: string;
  summary?: string;
  links?: Array<{ label: string; url: string }>;
}

export interface AboutData {
  meta: DataMeta;
  profile: AboutProfile | null;
}

export interface MarketTrendPoint {
  date: string;
  price: number;
}

export interface MarketQuote {
  symbol: string;
  name: string;
  nameEn: string;
  price: number | null;
  changePct: number | null;
  trend: MarketTrendPoint[];
}

export interface ProxyAssetDecision {
  asset: string | null;
  direction: string | null;
  status: string | null;
  reviewDate: string | null;
}

export interface MarketProxyAsset extends MarketQuote {
  linkedDecision: ProxyAssetDecision | null;
}

export interface MarketData {
  meta: DataMeta;
  dataAsOf: string | null;
  source: string | null;
  usIndices: MarketQuote[];
  usStocks: MarketQuote[];
  cnIndices: MarketQuote[];
  proxyAssets: MarketProxyAsset[];
}

export interface LifecycleStep {
  step: string;
  detail: string;
}

export interface McpToolItem {
  name: string;
  input: string;
  output: string;
  purpose: string;
}