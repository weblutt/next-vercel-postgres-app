import { NextResponse } from "next/server";
import { getPgClient } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/setup
 * 幂等：创建课程 demo 表 + 运单业务表；demo 表为空时插入示例数据。
 */
export async function POST() {
  const client = await getPgClient();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS course_demo_items (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const countResult = await client.query(`
      SELECT COUNT(*)::int AS c FROM course_demo_items;
    `);
    const rowCount = countResult.rows[0]?.c ?? 0;

    if (rowCount === 0) {
      await client.query(`
        INSERT INTO course_demo_items (title) VALUES
          ('示例数据：人工智能导论'),
          ('示例数据：数据库原理'),
          ('示例数据：Web 全栈开发');
      `);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS shipping_orders (
        id SERIAL PRIMARY KEY,
        batch_id UUID NOT NULL,
        external_code TEXT,
        sender_name TEXT NOT NULL,
        sender_phone TEXT NOT NULL,
        sender_address TEXT NOT NULL,
        receiver_name TEXT NOT NULL,
        receiver_phone TEXT NOT NULL,
        receiver_address TEXT NOT NULL,
        weight_kg NUMERIC(14, 4) NOT NULL,
        piece_count INTEGER NOT NULL,
        temp_layer TEXT NOT NULL,
        remark TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS shipping_orders_external_code_unique
      ON shipping_orders (external_code)
      WHERE external_code IS NOT NULL AND btrim(external_code) <> '';
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS shipping_orders_created_at_idx
      ON shipping_orders (created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS shipping_orders_receiver_name_idx
      ON shipping_orders (receiver_name);
    `);

    return NextResponse.json({
      ok: true,
      message:
        rowCount === 0
          ? "数据库已初始化：含课程示例表与运单表；已插入课程示例数据。"
          : "数据库已就绪：含课程示例表与运单表（未重复插入课程示例数据）。",
      hadDemoData: rowCount > 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await client.end();
  }
}
