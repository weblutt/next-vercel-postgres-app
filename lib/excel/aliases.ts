import type { SystemFieldKey } from "@/lib/types/order";

/** 每组别名用于模糊匹配 Excel 列名（已统一小写语义，匹配时再 normalize） */
export const COLUMN_ALIASES: Record<SystemFieldKey, string[]> = {
  external_code: [
    "外部编码",
    "外部单号",
    "客户单号",
    "第三方单号",
    "erp单号",
    "参考号",
    "orderid",
    "order_no",
    "orderno",
    "external code",
    "ext code",
    "waybill_no",
    "customer_ref",
    "自定义单号",
  ],
  sender_name: [
    "发件人",
    "发件姓名",
    "寄件人",
    "发货人",
    "sender",
    "sender name",
    "shipper",
    "始发联系人",
    "寄方姓名",
  ],
  sender_phone: [
    "发件电话",
    "寄件电话",
    "发货电话",
    "sender phone",
    "sender tel",
    "shipper phone",
    "寄方电话",
    "始发电话",
  ],
  sender_address: [
    "发件地址",
    "寄件地址",
    "发货地址",
    "始发地址",
    "sender addr",
    "sender address",
    "origin address",
    "寄方地址",
  ],
  receiver_name: [
    "收件人",
    "收货人",
    "收方",
    "receiver",
    "receiver name",
    "consignee",
    "客户姓名",
    "收货姓名",
    "签收人",
  ],
  receiver_phone: [
    "收件电话",
    "收货电话",
    "收件人电话",
    "receiver phone",
    "receiver tel",
    "consignee phone",
    "收方电话",
    "联系电话",
    "手机",
    "移动电话",
    "收件手机",
    "收货手机",
    "收件人手机",
    "收货人电话",
  ],
  receiver_address: [
    "收件地址",
    "收货地址",
    "收方地址",
    "收件人地址",
    "receiver addr",
    "receiver address",
    "consignee address",
    "详细地址",
    "收货详细地址",
  ],
  weight_kg: ["重量", "weight", "货品重量", "毛重", "净重", "计费重量", "千克", "公斤", "kg", "货物重量"],
  piece_count: [
    "件数",
    "包裹数",
    "数量",
    "箱数",
    "包裹件数",
    "pcs",
    "quantity",
    "packages",
    "order qty",
    "票数",
    "票数件数",
  ],
  temp_layer: [
    "温层",
    "温度区间",
    "温控",
    "温度要求",
    "存储温区",
    "冷链类型",
    "temp",
    "temperature",
    "运输温层",
  ],
  remark: ["备注", "说明", "附言", "留言", "remarks", "note", "comment", "memo", "交货备注"],
};

export function normalizeHeader(value: unknown): string {
  if (value === undefined || value === null) return "";
  let s = String(value).trim();
  try {
    s = s.replace(/\s+/g, "").replace(/_/g, "");
    s = s.replace(/[\u3000]/g, "");
    s = s.toLowerCase();
  } catch {
    /* ignore */
  }
  const map: Record<string, string> = {
    receiver: "receiver",
    recv: "receiver",
    sender: "sender",
    shipper: "shipper",
    consignee: "consignee",
    consigneeaddr: "consigneeaddr",
    收: "收",
    发: "发",
    件: "件",
    重: "重",
    备注: "备注",
  };
  // 中英混合的简单归一（保留中文）
  for (const [k, v] of Object.entries(map)) {
    if (s === k) s = v;
  }
  return s;
}

/** 计算列头与字段的匹配分：完全包含或相等则高分 */
export function scoreHeaderForField(headerRaw: string, field: SystemFieldKey): number {
  const nh = normalizeHeader(headerRaw);
  if (!nh) return 0;
  let best = 0;
  const variants = COLUMN_ALIASES[field];
  for (const alias of variants) {
    const a = normalizeHeader(alias);
    if (!a) continue;
    if (nh === a) {
      best = Math.max(best, 120);
      continue;
    }
    if (nh.includes(a) || a.includes(nh)) {
      const lenScore = Math.min(nh.length, a.length);
      best = Math.max(best, 40 + Math.min(40, lenScore));
      continue;
    }
    /** 英文字段：逐字符松散匹配 */
    if (nh.length >= 3 && a.length >= 3) {
      let hit = 0;
      const short = nh.length <= a.length ? nh : a;
      const long = nh.length <= a.length ? a : nh;
      for (const ch of short) {
        if (long.includes(ch)) hit++;
      }
      const ratio = hit / Math.max(short.length, 1);
      if (ratio >= 0.8) best = Math.max(best, 25 + Math.floor(ratio * 20));
    }
  }
  return best;
}

/**
 * 自动推断列索引映射：每条 Excel 列最多对应一个字段，每个字段至多一列。
 * 得分矩阵贪心：按全局最高分依次分配。
 */
export function inferColumnMapping(headers: string[]): Partial<Record<SystemFieldKey, number>> {
  const keys = Object.keys(COLUMN_ALIASES) as SystemFieldKey[];
  type Cand = { col: number; field: SystemFieldKey; score: number };
  const cands: Cand[] = [];
  headers.forEach((h, idx) => {
    for (const field of keys) {
      const sc = scoreHeaderForField(h, field);
      if (sc > 0) cands.push({ col: idx, field, score: sc });
    }
  });
  cands.sort((a, b) => b.score - a.score);
  const usedCols = new Set<number>();
  const usedFields = new Set<SystemFieldKey>();
  const out: Partial<Record<SystemFieldKey, number>> = {};
  for (const c of cands) {
    if (usedCols.has(c.col) || usedFields.has(c.field)) continue;
    usedCols.add(c.col);
    usedFields.add(c.field);
    out[c.field] = c.col;
  }
  return out;
}
