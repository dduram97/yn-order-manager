import { NextResponse } from "next/server";
import { getCustomerTrackingByInvoice } from "@/lib/delivery/customer-tracking";

/**
 * GET /api/tracking?invoiceNo={송장번호}
 * 고객용 공개 배송조회 API (yn-customer → yn-order-manager)
 */
export async function GET(request: Request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const invoiceNo = searchParams.get("invoiceNo") ?? "";

  console.log("[GET /api/tracking] request", {
    invoiceNo: invoiceNo.trim() ? "(present)" : "(empty)",
    invoiceLen: invoiceNo.trim().length,
  });

  if (!invoiceNo.trim()) {
    return NextResponse.json(
      {
        success: false,
        errorCode: "INVALID_INVOICE",
        message: "송장번호가 필요합니다.",
      },
      { status: 400 }
    );
  }

  const result = await getCustomerTrackingByInvoice(invoiceNo);

  if (!result.ok) {
    console.log("[GET /api/tracking] fail", {
      errorCode: result.errorCode,
      message: result.message,
      elapsedMs: Date.now() - startedAt,
    });

    const status =
      result.errorCode === "INVALID_INVOICE"
        ? 400
        : result.errorCode === "NOT_FOUND"
          ? 404
          : 500;

    return NextResponse.json(
      {
        success: false,
        errorCode: result.errorCode,
        message: result.message,
        elapsedMs: Date.now() - startedAt,
      },
      { status }
    );
  }

  console.log("[GET /api/tracking] success", {
    elapsedMs: Date.now() - startedAt,
  });

  return NextResponse.json({
    success: true,
    data: result.data,
    elapsedMs: Date.now() - startedAt,
  });
}
