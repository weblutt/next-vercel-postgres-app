import * as XLSX from "xlsx";

export type ParsedSheetMatrix = {
  sheetName: string;
  /** 二维表：每项为字符串化单元格（合并格由 SheetJS 按实现展开，部分模板可能空格） */
  matrix: string[][];
};

function cellToString(c: unknown): string {
  if (c === undefined || c === null) return "";
  if (typeof c === "number" && Number.isFinite(c)) {
    if (Number.isInteger(c)) return String(c);
    const s = String(c);
    return s;
  }
  if (c instanceof Date) {
    return c.toISOString().slice(0, 10);
  }
  return String(c).trim();
}

function worksheetToMatrix(ws: XLSX.WorkSheet): string[][] {
  const ref = ws["!ref"];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const rows: string[][] = [];
  for (let R = range.s.r; R <= range.e.r; R++) {
    const row: string[] = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      const raw = cell ? (cell as XLSX.CellObject).w ?? (cell as XLSX.CellObject).v : undefined;
      row.push(cellToString(raw));
    }
    rows.push(row);
  }
  return rows;
}

function trimTrailingEmpty(rows: string[][]): string[][] {
  return rows.map((row) => {
    const r = [...row];
    while (r.length > 0 && r[r.length - 1].trim() === "") r.pop();
    return r;
  });
}

/** 判断是否整行空白 */
export function rowIsBlank(row: string[]): boolean {
  return row.every((c) => !String(c || "").trim());
}

/**
 * 读取第一个「非空前几行中存在非空单元格」的工作表；
 * @param onChunk 在行展开后的分块进度（近似）
 */
export async function parseExcelFile(
  buffer: ArrayBuffer,
  opts: {
    onProgress?: (pct: number, current: number, total: number) => void;
    chunkRows?: number;
  } = {},
): Promise<ParsedSheetMatrix> {
  const chunkRows = opts.chunkRows ?? 80;

  opts.onProgress?.(0, 0, 1);

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "array", cellDates: true, dense: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`无法解析 Excel 文件（格式错误或文件已损坏）：${msg}`);
  }

  const names = wb.SheetNames;
  if (!names || names.length === 0) {
    throw new Error("文件中没有可用的工作表（Sheet）。");
  }

  /** 遍历找到首个含数据的 sheet */
  let picked: ParsedSheetMatrix | null = null;
  for (const name of names) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const matrixRaw = worksheetToMatrix(ws);
    const matrix = trimTrailingEmpty(matrixRaw).filter((r) => !rowIsBlank(r));
    if (matrix.length === 0) continue;

    picked = { sheetName: name, matrix };
    break;
  }

  if (!picked || picked.matrix.length === 0) {
    throw new Error("没有发现包含有效数据的 Sheet（可能是空文件或仅有合并空行）。");
  }

  const totalApprox = picked.matrix.length;
  opts.onProgress?.(5, 0, totalApprox);

  /** 分段 yield，避免大批量同步阻塞 UI */
  for (let i = 0; i < picked.matrix.length; i += chunkRows) {
    await yieldToBrowser();
    const cur = Math.min(i + chunkRows, picked.matrix.length);
    const pct = 5 + Math.floor((cur / Math.max(totalApprox, 1)) * 94);
    opts.onProgress?.(pct, cur, totalApprox);
  }

  opts.onProgress?.(100, totalApprox, totalApprox);
  return picked;
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      (window as Window & { requestIdleCallback: (cb: IdleRequestCallback) => number }).requestIdleCallback(() =>
        resolve(),
      );
    } else setTimeout(resolve, 0);
  });
}

export function inferHeaderRowIndex(matrix: string[][]): number {
  if (matrix.length === 0) return 0;
  /** 取首行非全空且「像表头」：含中文或英文关键词 */
  for (let i = 0; i < Math.min(5, matrix.length); i++) {
    const row = matrix[i].map((c) => String(c || "").trim());
    if (rowIsBlank(row)) continue;
    const joined = row.join(" ");
    if (
      /收件|发货|地址|电话|重量|件|温|receiver|sender|weight|qty|temp/i.test(joined) ||
      row.some((c) => /^(重量|件数|备注|电话|姓名)/.test(c))
    ) {
      return i;
    }
  }
  return 0;
}
