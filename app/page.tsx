"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OrderHistory } from "@/components/history/OrderHistory";
import { UploadZone } from "@/components/import/UploadZone";
import { MappingPanel } from "@/components/import/MappingPanel";
import { LinearProgress } from "@/components/LinearProgress";
import { Modal } from "@/components/Modal";
import { OrderGrid } from "@/components/preview/OrderGrid";
import { IssueList } from "@/components/preview/IssueList";
import { Toast } from "@/components/Toast";
import { inferColumnMapping } from "@/lib/excel/aliases";
import { exportOrdersToXlsx } from "@/lib/excel/exportSheet";
import { fingerprintFromHeaders, loadMappingForFingerprint, saveMappingForFingerprint, type StoredMapping } from "@/lib/excel/fingerprint";
import { matrixToDraftRows } from "@/lib/excel/mapRows";
import { inferHeaderRowIndex, parseExcelFile } from "@/lib/excel/parseFile";
import {
  FIELD_LABELS,
  type OrderDraftRow,
  type StructuredValidationIssue,
  type SystemFieldKey,
  SYSTEM_FIELDS,
  emptyOrderDraftRow,
} from "@/lib/types/order";
import {
  buildDuplicateIssues,
  computeBatchExternalCodeDupMap,
  normalizeRowForSubmit,
  validateOrderRow,
} from "@/lib/validation/order";

type Phase = "upload" | "mapping" | "preview";
type TopTab = "import" | "history";

function overlayMemoryMapping(
  inferred: Partial<Record<SystemFieldKey, number>>,
  memory: StoredMapping | null,
  colCount: number,
): Partial<Record<SystemFieldKey, number | null>> {
  const out: Partial<Record<SystemFieldKey, number | null>> = { ...inferred };
  if (!memory) return out;
  for (const key of SYSTEM_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(memory, key)) continue;
    const idx = memory[key];
    if (idx === null || idx === undefined) {
      out[key] = null;
      continue;
    }
    if (typeof idx === "number" && Number.isFinite(idx) && idx >= 0 && idx < colCount) {
      out[key] = idx;
    }
  }
  return out;
}

export default function HomePage() {
  const [topTab, setTopTab] = useState<TopTab>("import");
  const [phase, setPhase] = useState<Phase>("upload");

  const [importPct, setImportPct] = useState(0);
  const [importLabel, setImportLabel] = useState<string>("");
  const [busyImport, setBusyImport] = useState(false);
  const importLock = useRef(false);

  const [matrix, setMatrix] = useState<string[][] | null>(null);
  const [sheetName, setSheetName] = useState<string>("");
  const [headerIdx, setHeaderIdx] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  const [mapping, setMapping] = useState<Partial<Record<SystemFieldKey, number | null>>>({});
  const [rows, setRows] = useState<OrderDraftRow[]>([]);
  const [activeCell, setActiveCell] = useState<{ uid: string; field: SystemFieldKey } | null>(null);

  const [dbDup, setDbDup] = useState<Set<string>>(new Set());

  const [toast, setToast] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<"info" | "error" | "success">("info");
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockModalMsg, setBlockModalMsg] = useState("");
  const [setupBusy, setSetupBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const submitLock = useRef(false);
  const [submitPct, setSubmitPct] = useState(0);

  const displayRowFn = useCallback((rowIndex: number) => headerIdx + 2 + rowIndex, [headerIdx]);

  const baseIssues = useMemo(() => {
    const issues: StructuredValidationIssue[] = [];
    rows.forEach((row, idx) => validateOrderRow(row, displayRowFn(idx), issues));
    return issues;
  }, [rows, displayRowFn]);

  const dupBatchMap = useMemo(() => computeBatchExternalCodeDupMap(rows, displayRowFn), [rows, displayRowFn]);

  const dupIssues = useMemo(() => {
    return buildDuplicateIssues(rows, displayRowFn, {
      batchDuplicateRows: dupBatchMap,
      dbDuplicateCodes: dbDup,
    });
  }, [rows, displayRowFn, dupBatchMap, dbDup]);

  const allIssues = useMemo(() => [...baseIssues, ...dupIssues], [baseIssues, dupIssues]);

  useEffect(() => {
    if (topTab !== "import" || phase !== "preview") return;
    const codes = Array.from(new Set(rows.map((r) => r.external_code.trim()).filter(Boolean)));
    if (codes.length === 0) {
      setDbDup(new Set());
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/orders/check-duplicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codes }),
        });
        const data = (await res.json()) as { ok: boolean; existing?: string[]; error?: string };
        if (!data.ok) {
          setToastVariant("error");
          setToast(data.error ?? "重复检测失败");
          return;
        }
        setDbDup(new Set(data.existing ?? []));
      } catch {
        setToastVariant("error");
        setToast("重复检测网络异常");
      }
    }, 450);
    return () => window.clearTimeout(t);
  }, [rows, phase, topTab]);

  const showToast = useCallback((msg: string, v: "info" | "error" | "success" = "info") => {
    setToastVariant(v);
    setToast(msg);
  }, []);

  const resetImportState = useCallback(() => {
    setPhase("upload");
    setMatrix(null);
    setHeaders([]);
    setFingerprint(null);
    setMapping({});
    setRows([]);
    setActiveCell(null);
    setImportPct(0);
    setImportLabel("");
    setDbDup(new Set());
  }, []);

  const onPickFile = useCallback(
    async (file: File) => {
      if (importLock.current || busyImport) return;
      importLock.current = true;
      setBusyImport(true);
      setImportLabel("正在读取并解析 Excel…");
      setImportPct(0);
      setPhase("upload");
      try {
        const ab = await file.arrayBuffer();
        const parsed = await parseExcelFile(ab, {
          onProgress: (pct, cur, total) => {
            setImportPct(pct);
            setImportLabel(`解析进度：${cur}/${total} 行（约 ${pct}%）`);
          },
        });
        setSheetName(parsed.sheetName);
        const m = parsed.matrix;
        setMatrix(m);
        const hi = inferHeaderRowIndex(m);
        setHeaderIdx(hi);
        const hdr = (m[hi] ?? []).map((c) => String(c ?? "").trim());
        setHeaders(hdr);
        const fp = fingerprintFromHeaders(hdr);
        setFingerprint(fp);
        const inferred = inferColumnMapping(hdr);
        const memory = loadMappingForFingerprint(fp);
        const merged = overlayMemoryMapping(inferred, memory, hdr.length);
        setMapping(merged);
        setRows([]);
        setActiveCell(null);
        setPhase("mapping");
        showToast(
          memory
            ? `已匹配表头指纹并复用本地模板记忆（工作表：${parsed.sheetName}）`
            : `已自动推断列映射，请核对（工作表：${parsed.sheetName}）`,
          "success",
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "导入失败";
        showToast(msg, "error");
      } finally {
        importLock.current = false;
        setBusyImport(false);
        setImportPct(0);
        setImportLabel("");
      }
    },
    [busyImport, showToast],
  );

  const applyMapping = useCallback(() => {
    if (!matrix) return;
    const { rows: next } = matrixToDraftRows(matrix, headerIdx, mapping);
    if (next.length === 0) {
      showToast("按当前映射未解析到有效数据行（可能均为空行或表头有误）。请检查。", "error");
      return;
    }
    setRows(next);
    setActiveCell(next[0] ? { uid: next[0].uid, field: "sender_name" } : null);
    setPhase("preview");
    showToast(`已生成预览：${next.length} 条`, "success");
  }, [matrix, headerIdx, mapping, showToast]);

  const patchCell = useCallback((uid: string, field: SystemFieldKey, value: string) => {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, [field]: value } : r)));
  }, []);

  const removeRow = useCallback((uid: string) => {
    setRows((prev) => prev.filter((r) => r.uid !== uid));
    setActiveCell(null);
  }, []);

  const addEmptyRow = useCallback(() => {
    const uid =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `row_${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
    setRows((prev) => [...prev, emptyOrderDraftRow(uid)]);
  }, []);

  const runSetup = useCallback(async () => {
    setSetupBusy(true);
    try {
      const res = await fetch("/api/setup", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; message?: string; error?: string };
      if (!data.ok) throw new Error(data.error ?? "初始化失败");
      showToast(data.message ?? "初始化完成", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "初始化失败", "error");
    } finally {
      setSetupBusy(false);
    }
  }, [showToast]);

  const submitOrders = useCallback(async () => {
    if (submitLock.current || submitBusy) return;
    if (allIssues.length > 0) {
      setBlockModalMsg(`当前仍有 ${allIssues.length} 条校验错误，请先修正后再提交下单。`);
      setBlockModalOpen(true);
      return;
    }

    const bid =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const payloads = rows.map((r) => {
      const n = normalizeRowForSubmit(r);
      return {
        batchId: bid,
        external_code: n.external_code,
        sender_name: n.sender_name,
        sender_phone: n.sender_phone,
        sender_address: n.sender_address,
        receiver_name: n.receiver_name,
        receiver_phone: n.receiver_phone,
        receiver_address: n.receiver_address,
        weight_kg: n.weight_kg,
        piece_count: n.piece_count,
        temp_layer: n.temp_layer as "常温" | "冷藏" | "冷冻",
        remark: n.remark,
      };
    });

    submitLock.current = true;
    setSubmitBusy(true);
    setSubmitPct(0);
    let inserted = 0;
    let failed = 0;
    try {
      const chunkSize = 200;
      const total = payloads.length;
      for (let i = 0; i < total; i += chunkSize) {
        const slice = payloads.slice(i, i + chunkSize);
        const res = await fetch("/api/orders/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orders: slice }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          inserted?: number;
          failed?: number;
          failures?: unknown;
          error?: string;
        };
        if (!data.ok || res.ok === false) {
          throw new Error(data.error ?? "提交失败");
        }
        inserted += data.inserted ?? 0;
        failed += data.failed ?? 0;
        setSubmitPct(Math.round((Math.min(i + slice.length, total) / Math.max(total, 1)) * 100));
      }

      showToast(`提交完成：成功 ${inserted} 条，失败 ${failed} 条`, failed > 0 ? "info" : "success");
      if (failed === 0) {
        resetImportState();
        setTopTab("history");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "提交失败", "error");
    } finally {
      submitLock.current = false;
      setSubmitBusy(false);
      setSubmitPct(0);
    }
  }, [submitBusy, allIssues.length, rows, showToast, resetImportState]);

  return (
    <main style={{ maxWidth: 1220, margin: "0 auto", padding: "1.65rem 1.1rem 3.25rem" }}>
      <Toast
        message={toast}
        variant={toastVariant}
        durationMs={toastVariant === "error" ? 5200 : 3200}
        onClose={() => setToast(null)}
      />

      <Modal open={blockModalOpen} title="无法提交" onClose={() => setBlockModalOpen(false)}>
        <p style={{ margin: 0, lineHeight: 1.65, color: "var(--text)" }}>{blockModalMsg}</p>
      </Modal>

      <header style={{ marginBottom: "1.25rem", display: "grid", gap: "0.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.85rem", flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)", letterSpacing: "0.02em" }}>
              Next.js · App Router · PostgreSQL · 万能导入演示
            </p>
            <h1 style={{ margin: "0.35rem 0 0", fontSize: "1.72rem", lineHeight: 1.2 }}>
              多模板自动导入下单系统（考试示例）
            </h1>
            <p style={{ margin: "0.75rem 0 0", color: "var(--muted)", lineHeight: 1.65 }}>
              支持拖拽/点击上传 <code style={{ color: "var(--accent)" }}>.xlsx / .xls</code>
              ，多列名别名自动识别；失败可手动下拉映射并按表头指纹记忆；大批量虚拟表格预览编辑后批量入库，
              Vercel 托管数据库持久化并提供历史分页筛选。
              测试模板包：{" "}
              <a
                href="http://106.12.10.129:10010/uploads/excel.zip"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--accent)" }}
              >
                excel.zip 下载
              </a>
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", alignItems: "stretch", minWidth: 220 }}>
            <button type="button" disabled={setupBusy} onClick={() => void runSetup()} style={btnPrimary}>
              {setupBusy ? "初始化中…" : "初始化数据库（建表）"}
            </button>
            <small style={{ color: "var(--muted)", fontSize: "0.78rem", lineHeight: 1.45 }}>
              首次部署/本地请执行一次，需配置 <code>.env.local</code> 中 <code>POSTGRES_URL</code>。
            </small>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
          <SegButton active={topTab === "import"} onClick={() => setTopTab("import")}>
            导入与下单
          </SegButton>
          <SegButton active={topTab === "history"} onClick={() => setTopTab("history")}>
            历史运单
          </SegButton>
        </div>
      </header>

      {topTab === "history" ? (
        <OrderHistory />
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          <section style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem" }}>1. 上传 Excel</h2>
                <p style={{ margin: "0.45rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
                  支持合并单元格场景下「第一行有效表头」识别；空行自动跳过；异常会给出中文说明。
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.55rem", alignItems: "center", flexWrap: "wrap" }}>
                {phase !== "upload" && (
                  <button type="button" onClick={resetImportState} style={btnGhost}>
                    重新上传
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginTop: "0.85rem" }}>
              <UploadZone disabled={busyImport} onFile={onPickFile} onError={(m) => showToast(m, "error")} />
            </div>

            {(importLabel || importPct > 0) && (
              <div style={{ marginTop: "0.85rem" }}>
                <LinearProgress valuePct={importPct} label={importLabel || "正在处理…"} />
              </div>
            )}

            {matrix && (
              <p style={{ margin: "0.85rem 0 0", color: "var(--muted)", fontSize: "0.86rem" }}>
                已解析工作表：<b style={{ color: "var(--text)" }}>{sheetName}</b> · 表头行：第{" "}
                <b style={{ color: "var(--text)" }}>{headerIdx + 1}</b> 行（Excel 行号）
                {fingerprint ? (
                  <>
                    {" "}
                    · 表头指纹：<b style={{ color: "var(--text)" }}>{fingerprint}</b>
                  </>
                ) : null}
              </p>
            )}
          </section>

          {phase === "mapping" && matrix && (
            <MappingPanel
              headers={headers}
              mapping={mapping}
              onChange={setMapping}
              fingerprint={fingerprint}
              onSaveMemory={(m) => {
                if (!fingerprint) return;
                saveMappingForFingerprint(fingerprint, m);
                showToast("已保存模板记忆（本地浏览器）", "success");
              }}
              onApply={applyMapping}
              disabled={false}
            />
          )}

          {phase === "preview" && (
            <section style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.05rem" }}>2. 数据预览与校验</h2>
                  <p style={{ margin: "0.45rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
                    固定表头 + 虚拟列表；点击单元格编辑；<b>Tab / Enter</b> 快速切换；错误集中展示并标红；外部编码支持本批/历史重复检测。
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const ts = new Date();
                      const pad = (n: number) => String(n).padStart(2, "0");
                      exportOrdersToXlsx(
                        rows,
                        `运单导出_${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(
                          ts.getMinutes(),
                        )}${pad(ts.getSeconds())}.xlsx`,
                      );
                      showToast("已导出 Excel", "success");
                    }}
                    style={btnGhost}
                  >
                    导出 Excel
                  </button>
                  <button
                    type="button"
                    disabled={submitBusy}
                    onClick={() => void submitOrders()}
                    style={btnPrimary}
                  >
                    {submitBusy ? "提交中…" : "提交下单"}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: "0.85rem" }}>
                <IssueList issues={allIssues} />
              </div>

              {submitBusy && (
                <div style={{ marginTop: "0.85rem" }}>
                  <LinearProgress valuePct={submitPct} label="批量提交进度" />
                </div>
              )}

              <div style={{ marginTop: "0.85rem" }}>
                <OrderGrid
                  rows={rows}
                  displayRowFn={displayRowFn}
                  issues={allIssues}
                  active={activeCell}
                  onActiveChange={setActiveCell}
                  onPatchCell={patchCell}
                  onRemoveRow={removeRow}
                  onAddEmptyRow={addEmptyRow}
                  heightPx={520}
                />
              </div>

              <p style={{ margin: "0.85rem 0 0", color: "var(--muted)", fontSize: "0.82rem" }}>
                字段说明：{SYSTEM_FIELDS.filter((k) => k !== "external_code" && k !== "remark").map((k) => FIELD_LABELS[k]).join("、")}
                等为业务必填；{FIELD_LABELS.external_code}、{FIELD_LABELS.remark} 选填且允许整列缺失。
              </p>
            </section>
          )}
        </div>
      )}
    </main>
  );
}

function SegButton(props: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        cursor: "pointer",
        borderRadius: 999,
        padding: "0.45rem 0.85rem",
        border: props.active ? "1px solid rgba(56,189,248,0.55)" : "1px solid var(--border)",
        background: props.active ? "rgba(56,189,248,0.12)" : "transparent",
        color: "var(--text)",
        fontWeight: 800,
        fontSize: "0.9rem",
      }}
    >
      {props.children}
    </button>
  );
}

const card: CSSProperties = {
  borderRadius: 14,
  border: "1px solid var(--border)",
  background: "rgba(26, 35, 50, 0.45)",
  padding: "1rem 1rem",
};

const btnPrimary: CSSProperties = {
  cursor: "pointer",
  padding: "0.65rem 0.95rem",
  borderRadius: 10,
  border: "none",
  fontWeight: 900,
  background: "linear-gradient(180deg, var(--accent) 0%, var(--accent-dim) 100%)",
  color: "#0b1220",
};

const btnGhost: CSSProperties = {
  cursor: "pointer",
  padding: "0.65rem 0.95rem",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text)",
  fontWeight: 750,
};
