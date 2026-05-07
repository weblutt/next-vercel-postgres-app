"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import type { ShippingOrderDbRow } from "@/lib/types/order";

type Api = {
  ok: boolean;
  page: number;
  pageSize: number;
  total: string;
  items: ShippingOrderDbRow[];
  error?: string;
};

export function OrderHistory() {
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [total, setTotal] = useState<string>("0");
  const [items, setItems] = useState<ShippingOrderDbRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [externalCode, setExternalCode] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        externalCode: externalCode.trim(),
        receiverName: receiverName.trim(),
        from: from.trim(),
        to: to.trim(),
      });
      const res = await fetch(`/api/orders?${sp.toString()}`, { cache: "no-store" });
      const data = (await res.json()) as Api;
      if (!data.ok) {
        setError(data.error ?? "加载失败");
        setItems([]);
        return;
      }
      setItems(data.items ?? []);
      setTotal(data.total ?? "0");
    } catch {
      setError("网络异常");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, externalCode, receiverName, from, to, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(Number(total || "0") / pageSize));

  return (
    <div style={card()}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.85rem", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.05rem" }}>已导入运单历史</h2>
          <p style={{ margin: "0.45rem 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
            数据来源：PostgreSQL · 分页展示 · 可按外部编码 / 收件人 / 时间段筛选。
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} style={btnPrimary()}>
          {loading ? "刷新中…" : "刷新"}
        </button>
      </div>

      <div
        style={{
          marginTop: "0.95rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "0.65rem",
        }}
      >
        <label style={lbl()}>
          外部编码
          <input
            value={externalCode}
            onChange={(e) => {
              setPage(1);
              setExternalCode(e.target.value);
            }}
            style={inp()}
            placeholder="模糊匹配"
          />
        </label>
        <label style={lbl()}>
          收件人姓名
          <input
            value={receiverName}
            onChange={(e) => {
              setPage(1);
              setReceiverName(e.target.value);
            }}
            style={inp()}
            placeholder="模糊匹配"
          />
        </label>
        <label style={lbl()}>
          提交起始日期
          <input
            value={from}
            type="date"
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
            style={inp()}
          />
        </label>
        <label style={lbl()}>
          提交结束日期
          <input
            value={to}
            type="date"
            onChange={(e) => {
              setPage(1);
              setTo(e.target.value);
            }}
            style={inp()}
          />
        </label>
      </div>

      {error && (
        <p style={{ margin: "0.75rem 0 0", color: "var(--danger)", fontSize: "0.92rem" }}>{error}</p>
      )}

      <div style={{ marginTop: "0.9rem", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980, fontSize: "0.86rem" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--muted)" }}>
              <th style={th()}>ID</th>
              <th style={th()}>批次</th>
              <th style={th()}>外部编码</th>
              <th style={th()}>收件人</th>
              <th style={th()}>收件电话</th>
              <th style={th()}>温层</th>
              <th style={th()}>重量(kg)</th>
              <th style={th()}>件数</th>
              <th style={th()}>提交时间</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid rgba(45,58,79,0.55)" }}>
                <td style={td()}>{r.id}</td>
                <td style={td()} title={r.batch_id}>
                  {r.batch_id.slice(0, 8)}…
                </td>
                <td style={td()}>{r.external_code ?? ""}</td>
                <td style={td()}>{r.receiver_name}</td>
                <td style={td()}>{r.receiver_phone}</td>
                <td style={td()}>{r.temp_layer}</td>
                <td style={td()}>{r.weight_kg}</td>
                <td style={td()}>{r.piece_count}</td>
                <td style={td()}>{formatCn(r.created_at)}</td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={9} style={{ ...td(), color: "var(--muted)", padding: "1rem" }}>
                  暂无记录。可通过「上传模板」完成一次提交后在此查看。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: "0.85rem",
          display: "flex",
          justifyContent: "space-between",
          gap: "0.75rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ color: "var(--muted)", fontSize: "0.88rem" }}>
          共 <b style={{ color: "var(--text)" }}>{total}</b> 条 · 第{" "}
          <b style={{ color: "var(--text)" }}>{page}</b> / {totalPages} 页
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={btnGhost()}
          >
            上一页
          </button>
          <button
            type="button"
            disabled={loading || page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={btnGhost()}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}

function formatCn(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}

function card(): CSSProperties {
  return {
    borderRadius: 14,
    border: "1px solid var(--border)",
    background: "rgba(26, 35, 50, 0.45)",
    padding: "1rem 1rem",
  };
}

function lbl(): CSSProperties {
  return { display: "grid", gap: "0.35rem", fontSize: "0.82rem", color: "var(--muted)" };
}

function inp(): CSSProperties {
  return {
    padding: "0.55rem 0.65rem",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "rgba(15, 20, 29, 0.75)",
    color: "var(--text)",
    fontSize: "0.92rem",
  };
}

function th(): CSSProperties {
  return { padding: "0.55rem 0.45rem", borderBottom: "1px solid rgba(45,58,79,0.65)", whiteSpace: "nowrap" };
}

function td(): CSSProperties {
  return { padding: "0.55rem 0.45rem", verticalAlign: "top", color: "var(--text)" };
}

function btnPrimary(): CSSProperties {
  return {
    cursor: "pointer",
    padding: "0.6rem 0.9rem",
    borderRadius: 10,
    border: "none",
    fontWeight: 800,
    background: "linear-gradient(180deg, var(--accent) 0%, var(--accent-dim) 100%)",
    color: "#0b1220",
  };
}

function btnGhost(): CSSProperties {
  return {
    cursor: "pointer",
    padding: "0.55rem 0.75rem",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text)",
  };
}
