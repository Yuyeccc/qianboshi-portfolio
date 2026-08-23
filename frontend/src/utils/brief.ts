import type { BriefItem } from "@/types";

export function slugify(text: string): string {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

export function extractBriefHeadings(
  content: string,
): Array<{ id: string; text: string }> {
  const usedIds = new Map<string, number>();
  const headings: Array<{ id: string; text: string }> = [];

  for (const match of content.matchAll(/^##\s+(.+)$/gm)) {
    const text = match[1].trim();
    const baseId = slugify(text) || "section";
    const count = (usedIds.get(baseId) ?? 0) + 1;
    usedIds.set(baseId, count);

    headings.push({
      id: count === 1 ? baseId : `${baseId}-${count}`,
      text,
    });
  }

  return headings;
}

export function extractBriefSummary(content: string, maxLen = 90): string {
  const paragraphs = content.split(/\n\s*\n/);

  for (const paragraph of paragraphs) {
    const lines = paragraph
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(
        (line) => line && !/^={2,}\s*$/.test(line) && !/^#{1,6}\s+/.test(line),
      );

    if (!lines.length) {
      continue;
    }

    const summary = lines
      .join(" ")
      .replace(/[#*>`()\[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!summary) {
      continue;
    }

    return summary.length > maxLen ? `${summary.slice(0, maxLen)}…` : summary;
  }

  return "";
}

export function countBriefSections(content: string): number {
  return (content.match(/^##\s+/gm) ?? []).length;
}

export function groupBriefsByMonth(
  items: BriefItem[],
): Array<{ month: string; label: string; items: BriefItem[] }> {
  const groups = new Map<string, BriefItem[]>();

  for (const item of items) {
    const sourceDate = item.date ?? item.generatedAt;
    const monthMatch = sourceDate?.match(/^(\d{4})-(\d{1,2})/);
    const month = monthMatch
      ? `${monthMatch[1]}-${monthMatch[2].padStart(2, "0")}`
      : "unknown";

    const group = groups.get(month) ?? [];
    group.push(item);
    groups.set(month, group);
  }

  return [...groups.entries()]
    .sort(([first], [second]) => {
      if (first === "unknown") return 1;
      if (second === "unknown") return -1;
      return second.localeCompare(first);
    })
    .map(([month, itemsInMonth]) => {
      if (month === "unknown") {
        return { month, label: "—", items: itemsInMonth };
      }

      const [year, monthNumber] = month.split("-");
      return {
        month,
        label: `${year} 年 ${Number(monthNumber)} 月`,
        items: itemsInMonth,
      };
    });
}

export function formatShortDate(date: string | null): string {
  const match = date?.match(/^\d{4}-(\d{1,2})-(\d{1,2})/);

  if (!match) {
    return "—";
  }

  return `${Number(match[1])}月${Number(match[2])}日`;
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) {
    return "—";
  }

  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
