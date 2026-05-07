"use client";

export function LinearProgress(props: { valuePct: number; label?: string }) {
  const pct = Math.min(100, Math.max(0, props.valuePct));
  return (
    <div style={{ width: "100%" }}>
      {props.label && (
        <div
          style={{
            fontSize: "0.85rem",
            color: "var(--muted)",
            marginBottom: "0.45rem",
            display: "flex",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <span>{props.label}</span>
          <span style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
            {pct.toFixed(0)}%
          </span>
        </div>
      )}
      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: "rgba(45, 58, 79, 0.75)",
          overflow: "hidden",
          border: "1px solid rgba(45, 58, 79, 0.95)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 999,
            background: "linear-gradient(90deg, var(--accent) 0%, var(--accent-dim) 100%)",
            transition: "width 160ms ease-out",
          }}
        />
      </div>
    </div>
  );
}
