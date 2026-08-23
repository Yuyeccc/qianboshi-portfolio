import { useTranslation } from "react-i18next";
import { DecisionItem } from "@/types";

interface DecisionCardProps {
  decision: DecisionItem;
}

const directionStyles: Record<string, string> = {
  bullish: "bg-market-positive/10 text-market-positive",
  bearish: "bg-market-negative/10 text-market-negative",
  neutral: "bg-surfaceSubtle text-muted",
};

const directionBars: Record<string, string> = {
  bullish: "bg-market-positive",
  bearish: "bg-market-negative",
  neutral: "bg-muted",
};

function getDirectionLabel(
  direction: string,
  t: (key: string, fallback: string) => string,
): string {
  return t(
    `decisions.direction${direction.charAt(0).toUpperCase()}${direction.slice(1)}`,
    direction,
  );
}

export default function DecisionCard({ decision }: DecisionCardProps) {
  const { t } = useTranslation();
  const conviction = decision.conviction ?? 0;
  const result = decision.reviewResult;
  const statusKey =
    result === "wrong"
      ? "decisions.resultWrong"
      : result === "hit"
        ? "decisions.resultHit"
        : decision.status === "reviewed"
          ? "decisions.statusReviewed"
          : "decisions.statusOpen";

  const statusClass =
    result === "wrong"
      ? "bg-market-negative/10 text-market-negative"
      : result === "hit"
        ? "bg-market-positive/10 text-market-positive"
        : decision.status === "reviewed"
          ? "bg-info/10 text-info"
          : "bg-warning/10 text-warning";

  return (
    <article className="relative overflow-hidden rounded-lg border border-line bg-surface p-5">
      <div
        className={`absolute inset-y-0 left-0 w-0.5 ${
          directionBars[decision.direction] ?? directionBars.neutral
        }`}
      />

      <div className="flex flex-wrap items-center gap-2 pl-2">
        <h3 className="mr-auto text-base font-medium text-heading">
          {decision.assetName}
        </h3>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            directionStyles[decision.direction] ?? directionStyles.neutral
          }`}
        >
          {getDirectionLabel(decision.direction, t)}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass}`}
        >
          {t(statusKey)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 pl-2 text-xs text-muted">
        <span>{decision.decisionDate ?? "—"}</span>
        <span>
          {t(
            `decisions.horizon${decision.horizon.charAt(0).toUpperCase()}${decision.horizon.slice(1)}`,
            decision.horizon,
          )}
        </span>
        <span className="tabular-nums">
          {t("decisions.conviction")}: {Math.round(conviction * 100)}%
        </span>
      </div>

      <p className="mt-4 line-clamp-2 min-h-10 pl-2 text-sm leading-5 text-muted">
        {decision.thesis || t("decisions.noThesis")}
      </p>

      <div
        className="mt-4 ml-2 h-1 overflow-hidden rounded-full bg-surfaceSubtle"
        aria-label={`${Math.round(conviction * 100)}%`}
      >
        <div
          className={`h-full rounded-full ${
            directionBars[decision.direction] ?? directionBars.neutral
          }`}
          style={{ width: `${Math.max(0, Math.min(1, conviction)) * 100}%` }}
        />
      </div>
    </article>
  );
}
