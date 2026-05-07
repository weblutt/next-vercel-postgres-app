import { NextResponse } from "next/server";
import { z } from "zod";
import { getPgClient } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  codes: z.array(z.string()).max(5000),
});

/**
 * POST /api/orders/check-duplicates — 给定外部编码列表，返回已在库存在的编码集合。
 */
export async function POST(request: Request) {
  let parsed: z.infer<typeof bodySchema>;
  try {
    const json = (await request.json()) as unknown;
    parsed = bodySchema.parse(json);
  } catch {
    return NextResponse.json({ ok: false, error: "请求体必须为 { codes: string[] }" }, { status: 400 });
  }

  const codes = Array.from(
    new Set(parsed.codes.map((c) => c.trim()).filter((c) => c.length > 0)),
  );
  if (codes.length === 0) {
    return NextResponse.json({ ok: true, existing: [] as string[] });
  }

  const client = await getPgClient();
  try {
    const sql = `
      SELECT external_code FROM shipping_orders
      WHERE external_code = ANY($1::text[])
    `;
    const res = await client.query<{ external_code: string }>(sql, [codes]);
    const existing = res.rows.map((r) => r.external_code).filter(Boolean);
    return NextResponse.json({ ok: true, existing });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await client.end();
  }
}
