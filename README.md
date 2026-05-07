# 万能导入 — 多模板自动导入下单系统（Next.js + PostgreSQL）

Next.js **App Router + TypeScript** 全栈示例：上传 **`.xlsx` / `.xls`**，在多列名/列序模板下自动识别并映射字段，预览编辑校验后 **批量入库**（Vercel/Neon Postgres），并提供 **历史运单分页筛选**。

> 考试用测试模板包（网盘/文件站）：[http://106.12.10.129:10010/uploads/excel.zip](http://106.12.10.129:10010/uploads/excel.zip)

## 功能概览

| 模块 | 说明 |
|------|------|
| 上传 | 点击 / 拖拽；`.xlsx`、`.xls`；中文错误提示（空文件、无 Sheet、解析失败等） |
| 自动映射 | 基于列头别名打分的多字段贪心匹配；支持列缺失时手工下拉映射 |
| 模板记忆 | 表头指纹 → `localStorage` 持久化映射，下次同结构自动复用 |
| 大表 | 解析阶段分块 `yield` + 虚拟列表（`react-window`）渲染，适合 **1000+** 行 |
| 预览 | 固定表头、横向滚动、点击编辑；**Tab / Enter** 切换单元格；错误集中列表 + 单元格 Tooltip |
| 校验 | 必填、电话、重量正数、件数正整数、温层枚举；外部编码 **本批重复 + 历史库重复** 标红 |
| 提交 | 有错禁止提交（弹窗）；分段进度条；防连点；返回成功/失败统计 |
| 历史 | `GET /api/orders` 分页 + 外部编码/收件人/日期区间筛选 |

## API 路由

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/setup` | POST | 幂等建表：`course_demo_items`（课程示例）+ `shipping_orders`（运单） |
| `/api/items` | GET / POST | 课程 demo 列表/插入（保留） |
| `/api/orders` | GET | 历史运单分页查询 |
| `/api/orders/check-duplicates` | POST | Body `{ "codes": string[] }` → 返回已存在的外部编码 |
| `/api/orders/batch` | POST | Body `{ "orders": ShippingOrder[] }`（单请求 ≤250 条）批量插入 |

## 本地开发

### 1. 安装依赖

```bash
cd next-vercel-postgres-app
npm install
```

### 2. 环境变量

复制模板并按 Vercel Postgres / Neon 控制台填写连接串：

```powershell
copy .env.local.example .env.local
```

至少需要：

- **`POSTGRES_URL`**：`postgres://…`（与现有 `pg` 客户端写法一致）

### 3. 启动

```bash
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

1. 点击 **初始化数据库（建表）**（或直接 `POST /api/setup` 一次）。
2. 导入 Excel → 校对/调整映射 → 预览修正 → **提交下单**。
3. 在 **历史运单** 中查看分页与筛选结果。

### 4. 检查与构建

```bash
npm run lint
npm run build
```

## 部署到 Vercel

1. 将本目录作为 Vercel 项目根目录（或 monorepo 中指向该子目录）。
2. 在 Vercel 创建 **Postgres**（或绑定 Neon），确保项目环境变量中注入 `POSTGRES_URL`（及控制台提供的相关变量均可保留在 `.env.local.example` 中作参考）。
3. `git push` 触发部署，构建命令默认 `npm run build`，输出目录 `.next`。
4. 打开线上地址，执行一次 **初始化数据库（建表）**，即可开始使用。

官方文档：[Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)

## Git 初始化与推送（示例）

```bash
cd next-vercel-postgres-app
git init
git add .
git commit -m "feat: universal excel import shipping orders with postgres"
git branch -M main
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

若仓库已存在且本应用为子目录，在仓库根目录执行 `git add next-vercel-postgres-app` 后提交即可。

## 技术栈

- Next.js 14（App Router）
- TypeScript
- `pg`（Node runtime Serverless Route）
- `xlsx`（SheetJS 社区版：解析与导出）
- `zod`（API 入参校验）
- `react-window`（大数据表格虚拟滚动）

## 业务字段（与题目一致）

固定 11 项：`外部编码`（选填）、`发/收件人姓名/电话/地址`、`重量(kg)`、`件数`、`温层`（常温/冷藏/冷冻）、`备注`（选填）。详见 `lib/types/order.ts` 与页面校验逻辑。
