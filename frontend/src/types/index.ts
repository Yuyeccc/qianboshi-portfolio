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

export interface VaultNoteItem {
  noteId: string;
  filename: string;
  title: string;
  noteDate: string | null;
  createdAt: string | null;
  tags: string[];
  source: string | null;
  excerpt: string;
  structuredViewCount: number | null;
  sizeBytes: number | null;
}

export interface RelatedViewItem {
  viewId: string;
  analyst: string;
  claim: string;
  date: string | null;
  stance: string;
  confidence: number | null;
  section: string | null;
  evidence: string;
}

export interface VaultNoteDetail extends VaultNoteItem {
  content: string;
  relatedViews: RelatedViewItem[];
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface VaultSummary {
  meta: DataMeta;
  notesCount: number | null;
  viewsCount: number | null;
  chunksCount: number | null;
  assetsCount: number | null;
  latestNoteDate: string | null;
  modes: string[];
}

export interface RagHitItem {
  rank: number;
  content: string;
  source: string;
  section: string | null;
  score: number;
  rawScore: number;
  type: string;
}

export interface RagSuggestionItem {
  label: string;
  query: string;
  assetId?: string | null;
}

export interface NotesListData {
  data: VaultNoteItem[];
  pagination: Pagination;
}

export interface RagData {
  data: RagHitItem[];
  pagination: Pagination;
  degraded?: boolean;
  reason?: string;
  snapshotLimited?: boolean;
}

export interface VaultAssetIndexItem extends AssetCardItem {
  factorCount: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  consensusDirection: string | null;
  disagreementLevel: number | null;
}

export interface VaultAssetsIndex {
  data: VaultAssetIndexItem[];
  generatedAt?: string | null;
}

export interface AssetEvidencePack {
  assetId: string;
  assetName: string;
  asOfDate: string | null;
  assetCard: Record<string, unknown> | null;
  factorStates: Record<string, unknown>[];
  debateCard: Record<string, unknown> | null;
  latestViews: Record<string, unknown>[];
  analystScores: Record<string, unknown>[];
  marketSnapshot: Record<string, unknown> | null;
  userDecisionHistory: Record<string, unknown>[];
  ragEvidence: Record<string, unknown>[];
  summary: string | null;
  [key: string]: unknown;
}

export interface AssetViewsData {
  data: Record<string, unknown>[];
  pagination: Pagination;
}

export interface CognitiveData {
  meta: { generatedAt: string | null; source: string | null; version: string | null };
  blueprint: { completed: number | null; total: number | null; status: string | null };
  facts: Record<string, { value: unknown; unit?: string; source?: string }>;
  dimensions: Record<string, unknown>;
  conflicts: { available: boolean; exact: number; divergences: number; mappedViews: number; summary: Array<Record<string, unknown>> };
  backtest: { available: boolean; runId: string | null; rows: Record<string, { windowDays?: number; layer?: string; total?: number; hits?: number; hitRate?: number }> };
  decisions: { available: boolean; decisionLogs: number; reviews: number; assetCards: number; predictionEvents: number };
}
