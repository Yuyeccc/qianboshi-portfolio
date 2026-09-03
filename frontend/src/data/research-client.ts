/**
 * 研究任务 API 客户端（P1-D：前端去 mock 真接）
 *
 * 与 portfolio 后端 POST/GET /api/v1/research/jobs 对接：
 *   submitResearch(goal)      -> 202 {job} | 422 {gate}（后端意图闸 fail-closed）| 网络失败
 *   fetchResearchJob(jobId)   -> 轮询 job 状态；done 时 job.report 为协议 v2 报告
 *
 * 报告结构 = 后端 research_agent 产物（顶层 goal/generatedAt/coreIssue/summary/facts/
 * opinions/crossCheck/expectations/scenarios/watchlist/evidence/_meta，_meta 已含
 * schema_valid 校验痕迹）。前端渲染结构 DemoReport 与之 1:1（除 matchKeywords），
 * 故 toViewReport 仅剥离 _meta 并对 side 枚举做防御归一。
 */
import { apiBaseUrl } from "@/app/config";
import type { DemoReport } from "./demoReport";

export type ResearchJobStatus = "queued" | "running" | "done" | "failed";

export type AgentType = "analyst" | "portfolio_risk" | "decision_review";

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  analyst: "综合研究",
  portfolio_risk: "持仓风险",
  decision_review: "决策复盘",
};

export interface ResearchGate {
  verdict: string;
  reason: string;
  category?: string | null;
  rule_version?: string;
  matched?: string | null;
}

export interface ResearchJob {
  job_id: string;
  status: ResearchJobStatus;
  agent_type?: AgentType | string | null;
  goal: string;
  category?: string | null;
  gate?: ResearchGate | null;
  created_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  report_path?: string | null;
  error?: string | null;
  report?: unknown;
}

export type SubmitResearchResult =
  | { ok: true; job: ResearchJob }
  | { ok: false; kind: "blocked"; gate: ResearchGate }
  | { ok: false; kind: "error"; message: string };

const SIDE_NORMAL: Record<string, "bull" | "bear" | "neutral"> = {
  bull: "bull",
  bullish: "bull",
  bear: "bear",
  bearish: "bear",
  neutral: "neutral",
};

/** 后端报告 -> 前端渲染结构：剥离 _meta，side 枚举防御归一（LLM 偶发 bullish/bearish） */
export function toViewReport(input: unknown): DemoReport | null {
  if (!input || typeof input !== "object") return null;
  const r = input as Record<string, unknown>;
  const pick = <T>(key: string, fallback: T): T =>
    (r[key] as T | undefined) ?? fallback;
  const arr = <T,>(key: string, fallback: T[]): T[] =>
    Array.isArray(r[key]) ? (r[key] as T[]) : fallback;
  const str = (key: string): string =>
    typeof r[key] === "string" ? (r[key] as string) : "";

  const report: DemoReport = {
    matchKeywords: [],
    goal: str("goal") || str("coreIssue"),
    generatedAt: str("generatedAt") || str("generated_at"),
    coreIssue: str("coreIssue"),
    summary: str("summary"),
    facts: arr("facts", []).map((f) => {
      const o = f as Record<string, unknown>;
      return {
        text: typeof o.text === "string" ? o.text : "",
        source: typeof o.source === "string" ? o.source : "",
        date: typeof o.date === "string" ? o.date : "",
      };
    }),
    opinions: arr("opinions", []).map((o) => {
      const item = o as Record<string, unknown>;
      return {
        text: typeof item.text === "string" ? item.text : "",
        analyst: typeof item.analyst === "string" ? item.analyst : "",
        date: typeof item.date === "string" ? item.date : "",
        side: SIDE_NORMAL[String(item.side ?? "").toLowerCase()] ?? "neutral",
      };
    }),
    crossCheck: {
      consensus: Array.isArray((r.crossCheck as any)?.consensus)
        ? ((r.crossCheck as any).consensus as string[])
        : [],
      disagreements: Array.isArray((r.crossCheck as any)?.disagreements)
        ? ((r.crossCheck as any).disagreements as string[])
        : [],
    },
    expectations: {
      pricedIn: Array.isArray((r.expectations as any)?.pricedIn)
        ? ((r.expectations as any).pricedIn as string[])
        : [],
      upsideVars: Array.isArray((r.expectations as any)?.upsideVars)
        ? ((r.expectations as any).upsideVars as string[])
        : [],
      downsideVars: Array.isArray((r.expectations as any)?.downsideVars)
        ? ((r.expectations as any).downsideVars as string[])
        : [],
    },
    scenarios: arr("scenarios", []).map((s) => {
      const item = s as Record<string, unknown>;
      const prob = Number(item.probability);
      return {
        name: typeof item.name === "string" ? item.name : "",
        condition: typeof item.condition === "string" ? item.condition : "",
        outcome: typeof item.outcome === "string" ? item.outcome : "",
        probability: Number.isFinite(prob) ? Math.min(1, Math.max(0, prob)) : 0,
        rationale: typeof item.rationale === "string" ? item.rationale : "",
        invalidation:
          typeof item.invalidation === "string" ? item.invalidation : "",
      };
    }),
    watchlist: arr("watchlist", [])
      .map((w) => {
        const o = w as Record<string, unknown>;
        return {
          text: typeof o.text === "string" ? o.text : "",
          trigger: typeof o.trigger === "string" ? o.trigger : "",
        };
      })
      .filter((w) => w.text.length > 0),
    evidence: arr("evidence", []).map((e) => {
      const o = e as Record<string, unknown>;
      return {
        id: typeof o.id === "string" ? o.id : "",
        source: typeof o.source === "string" ? o.source : "",
        date: typeof o.date === "string" ? o.date : "",
        claim: typeof o.claim === "string" ? o.claim : "",
      };
    }),
  };
  return report;
}

/** 提取 job 对象（后端统一 {job:{...}} 包裹） */
function readJob(payload: unknown): ResearchJob | null {
  if (!payload || typeof payload !== "object") return null;
  const job = (payload as { job?: unknown }).job;
  if (!job || typeof job !== "object") return null;
  return job as ResearchJob;
}

export async function submitResearch(
  goal: string,
  agentType?: AgentType | null,
): Promise<SubmitResearchResult> {
  try {
    const res = await fetch(`${apiBaseUrl}/v1/research/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal, agent_type: agentType ?? undefined }),
    });
    if (res.status === 202) {
      const job = readJob(await res.json());
      return job ? { ok: true, job } : { ok: false, kind: "error", message: "empty job payload" };
    }
    if (res.status === 422) {
      const detail = (await res.json()) as { detail?: { gate?: ResearchGate } };
      const gate = detail.detail?.gate;
      if (gate) return { ok: false, kind: "blocked", gate };
      return { ok: false, kind: "error", message: `HTTP ${res.status}` };
    }
    return { ok: false, kind: "error", message: `HTTP ${res.status}` };
  } catch (err) {
    return {
      ok: false,
      kind: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function fetchResearchJob(jobId: string): Promise<ResearchJob> {
  const res = await fetch(`${apiBaseUrl}/v1/research/jobs/${jobId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const job = readJob(await res.json());
  if (!job) throw new Error("empty job payload");
  return job;
}

export interface ResearchJobSummary {
  job_id: string;
  status: ResearchJobStatus;
  agent_type: string;
  goal: string;
  category?: string | null;
  created_at?: string | null;
  finished_at?: string | null;
  report_path?: string | null;
  error?: string | null;
}

export async function listResearchJobs(limit = 10): Promise<ResearchJobSummary[]> {
  const res = await fetch(`${apiBaseUrl}/v1/research/jobs?limit=${limit}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const payload = (await res.json()) as { jobs?: unknown };
  const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  return jobs.filter((j): j is ResearchJobSummary => !!j && typeof j === "object");
}

/* ---------- 分型：产物协议判别（analyst v2 三桶 / 31_risk / 32_review） ---------- */

export interface RiskHolding {
  code?: string | null;
  name?: string | null;
  marketCode?: string | null;
  relation?: string | null;
  shares?: number | null;
  avgCost?: number | null;
  price?: number | null;
  value?: number | null;
  valueNote?: string | null;
  weightPct?: number | null;
}

export interface RiskReport {
  goal?: string;
  entity?: string | null;
  generatedAt?: string | null;
  summary?: string | null;
  holdingsExposure?: {
    total?: number | null;
    exposed?: RiskHolding[];
    portfolio?: {
      totalAssets?: number | null;
      onMarketValue?: number | null;
      cashAvailable?: number | null;
      positionPct?: number | null;
      asOf?: string | null;
    } | null;
  } | null;
  riskPoints?: Array<{
    risk?: string;
    severity?: "high" | "medium" | "low" | string;
    rationale?: string;
    watch?: string | null;
  }>;
  analysisNote?: string | null;
  watchlist?: Array<{ text?: string; trigger?: string | null }>;
  compliance?: { passed?: boolean; note?: string | null } | null;
  _meta?: Record<string, unknown>;
}

/** 判别：31_risk 产物（持仓风险 agent） */
export function isRiskReport(input: unknown): input is RiskReport {
  if (!input || typeof input !== "object") return false;
  const r = input as Record<string, unknown>;
  return "holdingsExposure" in r || "riskPoints" in r || "compliance" in r;
}

/** 判别：32_review 产物（决策复盘 agent） */
export function isReviewReport(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const r = input as Record<string, unknown>;
  return "reviewStatus" in r || "decisionId" in r || "lessons" in r;
}

/** 报告协议分型 → 渲染组件选择（供页面/历史列表共用） */
export function reportKind(
  input: unknown,
  agentType?: string | null,
): "analyst" | "risk" | "review" | "unknown" {
  if (isReviewReport(input)) return "review";
  if (isRiskReport(input)) return "risk";
  if (agentType === "portfolio_risk" || agentType === "decision_review") {
    // job 类型标记但产物非标准协议（LLM 降级/异常）→ 按标记渲染，组件内兜底
    return agentType === "portfolio_risk" ? "risk" : "review";
  }
  return "analyst";
}
