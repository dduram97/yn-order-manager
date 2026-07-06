"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PasswordInput } from "@/components/auth/password-input";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "비밀번호 변경에 실패했습니다.");
      }

      setSuccess(json.message || "비밀번호가 변경되었습니다.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        router.push("/orders");
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "비밀번호 변경에 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6">
        <Link
          href="/orders"
          className="text-sm text-zinc-500 transition hover:text-zinc-700"
        >
          ← 돌아가기
        </Link>
        <h1 className="mt-3 text-xl font-bold text-zinc-900">비밀번호 변경</h1>
        <p className="mt-1 text-sm text-zinc-500">
          현재 비밀번호 확인 후 새 비밀번호를 설정합니다.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm max-md:space-y-5 max-md:p-5"
      >
        <PasswordInput
          id="current-password"
          label="현재 비밀번호"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
        />

        <PasswordInput
          id="new-password"
          label="새 비밀번호"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          placeholder="8자 이상"
        />

        <PasswordInput
          id="confirm-password"
          label="새 비밀번호 확인"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          placeholder="새 비밀번호 다시 입력"
        />

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
            {error}
          </p>
        )}

        {success && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 max-md:min-h-12"
        >
          {loading ? "저장 중..." : "저장"}
        </button>
      </form>
    </div>
  );
}
