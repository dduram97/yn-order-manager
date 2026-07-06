"use client";

import { useCallback, useEffect, useState } from "react";

export type ToastVariant = "success" | "error";

interface ToastState {
  message: string;
  variant: ToastVariant;
}

export function useToast(durationMs = 4000) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      setToast({ message, variant });
    },
    []
  );

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      setToast(null);
    }, durationMs);

    return () => window.clearTimeout(timer);
  }, [toast, durationMs]);

  return { toast, showToast, dismissToast };
}

interface ToastProps {
  toast: ToastState | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  if (!toast) return null;

  const isSuccess = toast.variant === "success";

  return (
    <div
      role="status"
      className={`fixed bottom-6 left-1/2 z-50 flex max-w-md -translate-x-1/2 items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-xs opacity-70 hover:opacity-100"
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  );
}
