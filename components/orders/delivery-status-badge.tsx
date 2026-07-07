import {
  DELIVERY_STATUS_DOT,
  DELIVERY_STATUS_LABEL,
} from "@/lib/constants/delivery";
import type { DeliveryStatus } from "@/types/delivery";

interface DeliveryStatusBadgeProps {
  status: DeliveryStatus;
  size?: "sm" | "md";
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}

export function DeliveryStatusBadge({
  status,
  size = "md",
  onClick,
  disabled = false,
}: DeliveryStatusBadgeProps) {
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const dotSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  const label = DELIVERY_STATUS_LABEL[status];
  const content = (
    <>
      <span
        className={`shrink-0 rounded-full ${dotSize} ${DELIVERY_STATUS_DOT[status]}`}
        aria-hidden
      />
      <span>{label}</span>
    </>
  );

  if (!onClick) {
    return (
      <span
        className={`inline-flex items-center justify-center gap-1.5 font-medium text-zinc-700 ${textSize}`}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 font-medium text-zinc-700 transition hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 ${textSize}`}
    >
      {content}
    </button>
  );
}
