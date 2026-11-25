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
npm test                 # 15 条校验/构建用例
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

