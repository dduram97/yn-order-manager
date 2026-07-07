"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface UserMenuProps {
  onLogout: () => void;
}

export function UserMenu({ onLogout }: UserMenuProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 max-md:min-h-10 max-md:px-3"
      >
        계정 ▾
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-[10rem] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        >
          <Link
            href="/account/email"
            role="menuitem"
            className="block px-3 py-2.5 text-sm text-zinc-700 transition hover:bg-zinc-50 max-md:min-h-11 max-md:py-3"
            onClick={() => setOpen(false)}
          >
            아이디 변경
          </Link>
          <Link
            href="/account/password"
            role="menuitem"
            className="block px-3 py-2.5 text-sm text-zinc-700 transition hover:bg-zinc-50 max-md:min-h-11 max-md:py-3"
            onClick={() => setOpen(false)}
          >
            비밀번호 변경
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void onLogout();
            }}
            className="block w-full px-3 py-2.5 text-left text-sm text-zinc-700 transition hover:bg-zinc-50 max-md:min-h-11 max-md:py-3"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
