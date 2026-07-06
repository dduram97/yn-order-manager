"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AligoStatusBadge } from "@/components/orders/aligo-status-badge";
import { FavoriteCustomersPicker } from "@/components/orders/favorite-customers-picker";
import { TemplateSelector } from "@/components/orders/template-selector";
import { TemplateVariableFields } from "@/components/orders/template-variable-fields";
import { Card } from "@/components/ui/card";
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

interface OrderApiResponse {
  success: boolean;
  data: {
    id: string;
    aligo_status: AligoStatus;
    aligo_fail_reason?: AligoFailReason | null;
    aligo_fail_message?: string | null;
  };
  message?: string;
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

  const [templateType, setTemplateType] = useState<AligoTemplateType>(
    DEFAULT_ALIGO_TEMPLATE_TYPE
  );
  const [fieldValues, setFieldValues] =
    useState<TemplateFieldValues>(createEmptyFieldValues);
  const [memo, setMemo] = useState("");

  const handleFieldChange = (key: TemplateFieldKey, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleFavoriteCustomerSelect = (
    updates: Partial<TemplateFieldValues>
  ) => {
    setFieldValues((prev) => ({ ...prev, ...updates }));
    showToast("고객 정보가 입력되었습니다.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setAligoMessage(null);
    setAligoStatus(null);

    try {
      const orderData = fieldValuesToOrderData(fieldValues);
      const customer_name = resolveListCustomerNameByType(
        templateType,
        orderData
      );

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name,
          phone: orderData.phone,
          sender_name: orderData.sender_name,
          receiver_name: orderData.receiver_name,
          tracking_number: orderData.tracking_number,
          memo: memo.trim() || undefined,
          aligo_template_type: templateType,
        }),
      });

      const json: OrderApiResponse = await res.json();

      if (!res.ok || !json.success) {
        const detail =
          json.errors?.map((item) => item.message).join(", ") || json.message;
        throw new Error(detail || "발송 등록에 실패했습니다.");
      }

      setAligoStatus(json.data.aligo_status);
      if (json.data.aligo_status === "success") {
        showToast("주문 등록 및 알림톡 발송이 완료되었습니다.");
      } else {
        const reason = json.aligo?.failReason ?? json.data.aligo_fail_reason;
        const detail =
          json.aligo?.failMessage ??
          json.data.aligo_fail_message ??
          "주문은 등록되었으나 알림톡 발송에 실패했습니다.";
        const label = reason ? ALIGO_FAIL_REASON_LABEL[reason] : "발송 실패";
        showToast(`${label}: ${detail}`, "error");
      }
      setAligoMessage(
        json.data.aligo_status === "success"
          ? "알림톡 발송이 완료되었습니다."
          : "주문은 등록되었으나 알림톡 발송에 실패했습니다."
      );

      setTimeout(() => {
        router.push(`/orders/${json.data.id}`);
      }, 1200);
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
        <div className="mb-4">
          <FavoriteCustomersPicker
            templateType={templateType}
            disabled={submitting}
            onSelect={handleFavoriteCustomerSelect}
          />
        </div>
        <TemplateVariableFields
          templateType={templateType}
          values={fieldValues}
          onChange={handleFieldChange}
        />
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

      {aligoStatus && (
        <Card title="발송 결과">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">알리고 상태</span>
            <AligoStatusBadge status={aligoStatus} />
          </div>
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
