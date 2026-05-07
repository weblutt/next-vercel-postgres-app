import type { OrderDraftRow, SystemFieldKey } from "@/lib/types/order";
import { SYSTEM_FIELDS, emptyOrderDraftRow } from "@/lib/types/order";

function isDraftRowBlank(_uid: string, row: Record<SystemFieldKey, string>): boolean {
  return SYSTEM_FIELDS.every((k) => !String(row[k] ?? "").trim());
}

/**
 * 根据矩阵与「表头所在行」构建草稿行；映射值为列索引。
 */
export function matrixToDraftRows(
  matrix: string[][],
  headerRowIndex: number,
  mapping: Partial<Record<SystemFieldKey, number | null>>,
): { rows: OrderDraftRow[] } {
  const rows: OrderDraftRow[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const cells = matrix[r] ?? [];
    const uid =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `row_${r}_${Math.random().toString(16).slice(2)}`;
    const row = emptyOrderDraftRow(uid);
    for (const k of SYSTEM_FIELDS) {
      const col = mapping[k];
      if (col === null || col === undefined) {
        row[k] = "";
      } else {
        row[k] = String(cells[col] ?? "").trim();
      }
    }
    if (isDraftRowBlank(row.uid, row)) continue;
    rows.push(row);
  }
  return { rows };
}
