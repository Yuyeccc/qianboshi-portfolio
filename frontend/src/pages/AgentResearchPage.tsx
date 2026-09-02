import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { classifyQuestion, type ScreeningResult } from "@/utils/agentScreening";
import { matchDemoReport } from "@/data/demoReport";
import CategoryCards from "@/components/agent/CategoryCards";
import StageStepper, { STAGES } from "@/components/agent/StageStepper";
import ReportView from "@/components/agent/ReportView";

type Phase = "idle" | "screening" | "blocked" | "clarify" | "researching" | "done";

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

export default function AgentResearchPage() {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [verdict, setVerdict] = useState<ScreeningResult | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => timersRef.current.forEach((id) => window.clearTimeout(id)), []);

  const locked = phase === "screening" || phase === "researching";

  function reset() {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    setVerdict(null);
    setStageIndex(0);
    setPhase("idle");
  }

  function submit() {
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
    // pass → 安检动画 → 演示研究流
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
          className="w-full resize-none bg-transparent text-base leading-relaxed outline-none placeholder:text-muted disabled:opacity-60"
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
            ) : phase === "done" || phase === "blocked" || phase === "clarify" ? (
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
      {(phase === "screening" || phase === "researching" || phase === "done") && (
        <section className="mt-6 space-y-4" aria-live="polite">
          {phase === "screening" && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 size={14} className="animate-spin text-primary" />
              {t("agent.screening.checking")}
            </p>
          )}
          {phase !== "screening" && (
            <>
              <StageStepper activeIndex={stageIndex} />
              {phase === "researching" && (
                <p className="text-xs text-muted">{t("agent.demoMode")}</p>
              )}
            </>
          )}
          {phase === "done" && (
            <ReportView report={{ ...matchDemoReport(input.trim()), goal: input.trim() }} />
          )}
        </section>
      )}

      {/* 分类引导 */}
      {!busy && phase !== "done" && (
        <div className="mt-8">
          <CategoryCards onPick={(q) => setInput(q)} disabled={locked} />
        </div>
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
