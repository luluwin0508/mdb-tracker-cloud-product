# MDB Tracker Cloud Product

多边开发银行（MDB）制裁/新闻/年报追踪看板：静态网页 + 分板块刷新 API + Netlify Blobs 持久化 + 浏览器插件手动同步。

## 目录

- `public/` — 线上静态网页（`app.js` 拉 `/api/latest` 渲染，分板块刷新按钮，显示最近内容日期和最后访问时间）
- `functions/api/` — 框架无关的核心逻辑（`handleRequest`、抓取、分板块、存储、同步解析）
- `netlify/functions/` — Netlify 入口：`api.mjs`（HTTP）+ 三个分板块定时刷新函数
- `netlify.toml` — 发布目录、Functions 目录配置；路由和定时任务在 v2 函数里声明
- `data/latest.json` — 本地开发的持久化文件 / 云端首屏的种子数据（打包内联进函数）
- `extension/` — Chrome 插件（点击图标手动同步当前页到云端）

## 本地运行

```bash
cd cloud-product
npm install
npm run dev      # http://127.0.0.1:5051
npm run check    # 冒烟测试 handleRequest
```

本地用 `data/latest.json` 读写（没有 Netlify Blobs 时自动回退）。

## 接口

- `GET  /api/latest` — 读取已保存数据 + 渲染用的 sections
- `POST /api/refresh` — 全量刷新（并行，受单源超时约束）
- `POST /api/refresh/<section>` — 分板块刷新，`<section>` ∈ `sanctions` / `news` / `annual`
- `POST /api/refresh-source/<key>` — 单个来源刷新，例如 `wb_sdo` / `afdb_appeals`
- `POST /api/sync` — 接收插件推来的页面 HTML，解析后并入快照
- `GET  /api/health` — 健康检查

`/api/latest` 返回的每个来源行包含两类时间：

- `latest_date`：当前已保存内容里最新条目的日期，来自被抓取页面或条目标题。
- `last_visited`：系统最后一次访问该来源网页的时间。这里的“访问”包括后台刷新，也包括你打开来源页后点击 Chrome 插件同步。

刷新和插件同步都采用“只合并新增条目”的写入策略：如果本次没有解析到新增内容，不会覆盖已有结果；但只要来源被访问过，就会更新对应来源的 `last_visited`。

## 部署到 Netlify

这个仓库（`mdb-tracker-cloud-product`）的根目录就是本项目，`netlify.toml` 已配好，直接连仓库即可。

1. Netlify → Add new site → Import from GitHub，选 `luluwin0508/mdb-tracker-cloud-product`
2. 构建设置保持默认（`netlify.toml` 已指定 `publish = public`、`functions = netlify/functions`，无需构建命令）
3. 部署完成后，能访问以下地址即闭环：
   ```
   https://你的域名/
   https://你的域名/api/health
   https://你的域名/api/latest
   ```

- **存储**：Netlify Blobs 在 Functions 运行时自动可用，无需建数据库。首次部署 Blobs 为空，页面先显示打包内联的 `data/latest.json` 种子；之后任意一次刷新/同步都会写入 Blobs。
- **CLI 方式**（可选）：`npm i -g netlify-cli && netlify deploy --prod`。

## 分板块刷新 & 定时任务

把"刷新"拆成三个板块，是为了绕开 Netlify 免费版函数 **10 秒同步执行上限**——每次只抓一个板块的源，请求更短、更容易在限额内返回。云端单源超时压到约 8.5 秒（`REQUEST_TIMEOUT_MS` 可调）。

`netlify.toml` 里配了三个错峰定时任务（cron 为 UTC）：

| 函数 | 板块 | 频率 | 说明 |
|------|------|------|------|
| `refresh-news` | 新闻动态 | 每 3 小时 | 全是快源（JSON/RSS），最稳 |
| `refresh-sanctions` | 制裁案例 | 每天 2 次 | 5 个 jina 慢源 |
| `refresh-annual` | 年度报告 | 每天 1 次 | 变动很少 |

页面顶部「全部刷新」会一次性刷三个板块；每个板块标题旁的「↻ 刷新本板块」只刷该板块；每个来源行里的「↻」按钮只刷新该单个来源。

刷新写入规则：

- 抓到新增条目：新增条目会合并到该来源已有结果前面。
- 抓到空结果、无新增或请求失败：保留该来源已有结果，不清空、不覆盖。
- 只要本次尝试访问了该来源，就会更新表格里的「最后访问」时间。

## Chrome 插件（手动同步）

云端机房 IP 容易被 MDB 反爬挡住，所以页面级抓取仍靠你浏览器里的插件补齐——且改成了**点击触发**：

1. `chrome://extensions` → 打开「开发者模式」→「加载已解压的扩展程序」→ 选 `cloud-product/extension`
2. 右键插件图标 →「选项」→ 填你的 Netlify 域名（例如 `https://mdb-xxxx.netlify.app`）保存
3. 打开任意 MDB 来源页 → **点击工具栏插件图标** → 当前页 HTML 被同步到云端，页面右下角弹出结果提示

插件同步同样不会用空结果覆盖旧数据。同步成功但没有新增条目时，会提示“已访问，无新增”，并只更新该来源的「最后访问」时间。

> 旧版插件（`mdb-tracker/extension`，页面加载即自动抓取本地 5001）已被本目录的 2.0 版取代，建议在扩展页移除旧的。

## 注意

- AFDB 等页面受 Cloudflare 影响，云端定时刷新可能偶发失败；失败时保留上次结果（页面显示"上次保存结果"），并可用插件手动补一次。
- 分板块的失败状态互不影响：只刷新某板块不会清掉其它板块已保存的数据或失败标记。
- 新上线的「最后访问」列不会回填历史访问记录；旧数据会显示 `—`，后续刷新或插件同步后才会写入时间。
