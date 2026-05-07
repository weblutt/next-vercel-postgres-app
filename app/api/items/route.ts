import { NextResponse } from "next/server";
import type { DemoItem } from "@/lib/schema";
import { getPgClient } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/items — list all rows.
 */
export async function GET() {
  const client = await getPgClient();
  try {
    const result = await client.query(`
      SELECT id, title, created_at::text AS created_at
      FROM course_demo_items
      ORDER BY id ASC;
    `);
    return NextResponse.json({ ok: true, items: result.rows as DemoItem[] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message, items: [] },
      { status: 500 },
    );
  } finally {
    await client.end();
  }
}

type PostBody = { title?: string };

/**
 * POST /api/items — insert one row. Body: { "title": "..." }
 */
export async function POST(request: Request) {
  const client = await getPgClient();
  try {
    const body = (await request.json()) as PostBody;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json(
        { ok: false, error: "title 不能为空" },
        { status: 400 },
      );
    }

    const result = await client.query(
      `INSERT INTO course_demo_items (title)
       VALUES ($1)
       RETURNING id, title, created_at::text AS created_at;`,
      [title],
    );

    return NextResponse.json({
      ok: true,
      item: (result.rows[0] as DemoItem | undefined) ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    await client.end();
  }
}
