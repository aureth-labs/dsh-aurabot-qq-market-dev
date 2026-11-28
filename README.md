# dsh-aurabot-qq-market-dev

AuraBot 插件市场的**索引与镜像构建**。

## 它做什么

1. 维护一份收录表 `registry.jsonl`：一行一个作者仓库里 `package.json` 的 GitHub 链接
2. 构建时逐个拉取、按 schema 校验、合成 `market.json`
3. 清单写错的条目跳过并写进 `dist/report.md`（当警告，不阻断流水线）

## 快速开始

```bash
npm install
npm run build            # tsc → lib/
npm run market           # registry.jsonl → dist/market.json + dist/report.md
npm test                 # 16 条校验/构建用例
```

## 插件市场镜像源

宿主读的就是这份索引，由本仓库的 Actions 构建（推 main 时重建，另外每天 03:00 UTC 兜一次）。
同一份内容发三个出口，随便挑一个用：

| 出口 | 地址 |
| --- | --- |
| GitHub Pages | `https://aureth-labs.github.io/dsh-aurabot-qq-market-dev/market.json` |
| Release（固定 tag） | `https://github.com/aureth-labs/dsh-aurabot-qq-market-dev/releases/download/market-latest/market.json` |
| `market` 分支 | `https://raw.githubusercontent.com/aureth-labs/dsh-aurabot-qq-market-dev/market/market.json` |

三个出口都固定指向「最新一版」，不会各自漂移：

- Release 只用 `market-latest` 这一个 tag，每次 `--clobber` 覆盖附件，不会越堆越多
- `market` 分支旁边还有 `report.md`（收录了什么、跳过了什么、为什么）和 `index.html`（人看的列表页）
- Pages 根路径就是 `index.html`，直接用浏览器打开就能看到当前收录的全部插件

`market.json` 就是给 DeepSeek Harness 装 AuraBot 客户端插件市场用的那份大 JSON：
每个插件一条，带 `artifact.url`（作者仓库里的 zip）、`artifact.sha256`、`category`、`capabilities`，
宿主照它展示、照它下载安装。

文档不在这里，在 [dsh-aurabot-qq-docs](https://github.com/aureth-labs/dsh-aurabot-qq-docs)。

## 目录

```
schemas/               package.json / market.json 的 JSON Schema
src/                   构建器（TypeScript），landing.ts 生成 Pages 的列表页
registry.jsonl         收录表（一行一个链接，`#` 是注释）
verified.json          已审核的 id 列表
```

## 当前状态

- [x] 索引构建器（拉取、校验、生成 market.json + 报告）
- [x] package.json / market 的 schema
- [x] 主框架改造清单
- [x] 作者侧模板仓库（Actions + 两个示例插件）
- [x] 市场仓库自己的 GitHub Actions：构建索引后同时发 Pages、固定 tag 的 Release、`market` 分支
- [x] Pages 插件市场前端页（`index.html`）：卡片全部服务端渲染，JS 只加翻页、每行列数、右下角操作菜单；页内还带一份构建报告（跳过/改名的清单）


## 验收本地发行包

在社区仓库运行 `npm run dry-run`。该命令生成 ZIP 和预览收录表，可通过 AURABOT_PREVIEW_OWNER 指定本地作者命名空间。在市场仓库运行以下命令。

```sh
npm run build
node lib/index.js build --registry ../dsh-aurabot-qq-mods/dist/registry.jsonl --artifact-dir ../dsh-aurabot-qq-mods/dist --out dist/preview/market.json --report dist/preview/report.md --strict
```

构建器按清单核对 ZIP 的实际大小和 SHA-256，将文件写入索引旁的 artifacts/。宿主优先从同一镜像读取 ZIP，镜像不可达时可访问原始发行地址。预览清单使用本地工件。正式 CI 从作者的 Release 下载。

## 本机开发市场

在与本仓库同级的插件发布仓库运行 `npm run dry-run`，然后在本仓库运行 `npm run market:local`。构建读取收录表，只使用本机对应仓库生成的清单与 ZIP。每份包都会校验大小、SHA-256、包名、版本和 API，通过后才替换索引。

在控制台的「模块市场 → 模块市场地址」选择「本机开发市场」并保存。框架和构建命令读取同一 `AURABOT_DATA_DIR`（默认位于 DSH 数据目录）。索引和安装包存放在此目录同级的 `<目录名>.market-local`，重置用户数据后可重新选择本机市场。发布仓库位于其他位置时，可用 `npm run market:local -- <包含各仓库的目录>`。新安装的框架仍默认使用 GitHub 官方源。
