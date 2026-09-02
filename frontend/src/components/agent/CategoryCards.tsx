import { useTranslation } from "react-i18next";
import {
  Flame,
  GitBranch,
  Library,
  MousePointerClick,
  TrendingUp,
  Wallet,
} from "lucide-react";

const CATEGORIES = ["sector", "scenario", "position", "heat", "views"] as const;

const CATEGORY_ICONS = {
  sector: TrendingUp,
  scenario: GitBranch,
  position: Wallet,
  heat: Flame,
  views: Library,
} as const;

interface Props {
  onPick: (question: string) => void;
  disabled?: boolean;
}

export default function CategoryCards({ onPick, disabled }: Props) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="agent-categories-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="agent-categories-title" className="text-lg font-semibold tracking-tight">
          {t("agent.categoriesTitle")}
        </h2>
        <p className="text-xs text-muted">{t("agent.categoriesSub")}</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((key) => {
          const Icon = CATEGORY_ICONS[key];
          const exampleCount = t(`agent.cat.${key}.examples`, {
            returnObjects: true,
          }) as unknown as string[];
          return (
            <div
              key={key}
              className="flex flex-col border border-line bg-surface p-4 shadow-card transition-colors hover:border-primary/40"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-surfaceSubtle text-primary">
                  <Icon size={15} />
                </span>
                <h3 className="text-sm font-semibold">{t(`agent.cat.${key}.title`)}</h3>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                {t(`agent.cat.${key}.desc`)}
              </p>
              <ul className="mt-3 space-y-1">
                {exampleCount.map((ex, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onPick(ex)}
                      className="group flex w-full items-start gap-1.5 rounded px-1 py-1 text-left text-xs leading-relaxed text-muted transition-colors hover:bg-surfaceSubtle hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <MousePointerClick
                        size={12}
                        className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60"
                      />
                      <span>{ex}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
