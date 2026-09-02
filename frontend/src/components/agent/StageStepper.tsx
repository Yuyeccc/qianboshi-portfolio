import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";

export const STAGES = [
  "submitted",
  "screening",
  "planning",
  "retrieving",
  "judging",
  "done",
] as const;

export type StageKey = (typeof STAGES)[number];

interface Props {
  /** 当前推进到的阶段 index（含） */
  activeIndex: number;
}

export default function StageStepper({ activeIndex }: Props) {
  const { t } = useTranslation();
  return (
    <ol className="flex flex-wrap items-center gap-1.5" aria-label="research stages">
      {STAGES.map((key, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        const waiting = i > activeIndex;
        return (
          <li
            key={key}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
              active
                ? "border-primary/40 bg-primary/10 text-primary"
                : done
                  ? "border-market-positive/30 bg-market-positive/10 text-market-positive"
                  : waiting
                    ? "border-line bg-surfaceSubtle text-muted"
                    : "border-line bg-surfaceSubtle text-muted"
            }`}
          >
            {done && <Check size={11} />}
            <span className="flex items-center gap-1">
              <span className="opacity-60">{String(i + 1).padStart(2, "0")}</span>
              {t(`agent.stage.${key}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
