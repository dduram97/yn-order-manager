import { NextResponse } from "next/server";
import {
  authenticateLogin,
  isFormLoginRequest,
  parseLoginFormData,
  parseLoginJson,
} from "@/lib/auth/login-handler";
import { requestAbsoluteUrl } from "@/lib/auth/request-url";
import { setSessionCookie } from "@/lib/auth/session";

function loginErrorRedirect(request: Request, message: string, email?: string) {
  const url = requestAbsoluteUrl(request, "/login");
  url.searchParams.set("error", message);
  if (email?.trim()) {
    url.searchParams.set("email", email.trim().toLowerCase());
  }
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const formLogin = isFormLoginRequest(request);

  try {
    let input;
    if (formLogin) {
      input = parseLoginFormData(await request.formData());
    } else {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { success: false, message: "요청 본문이 올바른 JSON 형식이 아닙니다." },
          { status: 400 }
        );
      }
      input = parseLoginJson(body);
    }

    const result = await authenticateLogin(input);

    if (!result.ok) {
      if (formLogin) {
        return loginErrorRedirect(request, result.message, input.email);
      }
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    if (formLogin) {
      const response = NextResponse.redirect(
        requestAbsoluteUrl(request, result.redirectTo),
        303
      );
      return setSessionCookie(response, result.token, {
        rememberMe: result.rememberMe,
      });
    }

    const response = NextResponse.json({
      success: true,
      message: "로그인되었습니다.",
      data: { ...result.sessionUser, rememberMe: result.rememberMe },
    });

    return setSessionCookie(response, result.token, {
      rememberMe: result.rememberMe,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/auth/login] ❌", message);

    if (formLogin) {
      return loginErrorRedirect(
        request,
        "로그인 처리 중 오류가 발생했습니다."
      );
    }

    return NextResponse.json(
      { success: false, message: "로그인 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
