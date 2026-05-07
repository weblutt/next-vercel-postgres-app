"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { FixedSizeList as List, type ListChildComponentProps, type ListOnItemsRenderedProps } from "react-window";
import type { OrderDraftRow, SystemFieldKey } from "@/lib/types/order";
import { FIELD_LABELS, SYSTEM_FIELDS } from "@/lib/types/order";
import type { StructuredValidationIssue } from "@/lib/types/order";
import { summarizeIssueTooltip, issuesForCell } from "@/lib/validation/order";

const ROW_H = 40;
/** 序号 + 字段 + 操作 */
const SEQ_W = 64;
const OP_W = 72;

const FIELD_W: Partial<Record<SystemFieldKey, number>> & Record<string, number> = {
  external_code: 140,
  sender_name: 120,
  sender_phone: 120,
  sender_address: 220,
  receiver_name: 120,
  receiver_phone: 120,
  receiver_address: 220,
  weight_kg: 92,
  piece_count: 72,
  temp_layer: 92,
  remark: 180,
};

type Active = { uid: string; field: SystemFieldKey } | null;

type Props = {
  rows: OrderDraftRow[];
  displayRowFn: (rowIndex: number) => number;
  issues: StructuredValidationIssue[];
  active: Active;
  onActiveChange: (a: Active) => void;
  onPatchCell: (uid: string, field: SystemFieldKey, value: string) => void;
  onRemoveRow: (uid: string) => void;
  onAddEmptyRow: () => void;
  heightPx: number;
};

export function OrderGrid(props: Props) {
  const { rows, displayRowFn, issues, active, onActiveChange, onPatchCell, onRemoveRow, onAddEmptyRow, heightPx } =
    props;

  const listRef = useRef<List>(null);

  const totalInnerWidth =
    SEQ_W + OP_W + SYSTEM_FIELDS.reduce((s, k) => s + (FIELD_W[k] ?? 120), 0) + SYSTEM_FIELDS.length * 8;

  const gotoCell = useCallback(
    (uid: string | null, field: SystemFieldKey | null) => {
      if (!uid || !field) return;
      onActiveChange({ uid, field });
      const ri = rows.findIndex((r) => r.uid === uid);
      if (ri >= 0) listRef.current?.scrollToItem(ri, "smart");
    },
    [rows, onActiveChange],
  );

  const bumpCell = useCallback(
    (dir: 1 | -1) => {
      if (rows.length === 0 || !active) return;
      const ri = rows.findIndex((r) => r.uid === active.uid);
      if (ri < 0) return;
      let fi = SYSTEM_FIELDS.indexOf(active.field);
      if (fi < 0) fi = 0;
      fi += dir;
      if (fi >= SYSTEM_FIELDS.length) {
        if (ri + 1 >= rows.length) return;
        gotoCell(rows[ri + 1].uid, SYSTEM_FIELDS[0]);
        return;
      }
      if (fi < 0) {
        if (ri <= 0) return;
        gotoCell(rows[ri - 1].uid, SYSTEM_FIELDS[SYSTEM_FIELDS.length - 1]);
        return;
      }
      gotoCell(rows[ri].uid, SYSTEM_FIELDS[fi]);
    },
    [active, gotoCell, rows],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag !== "input" && tag !== "textarea" && tag !== "select") return;
      if (e.key === "Tab") {
        e.preventDefault();
        bumpCell(e.shiftKey ? -1 : 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        bumpCell(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bumpCell]);

  const header = useMemo(() => {
    return (
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          display: "flex",
          width: totalInnerWidth,
          background: "rgba(21, 29, 42, 0.98)",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(6px)",
        }}
      >
        <div style={th(SEQ_W)}>#</div>
        {SYSTEM_FIELDS.map((k) => (
          <div key={k} style={th(FIELD_W[k] ?? 120)}>
            {FIELD_LABELS[k]}
          </div>
        ))}
        <div style={th(OP_W)}>操作</div>
      </div>
    );
  }, [totalInnerWidth]);

  const rowData = useMemo(
    () => ({
      rows,
      displayRowFn,
      issues,
      active,
      onActiveChange,
      onPatchCell,
      onRemoveRow,
      totalInnerWidth,
    }),
    [rows, displayRowFn, issues, active, onActiveChange, onPatchCell, onRemoveRow, totalInnerWidth],
  );

  const onItemsRendered = useCallback(
    (_: ListOnItemsRenderedProps) => {
      /* reserved for future diagnostics */
    },
    [],
  );

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid var(--border)",
        background: "rgba(26, 35, 50, 0.45)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", padding: "0.75rem 0.85rem" }}>
        <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          共 <b style={{ color: "var(--text)" }}>{rows.length}</b> 行（虚拟列表渲染，适合 1000+ 行）
        </div>
        <button type="button" onClick={onAddEmptyRow} style={miniBtn()}>
          新增空行
        </button>
      </div>

      <div style={{ overflowX: "auto", overflowY: "hidden" }}>
        <div style={{ minWidth: totalInnerWidth }}>
          {header}
          <List
            ref={listRef}
            height={heightPx}
            width={totalInnerWidth}
            itemCount={rows.length}
            itemSize={ROW_H}
            itemKey={(index: number) => rows[index]?.uid ?? String(index)}
            itemData={rowData}
            onItemsRendered={onItemsRendered}
          >
            {RowRenderer}
          </List>
        </div>
      </div>
    </div>
  );
}

type RowData = {
  rows: OrderDraftRow[];
  displayRowFn: (rowIndex: number) => number;
  issues: StructuredValidationIssue[];
  active: Active;
  onActiveChange: (a: Active) => void;
  onPatchCell: (uid: string, field: SystemFieldKey, value: string) => void;
  onRemoveRow: (uid: string) => void;
  totalInnerWidth: number;
};

function RowRenderer({ index, style, data }: ListChildComponentProps<RowData>) {
  const row = data.rows[index];
  if (!row) return null;
  const displayRow = data.displayRowFn(index);

  return (
    <div style={{ ...style, width: data.totalInnerWidth }}>
      <div
        style={{
          display: "flex",
          width: data.totalInnerWidth,
          borderBottom: "1px solid rgba(45,58,79,0.55)",
          background: index % 2 === 0 ? "rgba(15, 20, 29, 0.25)" : "rgba(15, 20, 29, 0.12)",
        }}
      >
        <div style={td(SEQ_W, false, false)} title={`Excel 数据行号（含表头）：${displayRow}`}>
          {displayRow}
        </div>
        {SYSTEM_FIELDS.map((field) => {
          const drIssues = issuesForCell(data.issues, displayRow, field).concat(
            field === "external_code" ? issuesForCell(data.issues, displayRow, "external_code_duplicate") : [],
          );
          const bad = drIssues.length > 0;
          const isActive = data.active?.uid === row.uid && data.active?.field === field;
          return (
            <div key={field} style={td(FIELD_W[field] ?? 120, bad, isActive)} title={summarizeIssueTooltip(drIssues)}>
              {isActive ? (
                <input
                  value={row[field]}
                  autoFocus
                  onChange={(e) => data.onPatchCell(row.uid, field, e.target.value)}
                  onBlur={() => {
                    /** 保留编辑态由父层控制；点击其他单元格会切换 */
                  }}
                  style={inputStyle(bad)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => data.onActiveChange({ uid: row.uid, field })}
                  style={cellBtn(bad)}
                >
                  <span
                    style={{
                      display: "block",
                      width: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textAlign: "left",
                    }}
                  >
                    {row[field] || " "}
                  </span>
                </button>
              )}
            </div>
          );
        })}
        <div style={td(OP_W, false, false)}>
          <button type="button" onClick={() => data.onRemoveRow(row.uid)} style={dangerMini()}>
            删除
          </button>
        </div>
      </div>
    </div>
  );
}

function th(w: number): CSSProperties {
  return {
    width: w,
    minWidth: w,
    padding: "0.55rem 0.45rem",
    fontSize: "0.78rem",
    color: "var(--muted)",
    borderRight: "1px solid rgba(45,58,79,0.45)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}

function td(w: number, bad: boolean, active: boolean): CSSProperties {
  return {
    width: w,
    minWidth: w,
    padding: "0.15rem 0.35rem",
    borderRight: "1px solid rgba(45,58,79,0.35)",
    display: "flex",
    alignItems: "center",
    background: bad ? "rgba(248, 113, 113, 0.10)" : active ? "rgba(56, 189, 248, 0.10)" : "transparent",
    boxShadow: bad ? "inset 0 0 0 1px rgba(248, 113, 113, 0.35)" : undefined,
  };
}

function cellBtn(bad: boolean): CSSProperties {
  return {
    width: "100%",
    border: "none",
    background: "transparent",
    color: bad ? "var(--danger)" : "var(--text)",
    cursor: "pointer",
    padding: "0.35rem 0.25rem",
    fontSize: "0.84rem",
  };
}

function inputStyle(bad: boolean): CSSProperties {
  return {
    width: "100%",
    borderRadius: 8,
    border: `1px solid ${bad ? "rgba(248,113,113,0.65)" : "rgba(56,189,248,0.45)"}`,
    padding: "0.35rem 0.35rem",
    background: "rgba(15, 20, 29, 0.75)",
    color: "var(--text)",
    fontSize: "0.84rem",
    outline: "none",
  };
}

function dangerMini(): CSSProperties {
  return {
    cursor: "pointer",
    borderRadius: 8,
    border: "1px solid rgba(248,113,113,0.45)",
    background: "rgba(248,113,113,0.08)",
    color: "var(--danger)",
    fontSize: "0.8rem",
    padding: "0.25rem 0.45rem",
  };
}

function miniBtn(): CSSProperties {
  return {
    cursor: "pointer",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "rgba(56,189,248,0.10)",
    color: "var(--text)",
    fontSize: "0.85rem",
    fontWeight: 700,
    padding: "0.45rem 0.65rem",
  };
}
