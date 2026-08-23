import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Copy, Home, Link2, ChevronRight } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";

import { BriefDateBadge } from "@/components/brief/BriefDateBadge";
import { BriefPagination } from "@/components/brief/BriefPagination";
import { BriefToc } from "@/components/brief/BriefToc";
import { MarketSnapshot } from "@/components/brief/MarketSnapshot";
import { ReadingProgressBar } from "@/components/brief/ReadingProgressBar";
import { DataContext } from "@/app/providers";
import { extractBriefHeadings, slugify, formatFileSize } from "@/utils/brief";
import { BriefDetail, BriefItem, MarketData } from "@/types";

function formatLocalTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function getDate(filename: string | null, fallback: string | null) {
  return filename?.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? fallback?.slice(0, 10) ?? null;
}

const emptyMarket: MarketData = {
  meta: { status: "empty" },
  dataAsOf: null,
  source: null,
  usIndices: [],
  usStocks: [],
  cnIndices: [],
  proxyAssets: [],
};

export default function BriefDetailPage() {
  const { t } = useTranslation();
  const { locale = "zh", filename } = useParams();
  const provider = useContext(DataContext);
  const [brief, setBrief] = useState<BriefDetail | null>(null);
  const [briefs, setBriefs] = useState<BriefItem[]>([]);
  const [marketData, setMarketData] = useState<MarketData>(emptyMarket);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setBrief(null);
    setMarketData(emptyMarket);

    if (!filename) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    Promise.all([provider.getBrief(filename), provider.getBriefs(), provider.getMarket()])
      .then(([detail, items, market]) => {
        if (!active) return;
        setBrief(detail);
        setBriefs([...items].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")));
        setMarketData(market);
      })
      .catch(() => {
        if (!active) return;
        setBrief(null);
        setBriefs([]);
        setMarketData(emptyMarket);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [filename, provider]);

  const headings = useMemo(
    () => (brief ? extractBriefHeadings(brief.content) : []),
    [brief],
  );

  const pagination = useMemo(() => {
    if (!filename) return { previous: null, next: null };
    const index = briefs.findIndex((item) => item.filename === filename);
    return {
      previous: index >= 0 ? briefs[index + 1] ?? null : null,
      next: index > 0 ? briefs[index - 1] ?? null : null,
    };
  }, [briefs, filename]);

  const date = getDate(brief?.filename ?? null, brief?.generatedAt ?? null);
  const currentItem = briefs.find((item) => item.filename === brief?.filename);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  };

  const backLink = (
    <Link
      to={`/${locale}/briefs`}
      className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:text-brandStrong"
    >
      <ArrowLeft size={16} aria-hidden="true" />
      {t("briefs.backToList")}
    </Link>
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        {backLink}
        <p className="text-sm text-muted">{t("overview.loading")}</p>
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        {backLink}
        <h1 className="text-2xl font-semibold text-heading">{t("briefs.notFound")}</h1>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <ReadingProgressBar />
      <nav className="flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
        <Link to={`/${locale}`} className="inline-flex items-center gap-1 hover:text-brand">
          <Home size={13} aria-hidden="true" />
          {t("overview.title")}
        </Link>
        <ChevronRight size={13} aria-hidden="true" />
        <Link to={`/${locale}/briefs`} className="hover:text-brand">
          {t("briefs.title")}
        </Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span>{date ?? "—"}</span>
      </nav>

      <div className="mt-6">{backLink}</div>

      <header className="mt-6 border-b border-line pb-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <BriefDateBadge date={date} size="large" />
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-surfaceBrand px-3 py-1 text-xs font-medium text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {t("briefs.realOutput")}
            </div>
            <h1 className="mt-3 break-words text-2xl font-medium text-heading sm:text-3xl">
              {brief.filename}
            </h1>
            <p className="mt-2 break-all text-xs text-muted">{brief.filename}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted">
              <span>{t("briefs.generatedAt")}: {formatLocalTime(brief.generatedAt)}</span>
              <span>{t("briefs.size")}: {formatFileSize(currentItem?.sizeBytes ?? null)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex shrink-0 items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-muted transition hover:border-brand hover:text-brand"
            aria-label={copied ? t("briefs.copied") : t("briefs.copyLink")}
          >
            {copied ? <Copy size={16} /> : <Link2 size={16} />}
            {copied ? t("briefs.copied") : t("briefs.copyLink")}
          </button>
        </div>
      </header>

      <div className="mt-8">
        <MarketSnapshot data={marketData} />
      </div>

      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_200px]">
        <article className="prose-brief min-w-0 text-muted">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => {
                const text = String(children);
                const id = headings.find((heading) => heading.text === text)?.id ?? slugify(text);
                return <h2 id={id} className="scroll-mt-24">{children}</h2>;
              },
            }}
          >
            {brief.content}
          </ReactMarkdown>
        </article>
        <BriefToc headings={headings} />
      </div>

      <div className="mt-12 border-t border-line pt-6">
        <BriefPagination previous={pagination.previous} next={pagination.next} locale={locale} />
      </div>
    </div>
  );
}