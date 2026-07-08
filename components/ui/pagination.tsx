interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  unit?: string;
  onPageChange: (page: number) => void;
}

function getPageNumbers(current: number, total: number): number[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  let start = Math.max(1, current - 2);
  const end = Math.min(total, start + 4);
  start = Math.max(1, end - 4);

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function Pagination({
  page,
  totalPages,
  totalCount,
  unit = "건",
  onPageChange,
}: PaginationProps) {
  if (totalCount <= 0) return null;

  const pages = getPageNumbers(page, totalPages);
  const showPageButtons = totalPages > 1;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-zinc-500">
        총 {totalCount.toLocaleString()}
        {unit} · {page}/{Math.max(totalPages, 1)} 페이지
      </p>
      {showPageButtons && (
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          이전
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? "page" : undefined}
            className={`min-w-[2.25rem] rounded-lg border px-3 py-2 text-sm font-medium transition ${
              p === page
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          다음
        </button>
      </div>
      )}
    </div>
  );
}
