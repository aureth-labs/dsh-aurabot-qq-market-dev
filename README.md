# dsh-aurabot-qq-market-dev

AuraBot 插件市场的**索引与镜像构建**。

## 它做什么

1. 维护一份收录表 `registry.json`：每行是作者仓库里 `package.json` 的直链
2. 构建时逐个拉取、按 schema 校验、合成 `market.json`
3. 清单写错的条目跳过并写进 `dist/report.md`（当警告，不阻断流水线）

## 快速开始

```bash
npm install
npm run build            # tsc → lib/
npm run market           # registry.json → dist/market.json + dist/report.md
npm test                 # 12 条校验/构建用例
```

## 目录

```
docs/ARCHITECTURE.md   设计与决策记录（先看这个）
docs/HOST-CHANGES.md   主框架 dsh-aurabot-qq 的改造清单
schemas/               package.json / registry.json / market.json 的 JSON Schema
src/                   构建器（TypeScript）
registry.json          收录表
verified.json          已审核的 id 列表
```

## 当前状态

- [x] 索引构建器（拉取、校验、生成 market.json + 报告）
- [x] package.json / registry / market 的 schema
- [x] 主框架改造清单
- [x] 作者侧模板仓库（Actions + 两个示例插件）
- [x] 市场仓库自己的 GitHub Actions（定时重建 + 发布到 `market` 分支）
- [x] `docs/llms.txt`
- [ ] 文档站（VitePress）

