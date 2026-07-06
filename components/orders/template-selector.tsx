"use client";

import {
  ALIGO_TEMPLATE_OPTIONS,
  type AligoTemplateType,
} from "@/lib/constants/aligo";

interface TemplateSelectorProps {
  value: AligoTemplateType;
  onChange: (value: AligoTemplateType) => void;
  disabled?: boolean;
}

export function TemplateSelector({
  value,
  onChange,
  disabled = false,
}: TemplateSelectorProps) {
  return (
    <div className="space-y-2">
      {ALIGO_TEMPLATE_OPTIONS.map((option) => (
        <label
          key={option}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
            value === option
              ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900"
              : "border-zinc-200 hover:border-zinc-300"
          } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        >
          <input
            type="radio"
            name="aligo_template_type"
            value={option}
            checked={value === option}
            disabled={disabled}
            onChange={() => onChange(option)}
            className="accent-zinc-900"
          />
          <span className="text-sm font-medium text-zinc-800">{option}</span>
        </label>
      ))}
    </div>
  );
}
