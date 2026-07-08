"use client";

import {
  sanitizeTrackingNumberInput,
  TRACKING_NUMBER_LENGTH,
} from "@/lib/validations/tracking-number";

const ALLOWED_KEYS = new Set([
  "Backspace",
  "Delete",
  "Tab",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
]);

function blockNonDigitKey(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (ALLOWED_KEYS.has(e.key)) return;
  if (/^\d$/.test(e.key)) return;
  e.preventDefault();
}

interface TrackingNumberFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  placeholder?: string;
}

export function TrackingNumberField({
  value,
  onChange,
  disabled = false,
  id,
  "aria-label": ariaLabel,
  placeholder = "운송장번호",
}: TrackingNumberFieldProps) {
  const handleChange = (next: string) => {
    onChange(sanitizeTrackingNumberInput(next));
  };

  return (
    <div className="space-y-1">
      <input
        id={id}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={blockNonDigitKey}
        onPaste={(e) => {
          e.preventDefault();
          const pasted = e.clipboardData.getData("text");
          const input = e.currentTarget;
          const start = input.selectionStart ?? value.length;
          const end = input.selectionEnd ?? value.length;
          const merged = value.slice(0, start) + pasted + value.slice(end);
          handleChange(merged);
        }}
        disabled={disabled}
        placeholder={placeholder}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={TRACKING_NUMBER_LENGTH}
        aria-label={ariaLabel}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm tabular-nums outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 disabled:bg-zinc-50 disabled:text-zinc-600"
      />
      <p
        className={`text-right text-xs tabular-nums ${
          value.length === TRACKING_NUMBER_LENGTH
            ? "font-medium text-emerald-600"
            : "text-zinc-500"
        }`}
        aria-live="polite"
      >
        {value.length} / {TRACKING_NUMBER_LENGTH} 자리
      </p>
    </div>
  );
}

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
      <div className="space-y-3">
        {values.map((value, index) => (
          <div key={index} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <TrackingNumberField
                value={value}
                onChange={(next) => onChange(index, next)}
                disabled={isDisabled}
                aria-label={`운송장번호 ${index + 1}`}
              />
            </div>
            {values.length > 1 && !readOnly && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                disabled={disabled}
                aria-label={`운송장번호 ${index + 1} 삭제`}
                className="mt-0.5 shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
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
