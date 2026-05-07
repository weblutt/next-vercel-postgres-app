import { NextResponse } from "next/server";
import { getPgClient } from "@/lib/db";
import type { ShippingOrderDbRow } from "@/lib/types/order";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/orders?page=1&pageSize=20&externalCode=&receiverName=&from=&to=
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));
  const externalCode = (searchParams.get("externalCode") ?? "").trim();
  const receiverName = (searchParams.get("receiverName") ?? "").trim();
  const from = (searchParams.get("from") ?? "").trim();
  const to = (searchParams.get("to") ?? "").trim();

  const offset = (page - 1) * pageSize;
  const conds: string[] = ["1=1"];
  const params: unknown[] = [];
  let pi = 1;

  if (externalCode) {
    conds.push(`external_code ILIKE $${pi}`);
    params.push(`%${externalCode}%`);
    pi++;
  }
  if (receiverName) {
    conds.push(`receiver_name ILIKE $${pi}`);
    params.push(`%${receiverName}%`);
    pi++;
  }
  if (from) {
    conds.push(`created_at >= $${pi}::timestamptz`);
    params.push(new Date(`${from}T00:00:00.000Z`).toISOString());
    pi++;
  }
  if (to) {
    conds.push(`created_at <= $${pi}::timestamptz`);
    params.push(new Date(`${to}T23:59:59.999Z`).toISOString());
    pi++;
  }

  const where = conds.join(" AND ");

  const client = await getPgClient();
  try {
    const countSql = `
      SELECT COUNT(*)::bigint AS total
      FROM shipping_orders
      WHERE ${where};
    `;
    const countRes = await client.query<{ total: string }>(countSql, params);
    const total = BigInt(countRes.rows[0]?.total ?? "0");

    params.push(pageSize);
    params.push(offset);
    const listSql = `
      SELECT id, batch_id::text AS batch_id, external_code, sender_name, sender_phone,
        sender_address, receiver_name, receiver_phone, receiver_address,
        weight_kg::text AS weight_kg, piece_count, temp_layer, remark,
        created_at::text AS created_at
      FROM shipping_orders
      WHERE ${where}
      ORDER BY id DESC
      LIMIT $${pi} OFFSET $${pi + 1};
    `;
    const rows = await client.query<ShippingOrderDbRow>(listSql, params);
    const list = rows.rows;

    return NextResponse.json({
      ok: true,
      page,
      pageSize,
      total: total.toString(),
      items: list,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message, items: [], total: "0", page, pageSize },
      { status: 500 },
    );
  } finally {
    await client.end();
  }
}
