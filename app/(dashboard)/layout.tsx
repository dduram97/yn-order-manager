"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { UserMenu } from "@/components/auth/user-menu";

const ALL_NAV_ITEMS = [
  { href: "/orders/new", label: "발송 등록", icon: "✉️", adminOnly: true },
  { href: "/orders", label: "발송 현황", icon: "📦", adminOnly: false },
  { href: "/customers", label: "고객 관리", icon: "👥", adminOnly: false },
  { href: "/stats", label: "통계", icon: "📊", adminOnly: true },
];

function RoleBadge({ role }: { role: "admin" | "staff" }) {
  const isAdmin = role === "admin";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        isAdmin
          ? "bg-violet-100 text-violet-700"
          : "bg-sky-100 text-sky-700"
      }`}
    >
      {isAdmin ? "ADMIN" : "STAFF"}
    </span>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();

  const navItems = ALL_NAV_ITEMS.filter(
    (item) => !item.adminOnly || user?.role === "admin"
  );

  const isActive = (href: string) => {
    if (href === "/orders") {
      return (
        pathname === "/orders" ||
        (pathname.startsWith("/orders/") &&
          pathname !== "/orders/new" &&
          !pathname.startsWith("/orders/new/"))
      );
    }
    if (href === "/orders/new") {
      return pathname === "/orders/new" || pathname.startsWith("/orders/new/");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-sm text-zinc-500">
        세션 확인 중...
      </div>
    );
  }

  const showLogout = true;

  return (
    <div className="min-h-screen bg-zinc-50 max-md:mobile-app-shell max-md:flex max-md:flex-col">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur max-md:pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href={user?.role === "admin" ? "/orders/new" : "/orders"}
            className="min-w-0"
          >
            <p className="truncate text-lg font-bold text-zinc-900">
              YN 알림톡 관리
            </p>
            <p className="truncate text-xs text-zinc-500">
              택배 · 선물 발송 SaaS
            </p>
          </Link>

          <div className="flex items-center gap-3">
            <nav className="hidden gap-1 sm:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive(item.href)
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {showLogout && (
              <div className="hidden items-center gap-2 sm:flex">
                {user && <RoleBadge role={user.role} />}
                {user && (
                  <span className="max-w-[140px] truncate text-xs text-zinc-500">
                    {user.email}
                  </span>
                )}
                <UserMenu onLogout={logout} />
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-zinc-100 px-4 py-2 sm:hidden">
          <div className="mb-2 flex items-center justify-between gap-2">
            {user && <RoleBadge role={user.role} />}
            {showLogout && <UserMenu onLogout={logout} />}
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  isActive(item.href)
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {item.icon} {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl flex-1 px-4 py-6 sm:px-6 max-md:pb-[max(1.5rem,env(safe-area-inset-bottom))] max-md:overscroll-y-contain">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
