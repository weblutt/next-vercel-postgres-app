/** 固定业务字段 key（不含 id / batch） */
export const SYSTEM_FIELDS = [
  "external_code",
  "sender_name",
  "sender_phone",
  "sender_address",
  "receiver_name",
  "receiver_phone",
  "receiver_address",
  "weight_kg",
  "piece_count",
  "temp_layer",
  "remark",
] as const;

export type SystemFieldKey = (typeof SYSTEM_FIELDS)[number];

export type SystemFieldMeta = {
  key: SystemFieldKey;
  label: string;
  requiredInBusiness: boolean;
};

/** 人类可读标签（与考题一致） */
export const FIELD_LABELS: Record<SystemFieldKey, string> = {
  external_code: "外部编码",
  sender_name: "发件人姓名",
  sender_phone: "发件人电话",
  sender_address: "发件人地址",
  receiver_name: "收件人姓名",
  receiver_phone: "收件人电话",
  receiver_address: "收件人地址",
  weight_kg: "重量(kg)",
  piece_count: "件数",
  temp_layer: "温层",
  remark: "备注",
};

export const FIELD_METAS: SystemFieldMeta[] = SYSTEM_FIELDS.map((key) => ({
  key,
  label: FIELD_LABELS[key],
  requiredInBusiness:
    key !== "external_code" && key !== "remark",
}));

/** 页面编辑行（值均为字符串，提交前再规范化） */
export type OrderDraftRow = {
  /** 客户端稳定的行 ID */
  uid: string;
} & Record<SystemFieldKey, string>;

export function emptyOrderDraftRow(uid: string): OrderDraftRow {
  const base = { uid } as OrderDraftRow;
  for (const k of SYSTEM_FIELDS) {
    base[k] = "";
  }
  return base;
}

/** API / DB 对齐结构 */
export type ShippingOrderPayload = {
  batchId: string;
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
};

/** 历史列表行 */
export type ShippingOrderDbRow = {
  id: number;
  batch_id: string;
  external_code: string | null;
  sender_name: string;
  sender_phone: string;
  sender_address: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_address: string;
  weight_kg: string;
  piece_count: number;
  temp_layer: string;
  remark: string | null;
  created_at: string;
};

export type IssueFieldKey = SystemFieldKey | "external_code_duplicate";

export type StructuredValidationIssue = {
  /** 对用户展示：Excel 行号语义：表头为第一行时的数据行行号（表头下一行通常为 2） */
  displayRow: number;
  fieldKey: IssueFieldKey;
  fieldLabel: string;
  reason: string;
};
