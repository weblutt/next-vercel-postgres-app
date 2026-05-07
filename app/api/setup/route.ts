import { sql } from "@vercel/postgres";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/setup
 * Idempotent: creates table and inserts seed rows if table is empty.
 */
export async function POST() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS course_demo_items (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `;

    const countRows = await sql`
      SELECT COUNT(*)::int AS c FROM course_demo_items;
    `;
    const rowCount = countRows.rows[0]?.c ?? 0;

    if (rowCount === 0) {
      await sql`
        INSERT INTO course_demo_items (title) VALUES
          ('示例数据：人工智能导论'),
          ('示例数据：数据库原理'),
          ('示例数据：Web 全栈开发');
      `;
    }

    return NextResponse.json({
      ok: true,
      message:
        rowCount === 0
          ? "表已创建并已插入初始数据。"
          : "表已就绪（已有数据，未重复插入）。",
      hadData: rowCount > 0
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
