import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ExternalLink,
  History,
  Info,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { classifyQuestion, type ScreeningResult } from "@/utils/agentScreening";
import { matchDemoReport } from "@/data/demoReport";
import {
  fetchResearchJob,
  listResearchJobs,
  reportKind,
  submitResearch,
  toViewReport,
  type AgentType,
  type ResearchJob,
  type ResearchJobSummary,
  type RiskReport,
} from "@/data/research-client";
import CategoryCards from "@/components/agent/CategoryCards";
import StageStepper, { STAGES } from "@/components/agent/StageStepper";
import ReportView from "@/components/agent/ReportView";
import RiskReportView from "@/components/agent/RiskReportView";

type Phase =
  | "idle"
  | "screening"
  | "blocked"
  | "clarify"
  | "researching"
  | "done"
  | "failed";

/** 报告渲染分型（与产物协议一一对应） */
type RenderKind = "analyst" | "risk" | "review" | "none";

const AGENT_CHOICES: Array<{ value: AgentType; labelKey: string; descKey: string }> = [
  { value: "analyst", labelKey: "agent.agentType.analyst", descKey: "agent.agentType.analystDesc" },
  {
    value: "portfolio_risk",
    labelKey: "agent.agentType.portfolioRisk",
    descKey: "agent.agentType.portfolioRiskDesc",
  },
];

const STATUS_I18N: Record<string, string> = {
  queued: "agent.history.statusQueued",
  running: "agent.history.statusRunning",
  done: "agent.history.statusDone",
  failed: "agent.history.statusFailed",
};

const AGENT_BADGE_I18N: Record<string, string> = {
  analyst: "agent.agentType.analyst",
  portfolio_risk: "agent.agentType.portfolioRisk",
  decision_review: "agent.agentType.decisionReview",
};

const STATUS_DOT: Record<string, string> = {
  queued: "bg-muted",
  running: "bg-warning animate-pulse",
  done: "bg-market-positive",
  failed: "bg-market-negative",
};

function fmtTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const BLOCK_I18N: Record<string, string> = {
  hard_advice: "agent.block.hardAdvice",
  offtopic: "agent.block.offtopic",
  too_long: "agent.block.tooLong",
  unrecognized: "agent.block.unrecognized",
};
const CLARIFY_I18N: Record<string, string> = {
  empty: "agent.clarify.empty",
  no_entity: "agent.clarify.noEntity",
  no_intent: "agent.clarify.noIntent",
  unrecognized: "agent.clarify.unrecognized",
};

const POLL_MS = 8000;
const POLL_MAX = 75; // 10 分钟上限

export default function AgentResearchPage() {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [agentType, setAgentType] = useState<AgentType>("analyst");
  const [phase, setPhase] = useState<Phase>("idle");
  const [verdict, setVerdict] = useState<ScreeningResult | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [isDemo, setIsDemo] = useState(false); // 无后端时降级演示流
  const [runError, setRunError] = useState<string | null>(null);
  const [job, setJob] = useState<ResearchJob | null>(null);
  const [viewReport, setViewReport] = useState<ReturnType<typeof toViewReport>>(null);
  const [riskReport, setRiskReport] = useState<RiskReport | null>(null);
  const [rawReport, setRawReport] = useState<unknown>(null); // review 等未专配协议的兜底展示
  const [renderKind, setRenderKind] = useState<RenderKind>("none");
  const [history, setHistory] = useState<ResearchJobSummary[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const timersRef = useRef<number[]>([]);
  const pollRef = useRef<number | null>(null);
  const pollCountRef = useRef(0);
  const reportSectionRef = useRef<HTMLElement | null>(null);

  /** 拉取最近任务历史（失败静默降级：区块隐藏，不阻断主流程） */
  async function loadHistory() {
    try {
      const items = await listResearchJobs(10);
      setHistory(items);
      setHistoryError(null);
    } catch {
      setHistoryError("unavailable");
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  useEffect(
    () => () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
    },
    [],
  );

  const locked = phase === "screening" || phase === "researching";

  function clearPolls() {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollCountRef.current = 0;
  }

  function reset() {
    clearPolls();
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    setVerdict(null);
    setStageIndex(0);
    setJob(null);
    setViewReport(null);
    setRiskReport(null);
    setRawReport(null);
    setRenderKind("none");
    setRunError(null);
    setIsDemo(false);
    setPhase("idle");
  }

  /** 报告就绪：按产物协议分型填充渲染态（提交轮询/历史回看共用） */
  function openReport(reportRaw: unknown, agentTypeOfJob: string | null | undefined, jobId: string) {
    const kind = reportKind(reportRaw, agentTypeOfJob);
    if (kind === "risk") {
      setRiskReport(reportRaw as RiskReport);
      setViewReport(null);
      setRawReport(null);
      setRenderKind("risk");
    } else if (kind === "review") {
      setRawReport(reportRaw);
      setViewReport(null);
      setRiskReport(null);
      setRenderKind("review");
    } else {
      const view = toViewReport(reportRaw);
      if (!view) {
        setRunError("report payload invalid");
        setPhase("failed");
        return;
      }
      setViewReport(view);
      setRiskReport(null);
      setRawReport(null);
      setRenderKind("analyst");
    }
    void jobId; // 渲染态已含报告全文，jobId 仅留作扩展
    setStageIndex(STAGES.length - 1);
    setPhase("done");
    window.setTimeout(() => reportSectionRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  }

  /** 无后端/提交失败 -> 演示降级流（仅 analyst；持仓风险不做假数据演示） */
  function startDemoFlow(q: string) {
    if (agentType !== "analyst") {
      setRunError(t("agent.noDemoForRisk"));
      setPhase("failed");
      return;
    }
    setIsDemo(true);
    setPhase("screening");
    timersRef.current.push(
      window.setTimeout(() => {
        setPhase("researching");
        setStageIndex(2); // 计划中
        let i = 2;
        const iv = window.setInterval(() => {
          i += 1;
          setStageIndex(i);
          if (i >= STAGES.length - 1) {
            window.clearInterval(iv);
            setPhase("done");
          }
        }, 900);
        timersRef.current.push(iv);
      }, 1000),
    );
  }

  function applyGate(verdictKey: string, reason: string) {
    setVerdict({ verdict: verdictKey as ScreeningResult["verdict"], reason });
    setPhase(verdictKey === "block" ? "blocked" : "clarify");
  }

  /** 轮询研究任务状态 */
  function startPolling(q: string, jobId: string) {
    setJob({ job_id: jobId, status: "queued", goal: q });
    setPhase("researching");
    setStageIndex(1); // 安检已过
    pollRef.current = window.setInterval(async () => {
      pollCountRef.current += 1;
      try {
        const latest = await fetchResearchJob(jobId);
        setJob(latest);
        if (latest.status === "done") {
          clearPolls();
          if (latest.report) {
            openReport(latest.report, latest.agent_type, jobId);
          } else {
            setRunError("report payload invalid");
            setPhase("failed");
          }
          return;
        }
        if (latest.status === "failed") {
          clearPolls();
          setRunError(latest.error || "unknown error");
          setPhase("failed");
          return;
        }
        // queued/running：阶段随轮询缓慢推进（cap 在 judging）
        setStageIndex((prev) => (prev < STAGES.length - 2 ? prev + 1 : prev));
      } catch {
        // 网络闪断：忽略继续轮询；超时上限转失败
        if (pollCountRef.current >= POLL_MAX) {
          clearPolls();
          setRunError("poll timeout");
          setPhase("failed");
        }
      }
    }, POLL_MS);
  }

  async function submit() {
    const q = input.trim();
    const result = classifyQuestion(q);
    setVerdict(result);
    if (result.verdict === "block") {
      setPhase("blocked");
      return;
    }
    if (result.verdict === "clarify") {
      setPhase("clarify");
      return;
    }
    // pass：前端安检通过 -> 后端第二道闸 + 真实研究任务
    setPhase("screening");
    const res = await submitResearch(q, agentType);
    if (!res.ok) {
      if (res.kind === "blocked") {
        // 后端规则拦截（fail-closed 兜底，正常与前端同版本不触发）
        applyGate(res.gate.verdict, res.gate.reason);
        return;
      }
      // 网络/后端不可达 -> 演示降级
      startDemoFlow(q);
      return;
    }
    startPolling(q, res.job.job_id);
  }

  /** 历史任务回看：拉完整 job（含 report 全文）并按产物协议渲染 */
  async function openHistoryJob(summary: ResearchJobSummary) {
    if (summary.status !== "done" || !summary.report_path) return;
    try {
      const full = await fetchResearchJob(summary.job_id);
      if (full.status === "done" && full.report) {
        setJob(full);
        openReport(full.report, full.agent_type, full.job_id);
      }
    } catch {
      setRunError("history load failed");
      setPhase("failed");
    }
  }

  const busy = phase === "screening" || phase === "researching";

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      {/* 页头 */}
      <header>
        <p className="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-primary">
          <ShieldCheck size={14} />
          {t("agent.eyebrow")}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("agent.title")}</h1>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-muted">
          {t("agent.subtitle")}
        </p>
      </header>

      {/* 输入区 */}
      <section
        aria-label={t("agent.inputLabel")}
        className="mt-8 border border-line bg-surface p-4 shadow-card"
      >
        {/* Agent 类型选择（工作台雏形：analyst / portfolio_risk；decision_review 待产品化） */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">{t("agent.agentTypeLabel")}</span>
          {AGENT_CHOICES.map((c) => {
            const active = agentType === c.value;
            return (
              <button
                key={c.value}
                type="button"
                disabled={locked}
                onClick={() => setAgentType(c.value)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-line text-muted hover:bg-surfaceSubtle"
                }`}
              >
                {t(c.labelKey)}
              </button>
            );
          })}
          <span className="text-[11px] text-muted">
            {t(
              agentType === "analyst"
                ? "agent.agentType.analystDesc"
                : "agent.agentType.portfolioRiskDesc",
            )}
          </span>
        </div>
        <label htmlFor="agent-goal" className="sr-only">
          {t("agent.inputLabel")}
        </label>
        <textarea
          id="agent-goal"
          value={input}
          maxLength={500}
          disabled={locked}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          rows={2}
          placeholder={t("agent.inputPlaceholder")}
          className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">{t("agent.inputHint")}</p>
          <div className="flex items-center gap-3">
            <span className="text-[11px] tabular-nums text-muted">
              {t("agent.charCount", { count: input.length })}
            </span>
            {busy ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-surfaceSubtle px-3 py-1.5 text-xs text-muted">
                <Loader2 size={13} className="animate-spin" />
                {phase === "screening" ? t("agent.submitting") : t("agent.running")}
              </span>
            ) : phase === "done" ||
              phase === "blocked" ||
              phase === "clarify" ||
              phase === "failed" ? (
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs transition-colors hover:bg-surfaceSubtle"
              >
                <RefreshCw size={12} />
                {t("agent.cancel")}
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={input.trim().length === 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send size={12} />
                {t("agent.submit")}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 安检/拦截/引导状态 */}
      {(phase === "blocked" || phase === "clarify") && verdict && (
        <section
          role="alert"
          aria-live="polite"
          className={`mt-4 border px-4 py-3.5 ${
            phase === "blocked"
              ? "border-market-negative/40 bg-market-negative/5"
              : "border-line bg-surfaceSubtle"
          }`}
        >
          <div className="flex items-start gap-2.5">
            {phase === "blocked" ? (
              <ShieldAlert size={18} className="mt-0.5 shrink-0 text-market-negative" />
            ) : (
              <Info size={18} className="mt-0.5 shrink-0 text-primary" />
            )}
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                {phase === "blocked"
                  ? t("agent.screening.blockTitle")
                  : t("agent.screening.clarifyTitle")}
                {phase === "blocked" && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      verdict.reason === "offtopic"
                        ? "bg-surface text-muted"
                        : "bg-market-negative/10 text-market-negative"
                    }`}
                  >
                    {verdict.reason === "offtopic"
                      ? t("agent.screening.offtopicTag")
                      : t("agent.screening.complianceTag")}
                  </span>
                )}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed">
                {phase === "blocked"
                  ? t(BLOCK_I18N[verdict.reason] ?? BLOCK_I18N.unrecognized)
                  : t(CLARIFY_I18N[verdict.reason] ?? CLARIFY_I18N.unrecognized)}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 研究阶段与结果 */}
      {(phase === "screening" ||
        phase === "researching" ||
        phase === "done" ||
        phase === "failed") && (
        <section ref={reportSectionRef} className="mt-6 space-y-4" aria-live="polite">
          {phase === "screening" && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 size={14} className="animate-spin text-primary" />
              {t("agent.screening.checking")}
            </p>
          )}
          {phase !== "screening" && (
            <>
              <StageStepper activeIndex={stageIndex} />
              {phase === "researching" &&
                (isDemo ? (
                  <p className="text-xs text-muted">{t("agent.demoMode")}</p>
                ) : (
                  <p className="flex items-center gap-2 text-xs text-muted">
                    <Loader2 size={12} className="animate-spin text-primary" />
                    {t("agent.liveRunning")}
                    {job?.started_at && (
                      <span className="font-mono text-[10px] opacity-70">
                        #{job.job_id.slice(0, 8)}
                      </span>
                    )}
                  </p>
                ))}
              {phase === "failed" && (
                <div
                  role="alert"
                  className="rounded-md border border-market-negative/40 bg-market-negative/5 px-4 py-3"
                >
                  <p className="flex items-center gap-2 text-sm font-semibold text-market-negative">
                    <ShieldAlert size={15} />
                    {t("agent.failedTitle")}
                  </p>
                  <p className="mt-1.5 max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-muted">
                    {runError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void submit()}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-xs transition-colors hover:bg-surfaceSubtle"
                  >
                    <RefreshCw size={12} />
                    {t("agent.failedRetry")}
                  </button>
                </div>
              )}
            </>
          )}
          {phase === "done" &&
            (isDemo ? (
              // 演示模式仅 analyst（P0 行为保留）
              <ReportView report={{ ...matchDemoReport(input.trim()), goal: input.trim() }} />
            ) : renderKind === "risk" && riskReport ? (
              <RiskReportView report={riskReport} live />
            ) : renderKind === "review" && rawReport ? (
              // decision_review 产物：协议未专配渲染组件前，只读 JSON 兜底
              <div className="rounded-md border border-line bg-surface p-4">
                <p className="mb-2 text-xs font-medium text-muted">
                  {t("agent.history.reviewFallback")}
                </p>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
                  {JSON.stringify(rawReport, null, 2)}
                </pre>
              </div>
            ) : viewReport ? (
              <ReportView report={viewReport} live />
            ) : null)}
        </section>
      )}

      {/* 分类引导 */}
      {!busy && phase !== "done" && phase !== "failed" && (
        <div className="mt-8">
          <CategoryCards onPick={(q) => setInput(q)} disabled={locked} />
        </div>
      )}

      {/* 任务历史（工作台雏形；后端不可达时静默隐藏） */}
      {!historyError && (
        <section
          aria-label={t("agent.history.title")}
          className="mt-10 border-t border-line pt-6"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <History size={14} className="text-primary" />
              {t("agent.history.title")}
              <span className="rounded-full bg-surfaceSubtle px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted">
                {history.length}
              </span>
            </h2>
            <button
              type="button"
              onClick={() => void loadHistory()}
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[11px] text-muted transition-colors hover:bg-surfaceSubtle"
            >
              <RefreshCw size={11} />
              {t("agent.history.refresh")}
            </button>
          </div>
          {history.length === 0 ? (
            <p className="mt-3 text-xs text-muted">{t("agent.history.empty")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line rounded-md border border-line bg-surface">
              {history.map((j) => (
                <li
                  key={j.job_id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      STATUS_DOT[j.status] ?? STATUS_DOT.queued
                    }`}
                  />
                  <span className="w-14 text-[11px] text-muted">
                    {t(STATUS_I18N[j.status] ?? STATUS_I18N.queued)}
                  </span>
                  <span className="rounded-full border border-line bg-surfaceSubtle px-1.5 py-0.5 text-[10px] text-muted">
                    {t(AGENT_BADGE_I18N[j.agent_type] ?? AGENT_BADGE_I18N.analyst)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{j.goal}</span>
                  <span className="text-[10px] tabular-nums text-muted">
                    {fmtTime(j.created_at)}
                  </span>
                  {j.status === "done" && j.report_path && (
                    <button
                      type="button"
                      onClick={() => void openHistoryJob(j)}
                      className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      {t("agent.history.view")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 合规提示条 */}
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-market-negative" />
          {t("agent.footerCompliance")}
        </p>
        <a
          href="http://127.0.0.1:3080"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("agent.developerEntry")}
          <ExternalLink size={11} />
        </a>
      </footer>
    </main>
  );
}
