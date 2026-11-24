import { CAPABILITIES, CATEGORIES, type PackageManifest } from './types.js'

/** 包名必须是 @owner/name，owner 和 name 都只允许小写字母、数字、- */
const NAME_RE = /^@([a-z0-9][a-z0-9-]{0,38})\/([a-z0-9][a-z0-9-]{0,38})$/
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/
const SHA256_RE = /^[0-9a-f]{64}$/
/** 内置模块 id 没有 owner 前缀，允许平铺 */
const BUILTIN_ID_RE = /^[a-z][a-z0-9-]{1,39}$/

export interface ValidationResult {
  errors: string[]
  /** 校验通过时给出，方便调用方直接用 */
  manifest?: PackageManifest
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export function parseId(name: string): { owner: string; name: string } | null {
  const m = NAME_RE.exec(name)
  return m && m[1] && m[2] ? { owner: m[1], name: m[2] } : null
}

/** 校验作者仓库的 package.json。只认 `aurabot` 段，其它字段不管。 */
export function validateManifest(raw: unknown): ValidationResult {
  const errors: string[] = []
  if (!isRecord(raw)) return { errors: ['顶层不是 JSON 对象'] }

  const name = raw.name
  if (typeof name !== 'string') errors.push('缺 name')
  else if (!NAME_RE.test(name)) errors.push(`name「${name}」要写成 @owner/name，且只用小写字母、数字、-`)

  const version = raw.version
  if (typeof version !== 'string') errors.push('缺 version')
  else if (!SEMVER_RE.test(version)) errors.push(`version「${version}」不是 主.次.修`)

  const aurabot = raw.aurabot
  if (!isRecord(aurabot)) {
    errors.push('缺 aurabot 段（分类、能力、产物都写在里面）')
    return { errors }
  }

  if (typeof aurabot.category !== 'string' || !(CATEGORIES as readonly string[]).includes(aurabot.category)) {
    errors.push(`aurabot.category 要从这些里选一个：${CATEGORIES.join('、')}`)
  }

  const tags = aurabot.tags
  if (tags !== undefined) {
    if (!Array.isArray(tags) || tags.length > 5) errors.push('aurabot.tags 要是数组，最多 5 个')
    else if (tags.some((tag) => typeof tag !== 'string' || !tag.trim())) errors.push('aurabot.tags 里只能放非空字符串')
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
  if (!Number.isInteger(api) || (api as number) < 1) errors.push('aurabot.api 要是正整数')

  const requires = aurabot.requires
  if (requires !== undefined) {
    if (!Array.isArray(requires)) errors.push('aurabot.requires 要是数组')
    else {
      for (const id of requires) {
        if (typeof id !== 'string' || !(NAME_RE.test(id) || BUILTIN_ID_RE.test(id))) {
          errors.push(`aurabot.requires 里的「${String(id)}」既不是 owner/name，也不是合法的内置模块 id`)
        }
      }
    }
  }

  const platforms = aurabot.platforms
  if (platforms !== undefined) {
    if (!Array.isArray(platforms) || platforms.length === 0) errors.push('aurabot.platforms 要是非空数组；不写表示只支持 qq')
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
