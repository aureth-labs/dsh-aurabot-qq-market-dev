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

宿主读的就是这份索引，由本仓库的 Actions 自动构建，每天重建一次：

```
https://github.com/aureth-labs/dsh-aurabot-qq-market-dev/blob/market/market.json
```

`market` 分支同目录还有 `report.md`，记录这次收录了哪些包、跳过了哪些、为什么跳过。

## 文档

文档站在 `docs` 分支上，用 VitePress 构建、Actions 自动发布：

- 站点：https://aureth-labs.github.io/dsh-aurabot-qq-market-dev/
- 给 AI 看的规范：https://aureth-labs.github.io/dsh-aurabot-qq-market-dev/llms.txt
- 架构与决策：https://aureth-labs.github.io/dsh-aurabot-qq-market-dev/ARCHITECTURE
- 主框架改造清单：https://aureth-labs.github.io/dsh-aurabot-qq-market-dev/HOST-CHANGES
- 源码：`docs` 分支下的 `docs/` 目录

## 目录

```
schemas/               package.json / market.json 的 JSON Schema
src/                   构建器（TypeScript）
registry.jsonl         收录表（一行一个链接，`#` 是注释）
verified.json          已审核的 id 列表
```

## 当前状态

- [x] 索引构建器（拉取、校验、生成 market.json + 报告）
- [x] package.json / market 的 schema
- [x] 主框架改造清单
- [x] 作者侧模板仓库（Actions + 两个示例插件）
- [x] 市场仓库自己的 GitHub Actions（定时重建 + 发布到 `market` 分支）
- [x] `llms.txt`（随文档站发布在 `/llms.txt`）
- [x] 文档站（VitePress，`docs` 分支）

