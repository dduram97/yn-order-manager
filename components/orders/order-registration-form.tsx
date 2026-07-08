"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AligoStatusBadge } from "@/components/orders/aligo-status-badge";
import { AllCustomersPicker } from "@/components/orders/all-customers-picker";
import { FavoriteCustomersPicker } from "@/components/orders/favorite-customers-picker";
import { TemplateSelector } from "@/components/orders/template-selector";
import { TrackingNumbersInput } from "@/components/orders/tracking-numbers-input";
import { TemplateVariableFields } from "@/components/orders/template-variable-fields";
import { PageHeader } from "@/components/ui/page-header";
import { Toast, useToast } from "@/components/ui/toast";
import {
  ALIGO_FAIL_REASON_LABEL,
  DEFAULT_ALIGO_TEMPLATE_TYPE,
  type AligoTemplateType,
} from "@/lib/constants/aligo";
import {
  createEmptyFieldValues,
  fieldValuesToOrderData,
  resolveListCustomerNameByType,
  type TemplateFieldKey,
  type TemplateFieldValues,
} from "@/lib/aligo/template-schema";
import type { AligoFailReason, AligoStatus } from "@/types/database";
import {
  sanitizeTrackingNumberInput,
  validateTrackingNumber,
} from "@/lib/validations/tracking-number";
import { Card } from "@/components/ui/card";

interface SendResultItem {
  success: boolean;
  orderId: string | null;
  tracking_number: string | null;
  failReason?: AligoFailReason | null;
  failMessage?: string | null;
}

interface OrderApiResponse {
  success: boolean;
  data: {
    id: string;
    aligo_status: AligoStatus;
    aligo_fail_reason?: AligoFailReason | null;
    aligo_fail_message?: string | null;
  };
  message?: string;
  results?: SendResultItem[];
  aligo?: {
    success?: boolean;
    message?: string;
    failReason?: AligoFailReason;
    failMessage?: string;
  };
  errors?: { field: string; message: string }[];
}

export function OrderRegistrationForm() {
  const router = useRouter();
  const { toast, showToast, dismissToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aligoStatus, setAligoStatus] = useState<AligoStatus | null>(null);
  const [aligoMessage, setAligoMessage] = useState<string | null>(null);
  const [sendResults, setSendResults] = useState<SendResultItem[] | null>(null);

  const [templateType, setTemplateType] = useState<AligoTemplateType>(
    DEFAULT_ALIGO_TEMPLATE_TYPE
  );
  const [fieldValues, setFieldValues] =
    useState<TemplateFieldValues>(createEmptyFieldValues);
  const [trackingNumbers, setTrackingNumbers] = useState<string[]>([""]);
  const [memo, setMemo] = useState("");

  const handleFieldChange = (key: TemplateFieldKey, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleCustomerSelect = (updates: Partial<TemplateFieldValues>) => {
    setFieldValues((prev) => ({ ...prev, ...updates }));
    showToast("고객 정보가 입력되었습니다.");
  };

  const handleTrackingChange = (index: number, value: string) => {
    const sanitized = sanitizeTrackingNumberInput(value);

    setTrackingNumbers((prev) => {
      const next = [...prev];
      next[index] = sanitized;
      return next;
    });

    if (index === 0) {
      handleFieldChange("tracking_number", sanitized);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setAligoMessage(null);
    setAligoStatus(null);
    setSendResults(null);

    try {
      const orderData = fieldValuesToOrderData(fieldValues);
      const customer_name = resolveListCustomerNameByType(
        templateType,
        orderData
      );

      const cleanedTrackingNumbers = trackingNumbers
        .map((v) => v.trim())
        .filter((v) => v !== "");

      if (cleanedTrackingNumbers.length === 0) {
        throw new Error("운송장번호가 입력되지 않았습니다.");
      }

      for (const tn of cleanedTrackingNumbers) {
        const trackingError = validateTrackingNumber(tn);
        if (trackingError) {
          throw new Error(trackingError);
        }
      }

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name,
          phone: orderData.phone,
          sender_name: orderData.sender_name,
          receiver_name: orderData.receiver_name,
          tracking_number: cleanedTrackingNumbers[0],
          tracking_numbers: cleanedTrackingNumbers,
          memo: memo.trim() || undefined,
          aligo_template_type: templateType,
        }),
      });

      const json: OrderApiResponse = await res.json();

      if (!res.ok) {
        const detail =
          json.errors?.map((item) => item.message).join(", ") || json.message;
        throw new Error(detail || "발송 등록에 실패했습니다.");
      }

      const isMulti = (json.results?.length ?? 0) > 1;

      if (json.results && json.results.length > 0) {
        setSendResults(json.results);
      }

      const primaryStatus = json.data.aligo_status;
      setAligoStatus(primaryStatus);

      if (isMulti) {
        const successCount = json.results!.filter((r) => r.success).length;
        const total = json.results!.length;
        if (json.success) {
          showToast(`알림톡 발송 완료 (${successCount}/${total}건)`);
          setAligoMessage(`총 ${total}건 발송이 완료되었습니다.`);
        } else {
          showToast(
            `일부 발송 실패 (${successCount}/${total}건)`,
            "error"
          );
          setAligoMessage(`성공 ${successCount}건 · 실패 ${total - successCount}건`);
        }
      } else if (primaryStatus === "success") {
        showToast("주문 등록 및 알림톡 발송이 완료되었습니다.");
        setAligoMessage("알림톡 발송이 완료되었습니다.");
      } else {
        const reason = json.aligo?.failReason ?? json.data.aligo_fail_reason;
        const detail =
          json.aligo?.failMessage ??
          json.data.aligo_fail_message ??
          "주문은 등록되었으나 알림톡 발송에 실패했습니다.";
        const label = reason ? ALIGO_FAIL_REASON_LABEL[reason] : "발송 실패";
        showToast(`${label}: ${detail}`, "error");
        setAligoMessage("주문은 등록되었으나 알림톡 발송에 실패했습니다.");
      }

      setTimeout(() => {
        router.push(isMulti ? "/orders" : `/orders/${json.data.id}`);
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "오류가 발생했습니다.";
      showToast(message, "error");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <Toast toast={toast} onDismiss={dismissToast} />

      <PageHeader
        title="발송 등록"
        description="템플릿을 선택하고 정보를 입력한 뒤 알림톡을 발송합니다."
      />

      <Card
        title="1. 템플릿 선택"
        description="선택 즉시 아래 발송 정보 폼이 변경됩니다."
      >
        <TemplateSelector
          value={templateType}
          onChange={setTemplateType}
          disabled={submitting}
        />
      </Card>

      <Card title="2. 발송 정보">
        <div className="mb-4 flex flex-wrap items-center gap-[0.5cm]">
          <FavoriteCustomersPicker
            templateType={templateType}
            disabled={submitting}
            onSelect={handleCustomerSelect}
          />
          <AllCustomersPicker
            templateType={templateType}
            disabled={submitting}
            onSelect={handleCustomerSelect}
          />
        </div>

        <div className="mb-4">
          <TemplateVariableFields
            templateType={templateType}
            values={fieldValues}
            onChange={handleFieldChange}
            omitKeys={["tracking_number"]}
            disabled={submitting}
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-zinc-500">운송장번호</p>
          <TrackingNumbersInput
            values={trackingNumbers}
            onChange={handleTrackingChange}
            onAdd={handleAddTracking}
            onRemove={handleRemoveTracking}
            disabled={submitting}
          />
        </div>
      </Card>

      <Card title="3. 메모 (선택)">
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={3}
          placeholder="고객 관련 메모 (선택 입력)"
          className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
        />
      </Card>

      {(aligoStatus || sendResults) && (
        <Card title="발송 결과">
          {aligoStatus && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">알리고 상태</span>
              <AligoStatusBadge status={aligoStatus} />
            </div>
          )}
          {aligoMessage && (
            <p
              className={`mt-3 text-sm ${
                aligoStatus === "success"
                  ? "text-emerald-600"
                  : "text-amber-600"
              }`}
            >
              {aligoMessage}
            </p>
          )}
          {sendResults && sendResults.length > 1 && (
            <ul className="mt-4 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
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
          )}
        </Card>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-zinc-900 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
      >
        {submitting ? "발송 중..." : "알림톡 발송"}
      </button>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
