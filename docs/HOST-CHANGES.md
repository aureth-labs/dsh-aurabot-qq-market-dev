# 主框架改造清单（dsh-aurabot-qq）

> 这份清单给**主插件仓库**（`aureth-labs/dsh-aurabot-qq`）用。
> 市场这边只产出 `market.json` 和规范；下面每一条都要宿主动手改。
> 原则：新格式（`package.json` + `lib/`）和老格式（`module.json` + `index.mjs`）**并存**，老模块不改也能继续装。

## 0. 一句话

宿主现在认三样：`module.json`、入口文件名 `index.mjs` / `index.js`、`index.json` + `assetsBase` 拼出来的 zip 地址。
新市场换掉了这三样：`package.json.aurabot`、`package.json.main`、`market.json` 里直接的 `artifact.url + sha256`。

## 1. 元数据来源

### 1.1 先读 package.json，没有就回落 module.json

| | 现在 | 目标 |
| --- | --- | --- |
| 清单文件 | `modules/<id>/module.json` | `modules/<id>/package.json` 的 `aurabot` 段 |
| 缺失时 | 模块无效 | 回落读 `module.json`（老模块） |

- [ ] 统一一个 `readManifest(dir)`：优先 `package.json.aurabot`，否则 `module.json`
- [ ] 面板、市场页、安装器都走这一个函数，不要再各自读文件
- [ ] 新格式缺 `aurabot.artifact` 时给出明确报错，不要静默跳过

**验收**：只放 `package.json` 的模块，列表 / 详情 / 能力标记都正常。

### 1.2 字段映射

| module.json | package.json | 说明 |
| --- | --- | --- |
| `id` | `name` 的 `name` 部分 | `@owner/name` → `name` |
| — | `name` 的 `owner` 部分 | 新字段，展示来源 |
| `name` | `aurabot.displayName`（回落包名） | |
| `version` | `version` | |
| `description` | `description` | |
| `category` | `aurabot.category` | 单选 |
| `tags` | `aurabot.tags` | ≤ 5 个 |
| `platforms` | `aurabot.platforms` | 缺省 `["qq"]` |
| `capabilities` | `aurabot.capabilities` | |
| `minPluginVersion` | `aurabot.minPluginVersion` | |
| `api` | `aurabot.api` | |
| `requires` | `aurabot.requires` | |
| `panel` | **待定** | 见 §8 |
| `build.out` | 不再需要 | 构建在作者仓库完成 |

## 2. 入口解析

| | 现在 | 目标 |
| --- | --- | --- |
| 入口 | 目录下的 `index.mjs` / `index.js` | `package.json` 的 `main`（默认 `lib/index.js`） |
| 模块类型 | 不检查 | 只支持 ESM（`"type": "module"`），CJS 明确拒绝并提示 |

- [ ] `entryOf(dir)` 改成读 `main`，找不到再回落 `index.mjs` / `index.js`
- [ ] 加载失败时的报错带上「读的是哪个文件」，别只说「模块加载失败」
- [ ] 打包/冒烟测试（`scripts/lib.mjs` 的 `ENTRY`）同步改，否则 CI 会按老规则找不到入口（**这条在市场之外的仓库，但会直接卡住新插件**）

**验收**：入口叫 `main.js`、`dist/entry.js` 都能加载；没有 `index.mjs` 也能跑。

## 3. id：平铺 → `owner/name`

| | 现在 | 目标 |
| --- | --- | --- |
| 对外 id | `playmusic`（= 文件夹名） | `shangxueink/playmusic` |
| 同名不同作者 | 冲突 | 共存 |
| 安装目录 | `modules/<id>/` | `modules/<owner>__<name>/`（路径里不能出现 `/`） |

- [ ] id 一律按 `owner/name` 解析，来源是 `package.json.name`
- [ ] 配置文件里的键、面板路由、日志里的模块名都要跟着用 qualified id，否则重名会串
- [ ] `requires` 解析：先查内置（无前缀），再查 `owner/name`
- [ ] 老模块保持平铺 id 不变（它们没有 `/`，天然不冲突）

**验收**：`@a/music` 和 `@b/music` 能同时安装、同时启用、互不覆盖配置。

## 4. 安装协议

| | 现在 | 目标 |
| --- | --- | --- |
| 索引 | `registry` 分支的 `index.json` | 任一 `market.json`（可多个源） |
| 地址 | `assetsBase + tag + 文件名` 拼出来 | 每条自带 `artifact.url` |
| 校验 | 无 | `sha256` + `size`，不一致直接拒绝 |

- [ ] 下载后先算 sha256、比对大小，不一致就丢弃且保留旧版本
- [ ] 解压时拒绝绝对路径和 `..`（防 zip slip）
- [ ] 安装失败要能回滚到上一版，不能留下半个目录

**验收**：手工改 zip 一个字节 → 安装失败，提示「校验不通过」，旧版本还在。

## 5. 版本与更新

- [ ] 版本比较用 semver（`1.10.0 > 1.9.0`），不要字符串比
- [ ] `minPluginVersion` 不满足时，明确提示「需要插件 ≥ x.y.z」而不是装完报错
- [ ] 更新检查只读 `market.json`，不直接访问作者仓库
- [ ] 撤回（`revoked.json`）：已装用户强提示，未装用户不可装
- [ ] 市场里消失的插件：保留已装副本，只是不再提示更新（**不等于卸载**）

## 6. 多源

- [ ] 配置项 `market.sources: string[]`，官方源放第一个
- [ ] 合并规则：同 id 先到先得，冲突时在日志里写明哪两个源打架
- [ ] 每个源单独容错：一个源 502 不该让整个市场空掉

**验收**：配两个源，两边插件都能搜到；断掉一个源，另一个照常。

## 7. 来源与审核标记

- [ ] 详情页显示 `owner/repo`（来自 `artifact.url` 或 `source`）
- [ ] `verified: false` 时显示「未审核」标签，安装前二次确认
- [ ] 显示 `capabilities`（已有能力声明机制，沿用）

## 8. 待主框架拍板

1. **`panel` 字段放哪**：现在 `module.json.panel` 指向 `panel.js`，新格式里还没定（`aurabot.panel`？还是约定 `lib/panel.js`？）
2. **是否允许 CJS**：建议只允许 ESM，减少加载分支
3. **安装目录命名**：`owner__name` 还是别的转义方式
4. **是否校验 GitHub provenance / attestation**：第一版可以先只校验 sha256
5. **升级时数据目录**：`data/<id>/` 是否随 id 变更迁移

## 9. 明确不属于主框架的部分

- 索引怎么生成、怎么镜像：市场仓库负责
- 作者仓库怎么构建、Release 怎么发：模板仓库负责
- 收录审核：市场仓库的 `verified.json` 负责

