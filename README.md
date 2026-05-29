# MDB Tracker Cloud Product

正式产品版：静态网页 + 刷新 API + 持久化数据。

## 目录

- `public/`：线上网页静态资源。
- `functions/api/`：读取和刷新接口。
- `data/latest.json`：本地开发时的持久化数据；部署到 CloudBase 后优先使用云数据库。

## 本地运行

```bash
cd /Users/slsong/Desktop/codex工作区/mdb-tracker/cloud-product
npm run dev
```

访问：

```text
http://127.0.0.1:5051
```

接口：

- `GET /api/latest`：读取已保存数据。
- `POST /api/refresh`：立即抓取并保存。
- `GET /api/health`：健康检查。

## CloudBase 控制台 Git 仓库部署

如果使用腾讯云控制台里的 Git 仓库部署，建议把本目录 `cloud-product` 作为仓库根目录推到 GitHub。

控制台里选择：

- 部署类型：Git 个人仓库部署
- 框架/类型：CloudBase Framework / 静态网站 + 云函数
- 根目录：如果仓库根目录就是本项目，填 `/`；如果把整个 `mdb-tracker` 推上去，填 `cloud-product`
- 静态资源目录：`public`
- 云函数目录：`functions`
- 环境 ID：`mdb-board-d8g1opk5y85ae371e`

部署后，需要确认 `/api/*` 已转发到 `api` 云函数。能访问以下地址才算闭环：

```text
https://你的域名/
https://你的域名/api/health
https://你的域名/api/latest
```

## CloudBase CLI 部署方向

1. 创建腾讯云 CloudBase 环境。
2. 把 `cloudbaserc.json` 里的 `{{CLOUDBASE_ENV_ID}}` 改成环境 ID。
3. 开通云数据库，集合名使用 `mdb_tracker_snapshots`。
4. 在 CloudBase 控制台或 CLI 部署：

```bash
tcb framework deploy
```

5. 在静态托管里配置 `/api/*` 转发到 `api` 云函数。

## 钉钉入口

部署成功后，把 CloudBase 静态网站 URL 配成钉钉 H5 微应用入口即可。访问控制可以先用 CloudBase/腾讯云侧能力做，后续再接钉钉免登。

## 注意

AFDB 部分页受 Cloudflare 影响，云端刷新可能偶发失败。失败时旧数据仍保留在 `latest` 快照里，页面不会丢失已保存结果。
