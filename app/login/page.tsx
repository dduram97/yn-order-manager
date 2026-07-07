"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  loadSavedEmailPrefs,
  persistLoginPrefs,
} from "@/lib/auth/client-storage";

function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const errorParam = searchParams.get("error");
  const emailParam = searchParams.get("email");

  const [ready, setReady] = useState(false);
  const [defaultEmail, setDefaultEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [rememberEmail, setRememberEmail] = useState(false);

  useEffect(() => {
    const prefs = loadSavedEmailPrefs();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDefaultEmail(emailParam ?? prefs.email);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRememberEmail(prefs.rememberEmail);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRememberMe(prefs.rememberMe);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
  }, [emailParam]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const formData = new FormData(form);
    const emailVal = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const rememberMeVal = formData.get("rememberMe") === "true";

    try {
      persistLoginPrefs(emailVal, rememberEmail, rememberMeVal);
    } catch {
      /* localStorage 차단 시에도 로그인 진행 */
    }
    // native form POST — preventDefault 없음 (쿠키는 redirect 응답으로 설정)
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 max-md:min-h-[100dvh] max-md:px-5 max-md:py-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm max-md:rounded-xl max-md:p-6">
        <div className="mb-8 text-center max-md:mb-6">
          <p className="text-sm font-medium text-zinc-500">유선주문 알림톡</p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900 max-md:text-xl">
            로그인
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            이메일과 비밀번호로 로그인하세요.
          </p>
        </div>

        <form
          method="POST"
          action="/api/auth/login"
          onSubmit={handleSubmit}
          className="space-y-4 max-md:space-y-5"
        >
          <input type="hidden" name="next" value={nextPath ?? ""} />
          <input
            type="hidden"
            name="rememberMe"
            value={rememberMe ? "true" : "false"}
          />

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">이메일</span>
            <input
              type="email"
              name="email"
              defaultValue={defaultEmail}
              autoComplete="username"
              required
              placeholder="admin@yn-order.local"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 max-md:min-h-12 max-md:text-base"
            />
          </label>

          <UncontrolledPasswordInput />

          <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-3 max-md:gap-1 max-md:px-3 max-md:py-3">
            <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 shrink-0 rounded border-zinc-300 max-md:h-5 max-md:w-5"
              />
              <span className="truncate text-sm text-zinc-700">로그인 유지</span>
            </label>

            <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-end gap-2">
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
                className="h-4 w-4 shrink-0 rounded border-zinc-300 max-md:h-5 max-md:w-5"
              />
              <span className="truncate text-sm text-zinc-700">아이디 저장</span>
            </label>
          </div>

          {errorParam && (
            <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              {errorParam}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 max-md:min-h-12 max-md:rounded-xl max-md:text-base"
          >
            로그인
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-400 max-md:mt-5">
          여러 기기에서 동시 로그인 가능 · 세션 충돌 없음
        </p>
      </div>
    </div>
  );
}

function UncontrolledPasswordInput() {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block space-y-1.5" htmlFor="login-password">
      <span className="text-xs font-medium text-zinc-500">비밀번호</span>
      <div className="relative">
        <input
          id="login-password"
          name="password"
          type={visible ? "text" : "password"}
          autoComplete="current-password"
          required
          placeholder="비밀번호"
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
          불러오는 중...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
