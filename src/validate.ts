import { CAPABILITIES, CATEGORIES, type PackageManifest } from './types.js'

/** 包名本身：小写字母 / 数字 / -，不带 @，也不带用户名前缀 */
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,39}$/
/** 依赖里的完整 id：owner/name */
const QUALIFIED_RE = /^([a-z0-9][a-z0-9-]{0,38})\/([a-z0-9][a-z0-9-]{0,38})$/
/** 内置模块 id 没有 owner 前缀，允许平铺 */
const BUILTIN_ID_RE = /^[a-z][a-z0-9-]{1,39}$/
const OWNER_RE = /^[a-z0-9][a-z0-9-]{0,38}$/
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/
const SHA256_RE = /^[0-9a-f]{64}$/
const PANEL_RE = /^\.\/[A-Za-z0-9._/-]+\.js$/

/** 面板缺省路径：前端源码在 client/，编译产物落在 dist/ */
export const DEFAULT_PANEL = './dist/panel.js'

export interface ValidationResult {
  errors: string[]
  /** 校验通过时给出，方便调用方直接用 */
  manifest?: PackageManifest
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** 拼出市场里的全局唯一 id。作者只写包名，owner 由市场补。 */
export function qualify(owner: string, name: string): string {
  return `${owner}/${name}`
}

/**
 * 从收录地址里取 GitHub owner：作者不需要在 package.json 里写自己是谁，
 * 仓库地址本身就是身份。取不到就返回 null，由调用方记一条跳过。
 */
export function ownerFromSource(source: string, override?: string): string | null {
  const raw = (override ?? '').trim().toLowerCase()
  if (raw) return OWNER_RE.test(raw) ? raw : null

  const patterns = [
    /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\//i,
    /^https?:\/\/github\.com\/([^/]+)\/[^/]+\/(?:raw|blob)\//i,
    /^https?:\/\/(?:cdn\.)?jsdelivr\.net\/gh\/([^/]+)\//i,
  ]
  for (const pattern of patterns) {
    const found = pattern.exec(source)
    const owner = found?.[1]?.toLowerCase()
    if (owner && OWNER_RE.test(owner)) return owner
  }
  return null
}

export function parseQualifiedId(id: string): { owner: string; name: string } | null {
  const m = QUALIFIED_RE.exec(id)
  return m && m[1] && m[2] ? { owner: m[1], name: m[2] } : null
}

/** 校验作者仓库的 package.json。只认 `aurabot` 段，其它字段不管。 */
export function validateManifest(raw: unknown): ValidationResult {
  const errors: string[] = []
  if (!isRecord(raw)) return { errors: ['顶层不是 JSON 对象'] }

  const name = raw.name
  if (typeof name !== 'string') errors.push('缺 name')
  else if (!NAME_RE.test(name)) {
    errors.push(`name「${name}」只写包名本身（小写字母/数字/-），不要加用户名前缀、不要带 @`)
  }

  const version = raw.version
  if (typeof version !== 'string') errors.push('缺 version')
  else if (!SEMVER_RE.test(version)) errors.push(`version「${version}」不是 主.次.修`)

  if (raw.type !== 'module') errors.push('type 必须是 "module"：插件只支持 ESM')

  const aurabot = raw.aurabot
  if (!isRecord(aurabot)) {
    errors.push('缺 aurabot 段（分类、能力、产物都写在里面）')
    return { errors }
  }

  if (typeof aurabot.category !== 'string' || !(CATEGORIES as readonly string[]).includes(aurabot.category)) {
    errors.push(`aurabot.category 要从这些里选一个：${CATEGORIES.join('、')}`)
  }

  const panel = aurabot.panel
  if (panel !== undefined && (typeof panel !== 'string' || !PANEL_RE.test(panel))) {
    errors.push('aurabot.panel 要写成 ./xxx/panel.js（相对模块根目录，不能跳出模块）')
  }

  const caps = aurabot.capabilities
  if (!Array.isArray(caps)) {
    errors.push('aurabot.capabilities 要是数组，没有写 []')
  } else {
    const seen = new Set<string>()
    for (const cap of caps) {
      if (typeof cap !== 'string' || !(CAPABILITIES as readonly string[]).includes(cap)) {
        errors.push(`aurabot.capabilities 里的「${String(cap)}」不认识，可选：${CAPABILITIES.join('、')}`)
      } else if (seen.has(cap)) {
        errors.push(`aurabot.capabilities 里「${cap}」重复了`)
      } else {
        seen.add(cap)
      }
    }
  }

  const minPluginVersion = aurabot.minPluginVersion
  if (typeof minPluginVersion !== 'string' || !SEMVER_RE.test(minPluginVersion)) {
    errors.push('aurabot.minPluginVersion 要写成 主.次.修')
  }

  const api = aurabot.api
  if (api !== 2) errors.push('aurabot.api 要是 2（只收 V2 插件）')

  const requires = aurabot.requires
  if (requires !== undefined) {
    if (!Array.isArray(requires)) errors.push('aurabot.requires 要是数组')
    else {
      for (const id of requires) {
        if (typeof id !== 'string' || !(QUALIFIED_RE.test(id) || BUILTIN_ID_RE.test(id))) {
          errors.push(`aurabot.requires 里的「${String(id)}」既不是 owner/name，也不是合法的内置模块 id`)
        }
      }
    }
  }

  if (aurabot.kind !== undefined && aurabot.kind !== 'adapter' && aurabot.kind !== 'plugin') errors.push('aurabot.kind 需要是 adapter 或 plugin')
  const platforms = aurabot.platforms
  if (platforms !== undefined) {
    if (!Array.isArray(platforms) || platforms.length === 0) errors.push('aurabot.platforms 要是非空数组')
    else if (platforms.includes('*') && platforms.length !== 1) errors.push('aurabot.platforms 里的 "*" 只能单独使用')
  }

  const artifact = aurabot.artifact
  if (!isRecord(artifact)) {
    errors.push('缺 aurabot.artifact（构建产物地址、sha256、大小）')
  } else {
    if (typeof artifact.url !== 'string' || !/^https:\/\/.+\.zip$/i.test(artifact.url)) {
      errors.push('aurabot.artifact.url 要是 https 的 .zip 直链')
    }
    if (typeof artifact.sha256 !== 'string' || !SHA256_RE.test(artifact.sha256)) {
      errors.push('aurabot.artifact.sha256 要是 64 位小写十六进制')
    }
    if (!Number.isInteger(artifact.size) || (artifact.size as number) <= 0) {
      errors.push('aurabot.artifact.size 要是正整数（字节）')
    }
  }

  if (errors.length) return { errors }
  return { errors: [], manifest: raw as unknown as PackageManifest }
}
