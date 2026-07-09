import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminPrivateMemo } from "@/types/admin-memo";

type MemoApiResponse =
  | { success: true; data: Pick<AdminPrivateMemo, "content" | "updated_at"> }
  | { success: false; message: string };

type MemoContentRow = Pick<AdminPrivateMemo, "content" | "updated_at">;

export async function GET() {
  const auth = await requireAuth({ adminOnly: true });
  if (auth.error) return auth.error;

  const supabase = createAdminClient();
  const { data: rawData, error } = await supabase
    .from("admin_private_memos")
    .select("content, updated_at")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const data = rawData as MemoContentRow | null;

  if (error) {
    return NextResponse.json(
      { success: false, message: "메모를 불러오지 못했습니다." } satisfies MemoApiResponse,
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      content: data?.content ?? "",
      updated_at: data?.updated_at ?? new Date(0).toISOString(),
    },
  } satisfies MemoApiResponse);
}

export async function PUT(request: Request) {
  const auth = await requireAuth({ adminOnly: true });
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "요청 본문이 올바르지 않습니다." } satisfies MemoApiResponse,
      { status: 400 }
    );
  }

  const content =
    body && typeof body === "object" && "content" in body
      ? (body as { content?: unknown }).content
      : undefined;

  if (typeof content !== "string") {
    return NextResponse.json(
      { success: false, message: "content(string) 값이 필요합니다." } satisfies MemoApiResponse,
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data: rawData, error } = await supabase
    .from("admin_private_memos")
    .upsert(
      {
        user_id: auth.user.id,
        content,
      } as never,
      { onConflict: "user_id" }
    )
    .select("content, updated_at")
    .single();

  const data = rawData as MemoContentRow | null;

  if (error || !data) {
    return NextResponse.json(
      { success: false, message: "메모 저장에 실패했습니다." } satisfies MemoApiResponse,
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      content: data.content ?? "",
      updated_at: data.updated_at ?? new Date().toISOString(),
    },
  } satisfies MemoApiResponse);
}

