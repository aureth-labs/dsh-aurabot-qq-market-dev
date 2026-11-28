/**
 * 市场的数据形状。字段名一旦发布就不要改：作者仓库和宿主都依赖它。
 */

export const CATEGORIES = ['adapter', 'platform', 'social', 'creative', 'desktop', 'manage', 'tool'] as const
export type Category = (typeof CATEGORIES)[number]

export const CAPABILITIES = ['network', 'filesystem', 'process', 'dynamic-code', 'plugin-config', 'plugin-internals'] as const
export type Capability = (typeof CAPABILITIES)[number]

/** 构建产物：作者仓库 Release 里的 zip。 */
export interface Artifact {
  mirror?: string
  /** https 直链 */
  url: string
  /** 小写十六进制 sha256 */
  sha256: string
  /** 字节数 */
  size: number
}

/** package.json 里的 `aurabot` 段。 */
export interface AurabotManifest {
  /** 市场里显示的名字；和包名解耦，允许重名 */
  displayName?: string
  /** 面板文件，相对模块根目录；缺省 ./dist/panel.js */
  panel?: string
  category: Category
  capabilities: Capability[]
  /** 最低插件版本，例如 1.2.0 */
  minPluginVersion: string
  /** 按哪一版扩展接口写的 */
  api: number
  /** 依赖的模块 id：`owner/name` 或内置模块 id */
  requires?: string[]
  kind?: 'plugin' | 'adapter'
  /** V2 缺省适配全部平台。 */
  platforms?: string[]
  /** 最近一次构建的产物 */
  artifact: Artifact
}

/** 作者仓库里的 package.json，只列我们关心的字段。 */
export interface PackageManifest {
  /** 包名本身，不带用户名前缀：市场构建时用来源仓库的 owner 拼成 `owner/name` */
  name: string
  version: string
  main?: string
  description?: string
  license?: string
  author?: string | { name?: string }
  aurabot: AurabotManifest
}

/** 一条收录：registry.jsonl 里的一行。 */
export interface Source {
  /** 原样保留的链接：写进 market.json 的 `source` 也是它，不做任何改写 */
  url: string
  /** 可选：地址里看不出 owner 时（本地文件、自建域名）显式指定 */
  owner?: string
}

/** 生成的 market.json 里的一条。 */
export interface MarketEntry {
  /** `owner/name`，全局唯一 */
  id: string
  owner: string
  name: string
  version: string
  displayName: string
  description: string
  /** 面板文件路径，已套用默认值 */
  panel: string
  category: Category
  capabilities: Capability[]
  kind: 'plugin' | 'adapter'
  platforms: string[]
  requires: string[]
  minPluginVersion: string
  api: number
  license: string
  author: string
  artifact: Artifact
  /** package.json 的来源地址，方便追溯 */
  source: string
  /** 是否经过审核。自动收录一律 false */
  verified: boolean
}

export interface MarketIndex {
  schema: 2
  generatedAt: string
  entries: MarketEntry[]
}
