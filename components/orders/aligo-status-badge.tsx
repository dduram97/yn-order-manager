import type { AligoStatus, AligoFailReason } from "@/types/database";
import {
  ALIGO_FAIL_REASON_LABEL,
  ALIGO_STATUS_LABEL,
  ALIGO_STATUS_STYLE,
} from "@/lib/constants/aligo";

interface AligoStatusBadgeProps {
  status: AligoStatus;
  failReason?: AligoFailReason | null;
  failMessage?: string | null;
  size?: "sm" | "md";
}

export function AligoStatusBadge({
  status,
  failReason,
  failMessage,
  size = "md",
}: AligoStatusBadgeProps) {
  const style = ALIGO_STATUS_STYLE[status];
  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  const label =
    status === "failed" && failReason
      ? `실패 (${ALIGO_FAIL_REASON_LABEL[failReason]})`
      : ALIGO_STATUS_LABEL[status];

  const title =
    status === "failed"
      ? [failReason, failMessage].filter(Boolean).join(" — ") || undefined
      : undefined;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${style.bg} ${style.text} ${padding}`}
      title={title}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
      {status === "failed" ? `❌ ${label}` : label}
    </span>
  );
}
