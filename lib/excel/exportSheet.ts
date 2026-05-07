import * as XLSX from "xlsx";
import { FIELD_LABELS, SYSTEM_FIELDS, type OrderDraftRow } from "@/lib/types/order";

export function exportOrdersToXlsx(rows: OrderDraftRow[], filename: string) {
  const header = SYSTEM_FIELDS.map((k) => FIELD_LABELS[k]);
  const aoa: string[][] = [header, ...rows.map((r) => SYSTEM_FIELDS.map((k) => r[k] ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "运单导出");
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}
