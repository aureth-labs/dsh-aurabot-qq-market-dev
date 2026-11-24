#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { buildMarket } from './build.js'
import { renderReport } from './report.js'
import type { Registry } from './types.js'

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
    console.error('用法：node lib/index.js build [--registry registry.json] [--out dist/market.json] [--report dist/report.md] [--verified verified.json] [--allow-failures]')
    return 2
  }

  const registryPath = resolve(arg('--registry', 'registry.json'))
  const outPath = resolve(arg('--out', 'dist/market.json'))
  const reportPath = resolve(arg('--report', 'dist/report.md'))
  const verifiedPath = resolve(arg('--verified', 'verified.json'))

  const registry = (await readJsonIfExists(registryPath)) as Registry | null
  if (!registry || !Array.isArray(registry.sources)) {
    console.error(`${registryPath} 读不出来，或者没有 sources 数组`)
    return 2
  }

  const verifiedRaw = (await readJsonIfExists(verifiedPath)) as unknown
  const verified = new Set<string>(
    Array.isArray(verifiedRaw) ? verifiedRaw.filter((id): id is string => typeof id === 'string') : [],
  )

  const result = await buildMarket(registry, { verified })

  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify(result.index, null, 2) + '\n')
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, renderReport(result))

  console.log(`收录 ${result.index.entries.length} 个，失败 ${result.failures.length} 个`)
  for (const failure of result.failures) console.error(`✗ ${failure.id ?? failure.source}：${failure.reason}`)
  console.log(`索引：${outPath}`)
  console.log(`报告：${reportPath}`)

  if (result.failures.length && !flag('--allow-failures')) return 1
  return 0
}

process.exitCode = await main()
