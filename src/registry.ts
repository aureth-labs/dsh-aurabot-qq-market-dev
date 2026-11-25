import type { Source } from './types.js'

/**
 * 收录表里写的是人点的链接：`https://github.com/<owner>/<repo>/blob/<ref>/<path>`。
 * 拉取时换成 raw，省得作者去翻 raw 域名。
 */
export function toFetchUrl(url: string): string {
  const plain = url.split('#')[0] ?? url
  const found = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|raw)\/([^?#]+)/i.exec(plain)
  return found ? `https://raw.githubusercontent.com/${found[1]}/${found[2]}/${found[3]}` : plain
}

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
    if (line.startsWith('"')) {
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
    sources.push({ url: value, fetchUrl: toFetchUrl(value) })
  })

  return { sources, errors }
}
