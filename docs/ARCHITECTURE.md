# 架构与决策

## 目标

把「代码托管」「构建」「索引」拆开，让插件作者不必往官方仓库提 PR 改代码：

- 作者：自己的 GitHub 仓库（单模块或多模块都行），自带 Actions 构建
- 市场：只维护一份 `package.json` 地址清单，拉取、校验、生成 `market.json`
- 宿主：读 `market.json` 安装，不再关心代码从哪来

非目标（本仓库不做）：代码托管、运行时依赖管理、宿主加载逻辑。

## 数据流

```
作者仓库 push
   └─ Actions：npm ci → build → 打 zip → 发 Release
        └─ 回写 package.json.aurabot.artifact{url,sha256,size}（bot commit，[skip ci]）

市场仓库
   registry.json（package.json 直链清单）
   └─ npm run market：逐个拉取 → 校验 → market.json + report.md
        └─ 发布到 Pages / Release / CDN

宿主
   market.json → 选版本 → 下载 zip → 校验 sha256 → 解压 → 读 package.json.aurabot → 加载 main
```

## 决策记录

| # | 决策 | 理由 |
| --- | --- | --- |
| D1 | 代码与索引分离，市场不托管源码 | 避免「改一行也要 PR 到官方仓库」 |
| D2 | 作者只写包名；市场用来源仓库的 owner 拼成 `owner/name` 当 id | 天然唯一、和 GitHub 身份对齐；作者不用关心自己叫什么，`@` 是 npm 的约定，我们不发布到 npm |
| D3 | 构建在作者仓库做，产物发 Release | 市场不执行作者代码，供应链风险留在作者侧 |
| D4 | `package.json` 单一真相，自定义字段放 `aurabot` 段 | npm 工具链兼容；避免和编辑器内置 schema 打架 |
| D5 | 入口用 `main`，产物在 `lib/` | 不再依赖 `index.mjs` 约定 |
| D6 | 索引由市场全量重建；清单写错的条目跳过 | 没有「增量状态」要维护，天然自愈；一个作者写错不该卡住整条流水线 |
| D7 | 收录靠 `registry.json` 里的 package.json 直链 | 一个请求拿全一个仓库的所有模块信息 |
| D8 | 评分：star + 最近提交，口径见下 | 纯 star 对多模块仓库不公平 |
| D9 | 安全：自动收录一律 `verified: false`，不做背书 | 开放优先；出问题由作者自己管理 Release 与 commit 记录，索引不承担撤回职责 |
| D10 | 前端源码也写 TS：`client/*.ts` → `dist/`，后台 `src/*.ts` → `lib/` | 一个仓库里前端后端同语言，面板不用手写 JS |

## package.json 约定

```json
{
  "name": "playmusic",
  "version": "1.2.0",
  "type": "module",
  "main": "lib/index.js",
  "aurabot": {
    "displayName": "显示名",
    "panel": "./dist/panel.js",
    "category": "social",
    "capabilities": ["network"],
    "minPluginVersion": "1.2.0",
    "api": 1,
    "requires": [],
    "artifact": { "url": "https://…zip", "sha256": "…", "size": 12345 }
  }
}
```

完整约束见 `schemas/package.schema.json`。

`artifact` 由作者仓库的 Actions 回写；市场只读不写。`panel` 缺省为 `./dist/panel.js`。

`name` 只写包名本身，市场从收录地址里的 GitHub 路径取 owner，拼成 `owner/name`；作者不需要也没必要自己加前缀。

## 依赖策略

- 默认：构建期打包进 `lib/`（esbuild `bundle: true`），运行时不装依赖
- 例外：wasm / 原生模块打不进单文件的（`meme` 那类），允许「首次运行下载固定版本运行时」，但必须在 README 写明下载地址和 sha256
- 明确不支持：运行时装 `node_modules`

## 市场构建

```bash
npm run market          # registry.json → dist/market.json + dist/report.md
```

- 单条失败只记进报告并跳过，不影响其它条目、也不让流水线变红（`--strict` 才按失败处理）
- `verified.json` 里列出的 id 标 `verified: true`
- 下架：把 `registry.json` 里的条目删掉，下次构建自然消失
- 作者撤回某个版本：自己删对应 Release、改 `package.json` 的版本号；市场每次全量重建，下一次构建就看不到它了

## 评分口径（草案）

- 主展示：仓库 star
- 排序参考：`log10(stars) / sqrt(该仓库插件数)`，对多模块仓库温和惩罚
- 辅助：最近一次提交距今时间
- 以后有遥测再加下载量

## 安全边界

1. 市场不执行作者代码（构建在作者仓库）
2. 市场只做静态校验：字段、URL 形态、sha256 格式
3. 宿主负责下载后校验 sha256 与大小
4. 自动收录一律标 `verified: false`，安装时提示来源
5. 不做撤回/下架通知：作者管理自己的 Release 与 commit，索引只反映「现在能拉到什么」

