"use client";

import type { AligoTemplateType } from "@/lib/constants/aligo";
import {
  getAllFormFields,
  type TemplateFieldKey,
  type TemplateFieldValues,
} from "@/lib/aligo/template-schema";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10";

interface TemplateVariableFieldsProps {
  templateType: AligoTemplateType;
  values: TemplateFieldValues;
  onChange: (key: TemplateFieldKey, value: string) => void;
  disabled?: boolean;
  omitKeys?: TemplateFieldKey[];
}

export function TemplateVariableFields({
  templateType,
  values,
  onChange,
  disabled = false,
  omitKeys,
}: TemplateVariableFieldsProps) {
  const fields = getAllFormFields(templateType).filter((field) =>
    omitKeys?.includes(field.key) ? false : true
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((field) => (
        <label
          key={field.key}
          className={`block space-y-1.5 ${
            field.key === "tracking_number" ? "sm:col-span-2" : ""
          }`}
        >
          <span className="text-xs font-medium text-zinc-500">
            {field.label}
          </span>
          <input
            value={values[field.key]}
            onChange={(e) => onChange(field.key, e.target.value)}
            disabled={disabled}
            placeholder={field.key === "phone" ? "010-1234-5678" : undefined}
            className={inputClass}
          />
        </label>
      ))}
    </div>
  );
}

interface TemplateVariableSummaryProps {
  templateType: AligoTemplateType;
  values: TemplateFieldValues;
  formatPhone?: (phone: string) => string;
}

export function TemplateVariableSummary({
  templateType,
  values,
  formatPhone,
}: TemplateVariableSummaryProps) {
  const fields = getAllFormFields(templateType);

  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {fields.map((field) => {
        const raw = values[field.key];
        const display =
          field.key === "phone" && formatPhone ? formatPhone(raw) : raw;

        return (
          <div key={field.key} className="flex gap-2">
            <dt className="w-20 shrink-0 text-zinc-400">{field.label}</dt>
            <dd className="font-medium text-zinc-800">{display || "-"}</dd>
          </div>
        );
      })}
    </dl>
  );
}
