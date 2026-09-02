import { ReactNode } from "react";

interface ChartFrameProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  /** 覆盖内容容器默认的固定高度（默认 h-64）。列表类内容请传入可自适应/可滚动的高度类，避免固定 256px 溢出。 */
  bodyClassName?: string;
}

export default function ChartFrame({
  title,
  subtitle,
  children,
  className = "",
  bodyClassName,
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
      <div className={`min-w-0 ${bodyClassName ?? "h-64"}`}>{children}</div>
    </section>
  );
}
