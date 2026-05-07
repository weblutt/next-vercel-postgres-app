import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "万能导入 · 多模板运单批量下单",
  description: "Next.js App Router + TypeScript · Excel 多模板导入 · PostgreSQL · Vercel 部署演示",
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
