import { useTranslation } from "react-i18next";
import type {
  MarketData,
  MarketProxyAsset,
  MarketQuote,
  MarketTrendPoint,
} from "@/types";

interface MarketSnapshotProps {
  data: MarketData;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatChange(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function changeTone(value: number | null): string {
  if (value === null || value === 0) {
    return "text-heading";
  }

  return value > 0 ? "text-market-positive" : "text-market-negative";
}

function trendPath(trend: MarketTrendPoint[]): string | null {
  if (trend.length < 2) {
    return null;
  }

  const prices = trend.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const spread = max - min || 1;
  const width = 120;
  const height = 32;
  const padding = 2;

  return trend
    .map((point, index) => {
      const x = padding + (index / (trend.length - 1)) * (width - padding * 2);
      const y = height - padding - ((point.price - min) / spread) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function MiniTrend({ quote }: { quote: MarketQuote }) {
  const path = trendPath(quote.trend);

  if (!path) {
    return <span className="block h-8 text-xs leading-8 text-muted">—</span>;
  }

  return (
    <svg
      aria-label={`${quote.name} ${quote.trend.length} day trend`}
      className={`mt-2 h-8 w-full ${changeTone(quote.changePct)}`}
      preserveAspectRatio="none"
      role="img"
      viewBox="0 0 120 32"
    >
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function QuoteCard({ quote, compact = false }: { quote: MarketQuote; compact?: boolean }) {
  return (
    <article
      className={`rounded-lg border border-line bg-surface ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm text-muted">{quote.name}</h3>
          <p className="truncate text-xs text-muted/60">{quote.nameEn}</p>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-muted">{quote.symbol}</span>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <span className={`${compact ? "text-lg" : "text-xl"} font-semibold text-heading`}>
          {formatPrice(quote.price)}
        </span>
        <span className={`text-sm ${changeTone(quote.changePct)}`}>
          {formatChange(quote.changePct)}
        </span>
      </div>
      <MiniTrend quote={quote} />
    </article>
  );
}

function StockChip({ quote }: { quote: MarketQuote }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-line bg-surfaceSubtle px-2.5 py-1.5 transition-colors hover:border-brand">
      <span className="font-mono text-xs font-medium text-heading">{quote.symbol}</span>
      <span className={`text-xs ${changeTone(quote.changePct)}`}>
        {formatChange(quote.changePct)}
      </span>
    </span>
  );
}

function decisionDirection(direction: string | null, t: (key: string) => string): string {
  if (direction === "bullish") {
    return t("market.bullish");
  }
  if (direction === "bearish") {
    return t("market.bearish");
  }
  return t("market.neutral");
}

function decisionTone(direction: string | null): string {
  if (direction === "bullish") {
    return "text-market-positive";
  }
  if (direction === "bearish") {
    return "text-market-negative";
  }
  return "text-muted";
}

function ProxyCard({ asset }: { asset: MarketProxyAsset }) {
  const { t } = useTranslation();
  const decision = asset.linkedDecision;

  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <span className="inline-flex rounded bg-surfaceBrand/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-brand">
        {t("market.decisionValidation")}
      </span>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-heading">{asset.name}</h3>
          <p className="font-mono text-xs text-muted">{asset.symbol}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-semibold text-heading">{formatPrice(asset.price)}</p>
          <p className={`text-sm ${changeTone(asset.changePct)}`}>
            {formatChange(asset.changePct)}
          </p>
        </div>
      </div>
      {decision ? (
        <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
          {decision.asset ?? "—"} {" "}
          <span className={decisionTone(decision.direction)}>
            {decisionDirection(decision.direction, t)}
          </span>
          {" · "}
          {decision.status === "open" ? t("market.pendingReview") : t("market.reviewed")}
          {" · "}
          {decision.reviewDate ?? "—"}
        </p>
      ) : null}
    </article>
  );
}

export function MarketSnapshot({ data }: MarketSnapshotProps) {
  const { t } = useTranslation();
  const hasMarketData = data.usIndices.length > 0 || data.usStocks.length > 0;

  return (
    <section className="space-y-6" aria-labelledby="market-snapshot-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 id="market-snapshot-title" className="text-sm font-medium text-heading">
          {t("market.title")}
        </h2>
        <p className="text-xs text-muted">
          {t("market.updatedAt", { date: formatDateTime(data.dataAsOf) })}
          {data.source ? ` · ${data.source}` : ""}
        </p>
      </div>

      {!hasMarketData ? (
        <p className="py-8 text-center text-sm text-muted">{t("market.empty")}</p>
      ) : (
        <>
          {data.usIndices.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {data.usIndices.map((quote) => (
                <QuoteCard key={quote.symbol} quote={quote} />
              ))}
            </div>
          ) : null}

          {data.usStocks.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                {t("market.usAiStocks")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {data.usStocks.map((quote) => (
                  <StockChip key={quote.symbol} quote={quote} />
                ))}
              </div>
            </div>
          ) : null}

          {data.cnIndices.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                {t("market.cnIndices")}
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {data.cnIndices.map((quote) => (
                  <QuoteCard key={quote.symbol} compact quote={quote} />
                ))}
              </div>
            </div>
          ) : null}

          {data.proxyAssets.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
                {t("market.proxyAssets")}
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {data.proxyAssets.map((asset) => (
                  <ProxyCard key={asset.symbol} asset={asset} />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export default MarketSnapshot;