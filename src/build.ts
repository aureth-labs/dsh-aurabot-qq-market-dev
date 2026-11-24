import { readFile } from 'node:fs/promises'
import { parseId, validateManifest } from './validate.js'
import type { MarketEntry, MarketIndex, PackageManifest, Registry } from './types.js'

export interface Failure {
  source: string
  id?: string
  reason: string
}

export interface BuildOptions {
  /** 已审核的 id，命中的条目标 verified: true */
  verified?: Set<string>
  /** 单条请求超时，默认 15 秒 */
  timeoutMs?: number
}

export interface BuildResult {
  index: MarketIndex
  failures: Failure[]
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

/**
 * 拉取 registry 里的每个 package.json，校验后合成市场索引。
 * 单条失败只记进 failures，不影响其它条目——一个作者的 404 不该拖垮整次构建。
 */
export async function buildMarket(registry: Registry, options: BuildOptions = {}): Promise<BuildResult> {
  const verified = options.verified ?? new Set<string>()
  const timeoutMs = options.timeoutMs ?? 15_000
  const entries = new Map<string, MarketEntry>()
  const failures: Failure[] = []

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
        failures.push({ source, id: manifest.name, reason: '包名不是 @owner/name' })
        continue
      }
      const id = `${parsed.owner}/${parsed.name}`

      const previous = entries.get(id)
      if (previous) {
        failures.push({ source, id, reason: `id 重复：已收录自 ${previous.source}` })
        continue
      }

      entries.set(id, {
        id,
        owner: parsed.owner,
        name: parsed.name,
        version: manifest.version,
        displayName: manifest.aurabot.displayName || parsed.name,
        description: manifest.description ?? '',
        tags: manifest.aurabot.tags ?? [],
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
        verified: verified.has(id),
      })
    } catch (error) {
      failures.push({ source, reason: (error as Error).message })
    }
  }

  const sorted = [...entries.values()].sort((a, b) => a.id.localeCompare(b.id))
  return {
    index: { schema: 2, generatedAt: new Date().toISOString(), entries: sorted },
    failures,
  }
}

