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
  goal: string;
  category?: string | null;
  gate?: ResearchGate | null;
  created_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  report_path?: string | null;
  error?: string | null;
  report?: DemoReport | null;
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

export async function submitResearch(goal: string): Promise<SubmitResearchResult> {
  try {
    const res = await fetch(`${apiBaseUrl}/v1/research/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal }),
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
