"use client";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** false면 확인 버튼만 표시 */
  showCancel?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title = "삭제 확인",
  message,
  confirmLabel = "삭제",
  cancelLabel = "취소",
  showCancel = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-zinc-900/40"
        onClick={() => {
          if (!loading) onCancel();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
      >
        <div className="space-y-2 px-4 py-4">
          <h2
            id="confirm-dialog-title"
            className="text-sm font-semibold text-zinc-900"
          >
            {title}
          </h2>
          <p className="whitespace-pre-line text-sm text-zinc-600">{message}</p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-4 py-3">
          {showCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "처리 중..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
