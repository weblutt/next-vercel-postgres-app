"use client";

import type { StructuredValidationIssue } from "@/lib/types/order";

export function IssueList(props: { issues: StructuredValidationIssue[] }) {
  const { issues } = props;
  if (issues.length === 0) {
    return (
      <div style={{ color: "var(--success)", fontSize: "0.92rem", padding: "0.25rem 0" }}>
        当前无校验错误，可以提交下单。
      </div>
    );
  }
  return (
    <div
      style={{
        maxHeight: 220,
        overflow: "auto",
        borderRadius: 12,
        border: "1px solid rgba(248,113,113,0.35)",
        background: "rgba(248,113,113,0.08)",
        padding: "0.65rem 0.75rem",
      }}
    >
      <div style={{ fontSize: "0.85rem", color: "var(--danger)", fontWeight: 800, marginBottom: "0.45rem" }}>
        共 {issues.length} 条问题（请修正后提交）
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.35rem" }}>
        {issues.map((it, idx) => (
          <li
            key={`${it.displayRow}-${it.fieldKey}-${idx}`}
            style={{
              fontSize: "0.88rem",
              lineHeight: 1.45,
              color: "var(--text)",
              borderBottom: "1px dashed rgba(248,113,113,0.22)",
              paddingBottom: "0.35rem",
            }}
            title={`${it.fieldLabel}：${it.reason}`}
          >
            <span style={{ color: "var(--muted)" }}>第 {it.displayRow} 行</span> ·{" "}
            <span style={{ fontWeight: 700 }}>{it.fieldLabel}</span> · {it.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
