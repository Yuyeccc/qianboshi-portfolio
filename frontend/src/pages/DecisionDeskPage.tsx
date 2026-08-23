import { AlertCircle, FileText } from "lucide-react";
import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AssetCardView from "@/components/decision/AssetCardView";
import DecisionCard from "@/components/decision/DecisionCard";
import { DataContext } from "@/app/providers";
import { DecisionReviewItem, DecisionSummary } from "@/types";

const emptySummary: DecisionSummary = {
  stats: {
    total: 0,
    open: 0,
    reviewed: 0,
    hit: 0,
    wrong: 0,
    generatedAt: null,
  },
  decisions: [],
  assetCards: [],
  reviews: [],
};

const directionStyles: Record<string, string> = {
  bullish: "bg-market-positive/10 text-market-positive",
  bearish: "bg-market-negative/10 text-market-negative",
  neutral: "bg-surfaceSubtle text-muted",
};

const resultStyles: Record<string, string> = {
  hit: "bg-market-positive/10 text-market-positive",
  wrong: "bg-market-negative/10 text-market-negative",
};

function formatReturn(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export default function DecisionDeskPage() {
  const { t, i18n } = useTranslation();
  const provider = useContext(DataContext);
  const [summary, setSummary] = useState<DecisionSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDecisions() {
      setLoading(true);
      setError(false);

      try {
        const result = await provider?.getDecisions();
        if (active) {
          setSummary(result);
        }
      } catch {
        if (active) {
          setSummary(emptySummary);
          setError(true);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDecisions();

    return () => {
      active = false;
    };
  }, [provider]);

  const sortedDecisions = useMemo(
    () =>
      [...summary.decisions].sort((left, right) =>
        (right.decisionDate ?? "").localeCompare(left.decisionDate ?? ""),
      ),
    [summary.decisions],
  );

  const generatedAt = useMemo(() => {
    if (!summary.stats.generatedAt) {
      return null;
    }

    const date = new Date(summary.stats.generatedAt);
    if (Number.isNaN(date.getTime())) {
      return summary.stats.generatedAt;
    }

    return new Intl.DateTimeFormat(
      i18n.resolvedLanguage?.startsWith("en") ? "en" : "zh-CN",
      {
        dateStyle: "medium",
        timeStyle: "short",
      },
    ).format(date);
  }, [i18n.resolvedLanguage, summary.stats.generatedAt]);

  const stats = [
    {
      label: t("decisions.statTotal"),
      value: summary.stats.total,
      className: "text-heading",
    },
    {
      label: t("decisions.statOpen"),
      value: summary.stats.open,
      className: "text-warning",
    },
    {
      label: t("decisions.statReviewed"),
      value: summary.stats.reviewed,
      className: "text-info",
    },
    {
      label: t("decisions.statHit"),
      value: summary.stats.hit,
      className: "text-market-positive",
    },
    {
      label: t("decisions.statWrong"),
      value: summary.stats.wrong,
      className: "text-market-negative",
    },
  ];

  const hasData =
    summary.decisions.length > 0 ||
    summary.assetCards.length > 0 ||
    summary.reviews.length > 0;

  function directionLabel(direction: string): string {
    const key =
      direction === "bullish"
        ? "decisions.directionBullish"
        : direction === "bearish"
          ? "decisions.directionBearish"
          : "decisions.directionNeutral";

    return t(key);
  }

  function renderReview(review: DecisionReviewItem) {
    return (
      <article
        className="border-b border-line py-5 first:pt-0 last:border-b-0 last:pb-0"
        key={review.decisionId}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-auto font-medium text-heading">
            {review.assetName}
          </h3>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              directionStyles[review.direction] ?? directionStyles.neutral
            }`}
          >
            {directionLabel(review.direction)}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              resultStyles[review.resultLabel] ?? "bg-surfaceSubtle text-muted"
            }`}
          >
            {review.resultLabel === "hit"
              ? t("decisions.resultHit")
              : t("decisions.resultWrong")}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
          <span>
            {t("decisions.reviewDate")}: {review.reviewDate ?? "—"}
          </span>
          <span>
            {t("decisions.outcomeReturn")}:{" "}
            <strong
              className={`font-medium tabular-nums ${
                review.outcomeReturn !== null && review.outcomeReturn >= 0
                  ? "text-market-positive"
                  : "text-market-negative"
              }`}
            >
              {formatReturn(review.outcomeReturn)}
            </strong>
          </span>
          <span className="tabular-nums">
            {review.horizonDays === null
              ? "—"
              : t("decisions.horizonDays", {
                  count: review.horizonDays,
                })}
          </span>
        </div>

        {review.newRuleLearned ? (
          <blockquote className="mt-4 border-l-2 border-brand bg-surfaceSubtle px-4 py-3 text-sm leading-6 text-text">
            {review.newRuleLearned}
          </blockquote>
        ) : null}
      </article>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <header className="max-w-3xl">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-brand" aria-hidden="true" />
          <p className="font-mono text-xs font-medium uppercase text-brand">
            Decision Desk
          </p>
        </div>
        <h1 className="display-title mt-5 text-4xl text-heading sm:text-5xl">
          {t("decisions.title")}
        </h1>
        <p className="mt-5 text-lg leading-8 text-text">
          {t("decisions.description")}
        </p>
      </header>

      {loading ? (
        <div
          className="mt-12 border-y border-line py-16 text-center text-sm text-muted"
          role="status"
        >
          {t("decisions.loading")}
        </div>
      ) : error ? (
        <div
          className="mt-12 flex items-center gap-3 border-y border-line py-8 text-sm text-muted"
          role="alert"
        >
          <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
          {t("decisions.error")}
        </div>
      ) : !hasData ? (
        <div className="mt-12 border-y border-line py-16 text-center text-sm text-muted">
          {t("decisions.empty")}
        </div>
      ) : (
        <>
          <section
            aria-label={t("decisions.statsLabel")}
            className="mt-12 grid grid-cols-2 border-y border-line sm:grid-cols-5"
          >
            {stats.map((stat) => (
              <div
                className="border-b border-line px-4 py-5 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0"
                key={stat.label}
              >
                <p className="text-xs text-muted">{stat.label}</p>
                <p
                  className={`mt-2 text-2xl font-medium tabular-nums ${stat.className}`}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </section>

          <section className="mt-14" aria-labelledby="decision-log-title">
            <div className="flex items-end justify-between gap-4">
              <h2
                className="text-xl font-medium text-heading"
                id="decision-log-title"
              >
                {t("decisions.logTitle")}
              </h2>
              <span className="font-mono text-xs tabular-nums text-muted">
                {summary.decisions.length}
              </span>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {sortedDecisions.map((decision) => (
                <DecisionCard decision={decision} key={decision.decisionId} />
              ))}
            </div>
          </section>

          <section className="mt-16" aria-labelledby="asset-cards-title">
            <div className="flex items-end justify-between gap-4">
              <h2
                className="text-xl font-medium text-heading"
                id="asset-cards-title"
              >
                {t("decisions.cardsTitle")}
              </h2>
              <span className="font-mono text-xs tabular-nums text-muted">
                {summary.assetCards.length}
              </span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {summary.assetCards.map((card) => (
                <AssetCardView card={card} key={card.assetId} />
              ))}
            </div>
          </section>

          <section className="mt-16" aria-labelledby="reviews-title">
            <div className="flex items-end justify-between gap-4">
              <h2
                className="text-xl font-medium text-heading"
                id="reviews-title"
              >
                {t("decisions.reviewsTitle")}
              </h2>
              <span className="font-mono text-xs tabular-nums text-muted">
                {summary.reviews.length}
              </span>
            </div>
            <div className="mt-6 rounded-lg border border-line bg-surface px-5 py-6 sm:px-6">
              {summary.reviews.length > 0 ? (
                summary.reviews.map(renderReview)
              ) : (
                <p className="text-sm text-muted">{t("decisions.noReviews")}</p>
              )}
            </div>
          </section>
        </>
      )}

      {generatedAt ? (
        <footer className="mt-12 border-t border-line pt-5 text-xs text-muted">
          {t("decisions.generatedAt")}:{" "}
          <time dateTime={summary.stats.generatedAt ?? undefined}>
            {generatedAt}
          </time>
        </footer>
      ) : null}
    </main>
  );
}
