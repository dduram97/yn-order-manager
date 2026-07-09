"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface AdminMemoModalProps {
  open: boolean;
  onClose: () => void;
}

type MemoApiResponse =
  | { success: true; data: { content: string; updated_at: string } }
  | { success: false; message: string };

const textareaClass =
  "w-full min-h-[240px] resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10";

export function AdminMemoModal({ open, onClose }: AdminMemoModalProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const lastSavedRef = useRef<string>("");
  const saveTimerRef = useRef<number | null>(null);
  const contentRef = useRef(content);

  const canClose = useMemo(() => !loading && !saving, [loading, saving]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const saveMemo = useCallback(async (text: string): Promise<boolean> => {
    const res = await fetch("/api/admin/memo", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    const json: MemoApiResponse = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(
        (json as { message?: string }).message || "메모 저장에 실패했습니다."
      );
    }
    lastSavedRef.current = json.data.content ?? "";
    return true;
  }, []);

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const pending = contentRef.current;
    if (pending === lastSavedRef.current) return;

    setSaving(true);
    try {
      await saveMemo(pending);
    } catch {
      // 저장 실패는 조용히 허용
    } finally {
      setSaving(false);
    }
  }, [saveMemo]);

  const handleClose = () => {
    if (!canClose) return;
    void flushPendingSave().finally(() => {
      onClose();
    });
  };

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setSaving(false);

    void (async () => {
      try {
        const res = await fetch("/api/admin/memo");
        const json: MemoApiResponse = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(
            (json as { message?: string }).message || "메모를 불러오지 못했습니다."
          );
        }
        setContent(json.data.content ?? "");
        lastSavedRef.current = json.data.content ?? "";
      } catch {
        // API 오류는 UI에 노출하지 않음 (운영자 개인 메모는 조용히 실패 허용)
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, canClose]);

  useEffect(() => {
    if (!open) return;
    if (loading) return;
    if (content === lastSavedRef.current) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        setSaving(true);
        try {
          await saveMemo(content);
        } catch {
          // 저장 실패도 UI에 노출하지 않음
        } finally {
          setSaving(false);
        }
      })();
    }, 600);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [content, open, loading, saveMemo]);

  useEffect(() => {
    if (!open) return;

    const onBeforeUnload = () => {
      const pending = contentRef.current;
      if (pending === lastSavedRef.current) return;

      void fetch("/api/admin/memo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: pending }),
        keepalive: true,
      });
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      void flushPendingSave();
    };
  }, [open, flushPendingSave]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-zinc-900/40"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-memo-title"
        className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
      >
        <div className="shrink-0 border-b border-zinc-100 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="admin-memo-title"
                className="text-sm font-semibold text-zinc-900"
              >
                메모
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                {loading
                  ? "불러오는 중..."
                  : saving
                    ? "자동 저장 중..."
                    : "자동 저장됩니다."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={!canClose}
              className="shrink-0 rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="자유롭게 메모를 작성하세요."
            className={textareaClass}
            disabled={loading}
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
