import * as XLSX from "xlsx";

type CustomerExportRow = {
  name: string;
  phone: string;
  order_count: number;
  last_sent_date: string | null;
  grade?: "normal" | "silver" | "gold";
  vip_level?: "normal" | "silver" | "gold";
  is_favorite?: boolean;
};

function resolveCategory(row: CustomerExportRow): string {
  if (row.is_favorite) return "즐겨찾기";
  if (row.grade && row.grade !== "normal") {
    return row.grade === "silver" ? "Silver VIP" : "Gold VIP";
  }
  if (row.vip_level && row.vip_level !== "normal") {
    return row.vip_level === "silver" ? "Silver VIP(자동)" : "Gold VIP(자동)";
  }
  return "일반";
}

export function buildCustomersWorkbook(rows: CustomerExportRow[]) {
  const data = rows.map((row) => ({
    구분: resolveCategory(row),
    고객명: row.name,
    휴대폰번호: row.phone,
    "최근 발송일": row.last_sent_date ?? "-",
    발송횟수: row.order_count,
  }));

  const sheet = XLSX.utils.json_to_sheet(data, {
    header: ["구분", "고객명", "휴대폰번호", "최근 발송일", "발송횟수"],
  });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "고객목록");
  return book;
}

export function downloadCustomersXlsx(rows: CustomerExportRow[]) {
  const book = buildCustomersWorkbook(rows);
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const filename = `고객목록_${yyyy}${mm}${dd}.xlsx`;
  XLSX.writeFile(book, filename);
}

