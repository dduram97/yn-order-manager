import Link from "next/link";

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = "목록으로",
  action,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="text-sm font-medium text-zinc-500 transition hover:text-zinc-800"
          >
            ← {backLabel}
          </Link>
        )}
        <h1 className={`text-2xl font-bold text-zinc-900 ${backHref ? "mt-2" : ""}`}>
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
