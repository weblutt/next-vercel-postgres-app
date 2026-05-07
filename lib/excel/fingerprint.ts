import type { SystemFieldKey } from "@/lib/types/order";
import { normalizeHeader } from "@/lib/excel/aliases";

const STORAGE_KEY = "shipping_template_mappings_v1";

export type StoredMapping = Partial<Record<SystemFieldKey, number | null>>;

export function fingerprintFromHeaders(headers: string[]): string {
  const parts = headers.map((h) => normalizeHeader(h));
  const joined = parts.join("\u001f");
  return simpleHash(joined);
}

function simpleHash(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function readStore(): Record<string, StoredMapping> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, StoredMapping>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(data: Record<string, StoredMapping>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* quota / private mode */
  }
}

export function loadMappingForFingerprint(fp: string): StoredMapping | null {
  const all = readStore();
  const m = all[fp];
  return m && typeof m === "object" ? m : null;
}

export function saveMappingForFingerprint(fp: string, mapping: StoredMapping) {
  const all = readStore();
  all[fp] = { ...mapping };
  writeStore(all);
}
