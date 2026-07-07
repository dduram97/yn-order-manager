"use client";

interface TrackingNumbersInputProps {
  values: string[];
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

export function TrackingNumbersInput({
  values,
  onChange,
  onAdd,
  onRemove,
  disabled = false,
  readOnly = false,
}: TrackingNumbersInputProps) {
  const isDisabled = disabled || readOnly;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={value}
              onChange={(e) => onChange(index, e.target.value)}
              disabled={isDisabled}
              placeholder="송장번호"
              aria-label={`송장번호 ${index + 1}`}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 disabled:bg-zinc-50 disabled:text-zinc-600"
            />
            {values.length > 1 && !readOnly && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                disabled={disabled}
                aria-label={`송장번호 ${index + 1} 삭제`}
                className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                X
              </button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled}
          className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100 disabled:opacity-50 max-md:min-h-12"
        >
          + 송장 추가
        </button>
      )}
    </div>
  );
}
