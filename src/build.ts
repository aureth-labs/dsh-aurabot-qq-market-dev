import { readFile } from 'node:fs/promises'
import { DEFAULT_PANEL, parseId, validateManifest } from './validate.js'
import type { MarketEntry, MarketIndex, PackageManifest, Registry, RevokedEntry } from './types.js'

export interface Failure {
  source: string
  id?: string
  reason: string
}

export interface BuildOptions {
  /** 已审核的 id，命中的条目标 verified: true */
  verified?: Set<string>
  /** 撤回表：命中的条目带上 revoked 说明 */
  revoked?: RevokedEntry[]
  /** 单条请求超时，默认 15 秒 */
  timeoutMs?: number
}

export interface BuildResult {
  index: MarketIndex
  /** 清单本身不合法，整条跳过 */
  failures: Failure[]
  /** id 冲突后被改名的条目 */
  renamed: { from: string; to: string }[]
}

async function readJson(source: string, timeoutMs: number): Promise<unknown> {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source, {
      headers: {
        'user-agent': 'aurabot-market/0.1 (+https://github.com/aureth-labs/dsh-aurabot-qq-market-dev)',
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
    return await res.json()
  }
  return JSON.parse(await readFile(source, 'utf8')) as unknown
}

function authorOf(manifest: PackageManifest): string {
  if (typeof manifest.author === 'string') return manifest.author
  return manifest.author?.name ?? ''
}

interface Candidate {
  id: string
  owner: string
  name: string
  manifest: PackageManifest
  source: string
}

function toEntry(candidate: Candidate, id: string, verified: boolean, revoked: RevokedEntry[]): MarketEntry {
  const { manifest, owner, name, source } = candidate
  const hit = revoked.find((item) => item.id === id && item.versions.includes(manifest.version))
  return {
    id,
    owner,
    name,
    version: manifest.version,
    displayName: manifest.aurabot.displayName || name,
    description: manifest.description ?? '',
    panel: manifest.aurabot.panel ?? DEFAULT_PANEL,
    category: manifest.aurabot.category,
    capabilities: manifest.aurabot.capabilities,
    platforms: manifest.aurabot.platforms ?? ['qq'],
    requires: manifest.aurabot.requires ?? [],
    minPluginVersion: manifest.aurabot.minPluginVersion,
    api: manifest.aurabot.api,
    license: manifest.license ?? '',
    author: authorOf(manifest),
    artifact: manifest.aurabot.artifact,
    source,
    verified,
    ...(hit ? { revoked: { versions: hit.versions, reason: hit.reason } } : {}),
  }
}

/**
 * 拉取 registry 里的每个 package.json，校验后合成市场索引。
 * 清单不合法只记进 failures 并跳过这一条，不影响其它条目，也不让整次构建失败。
 */
export async function buildMarket(registry: Registry, options: BuildOptions = {}): Promise<BuildResult> {
  const verified = options.verified ?? new Set<string>()
  const revoked = options.revoked ?? []
  const timeoutMs = options.timeoutMs ?? 15_000
  const failures: Failure[] = []
  const candidates: Candidate[] = []

  for (const item of registry.sources) {
    const source = item.package
    try {
      const raw = await readJson(source, timeoutMs)
      const { errors, manifest } = validateManifest(raw)
      if (!manifest) {
        failures.push({ source, reason: errors.join('；') })
        continue
      }
      const parsed = parseId(manifest.name)
      if (!parsed) {
        failures.push({ source, id: manifest.name, reason: '包名不是 scope/name' })
        continue
      }
      candidates.push({ id: `${parsed.owner}/${parsed.name}`, owner: parsed.owner, name: parsed.name, manifest, source })
    } catch (error) {
      failures.push({ source, reason: (error as Error).message })
    }
  }

  // 同 id 冲突：按 owner 首字母排，先到的保住 id，后来的加 -2 / -3 后缀
  const grouped = new Map<string, Candidate[]>()
  for (const candidate of candidates) {
    const list = grouped.get(candidate.id)
    if (list) list.push(candidate)
    else grouped.set(candidate.id, [candidate])
  }

  const entries: MarketEntry[] = []
  const renamed: { from: string; to: string }[] = []
  for (const [id, group] of grouped) {
    group.sort((a, b) => a.owner.localeCompare(b.owner) || a.source.localeCompare(b.source))
    group.forEach((candidate, index) => {
      const finalId = index === 0 ? id : `${candidate.owner}/${candidate.name}-${index + 1}`
      if (finalId !== id) renamed.push({ from: id, to: finalId })
      entries.push(toEntry(candidate, finalId, verified.has(finalId) || verified.has(id), revoked))
    })
  }

  entries.sort((a, b) => a.id.localeCompare(b.id))
  return {
    index: { schema: 2, generatedAt: new Date().toISOString(), entries },
    failures,
    renamed,
  }
}

