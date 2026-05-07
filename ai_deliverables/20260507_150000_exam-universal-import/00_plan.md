# 计划：万能导入 — 多模板自动导入下单系统

**任务标识**：`20260507_150000_exam-universal-import`  
**基线项目**：`next-vercel-postgres-app`（Next.js 14 App Router + `@vercel/postgres`/`pg` + 现有 `/api/setup`、`/api/items` 演示）  
**目标**：在原项目上扩展为完整「Excel 多模板导入 → 预览编辑校验 → 批量提交 → 历史分页」闭环，可本地与 Vercel 零配置部署。

---

## 1. 范围与约束

### 1.1 必须实现（对标评分项）

| 模块 | 要点 |
|------|------|
| 模板与导入 | `.xlsx`/`.xls`、点击+拖拽、≥5 种表头结构自动识别、别名智能映射、失败时手动列→字段映射、表头指纹记忆（localStorage + 可选服务端 `template_fingerprints` 表或仅存客户端，优先：**指纹 key = 规范化表头序列 hash**，value = 字段→列索引映射 JSON） |
| 大文件 | 1000+ 行：Web Worker 或分 chunk 解析（`xlsx` 库 `sheet_to_json` 分批）、requestIdleCallback/分段 setState 更新进度，避免主线程长时间阻塞 |
| 进度与异常 | 导入进度条（%、当前/总数）、提交进度条；中文错误：格式错误、空文件、无 Sheet、列全无法匹配等 |
| 预览 | 固定表头、横向滚动、列宽自适应；类 Excel：自研 `div+grid` 或轻量表格组件，单元格点击编辑、Tab/Enter 导航 |
| 校验 | 全量一次性错误列表：行号+字段+原因；必填缺失、手机、重量正数、件数正整数、温层枚举；Tooltip |
| 去重 | 批次内重复 + 与库历史 `external_code` 重复（API 预检或提交时返回重复行） |
| 行操作 | 删行、增空行；导出当前数据为 `.xlsx` |
| 提交 | 有错禁止提交 Modal；批量插入（事务分批，如每批 100）、成功/失败统计；按钮 loading、防连点 |
| 历史 | DB 分页、按外部编码/收件人姓名/提交时间筛选 |
| 工程 | TS 全量类型、组件拆分、`README`/`env` 示例、Vercel 构建通过 |

### 1.2 固定业务字段（库表与 TS 类型一一对应）

1. `external_code` — 外部编码，可空，去重用  
2. `sender_name` — 发件人姓名 *  
3. `sender_phone` — 发件人电话 *  
4. `sender_address` — 发件人地址 *  
5. `receiver_name` — 收件人姓名 *  
6. `receiver_phone` — 收件人电话 *  
7. `receiver_address` — 收件人地址 *  
8. `weight_kg` — 重量(kg)，正数 *  
9. `piece_count` — 件数，正整数 *  
10. `temp_layer` — 温层：`常温` \| `冷藏` \| `冷冻` *  
11. `remark` — 备注，可空  

\* 表示业务必填（外部编码、备注可不填）。

### 1.3 不修改的路径（遵守 AGENTS）

- `agents/`、`skills/`、根模板文档、`AGENTS.md`  
- 不覆盖已有 `ai_deliverables` 子目录内容（本任务仅新增本目录）

---

## 2. 技术方案

### 2.1 依赖新增

- `xlsx`（SheetJS）解析与写出 Excel  
- 可选 `zod` 做服务端入参校验（或手写）  
- UI：保持 CSS 变量 + 少量模块化 CSS（无强制 UI 库，避免体积过大）；Toast 自研或极简 portal

### 2.2 数据库（Vercel Postgres / Neon）

- 新表 `shipping_orders`：上述字段 + `id` SERIAL + `created_at` + `batch_id`（UUID，一次提交一批）  
- 唯一索引：`(external_code)` 上 **部分唯一索引** `WHERE external_code IS NOT NULL AND external_code <> ''`，避免多条空外部编码冲突  
- `/api/setup` 扩展：创建新表与索引（保留或替换原 demo 表由产品决定：**建议保留 demo 表不动，新增运单表**，首页改为新业务）

### 2.3 API 路由（拟）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/setup` | 增加 `shipping_orders` 建表 DDL（幂等） |
| GET | `/api/orders` | 分页 `page,pageSize`，筛选 `externalCode,receiverName,from,to` |
| POST | `/api/orders/check-duplicates` | Body: 外部编码列表，返回库中已存在编码集合 |
| POST | `/api/orders/batch` | Body: 订单数组，分批 INSERT，返回 successCount/failCount/errors |

### 2.4 客户端架构

- `lib/types/order.ts` — `OrderRow`, `SystemFieldKey`, `ValidationError` 等  
- `lib/excel/aliases.ts` — 列名别名 → `SystemFieldKey` 打分匹配  
- `lib/excel/fingerprint.ts` — 表头指纹与存取  
- `lib/excel/parseWorker.ts` 或 `hooks/useExcelImport.ts` — 进度回调  
- `components/import/UploadZone.tsx`  
- `components/import/MappingPanel.tsx`  
- `components/preview/OrderGrid.tsx`  
- `components/history/OrderHistory.tsx`  
- `app/page.tsx` — 步骤条：导入 → 预览 → 提交结果；或 Tab 切换「导入/历史」

### 2.5 至少 5 种模板策略

内置 5 组「期望表头变体」用于自动匹配测试；真实文件以客户 zip 为准，逻辑为：**模糊匹配得分最高** + 缺失列允许手动补映射。

### 2.6 环境变量

- 沿用 `POSTGRES_URL`（与现有 `pg` 连接一致）  
- 新增 `.env.local.example` 注释说明 Vercel Postgres / Neon 获取方式

---

## 3. 文件改动清单（待确认后执行）

- `package.json` — 依赖  
- `app/layout.tsx` — 全局样式微调（可选）  
- `app/page.tsx` — 替换为业务主流程  
- `app/api/setup/route.ts` — 新表 DDL  
- 新增 `app/api/orders/**`、`lib/**`、`components/**`  
- `README.md` — 安装、本地运行、Git、Vercel 步骤（若仓库已有 README 则在其上增补一节）  
- `.env.local.example` — 模板（若禁止写点文件则仅 README 说明；通常可新增 example）

**拟移除或废弃**：原首页「course_demo_items」交互可改为侧边链接或删除（计划：**默认移除 demo UI，setup 仍创建 demo 表以免破坏旧文档，主界面只做运单**）。

---

## 4. 风险与缓解

| 风险 | 缓解 |
|------|------|
| `xlsx` 大文件主线程卡死 | Worker + 分块 `sheet_to_json` + 进度 |
| 内存 | 不一次性保留原始 ArrayBuffer；解析完仅保留行对象数组 |
| 中文列名编码 | 使用 SheetJS 按二进制读，避免错误编码假设 |

---

## 5. 验证方式

1. `npm ci` / `npm install` → `npm run build` 无报错  
2. 配置 `POSTGRES_URL` → `POST /api/setup` → 导入提供的 zip 内多种 xlsx → 自动/手动映射 → 预览标红 → 修正后提交 → 历史列表筛选分页  
3. 人为构造 1000+ 行 xlsx 测进度与卡顿  

---

## 6. 执行顺序（获批准后）

1. 依赖与类型、别名与指纹工具  
2. DB schema + setup + orders API  
3. 上传与解析 + 映射 UI + 记忆  
4. 预览网格与校验聚合  
5. 提交与历史页  
6. README / env 示例与自测 build  

---

**等待确认**：请回复 **「允许继续执行」** 后，再开始修改上述业务代码与配置。
