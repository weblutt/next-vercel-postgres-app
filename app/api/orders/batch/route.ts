import { NextResponse } from "next/server";
import type { Client } from "pg";
import { z } from "zod";
import { getPgClient } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const orderSchema = z.object({
  batchId: z.string().uuid(),
  external_code: z.string().nullable(),
  sender_name: z.string().min(1),
  sender_phone: z.string().min(1),
  sender_address: z.string().min(1),
  receiver_name: z.string().min(1),
  receiver_phone: z.string().min(1),
  receiver_address: z.string().min(1),
  weight_kg: z.number().positive(),
  piece_count: z.number().int().positive(),
  temp_layer: z.enum(["常温", "冷藏", "冷冻"]),
  remark: z.string().nullable(),
});

const bodySchema = z.object({
  orders: z.array(orderSchema).min(1).max(250),
});

type BatchResult = {
  inserted: number;
  failed: number;
  failures: { index: number; reason: string }[];
};

async function insertWithSavepoints(
  client: Client,
  rows: z.infer<typeof orderSchema>[],
): Promise<BatchResult> {
  let inserted = 0;
  let failed = 0;
  const failures: { index: number; reason: string }[] = [];

  await client.query("BEGIN");
  try {
    for (let i = 0; i < rows.length; i++) {
      await client.query("SAVEPOINT sp_batch_row");
      const r = rows[i];
      try {
        const ec = r.external_code?.trim();
        const externalSql = ec && ec.length > 0 ? ec : null;
        await client.query(
          `
          INSERT INTO shipping_orders (
            batch_id, external_code, sender_name, sender_phone, sender_address,
            receiver_name, receiver_phone, receiver_address,
            weight_kg, piece_count, temp_layer, remark
          ) VALUES (
            $1::uuid, $2, $3, $4, $5,
            $6, $7, $8,
            $9::numeric, $10::integer, $11, $12
          );
        `,
          [
            r.batchId,
            externalSql,
            r.sender_name,
            r.sender_phone,
            r.sender_address,
            r.receiver_name,
            r.receiver_phone,
            r.receiver_address,
            r.weight_kg,
            r.piece_count,
            r.temp_layer,
            r.remark?.trim() || null,
          ],
        );
        await client.query("RELEASE SAVEPOINT sp_batch_row");
        inserted++;
      } catch (e) {
        await client.query("ROLLBACK TO SAVEPOINT sp_batch_row");
        await client.query("RELEASE SAVEPOINT sp_batch_row");
        failed++;
        const info = e instanceof Error ? e.message : String(e);
        failures.push({
          index: i,
          reason: info.includes("shipping_orders_external_code_unique")
            ? "外部编码与已有运单冲突"
            : info,
        });
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }

  return { inserted, failed, failures };
}

/**
 * POST /api/orders/batch — 单请求最多 250 条，返回本批成功/失败条数。
 */
export async function POST(request: Request) {
  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch (e) {
    const msg =
      e instanceof z.ZodError ? e.issues.map((x) => x.message).join("; ") : "JSON 无效";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  const client = await getPgClient();
  try {
    const result = await insertWithSavepoints(client, payload.orders);
    return NextResponse.json({
      ok: true,
      inserted: result.inserted,
      failed: result.failed,
      failures: result.failures,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await client.end();
  }
}
