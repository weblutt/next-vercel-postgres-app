"use client";

import type { CSSProperties } from "react";
import type { StoredMapping } from "@/lib/excel/fingerprint";
import type { SystemFieldKey } from "@/lib/types/order";
import { FIELD_METAS, FIELD_LABELS, SYSTEM_FIELDS } from "@/lib/types/order";

type Props = {
  headers: string[];
  /** 列索引或 null 表示未映射 */
  mapping: Partial<Record<SystemFieldKey, number | null>>;
  onChange: (mapping: Partial<Record<SystemFieldKey, number | null>>) => void;
  fingerprint: string | null;
  onSaveMemory: (m: StoredMapping) => void;
  onApply: () => void;
  disabled?: boolean;
};

export function MappingPanel(props: Props) {
  const { headers, mapping, onChange, fingerprint, onSaveMemory, onApply, disabled } = props;

  const setFieldCol = (field: SystemFieldKey, col: string) => {
    if (col === "__none__") {
      const next = { ...mapping, [field]: null };
      onChange(next);
      return;
    }
    const idx = parseInt(col, 10);
    if (Number.isNaN(idx)) {
      const next = { ...mapping, [field]: null };
      onChange(next);
      return;
    }
    const next = { ...mapping, [field]: idx };
    /** 避免两列抢占：清除其他字段对同列的占用 */
    for (const fk of SYSTEM_FIELDS) {
      if (fk === field) continue;
      if (next[fk] === idx) delete next[fk];
    }
    onChange(next);
  };

  const handleSaveMemoryClick = () => {
    if (!fingerprint) return;
    onSaveMemory({ ...mapping });
  };

  return (
    <div style={card()}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.02rem" }}>列映射（可手动纠错）</h2>
          <p style={{ margin: "0.55rem 0 0", color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.55 }}>
            系统自动匹配可能受合并单元格或非标准表头影响；请为每个业务字段选择对应 Excel 列。确认后会将规则按「表头指纹」记忆在浏览器本地，下次同结构模板自动复用。
          </p>
        </div>
      </div>

      <div style={{ marginTop: "1rem", display: "grid", gap: "0.55rem" }}>
        {FIELD_METAS.map((m) => (
          <div
            key={m.key}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(160px, 220px) minmax(260px, 1fr)",
              gap: "0.65rem",
              alignItems: "center",
              padding: "0.55rem 0.65rem",
              borderRadius: 10,
              border: "1px solid rgba(45,58,79,0.75)",
              background: "rgba(15, 20, 29, 0.45)",
            }}
          >
            <div style={{ fontSize: "0.92rem" }}>
              {m.label}
              {m.requiredInBusiness ? (
                <span style={{ color: "var(--danger)", marginLeft: 6 }}>*</span>
              ) : (
                <span style={{ color: "var(--muted)", marginLeft: 6, fontSize: "0.8rem" }}>
                  选填
                </span>
              )}
            </div>
            <select
              disabled={disabled}
              value={mapping[m.key] !== undefined && mapping[m.key] !== null ? String(mapping[m.key]) : "__none__"}
              onChange={(e) => setFieldCol(m.key, e.target.value)}
              style={selectStyle()}
            >
              <option value="__none__">— 不映射该字段 —</option>
              {headers.map((h, idx) => (
                <option key={`${idx}-${h}`} value={String(idx)}>
                  第 {idx + 1} 列：{h || "（空列头）"}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "1rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.65rem",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          disabled={disabled || !fingerprint}
          onClick={handleSaveMemoryClick}
          style={ghostBtn()}
          title="保存当前映射到本地，供下次自动复用"
        >
          保存模板记忆
        </button>
        <button type="button" disabled={disabled} onClick={onApply} style={primaryBtn()}>
          应用映射并生成预览
        </button>
      </div>

      <p style={{ margin: "0.85rem 0 0", color: "var(--muted)", fontSize: "0.82rem" }}>
        提示：字段「{FIELD_LABELS.external_code}」「{FIELD_LABELS.remark}」允许整列缺失；业务必填字段请确保映射到有效列。
      </p>
    </div>
  );
}

function card(): CSSProperties {
  return {
    borderRadius: 14,
    border: "1px solid var(--border)",
    background: "rgba(26, 35, 50, 0.55)",
    padding: "1.05rem 1rem",
  };
}

function selectStyle(): CSSProperties {
  return {
    width: "100%",
    padding: "0.55rem 0.65rem",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "rgba(15, 20, 29, 0.75)",
    color: "var(--text)",
    fontSize: "0.92rem",
  };
}

function primaryBtn(): CSSProperties {
  return {
    cursor: "pointer",
    padding: "0.65rem 1rem",
    borderRadius: 10,
    fontSize: "0.95rem",
    fontWeight: 800,
    border: "none",
    background: "linear-gradient(180deg, var(--accent) 0%, var(--accent-dim) 100%)",
    color: "#0b1220",
  };
}

function ghostBtn(): CSSProperties {
  return {
    cursor: "pointer",
    padding: "0.65rem 1rem",
    borderRadius: 10,
    fontSize: "0.95rem",
    fontWeight: 650,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
  };
}
