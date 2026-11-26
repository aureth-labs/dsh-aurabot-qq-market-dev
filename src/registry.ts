import type { Source } from './types.js'

export interface RegistryParse {
  sources: Source[]
  /** 写错的行，构建时打到日志里，不影响其它行 */
  errors: string[]
}

/**
 * registry.jsonl：一行一个 URL。
 * 空行和 `#` 开头的注释行跳过；也兼容每行是 JSON 字符串（带引号）的写法。
 */
export function parseRegistry(text: string): RegistryParse {
  const sources: Source[] = []
  const errors: string[] = []
  const seen = new Set<string>()

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return

    let url = line
    let owner: string | undefined
    if (line.startsWith('{')) {
      try {
        const row = JSON.parse(line)
        if (typeof row.url !== 'string' || typeof row.owner !== 'string' || !/^[a-z0-9][a-z0-9-]{0,38}$/.test(row.owner)) throw Error()
        url = row.url
        owner = row.owner
      } catch {
        errors.push('第 ' + (index + 1) + ' 行需要 url 和有效的 owner')
        return
      }
    } else if (line.startsWith('"')) {
      try {
        url = JSON.parse(line) as string
      } catch {
        errors.push(`第 ${index + 1} 行不是合法的 JSON 字符串`)
        return
      }
    }
    if (typeof url !== 'string' || !url.trim()) {
      errors.push(`第 ${index + 1} 行读不出 URL`)
      return
    }
    const value = url.trim()
    if (seen.has(value)) return
    seen.add(value)
    sources.push(owner ? { url: value, owner } : { url: value })
  })

  return { sources, errors }
}
