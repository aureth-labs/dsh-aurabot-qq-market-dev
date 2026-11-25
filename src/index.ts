#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { buildMarket } from './build.js'
import { parseRegistry } from './registry.js'
import { renderLanding } from './landing.js'
import { renderReport } from './report.js'

const arg = (name: string, fallback: string): string => {
  const i = process.argv.indexOf(name)
  const value = i > 0 ? process.argv[i + 1] : undefined
  return value ?? fallback
}

const flag = (name: string): boolean => process.argv.includes(name)

async function readJsonIfExists(path: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function main(): Promise<number> {
  const command = process.argv[2]
  if (command !== 'build') {
    console.error('用法：node lib/index.js build [--registry registry.jsonl] [--out dist/market.json] [--report dist/report.md] [--verified verified.json] [--strict]')
    return 2
  }

  const registryPath = resolve(arg('--registry', 'registry.jsonl'))
  const outPath = resolve(arg('--out', 'dist/market.json'))
  const reportPath = resolve(arg('--report', 'dist/report.md'))
  const verifiedPath = resolve(arg('--verified', 'verified.json'))

  let registryText: string
  try {
    registryText = await readFile(registryPath, 'utf8')
  } catch {
    console.error(`${registryPath} 读不出来`)
    return 2
  }
  const { sources, errors } = parseRegistry(registryText)
  for (const error of errors) console.warn(`! 收录表：${error}`)
  if (!sources.length) console.warn(`! 收录表是空的（一行一个 GitHub 文件链接）`)

  const verifiedRaw = (await readJsonIfExists(verifiedPath)) as unknown
  const verified = new Set<string>(
    Array.isArray(verifiedRaw) ? verifiedRaw.filter((id): id is string => typeof id === 'string') : [],
  )

  const result = await buildMarket(sources, { verified })

  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify(result.index, null, 2) + '\n')
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, renderReport(result))

  // Pages 的根路径得有东西，否则 / 直接 404，看着像没部署成功。
  const landingPath = resolve(dirname(outPath), 'index.html')
  await writeFile(landingPath, renderLanding(result.index), 'utf8')

  console.log(`收录 ${result.index.entries.length} 个，跳过 ${result.failures.length} 个，重命名 ${result.renamed.length} 个`)
  for (const failure of result.failures) console.warn(`! ${failure.id ?? failure.source}：${failure.reason}`)
  for (const item of result.renamed) console.warn(`! id 冲突：${item.from} → ${item.to}`)
  console.log(`索引：${outPath}`)
  console.log(`报告：${reportPath}`)
  console.log(`落地页：${landingPath}`)

  // 默认只当警告：单个作者写错清单不该卡住整条流水线。需要严格模式时加 --strict。
  if (result.failures.length && flag('--strict')) return 1
  return 0
}

process.exitCode = await main()
