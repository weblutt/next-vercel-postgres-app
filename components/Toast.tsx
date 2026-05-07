"use client";

import { useEffect } from "react";

export function Toast(props: {
  message: string | null;
  onClose: () => void;
  variant?: "info" | "error" | "success";
  durationMs?: number;
}) {
  const { message, onClose, variant = "info", durationMs = 3200 } = props;

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(t);
  }, [message, onClose, durationMs]);

  if (!message) return null;

  const border =
    variant === "error"
      ? "rgba(248, 113, 113, 0.45)"
      : variant === "success"
        ? "rgba(74, 222, 128, 0.45)"
        : "rgba(56, 189, 248, 0.35)";
  const bg =
    variant === "error"
      ? "rgba(248, 113, 113, 0.12)"
      : variant === "success"
        ? "rgba(74, 222, 128, 0.12)"
        : "rgba(56, 189, 248, 0.12)";

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        right: "1.25rem",
        bottom: "1.25rem",
        zIndex: 60,
        maxWidth: "min(520px, calc(100vw - 2.5rem))",
        padding: "0.85rem 1rem",
        borderRadius: 12,
        border: `1px solid ${border}`,
        background: bg,
        color: "var(--text)",
        fontSize: "0.92rem",
        boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
      }}
    >
      {message}
    </div>
  );
}
