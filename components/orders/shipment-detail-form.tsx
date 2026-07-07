"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { AligoStatusBadge } from "@/components/orders/aligo-status-badge";
import { TemplateSelector } from "@/components/orders/template-selector";
import {
  TemplateVariableFields,
  TemplateVariableSummary,
} from "@/components/orders/template-variable-fields";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Toast, useToast } from "@/components/ui/toast";
import {
  ALIGO_FAIL_REASON_LABEL,
  DEFAULT_ALIGO_TEMPLATE_TYPE,
  type AligoTemplateType,
} from "@/lib/constants/aligo";
import { MAX_ALIGO_RETRY } from "@/lib/constants/order";
import {
  createEmptyFieldValues,
  fieldValuesToOrderData,
  orderToFieldValues,
  resolveListCustomerNameByType,
  type TemplateFieldKey,
  type TemplateFieldValues,
} from "@/lib/aligo/template-schema";
import { formatDateTime, formatPhone } from "@/lib/utils/format";
import type { AligoFailReason, AligoStatus, Order } from "@/types/database";
import type { AligoResponseLog } from "@/types/aligo-audit";

interface OrderApiResponse {
  success: boolean;
  data: Order;
  tracking_numbers?: string[];
  message?: string;
  errors?: { field: string; message: string }[];
}

interface SendResultItem {
  success: boolean;
  orderId: string | null;
  tracking_number: string | null;
  failReason?: AligoFailReason | null;
  failMessage?: string | null;
  retryCount?: number | null;
}

interface SendApiResponse {
  success: boolean;
  message: string;
  data: Order;
  results?: SendResultItem[];
  failReason?: AligoFailReason;
  failMessage?: string;
  retryCount?: number;
}

interface ShipmentDetailFormProps {
  orderId: string;
}

export function ShipmentDetailForm({ orderId }: ShipmentDetailFormProps) {
  const { isAdmin } = useAuth();
  const { toast, showToast, dismissToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [sendMessage, setSendMessage] = useState<string | null>(null);

  const [fieldValues, setFieldValues] =
    useState<TemplateFieldValues>(createEmptyFieldValues);
  const [trackingNumbers, setTrackingNumbers] = useState<string[]>([""]);
  const [memo, setMemo] = useState("");
  const [aligoStatus, setAligoStatus] = useState<AligoStatus>("pending");
  const [aligoFailReason, setAligoFailReason] =
    useState<AligoFailReason | null>(null);
  const [aligoFailMessage, setAligoFailMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastRetryAt, setLastRetryAt] = useState<string | null>(null);
  const [aligoResponse, setAligoResponse] = useState<AligoResponseLog | null>(
    null
  );
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [aligoTemplateType, setAligoTemplateType] =
    useState<AligoTemplateType>(DEFAULT_ALIGO_TEMPLATE_TYPE);
  const [createdAt, setCreatedAt] = useState("");
  const [sendResults, setSendResults] = useState<SendResultItem[] | null>(null);

  const applyOrder = (order: Order, trackingNums?: string[]) => {
    setFieldValues(orderToFieldValues(order));
    const nums =
      trackingNums && trackingNums.length > 0
        ? trackingNums
        : [order.tracking_number || ""];
    setTrackingNumbers(nums.length > 0 ? nums : [""]);
    setMemo(order.memo ?? "");
    setAligoStatus(order.aligo_status);
    setAligoFailReason(order.aligo_fail_reason ?? null);
    setAligoFailMessage(order.aligo_fail_message ?? null);
    setRetryCount(order.retry_count ?? 0);
    setLastRetryAt(order.last_retry_at ?? null);
    setAligoResponse(order.aligo_response ?? null);
    setSentAt(order.sent_at ?? null);
    setAligoTemplateType(
      order.aligo_template_type || DEFAULT_ALIGO_TEMPLATE_TYPE
    );
  };

  useEffect(() => {
    async function fetchOrder() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/orders/${orderId}`);
        const json: OrderApiResponse = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "주문을 찾을 수 없습니다.");
        }

        applyOrder(json.data, json.tracking_numbers);
        setCreatedAt(json.data.created_at);
      } catch (err) {
        setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    void fetchOrder();
  }, [orderId]);

  const refetchOrder = async () => {
    const res = await fetch(`/api/orders/${orderId}`);
    const json: OrderApiResponse = await res.json();
    if (res.ok && json.success) {
      applyOrder(json.data, json.tracking_numbers);
    }
  };

  const buildPayload = () => {
    const orderData = fieldValuesToOrderData(fieldValues);
    const customer_name = resolveListCustomerNameByType(
      aligoTemplateType,
      orderData
    );

    const cleanedTrackingNumbers = trackingNumbers
      .map((v) => v.trim())
      .filter((v) => v !== "");

    const firstTracking =
      cleanedTrackingNumbers[0] ?? orderData.tracking_number.trim();

    return {
      customer_name,
      phone: orderData.phone,
      sender_name: orderData.sender_name,
      receiver_name: orderData.receiver_name,
      tracking_number: firstTracking,
      tracking_numbers: cleanedTrackingNumbers,
      memo: memo.trim() === "" ? null : memo,
      aligo_template_type: aligoTemplateType,
    };
  };

  const handleFieldChange = (key: TemplateFieldKey, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
    setSaveMessage(null);
    setSendMessage(null);
  };

  const handleTrackingChange = (index: number, value: string) => {
    setTrackingNumbers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

    if (index === 0) {
      handleFieldChange("tracking_number", value);
    }
  };

  const handleAddTracking = () => {
    setTrackingNumbers((prev) => [...prev, ""]);
  };

  const handleRemoveTracking = (index: number) => {
    setTrackingNumbers((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      const first = next[0] ?? "";
      setFieldValues((fv) => ({ ...fv, tracking_number: first }));
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });

      const json: OrderApiResponse = await res.json();

      if (!res.ok || !json.success) {
        const detail =
          json.errors?.map((e) => e.message).join(", ") || json.message;
        throw new Error(detail || "저장에 실패했습니다.");
      }

      applyOrder(json.data);
      setSaveMessage("저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    const payload = buildPayload();
    if (payload.tracking_numbers.length === 0) {
      showToast("송장번호를 하나 이상 입력해주세요.", "error");
      return;
    }

    setSending(true);
    setSendMessage(null);
    setSendResults(null);
    setError(null);
    setAligoStatus("pending");
    setAligoFailReason(null);
    setAligoFailMessage(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json: SendApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "알림톡 발송에 실패했습니다.");
      }

      if (json.results && json.results.length > 0) {
        setSendResults(json.results);
      }

      await refetchOrder();

      if (json.results && json.results.length > 1) {
        const successCount = json.results.filter((r) => r.success).length;
        if (json.success) {
          showToast(`알림톡 발송 완료 (${successCount}/${json.results.length}건)`);
          setSendMessage(null);
        } else {
          const failed = json.results.filter((r) => !r.success);
          const detail = failed
            .map((r) => `${r.tracking_number ?? "?"}: ${r.failMessage ?? "실패"}`)
            .join(", ");
          showToast(
            `일부 발송 실패 (${successCount}/${json.results.length}건) — ${detail}`,
            "error"
          );
          setSendMessage(detail);
        }
      } else if (json.success) {
        showToast("알림톡 발송이 완료되었습니다.");
        setSendMessage(null);
      } else {
        const reasonLabel = json.failReason
          ? ALIGO_FAIL_REASON_LABEL[json.failReason]
          : "발송 실패";
        const detail = json.failMessage || json.message;
        showToast(`${reasonLabel}: ${detail}`, "error");
        setSendMessage(detail);
      }
    } catch (err) {
      setAligoStatus("failed");
      const message =
        err instanceof Error ? err.message : "발송에 실패했습니다.";
      showToast(message, "error");
      setError(message);
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    const payload = buildPayload();
    if (payload.tracking_numbers.length === 0) {
      showToast("송장번호를 하나 이상 입력해주세요.", "error");
      return;
    }

    setResending(true);
    setError(null);
    setSendResults(null);
    setAligoStatus("pending");
    setAligoFailReason(null);
    setAligoFailMessage(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json: SendApiResponse = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "재발송에 실패했습니다.");
      }

      if (json.results && json.results.length > 0) {
        setSendResults(json.results);
      }

      await refetchOrder();

      if (json.results && json.results.length > 1) {
        const successCount = json.results.filter((r) => r.success).length;
        if (json.success) {
          showToast(`재발송 완료 (${successCount}/${json.results.length}건)`);
          setSendMessage(null);
        } else {
          const failed = json.results.filter((r) => !r.success);
          const detail = failed
            .map((r) => `${r.tracking_number ?? "?"}: ${r.failMessage ?? "실패"}`)
            .join(", ");
          showToast(`${detail}`, "error");
          setSendMessage(detail);
        }
      } else if (json.success) {
        showToast("재발송 성공");
        setSendMessage(null);
      } else {
        const reasonLabel = json.failReason
          ? ALIGO_FAIL_REASON_LABEL[json.failReason]
          : "발송 실패";
        const detail = json.failMessage || json.message;
        showToast(`${reasonLabel}: ${detail}`, "error");
        setSendMessage(detail);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "재발송에 실패했습니다.";
      showToast(message, "error");
      setError(message);
    } finally {
      setResending(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-zinc-500">불러오는 중...</p>
      </Card>
    );
  }

  if (error && !fieldValues.phone) {
    return (
      <div className="space-y-4">
        <Card>
          <p className="text-sm text-red-600">{error}</p>
        </Card>
        <Link
          href="/orders"
          className="inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          ← 발송 현황으로
        </Link>
      </div>
    );
  }

  const isBusy = saving || sending || resending;
  const isFailed = aligoStatus === "failed";
  const canRetry = retryCount < MAX_ALIGO_RETRY;
  const readOnly = !isAdmin;

  return (
    <div className="space-y-6">
      <Toast toast={toast} onDismiss={dismissToast} />

      <PageHeader
        title="발송 상세"
        description={`등록일 ${formatDateTime(createdAt)}`}
        backHref="/orders"
        backLabel="발송 현황"
        action={
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">알리고</span>
            <AligoStatusBadge
              status={aligoStatus}
              failReason={aligoFailReason}
              failMessage={aligoFailMessage}
            />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card
            title="송장번호"
            description={
              readOnly
                ? "등록된 송장번호입니다."
                : "여러 박스인 경우 송장번호를 추가한 뒤 한 번에 발송할 수 있습니다."
            }
          >
            <div className="space-y-2">
              {trackingNumbers.map((value, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    value={value}
                    onChange={(e) => handleTrackingChange(index, e.target.value)}
                    disabled={isBusy || readOnly}
                    placeholder="송장번호"
                    aria-label={`송장번호 ${index + 1}`}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 disabled:bg-zinc-50 disabled:text-zinc-600"
                  />
                  {trackingNumbers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTracking(index)}
                      disabled={isBusy || readOnly}
                      className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                    >
                      X
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!readOnly && (
              <button
                type="button"
                onClick={handleAddTracking}
                disabled={isBusy}
                className="mt-3 w-full rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-100 disabled:opacity-50 max-md:min-h-12"
              >
                + 송장 추가
              </button>
            )}
          </Card>

          <Card
            title="발송 정보"
            description={
              readOnly
                ? "조회 전용입니다. 수정은 관리자만 가능합니다."
                : "템플릿에 맞는 정보를 입력하세요."
            }
          >
            <TemplateVariableFields
              templateType={aligoTemplateType}
              values={fieldValues}
              onChange={handleFieldChange}
              omitKeys={["tracking_number"]}
              disabled={readOnly}
            />
          </Card>

          <Card title="고객 메모">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={4}
              disabled={readOnly}
              placeholder="고객 관련 메모를 입력하세요"
              className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 disabled:bg-zinc-50 disabled:text-zinc-600"
            />
          </Card>

          <Card title="입력 요약">
            <TemplateVariableSummary
              templateType={aligoTemplateType}
              values={{
                ...fieldValues,
                tracking_number:
                  trackingNumbers
                    .map((v) => v.trim())
                    .filter(Boolean)
                    .join(", ") || fieldValues.tracking_number,
              }}
              formatPhone={formatPhone}
            />
          </Card>

          {sendResults && sendResults.length > 0 && (
            <Card title="발송 결과" description="송장별 알림톡 발송 결과입니다.">
              <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
                {sendResults.map((result, index) => (
                  <li
                    key={`${result.orderId ?? index}-${result.tracking_number ?? index}`}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-900">
                        {result.tracking_number || "-"}
                      </p>
                      {!result.success && result.failMessage && (
                        <p className="mt-0.5 truncate text-xs text-red-600">
                          {result.failMessage}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 text-xs font-semibold ${
                        result.success ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {result.success ? "성공" : "실패"}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card
            title="템플릿 선택"
            description="선택 시 입력 필드가 자동으로 변경됩니다."
          >
            <TemplateSelector
              value={aligoTemplateType}
              onChange={setAligoTemplateType}
              disabled={isBusy || readOnly}
            />
          </Card>

          <Card title="발송 상태">
            <div className="flex items-center justify-between rounded-lg bg-zinc-50 px-4 py-3">
              <span className="text-sm text-zinc-600">현재 상태</span>
              <AligoStatusBadge
                status={aligoStatus}
                failReason={aligoFailReason}
                failMessage={aligoFailMessage}
              />
            </div>

            {isFailed && aligoFailMessage && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-xs font-medium text-red-600">실패 상세</p>
                <p className="mt-1 text-sm text-red-800">{aligoFailMessage}</p>
                {aligoFailReason && (
                  <p className="mt-2 text-xs text-red-600">
                    분류: {ALIGO_FAIL_REASON_LABEL[aligoFailReason]} (
                    {aligoFailReason})
                  </p>
                )}
              </div>
            )}

            {retryCount > 0 && (
              <p className="mt-3 text-xs text-zinc-500">
                재발송 {retryCount}/{MAX_ALIGO_RETRY}회
                {lastRetryAt
                  ? ` · 마지막 ${formatDateTime(lastRetryAt)}`
                  : ""}
              </p>
            )}

            {sentAt && (
              <p className="mt-2 text-xs text-zinc-500">
                발송 완료 {formatDateTime(sentAt)}
              </p>
            )}

            {aligoResponse && (
              <details className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                <summary className="cursor-pointer text-xs font-medium text-zinc-600">
                  Aligo 발송 로그
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs text-zinc-600">
                  {JSON.stringify(aligoResponse, null, 2)}
                </pre>
              </details>
            )}

            {(sending || resending) && (
              <p className="mt-3 text-sm text-zinc-500">
                {resending ? "재발송 중..." : "알림톡 발송 중..."}
              </p>
            )}
            {sendMessage && (
              <p
                className={`mt-3 text-sm ${
                  aligoStatus === "success"
                    ? "text-emerald-600"
                    : "text-amber-600"
                }`}
              >
                {sendMessage}
              </p>
            )}
          </Card>

          {isAdmin && isFailed && canRetry && (
            <button
              type="button"
              onClick={handleResend}
              disabled={isBusy}
              className="w-full rounded-lg bg-red-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 max-md:min-h-12 max-md:rounded-xl max-md:py-4 max-md:text-base max-md:active:scale-[0.98]"
            >
              {resending ? "재발송 중..." : "재발송"}
            </button>
          )}

          {isAdmin && isFailed && !canRetry && (
            <p className="rounded-lg bg-zinc-100 px-4 py-3 text-center text-sm text-zinc-600">
              재발송 한도({MAX_ALIGO_RETRY}회)에 도달했습니다.
            </p>
          )}

          {isAdmin && aligoStatus === "pending" && (
            <button
              type="button"
              onClick={handleSend}
              disabled={isBusy}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 max-md:min-h-12 max-md:rounded-xl max-md:py-4 max-md:text-base max-md:active:scale-[0.98]"
            >
              {sending ? "발송 중..." : "알림톡 발송"}
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={handleSave}
              disabled={isBusy}
              className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50 max-md:min-h-12 max-md:rounded-xl max-md:py-4 max-md:text-base max-md:active:scale-[0.98]"
            >
              {saving ? "저장 중..." : "변경사항 저장"}
            </button>
          )}

          {readOnly && (
            <p className="rounded-lg bg-sky-50 px-4 py-3 text-center text-sm text-sky-700">
              STAFF 계정은 조회만 가능합니다.
            </p>
          )}

          {saveMessage && (
            <p className="text-center text-sm font-medium text-emerald-600">
              {saveMessage}
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
