import { randomUUID } from 'node:crypto'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { mirrorArtifacts } from './artifacts.js'
import { buildMarket } from './build.js'
import { parseRegistry } from './registry.js'

const root = process.cwd()
const workspaces = resolve(process.argv[2] || join(root, '..'))
const data = process.env.AURABOT_DATA_DIR || join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'plugins-data', 'aurabot')
const output = join(data, 'market-local')
const { sources, errors } = parseRegistry(await readFile(join(root, 'registry.jsonl'), 'utf8'))
if (errors.length || !sources.length) throw Error(errors.join('；') || '收录表为空')
const upstream = new Map<string, { url: string; dist: string }>()
const manifests = sources.map(({ url }) => {
  const match = /^https:\/\/github\.com\/([\w-]+)\/([\w.-]+)\/blob\/[^/]+\/modules\/([a-z0-9-]+)\/package\.json$/.exec(url)
  if (!match?.[1] || !match[2] || !match[3] || match[2] === '.' || match[2] === '..') throw Error('需要本地发布仓库的模块清单地址：' + url)
  const [,owner,repo,name] = match
  const dist = join(workspaces, repo, 'dist')
  const manifest = join(dist, 'manifests', name, 'package.json')
  upstream.set(manifest, { url, dist })
  return { owner, url: manifest }
})
const verified = new Set<string>(JSON.parse(await readFile(join(root, 'verified.json'), 'utf8')))
const result = await buildMarket(manifests, { verified })
await mirrorArtifacts(result, output, entry => upstream.get(entry.source)!.dist)
if (result.failures.length || result.renamed.length || result.index.entries.length !== sources.length) {
  for (const row of result.failures) console.error(row.source, row.reason)
  throw Error('请先在发布仓库运行 npm run dry-run。原索引已保留。')
}
for (const entry of result.index.entries) entry.source = upstream.get(entry.source)!.url
const tmp = join(output, '.' + randomUUID() + '.json')
try {
  await writeFile(tmp, JSON.stringify(result.index, null, 2) + '\n')
  await rename(tmp, join(output, 'market.json'))
} finally { await rm(tmp, { force: true }) }
console.log('本机开发市场已生成：' + result.index.entries.length + ' 个已校验插件，' + output)
