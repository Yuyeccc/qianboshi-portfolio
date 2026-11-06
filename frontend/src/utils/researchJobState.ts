import type { ResearchJobStatus } from "../data/research-client";

export const STAGES = [
  "submitted",
  "screening",
  "planning",
  "retrieving",
  "judging",
  "done",
] as const;

export type StageKey = (typeof STAGES)[number];

const BACKEND_STAGE_MAP: Record<string, StageKey> = {
  "1/6": "planning",
  "2/6": "retrieving",
  "3/6": "retrieving",
  "4/6": "retrieving",
  "4b/6": "retrieving",
  "5/6": "judging",
  "5c/6": "judging",
  "5d/6": "judging",
  "6/6": "judging",
};

/** 仅映射后端已报告的真实阶段；未知或缺失进度由调用方保持原阶段。 */
export function stageForResearchJob(
  status: ResearchJobStatus,
  backendStage?: string | null,
): StageKey | null {
  if (status === "done") return "done";
  return backendStage ? (BACKEND_STAGE_MAP[backendStage] ?? null) : null;
}

export type RecoveryAction = "poll" | "report" | "error";

const RECOVERY_ACTIONS: Record<ResearchJobStatus, RecoveryAction> = {
  queued: "poll",
  running: "poll",
  done: "report",
  failed: "error",
};

export function recoveryActionForResearchJob(status: ResearchJobStatus): RecoveryAction {
  return RECOVERY_ACTIONS[status];
}
