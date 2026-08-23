import type { ReactNode } from "react";

interface BriefDateBadgeProps {
  date: string | null;
  size?: "large" | "small";
}

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

function parseDate(date: string | null) {
  const match = date?.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

  if (!match) {
    return null;
  }

  return {
    year: match[1],
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function DateFallback({ size }: { size: "large" | "small" }) {
  if (size === "small") {
    return (
      <span
        className="tabular-nums text-sm font-medium text-muted"
        aria-label="—"
      >
        —
      </span>
    );
  }

  return (
    <span
      className="text-2xl font-medium tabular-nums text-heading"
      aria-label="—"
    >
      —
    </span>
  );
}

export function BriefDateBadge({
  date,
  size = "large",
}: BriefDateBadgeProps): ReactNode {
  const parsed = parseDate(date);

  if (size === "small") {
    return (
      <div
        className="inline-flex min-h-9 min-w-[4.25rem] items-center justify-center rounded-md border border-line bg-surfaceSubtle px-2.5"
        aria-label={parsed ? `${parsed.month}.${parsed.day}` : "—"}
      >
        {parsed ? (
          <span className="tabular-nums text-sm font-medium text-heading">
            {parsed.month}.{String(parsed.day).padStart(2, "0")}
          </span>
        ) : (
          <DateFallback size="small" />
        )}
      </div>
    );
  }

  return (
    <div
      className="flex aspect-square w-[5.5rem] flex-col items-center justify-center rounded-lg border border-line bg-surfaceSubtle"
      aria-label={
        parsed
          ? `${parsed.year}-${String(parsed.month).padStart(2, "0")}-${String(
              parsed.day,
            ).padStart(2, "0")}`
          : "—"
      }
    >
      {parsed ? (
        <>
          <span className="text-2xl font-medium tabular-nums leading-none text-heading">
            {parsed.day}
          </span>
          <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted">
            {MONTHS[parsed.month - 1]} {parsed.year}
          </span>
        </>
      ) : (
        <DateFallback size="large" />
      )}
    </div>
  );
}
