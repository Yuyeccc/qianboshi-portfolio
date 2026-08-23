import { ArrowLeft, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { BriefItem } from "@/types";

interface BriefPaginationProps {
  previous: BriefItem | null;
  next: BriefItem | null;
  locale: string;
}

function BriefNavigationItem({
  item,
  locale,
  direction,
  label,
}: {
  item: BriefItem | null;
  locale: string;
  direction: "previous" | "next";
  label: string;
}) {
  const Icon = direction === "previous" ? ArrowLeft : ArrowRight;
  const alignment = direction === "previous" ? "items-start" : "items-end";
  const textAlignment = direction === "previous" ? "text-left" : "text-right";

  if (!item) {
    return (
      <div className={`flex min-w-0 flex-col ${alignment} text-muted`}>
        <span className="mb-2 flex items-center gap-2 text-xs">
          {direction === "previous" && (
            <Icon className="h-4 w-4" aria-hidden="true" />
          )}
          {label}
          {direction === "next" && (
            <Icon className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
        <span className="max-w-full truncate text-sm">—</span>
      </div>
    );
  }

  return (
    <Link
      to={`/${locale}/briefs/${encodeURIComponent(item.filename)}`}
      className={`group flex min-w-0 flex-col ${alignment} text-muted transition-colors hover:text-brand`}
    >
      <span className="mb-2 flex items-center gap-2 text-xs">
        {direction === "previous" && (
          <Icon className="h-4 w-4" aria-hidden="true" />
        )}
        {label}
        {direction === "next" && (
          <Icon className="h-4 w-4" aria-hidden="true" />
        )}
      </span>
      <span
        className={`max-w-full truncate text-sm font-medium text-heading group-hover:text-brand ${textAlignment}`}
      >
        {item.filename}
      </span>
    </Link>
  );
}

export function BriefPagination({
  previous,
  next,
  locale,
}: BriefPaginationProps) {
  const { t } = useTranslation();

  return (
    <nav
      className="grid grid-cols-2 gap-6 border-t border-line py-8"
      aria-label={`${t("briefs.prev")} / ${t("briefs.next")}`}
    >
      <BriefNavigationItem
        item={previous}
        locale={locale}
        direction="previous"
        label={t("briefs.prev")}
      />
      <BriefNavigationItem
        item={next}
        locale={locale}
        direction="next"
        label={t("briefs.next")}
      />
    </nav>
  );
}
