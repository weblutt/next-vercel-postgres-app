import { Client } from "pg";

/**
 * Parse POSTGRES_URL (postgres://...) into node-pg Client options.
 * Mirrors existing API routes in this project (Vercel Postgres / Neon).
 */
export async function getPgClient(): Promise<Client> {
  const raw = process.env.POSTGRES_URL;
  if (!raw) {
    throw new Error("缺少环境变量 POSTGRES_URL，请在 .env.local 中配置数据库连接。");
  }
  const url = new URL(raw.replace(/^postgres:\/\//, "https://"));
  const client = new Client({
    host: url.hostname,
    port: parseInt(url.port, 10) || 5432,
    database: url.pathname.slice(1) || "postgres",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}
