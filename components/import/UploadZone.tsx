"use client";

import type { CSSProperties, DragEvent } from "react";
import { useCallback, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  onFile: (file: File) => void;
  onError: (msg: string) => void;
};

const ACCEPT = ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

export function UploadZone(props: Props) {
  const { disabled, onFile, onError } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const pick = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      const name = file.name.toLowerCase();
      if (!(name.endsWith(".xlsx") || name.endsWith(".xls"))) {
        onError("仅支持 .xlsx / .xls 格式的 Excel 文件。");
        return;
      }
      if (file.size === 0) {
        onError("文件为空，请检查后重新上传。");
        return;
      }
      onFile(file);
    },
    [onError, onFile],
  );

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
      }}
      onDrop={(e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        if (disabled) return;
        const f = e.dataTransfer.files?.[0];
        pick(f);
      }}
      style={{
        borderRadius: 14,
        border: `1px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
        background: dragOver ? "rgba(56, 189, 248, 0.08)" : "rgba(26, 35, 50, 0.35)",
        padding: "1.35rem 1rem",
        textAlign: "center",
      }}
    >
      <p style={{ margin: "0 0 0.75rem", color: "var(--muted)", fontSize: "0.92rem" }}>
        将 Excel 拖到此处，或点击下方按钮选择文件（支持 .xlsx / .xls）
      </p>
      <div style={{ display: "flex", gap: "0.65rem", justifyContent: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          style={primaryBtn()}
        >
          选择文件
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function primaryBtn(): CSSProperties {
  return {
    cursor: "pointer",
    padding: "0.65rem 1rem",
    borderRadius: 10,
    fontSize: "0.95rem",
    fontWeight: 700,
    border: "none",
    background: "linear-gradient(180deg, var(--accent) 0%, var(--accent-dim) 100%)",
    color: "#0b1220",
  };
}
