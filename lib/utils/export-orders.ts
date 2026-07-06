import { ALIGO_STATUS_LABEL } from "@/lib/constants/aligo";
import { formatDateTime, formatPhone } from "@/lib/utils/format";
import type { OrderListItem } from "@/types/order";

const CSV_HEADERS = [
  "고객명",
  "전화번호",
  "송장번호",
  "템플릿 타입",
  "알리고 상태",
  "생성일",
] as const;

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toExportRow(order: OrderListItem): string[] {
  return [
    order.customer_name,
    formatPhone(order.phone),
    order.tracking_number || "-",
    order.aligo_template_type || "-",
    ALIGO_STATUS_LABEL[order.aligo_status],
    formatDateTime(order.created_at),
  ];
}

export function ordersToCsv(orders: OrderListItem[]): string {
  const rows = orders.map((order) =>
    toExportRow(order).map(escapeCsvCell).join(",")
  );
  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

export function ordersToClipboardText(orders: OrderListItem[]): string {
  return orders
    .map((order) => {
      const [name, phone, tracking, , status, createdAt] = toExportRow(order);
      return `${name} | ${phone} | ${tracking} | ${status} | ${createdAt}`;
    })
    .join("\n");
}

export function downloadOrdersCsv(orders: OrderListItem[], filename: string) {
  const csv = ordersToCsv(orders);
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function copyOrdersToClipboard(
  orders: OrderListItem[]
): Promise<void> {
  const text = ordersToClipboardText(orders);
  await navigator.clipboard.writeText(text);
}
