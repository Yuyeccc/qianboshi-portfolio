import { ArrowUpRight, Clock3, Layers3 } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { LatestBrief } from "@/types";
import { BriefDateBadge } from "./BriefDateBadge";

interface LatestBriefCardProps {
  brief: LatestBrief;
  locale: string;
}

function extractDate(brief: LatestBrief): string | null {
  const filenameDate = brief.filename?.match(/\d{4}-\d{2}-\d{2}/)?.[0];

  return filenameDate ?? brief.generatedAt ?? null;
}

function formatGeneratedAt(value: string | null): string {
  if (!value) {
    return "—";
  }

  return value
    .replace("T", " ")
    .replace(/([+-]\d{2}:\d{2}|Z)$/, "")
    .slice(0, 16);
}

export function LatestBriefCard({ brief, locale }: LatestBriefCardProps) {
  const { t } = useTranslation();

  if (!brief.filename) {
    return null;
  }

  const date = extractDate(brief);

  return (
    <Link
      to={`/${locale}/briefs/${encodeURIComponent(brief.filename)}`}
      className="group relative block rounded-lg border border-line bg-surfaceRaised shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-cardHover"
    >
      <div className="grid items-center gap-5 p-6 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:p-8">
        <BriefDateBadge date={date} size="large" />

        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-surfaceBrand px-2.5 py-1 text-xs font-medium text-brand">
            <span
              className="h-1.5 w-1.5 rounded-full bg-market-positive"
              aria-hidden="true"
            />
            {t("briefs.generated")}
          </div>

          <h3 className="truncate text-xl font-medium text-heading transition-colors group-hover:text-brand">
            {brief.filename}
          </h3>

          <p className="mt-2 line-clamp-2 text-sm leading-6 text-text">
            {brief.summary || t("briefs.preview")}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Layers3 className="h-3.5 w-3.5" aria-hidden="true" />
              {brief.sectionCount ?? 0} {t("briefs.sections")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              {formatGeneratedAt(brief.generatedAt)}
            </span>
          </div>
        </div>

        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line text-muted transition-colors group-hover:border-brand group-hover:bg-brand group-hover:text-surface"
          aria-hidden="true"
        >
          <ArrowUpRight className="h-5 w-5" />
        </span>
      </div>
    </Link>
  );
}
