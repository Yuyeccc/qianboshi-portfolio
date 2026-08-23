import { ReactNode } from "react";

interface ChartFrameProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export default function ChartFrame({
  title,
  subtitle,
  children,
  className = "",
}: ChartFrameProps) {
  return (
    <section
      className={`rounded-lg border border-line bg-surface p-5 shadow-card ${className}`}
    >
      <header className="mb-4 min-h-10">
        <h2 className="text-sm font-medium text-heading">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-xs leading-5 text-muted">{subtitle}</p>
        ) : null}
      </header>
      <div className="h-64 min-w-0">{children}</div>
    </section>
  );
}
