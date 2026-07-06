"use client";

import { useState } from "react";

interface PasswordInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  label?: string;
}

export function PasswordInput({
  id,
  name,
  value,
  onChange,
  placeholder = "비밀번호",
  autoComplete = "current-password",
  required = true,
  label,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block space-y-1.5" htmlFor={id}>
      {label && (
        <span className="text-xs font-medium text-zinc-500">{label}</span>
      )}
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          placeholder={placeholder}
          className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-3 pr-11 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 max-md:min-h-12 max-md:text-base"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-base text-zinc-400 transition hover:text-zinc-600 max-md:min-h-12"
        >
          {visible ? "🙈" : "👁"}
        </button>
      </div>
    </label>
  );
}
