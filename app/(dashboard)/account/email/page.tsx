"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PasswordInput } from "@/components/auth/password-input";
import { updateSavedEmail } from "@/lib/auth/client-storage";

export default function ChangeEmailPage() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/auth/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          newEmail,
          currentPassword,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "아이디 변경에 실패했습니다.");
      }

      updateSavedEmail(newEmail);
      await refresh();

      setSuccess(json.message || "아이디가 변경되었습니다.");
      setNewEmail("");
      setCurrentPassword("");

      setTimeout(() => {
        router.push("/orders");
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "아이디 변경에 실패했습니다."
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
        <h1 className="mt-3 text-xl font-bold text-zinc-900">아이디 변경</h1>
        <p className="mt-1 text-sm text-zinc-500">
          현재 비밀번호 확인 후 새 아이디를 설정합니다.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm max-md:space-y-5 max-md:p-5"
      >
        <div className="space-y-1.5">
          <label
            htmlFor="current-email"
            className="block text-sm font-medium text-zinc-700"
          >
            현재 아이디
          </label>
          <input
            id="current-email"
            type="email"
            value={user?.email ?? ""}
            readOnly
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="new-email"
            className="block text-sm font-medium text-zinc-700"
          >
            새 아이디
          </label>
          <input
            id="new-email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            autoComplete="username"
            placeholder="new@example.com"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
          />
        </div>

        <PasswordInput
          id="current-password"
          label="현재 비밀번호"
          value={currentPassword}
          onChange={setCurrentPassword}
          autoComplete="current-password"
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
          {loading ? "변경 중..." : "변경"}
        </button>
      </form>
    </div>
  );
}
