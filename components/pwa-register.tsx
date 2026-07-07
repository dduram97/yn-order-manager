"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  isMobileDevice,
  isStandaloneMode,
  shouldEnablePwa,
} from "@/lib/pwa";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaRegister() {
  const pathname = usePathname();
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showManualHint, setShowManualHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    // HTTP/로컬 환경: 등록된 SW 제거 (API·로그인 방해 방지)
    if ("serviceWorker" in navigator && !shouldEnablePwa()) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.unregister();
      });
    }

    if (!isMobileDevice()) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStandalone(isStandaloneMode());

    // dev / HTTP LAN: SW 등록 금지 (캐시된 ok-page·라우팅 꼬임 방지)
    if (shouldEnablePwa() && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* 등록 실패 무시 */
      });
    } else if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.unregister();
      });
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    if (
      shouldEnablePwa() &&
      !isStandaloneMode() &&
      !localStorage.getItem("yn_pwa_install_dismiss")
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowManualHint(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  const dismiss = () => {
    setDismissed(true);
    setShowManualHint(false);
    localStorage.setItem("yn_pwa_install_dismiss", "1");
  };

  if (
    !shouldEnablePwa() ||
    standalone ||
    dismissed ||
    pathname === "/login" ||
    !showManualHint
  ) {
    return null;
  }

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur max-md:block md:hidden">
      {installEvent ? (
        <div className="flex items-center gap-3">
          <p className="flex-1 text-sm text-zinc-700">
            홈 화면에 추가하면 앱처럼 사용할 수 있습니다.
          </p>
          <button
            type="button"
            onClick={() => void handleInstall()}
            className="min-h-12 shrink-0 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white"
          >
            설치
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="min-h-12 shrink-0 rounded-xl px-3 text-sm text-zinc-500"
          >
            닫기
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <p className="flex-1 text-sm text-zinc-700">
            {isIos ? (
              <>
                Safari <strong>공유 → 홈 화면에 추가</strong>
              </>
            ) : (
              <>
                Chrome <strong>⋮ 메뉴 → 홈 화면에 추가</strong>
              </>
            )}
            로 앱처럼 설치하세요.
          </p>
          <button
            type="button"
            onClick={dismiss}
            className="min-h-12 shrink-0 rounded-xl px-3 text-sm text-zinc-500"
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
}
