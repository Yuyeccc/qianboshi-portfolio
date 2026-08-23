import { useTranslation } from "react-i18next";
import { AssetCardItem } from "@/types";

interface AssetCardViewProps {
  card: AssetCardItem;
}

const typeStyles: Record<string, string> = {
  commodity: "bg-amber-50 text-amber-700",
  sector: "bg-sky-50 text-sky-700",
  theme: "bg-violet-50 text-violet-700",
};

const impactStyles: Record<string, string> = {
  positive: "bg-market-positive",
  negative: "bg-market-negative",
  neutral: "bg-muted",
};

export default function AssetCardView({ card }: AssetCardViewProps) {
  const { t } = useTranslation();

  return (
    <article className="group rounded-lg border border-line bg-surface p-6 shadow-card transition hover:border-brand hover:shadow-cardHover">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-lg font-medium text-heading">{card.assetName}</h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            typeStyles[card.assetType] ?? "bg-surfaceSubtle text-muted"
          }`}
        >
          {t(`decisions.assetType.${card.assetType}`, card.assetType)}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-muted">
        {card.description || t("decisions.noDescription")}
      </p>

      <div className="mt-5 divide-y divide-line border-t border-line">
        {card.factors.slice(0, 3).map((factor) => (
          <div
            className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_auto] items-center gap-3 py-3"
            key={`${card.assetId}-${factor.factorName}`}
          >
            <span
              className="truncate text-sm text-muted"
              title={factor.factorName}
            >
              {factor.factorName}
            </span>
            <span
              className="truncate text-sm text-text"
              title={factor.currentState}
            >
              {factor.currentState}
            </span>
            <span
              aria-label={factor.impactDirection}
              className={`h-2 w-2 rounded-full ${
                impactStyles[factor.impactDirection] ?? impactStyles.neutral
              }`}
              title={factor.impactStrength}
            />
          </div>
        ))}
      </div>
    </article>
  );
}
