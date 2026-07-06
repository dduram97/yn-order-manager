import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { setCustomerFavorite } from "@/lib/supabase/customers";
import { createClient } from "@/lib/supabase/server";
import { validateOrderId } from "@/lib/validations/order";

/**
 * PATCH /api/customers/[id]/favorite
 * body: { is_favorite: boolean }
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const idValidation = validateOrderId(id);

    if (!idValidation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "고객 ID가 올바르지 않습니다.",
          errors: idValidation.errors,
        },
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "요청 본문이 올바른 JSON 형식이 아닙니다." },
        { status: 400 }
      );
    }

    const isFavorite =
      body &&
      typeof body === "object" &&
      "is_favorite" in body &&
      typeof (body as { is_favorite: unknown }).is_favorite === "boolean"
        ? (body as { is_favorite: boolean }).is_favorite
        : null;

    if (isFavorite === null) {
      return NextResponse.json(
        {
          success: false,
          message: "is_favorite(boolean) 필드가 필요합니다.",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await setCustomerFavorite(
      supabase,
      idValidation.id,
      isFavorite
    );

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: "즐겨찾기 저장 중 오류가 발생했습니다.",
          error: error.message,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, message: "고객을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, message: "서버 오류가 발생했습니다.", error: message },
      { status: 500 }
    );
  }
}
