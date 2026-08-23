interface MetricCardProps {
  label: string;
  value: number | null;
  hint?: string;
}

export function MetricCard({ label, value, hint }: MetricCardProps) {
  const formattedValue = value === null ? "—" : value.toLocaleString("en-US");

  return (
    <article className="rounded-[6px] border border-line bg-surface p-5 shadow-panel">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-heading">
        {formattedValue}
      </p>
      {hint ? <p className="mt-2 text-xs text-muted">{hint}</p> : null}
    </article>
  );
}
