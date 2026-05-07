# Next.js 14 + Vercel Postgres 课程演示

全栈示例：App Router 首页调用 Serverless API，使用 `@vercel/postgres` 完成建表、插入与查询。

## 功能说明

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/setup` | POST | 幂等：创建 `course_demo_items` 表；若为空则插入 3 条示例数据 |
| `/api/items` | GET | 查询全部记录 |
| `/api/items` | POST | 插入一条，`JSON` 体：`{ "title": "字符串" }` |

## 本地开发

### 1. 安装依赖

```bash
cd next-vercel-postgres-app
npm install
```

### 2. 环境变量

复制模板并填写（值来自 Vercel 控制台：项目 → Storage → Postgres → Connect → `.env.local`）：

```bash
copy .env.local.example .env.local
```

### 3. 启动

```bash
npm run dev
```

浏览器打开 <http://localhost:3000>，先点击「初始化数据库」，再查看列表或新增记录。

### 4. 代码检查与构建

```bash
npm run lint
npm run build
```

## 部署到 Vercel

1. 在 Vercel 创建项目并关联本目录（或整个仓库根目录若仅含本应用）。
2. 在 Vercel 创建 **Postgres** 数据库，将自动注入环境变量到项目。
3. 部署完成后访问线上地址，执行一次「初始化数据库」即可。

官方文档：<https://vercel.com/docs/storage/vercel-postgres>

## Git 与 GitHub（示例命令）

在 `next-vercel-postgres-app` 目录内初始化并推送（将 `YOUR_USER` 与 `YOUR_REPO` 换成你的）：

```bash
cd next-vercel-postgres-app
git init
git add .
git commit -m "feat: Next.js 14 App Router with Vercel Postgres demo"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

若仓库已存在且仅添加子目录，可在仓库根目录 `git add next-vercel-postgres-app` 后提交推送。

## 技术栈

- Next.js 14（App Router）
- TypeScript
- `@vercel/postgres`
- ESLint（`next/core-web-vitals`）
