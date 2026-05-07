"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import type { DemoItem } from "@/lib/schema";

type ApiList = { ok: boolean; items?: DemoItem[]; error?: string };
type ApiSetup = { ok: boolean; message?: string; error?: string };
type ApiPost = { ok: boolean; item?: DemoItem; error?: string };

export default function HomePage() {
  const [items, setItems] = useState<DemoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/items", { cache: "no-store" });
      const data = (await res.json()) as ApiList;
      if (!data.ok) {
        setError(data.error ?? "加载失败");
        setItems([]);
        return;
      }
      setItems(data.items ?? []);
    } catch {
      setError("网络错误");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  async function runSetup() {
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch("/api/setup", { method: "POST" });
      const data = (await res.json()) as ApiSetup;
      if (!data.ok) {
        setToast(data.error ?? "初始化失败");
        return;
      }
      setToast(data.message ?? "完成");
      await loadItems();
    } catch {
      setToast("请求失败");
    } finally {
      setBusy(false);
    }
  }

  async function addItem() {
    const title = newTitle.trim();
    if (!title) return;
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
      });
      const data = (await res.json()) as ApiPost;
      if (!data.ok) {
        setToast(data.error ?? "插入失败");
        return;
      }
      setNewTitle("");
      setToast("已新增一条记录");
      await loadItems();
    } catch {
      setToast("请求失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "2.5rem 1.25rem 4rem"
      }}
    >
      <header style={{ marginBottom: "2rem" }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.85rem",
            color: "var(--muted)",
            letterSpacing: "0.02em"
          }}
        >
          Next.js 14 · App Router · Serverless API
        </p>
        <h1 style={{ margin: "0.35rem 0 0", fontSize: "1.75rem" }}>
          Vercel Postgres 数据展示
        </h1>
        <p style={{ margin: "0.75rem 0 0", color: "var(--muted)", lineHeight: 1.6 }}>
          点击下方按钮完成建表与示例数据插入，然后在本页查看查询结果。请先在{" "}
          <code style={{ color: "var(--accent)" }}>.env.local</code> 中配置数据库连接（可参考{" "}
          <code>.env.local.example</code>）。
        </p>
      </header>

      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "1.5rem",
          alignItems: "center"
        }}
      >
        <button
          type="button"
          onClick={() => void runSetup()}
          disabled={busy}
          style={btnStyle(true)}
        >
          初始化数据库（建表 + 示例数据）
        </button>
        <button
          type="button"
          onClick={() => void loadItems()}
          disabled={busy || loading}
          style={btnStyle(false)}
        >
          刷新列表
        </button>
      </section>

      <section
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "1.25rem",
          marginBottom: "1.5rem"
        }}
      >
        <h2 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>新增一条记录</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="输入标题，例如：期末大作业"
            disabled={busy}
            style={{
              flex: "1 1 200px",
              padding: "0.65rem 0.85rem",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
              fontSize: "1rem"
            }}
          />
          <button
            type="button"
            onClick={() => void addItem()}
            disabled={busy || !newTitle.trim()}
            style={btnStyle(true)}
          >
            插入数据库
          </button>
        </div>
      </section>

      {toast && (
        <p
          role="status"
          style={{
            margin: "0 0 1rem",
            padding: "0.65rem 0.85rem",
            borderRadius: 8,
            background: "rgba(56, 189, 248, 0.12)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            color: "var(--text)",
            fontSize: "0.9rem"
          }}
        >
          {toast}
        </p>
      )}

      {error && (
        <p
          role="alert"
          style={{
            margin: "0 0 1rem",
            color: "var(--danger)",
            fontSize: "0.95rem"
          }}
        >
          {error}
        </p>
      )}

      <section>
        <h2 style={{ margin: "0 0 1rem", fontSize: "1rem" }}>
          数据库查询结果 {loading ? "（加载中…）" : `（${items.length} 条）`}
        </h2>
        {!loading && items.length === 0 && !error && (
          <p style={{ color: "var(--muted)" }}>
            暂无数据。请先执行「初始化数据库」。
          </p>
        )}
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.65rem"
          }}
        >
          {items.map((row) => (
            <li
              key={row.id}
              style={{
                padding: "1rem 1.1rem",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "linear-gradient(135deg, #1c2738 0%, #151d2a 100%)"
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  marginBottom: "0.35rem"
                }}
              >
                ID #{row.id}{" "}
                <span style={{ opacity: 0.85 }}>· {formatTime(row.created_at)}</span>
              </div>
              <div style={{ fontSize: "1.05rem" }}>{row.title}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function btnStyle(primary: boolean): CSSProperties {
  return {
    cursor: "pointer",
    padding: "0.65rem 1rem",
    borderRadius: 8,
    fontSize: "0.95rem",
    fontWeight: 600,
    border: primary ? "none" : "1px solid var(--border)",
    background: primary
      ? "linear-gradient(180deg, var(--accent) 0%, var(--accent-dim) 100%)"
      : "transparent",
    color: primary ? "#0b1220" : "var(--text)"
  };
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("zh-CN", { hour12: false });
  } catch {
    return iso;
  }
}
