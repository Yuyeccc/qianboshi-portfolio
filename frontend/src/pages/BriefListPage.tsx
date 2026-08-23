import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, ChevronRight, Home } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { BriefDateBadge } from "@/components/brief/BriefDateBadge";
import { DataContext } from "@/app/providers";
import {
  formatShortDate,
  groupBriefsByMonth,
  formatFileSize,
} from "@/utils/brief";
import { BriefItem } from "@/types";

export default function BriefListPage() {
  const { t } = useTranslation();
  const { locale = "zh" } = useParams();
  const provider = useContext(DataContext);
  const [briefs, setBriefs] = useState<BriefItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(false);

    provider
      .getBriefs()
      .then((data) => {
        if (active) {
          setBriefs(data);
        }
      })
      .catch(() => {
        if (active) {
          setBriefs([]);
          setError(true);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [provider]);

  const groups = useMemo(() => groupBriefsByMonth(briefs), [briefs]);
  const dates = briefs
    .map((item) => item.date)
    .filter((date): date is string => Boolean(date))
    .sort();

  const latestDate = dates.at(-1) ?? null;
  const earliestDate = dates[0] ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <nav className="flex items-center gap-1.5 text-xs text-muted" aria-label="Breadcrumb">
        <Link
          to={`/${locale}`}
          className="inline-flex items-center gap-1 hover:text-brand"
        >
          <Home size={13} aria-hidden="true" />
          {t("overview.title")}
        </Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span>{t("briefs.title")}</span>
      </nav>

      <section className="border-b border-line pb-8">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-brand">
          Daily research output
        </p>
        <h1 className="mt-3 text-4xl font-medium tracking-tight text-heading sm:text-5xl">
          {t("briefs.title")}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
          {t("briefs.description")}
        </p>
      </section>

      {loading ? (
        <p className="text-sm text-muted">{t("overview.loading")}</p>
      ) : error ? (
        <p className="text-sm text-muted">—</p>
      ) : briefs.length === 0 ? (
        <p className="text-sm text-muted">{t("briefs.empty")}</p>
      ) : (
        <>
          <section className="grid border-y border-line sm:grid-cols-3">
            <div className="px-4 py-4 sm:px-5">
              <p className="text-xs text-muted">{t("briefs.statTotal")}</p>
              <p className="mt-1 tabular-nums text-heading">
                {briefs.length} {t("briefs.pieces")}
              </p>
            </div>
            <div className="border-line px-4 py-4 sm:border-l sm:px-5">
              <p className="text-xs text-muted">{t("briefs.statLatest")}</p>
              <p className="mt-1 tabular-nums text-heading">
                {formatShortDate(latestDate)}
              </p>
            </div>
            <div className="border-line px-4 py-4 sm:border-l sm:px-5">
              <p className="text-xs text-muted">{t("briefs.statCoverage")}</p>
              <p className="mt-1 tabular-nums text-heading">
                {formatShortDate(earliestDate)} - {formatShortDate(latestDate)}
              </p>
            </div>
          </section>

          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.month}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-base font-medium text-heading">
                    {group.label}
                  </h2>
                  <span className="text-xs text-muted">
                    {group.items.length} {t("briefs.pieces")}
                  </span>
                </div>

                <div className="space-y-3">
                  {group.items.map((brief) => (
                    <Link
                      key={brief.filename}
                      to={`/${locale}/briefs/${encodeURIComponent(brief.filename)}`}
                      className="group grid items-center gap-4 rounded-lg border border-line bg-surface px-5 py-4 shadow-card transition-all duration-200 hover:border-brand hover:shadow-cardHover sm:grid-cols-[auto_minmax(0,1fr)_auto]"
                    >
                      <BriefDateBadge date={brief.date} size="small" />
                      <span className="min-w-0 truncate font-medium text-heading group-hover:text-brand">
                        {brief.filename}
                      </span>
                      <span className="flex items-center justify-between gap-4 text-xs text-muted">
                        {formatFileSize(brief.sizeBytes)}
                        <ArrowUpRight
                          size={18}
                          className="shrink-0"
                          aria-hidden="true"
                        />
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}