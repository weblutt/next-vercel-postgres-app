"use client";

import type { PropsWithChildren } from "react";

export function Modal(props: PropsWithChildren<{ open: boolean; title: string; onClose: () => void }>) {
  const { open, title, onClose, children } = props;
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 55,
        background: "rgba(10, 14, 22, 0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          borderRadius: 14,
          border: "1px solid var(--border)",
          background:
            "linear-gradient(180deg, rgba(26,35,50,0.96) 0%, rgba(21,29,42,0.98) 100%)",
          boxShadow: "0 22px 70px rgba(0,0,0,0.48)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "0.75rem",
            alignItems: "flex-start",
            padding: "1rem 1.05rem 0",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.08rem" }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              cursor: "pointer",
              borderRadius: 8,
              padding: "0.35rem 0.6rem",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--muted)",
            }}
          >
            关闭
          </button>
        </div>
        <div style={{ padding: "1rem 1.05rem 1.1rem" }}>{children}</div>
      </div>
    </div>
  );
}
