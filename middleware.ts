import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ADMIN_ONLY_API_PREFIXES,
  ADMIN_ONLY_PATHS,
} from "@/lib/auth/constants";
import { requestAbsoluteUrl } from "@/lib/auth/request-url";
import { getSessionUserFromRequest } from "@/lib/auth/session";

const PUBLIC_PATHS = ["/login"];
const PUBLIC_API_PATHS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/ping",
  "/api/test",
  "/api/health",
  "/api/aligo/env-check",
  /** 고객용 배송조회 — yn-customer BFF에서 호출 (로그인 불필요) */
  "/api/tracking",
];

function isStaticAsset(pathname: string): boolean {
  return (
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icons/") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/) != null
  );
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function isPublicApiPath(pathname: string): boolean {
  const normalized =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return PUBLIC_API_PATHS.some((path) => normalized === path);
}

function isAdminOnlyPage(pathname: string): boolean {
  return ADMIN_ONLY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function isAdminOnlyApi(pathname: string): boolean {
  if (pathname.startsWith("/api/auth")) {
    return false;
  }

  if (ADMIN_ONLY_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  return false;
}

function requiresAdminForApi(pathname: string, method: string): boolean {
  if (isAdminOnlyApi(pathname)) {
    return true;
  }

  if (pathname === "/api/orders" && method === "POST") {
    return true;
  }

  if (pathname.match(/^\/api\/orders\/[^/]+\/send$/) && method === "POST") {
    return true;
  }

  if (pathname.match(/^\/api\/orders\/[^/]+$/) && method === "PATCH") {
    return true;
  }

  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    isStaticAsset(pathname)
  ) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    const user = await getSessionUserFromRequest(request);
    if (user && pathname === "/login") {
      const redirectTo =
        user.role === "admin" ? "/orders/new" : "/orders";
      return NextResponse.redirect(requestAbsoluteUrl(request, redirectTo));
    }
    return NextResponse.next();
  }

  const user = await getSessionUserFromRequest(request);

  if (!user) {
    if (pathname.startsWith("/api/")) {
      if (isPublicApiPath(pathname)) {
        return NextResponse.next();
      }
      return NextResponse.json(
        { success: false, message: "로그인이 필요합니다." },
        { status: 401 }
      );
    }

    const loginUrl = requestAbsoluteUrl(request, "/login");
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user.role !== "admin") {
    if (isAdminOnlyPage(pathname)) {
      return NextResponse.redirect(requestAbsoluteUrl(request, "/orders"));
    }

    if (
      pathname.startsWith("/api/") &&
      requiresAdminForApi(pathname, request.method)
    ) {
      return NextResponse.json(
        { success: false, message: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }
  }

  if (pathname === "/" || pathname === "") {
    const redirectTo = user.role === "admin" ? "/orders/new" : "/orders";
    return NextResponse.redirect(requestAbsoluteUrl(request, redirectTo));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
