import { useTranslation } from "react-i18next";

interface BriefHeading {
  id: string;
  text: string;
}

interface BriefTocProps {
  headings: BriefHeading[];
}

export function BriefToc({ headings }: BriefTocProps) {
  const { t } = useTranslation();

  if (!headings.length) {
    return null;
  }

  const scrollToHeading = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <aside className="lg:sticky lg:top-16" aria-label={t("briefs.toc")}>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
        {t("briefs.toc")}
      </h2>
      <nav>
        <ol className="space-y-2 border-l border-line pl-4">
          {headings.map((heading) => (
            <li key={heading.id}>
              <button
                type="button"
                onClick={() => scrollToHeading(heading.id)}
                className="text-left text-sm leading-5 text-muted transition-colors hover:text-brand"
              >
                {heading.text}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    </aside>
  );
}
