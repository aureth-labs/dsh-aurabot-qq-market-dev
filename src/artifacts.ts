import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { text } from 'node:stream/consumers'
import { fromBufferPromise } from 'yauzl'
import type { BuildResult } from './build.js'
import type { Artifact, MarketEntry } from './types.js'

const MAX_BYTES = 25 * 1024 * 1024

async function readArtifact(asset: Artifact, localDir?: string) {
  if (asset.size > MAX_BYTES) throw Error('发行包超过 25 MiB')
  if (localDir) {
    const name = new URL(asset.url).pathname.split('/').pop() || ''
    if (!/^[a-z0-9][a-z0-9._-]*\.zip$/i.test(name)) throw Error('本地发行包名无效')
    const path = join(localDir,name)
    if ((await stat(path)).size !== asset.size) throw Error('本地 ZIP 大小与清单不符')
    return readFile(path)
  }
  const res = await fetch(asset.url,{ signal: AbortSignal.timeout(90_000) })
  if (!res.ok || !res.body) throw Error('无法下载发行包，HTTP ' + res.status)
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of res.body) {
    size += chunk.byteLength
    if (size > asset.size) throw Error('下载的 ZIP 超过清单大小')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export async function verifyManifest(bytes: Buffer, entry: MarketEntry) {
  const zip = await fromBufferPromise(bytes)
  let found = false
  try {
    for await (const file of zip.eachEntry()) {
      if (file.fileName !== 'package.json') continue
      if (found || file.uncompressedSize > 1024 * 1024) throw Error('发行包清单重复或过大')
      found = true
      const pkg = JSON.parse(await text(await zip.openReadStreamPromise(file)))
      if (pkg.name !== entry.name || pkg.version !== entry.version || pkg.type !== 'module' || pkg.aurabot?.api !== entry.api) {
        throw Error(`发行包清单 ${pkg.name}@${pkg.version} (API ${pkg.aurabot?.api}) 与索引 ${entry.name}@${entry.version} (API ${entry.api}) 不符`)
      }
    }
    if (!found) throw Error('发行包缺少根目录 package.json')
  } finally { zip.close() }
}

export async function mirrorArtifacts(result: BuildResult, output: string, localDir?: string) {
  const dir = join(output,'artifacts')
  await mkdir(dir,{recursive:true})
  const entries = []
  for (const entry of result.index.entries) {
    try {
      const asset = entry.artifact
      const bytes = await readArtifact(asset,localDir)
      if (bytes.length !== asset.size || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw Error('发行包大小或 SHA-256 与清单不符')
      await verifyManifest(bytes, entry)
      const filename = asset.sha256 + '.zip'
      const tmp = join(dir,'.' + randomUUID())
      try {
        await writeFile(tmp,bytes)
        await rename(tmp, join(dir,filename))
      } finally { await rm(tmp,{force:true}) }
      entries.push({...entry,artifact:{...asset,mirror:'artifacts/' + filename}})
    } catch (error) {
      result.failures.push({id:entry.id,source:entry.source,reason:error instanceof Error ? error.message : String(error)})
    }
  }
  result.index.entries = entries
}
