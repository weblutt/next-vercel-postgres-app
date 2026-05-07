import {
  FIELD_LABELS,
  type IssueFieldKey,
  type OrderDraftRow,
  type StructuredValidationIssue,
  type SystemFieldKey,
  SYSTEM_FIELDS,
} from "@/lib/types/order";

const TEMP_ALLOWED = new Set(["常温", "冷藏", "冷冻"]);

const TEMP_ALIASES: Array<{ re: RegExp; v: string }> = [
  { re: /常温|普通|normal|ambient|室温|室溫/i, v: "常温" },
  { re: /冷藏|冷鲜|chilled|refrigerat/i, v: "冷藏" },
  { re: /冷冻|冻品|frozen|freeze|冷凍/i, v: "冷冻" },
];

function normalizeTempLayer(raw: string): string {
  const s = raw.trim();
  if (TEMP_ALLOWED.has(s)) return s;
  for (const { re, v } of TEMP_ALIASES) {
    if (re.test(s)) return v;
  }
  return s;
}

function countDigits(s: string): number {
  return (s.match(/\d/g) ?? []).length;
}

/** 大陆手机为主，兼容固话与带区号格式 */
export function isLikelyPhone(input: string): boolean {
  const s = input.replace(/[\s\-()（）]/g, "");
  if (!s) return false;
  if (/^(\+?86)?1[3-9]\d{9}$/.test(s)) return true;
  if (/^0\d{9,11}$/.test(s) && countDigits(s) >= 10) return true;
  if (/^\d{7,12}$/.test(s) && countDigits(s) >= 7) return true;
  return false;
}

export function validateOrderRow(
  row: OrderDraftRow,
  displayRow: number,
  issues: StructuredValidationIssue[],
) {
  for (const key of SYSTEM_FIELDS) {
    if (key === "external_code" || key === "remark") continue;
    const v = row[key].trim();
    if (!v) {
      issues.push({
        displayRow,
        fieldKey: key,
        fieldLabel: FIELD_LABELS[key],
        reason: "必填字段缺失",
      });
    }
  }

  const sp = row.sender_phone.trim();
  if (sp && !isLikelyPhone(sp)) {
    issues.push({
      displayRow,
      fieldKey: "sender_phone",
      fieldLabel: FIELD_LABELS.sender_phone,
      reason: "手机号或电话格式可能不正确",
    });
  }
  const rp = row.receiver_phone.trim();
  if (rp && !isLikelyPhone(rp)) {
    issues.push({
      displayRow,
      fieldKey: "receiver_phone",
      fieldLabel: FIELD_LABELS.receiver_phone,
      reason: "手机号或电话格式可能不正确",
    });
  }

  const w = row.weight_kg.trim().replace(/,/g, "");
  if (w) {
    const n = Number(w);
    if (!Number.isFinite(n) || n <= 0) {
      issues.push({
        displayRow,
        fieldKey: "weight_kg",
        fieldLabel: FIELD_LABELS.weight_kg,
        reason: "重量必须为正数",
      });
    }
  }

  const p = row.piece_count.trim().replace(/,/g, "");
  if (p) {
    const n = Number(p);
    if (!Number.isInteger(n) || n <= 0) {
      issues.push({
        displayRow,
        fieldKey: "piece_count",
        fieldLabel: FIELD_LABELS.piece_count,
        reason: "件数必须为正整数",
      });
    }
  }

  const tRaw = row.temp_layer.trim();
  if (tRaw) {
    const t = normalizeTempLayer(tRaw);
    if (!TEMP_ALLOWED.has(t)) {
      issues.push({
        displayRow,
        fieldKey: "temp_layer",
        fieldLabel: FIELD_LABELS.temp_layer,
        reason: "温层仅允许：常温 / 冷藏 / 冷冻",
      });
    }
  }
}

export function normalizeRowForSubmit(row: OrderDraftRow): {
  external_code: string | null;
  sender_name: string;
  sender_phone: string;
  sender_address: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  weight_kg: number;
  piece_count: number;
  temp_layer: string;
  remark: string | null;
} {
  const ext = row.external_code.trim();
  const temp = normalizeTempLayer(row.temp_layer.trim());
  return {
    external_code: ext ? ext : null,
    sender_name: row.sender_name.trim(),
    sender_phone: row.sender_phone.trim(),
    sender_address: row.sender_address.trim(),
    receiver_name: row.receiver_name.trim(),
    receiver_phone: row.receiver_phone.trim(),
    receiver_address: row.receiver_address.trim(),
    weight_kg: Number(String(row.weight_kg).trim().replace(/,/g, "")),
    piece_count: parseInt(String(row.piece_count).trim().replace(/,/g, ""), 10),
    temp_layer: TEMP_ALLOWED.has(temp) ? temp : row.temp_layer.trim(),
    remark: row.remark.trim() ? row.remark.trim() : null,
  };
}

export type DuplicateContext = {
  batchDuplicateRows: Map<string, number[]>;
  dbDuplicateCodes: Set<string>;
};

export function computeBatchExternalCodeDupMap(
  rows: OrderDraftRow[],
  getDisplayRow: (index: number) => number,
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  rows.forEach((row, idx) => {
    const code = row.external_code.trim();
    if (!code) return;
    const dr = getDisplayRow(idx);
    const arr = map.get(code);
    if (arr) arr.push(dr);
    else map.set(code, [dr]);
  });
  const dup = new Map<string, number[]>();
  for (const [k, arr] of Array.from(map.entries())) {
    if (arr.length > 1) dup.set(k, arr);
  }
  return dup;
}

export function buildDuplicateIssues(
  rows: OrderDraftRow[],
  getDisplayRow: (index: number) => number,
  dupCtx: DuplicateContext,
): StructuredValidationIssue[] {
  const issues: StructuredValidationIssue[] = [];
  rows.forEach((row, idx) => {
    const code = row.external_code.trim();
    if (!code) return;
    const dr = getDisplayRow(idx);
    const batchRows = dupCtx.batchDuplicateRows.get(code);
    if (batchRows && batchRows.includes(dr)) {
      issues.push({
        displayRow: dr,
        fieldKey: "external_code_duplicate",
        fieldLabel: FIELD_LABELS.external_code,
        reason: `本批次内「外部编码」重复，涉及 Excel 数据行：${Array.from(new Set(batchRows))
          .sort((a, b) => a - b)
          .join("、")}`,
      });
    }
    if (dupCtx.dbDuplicateCodes.has(code)) {
      issues.push({
        displayRow: dr,
        fieldKey: "external_code_duplicate",
        fieldLabel: FIELD_LABELS.external_code,
        reason: "该外部编码与数据库历史运单重复",
      });
    }
  });
  return issues;
}

export function issuesForCell(
  issues: StructuredValidationIssue[],
  displayRow: number,
  field: IssueFieldKey,
): StructuredValidationIssue[] {
  return issues.filter((x) => x.displayRow === displayRow && x.fieldKey === field);
}

export function summarizeIssueTooltip(list: StructuredValidationIssue[]): string {
  return list.map((x) => `${x.fieldLabel}：${x.reason}`).join("\n");
}
