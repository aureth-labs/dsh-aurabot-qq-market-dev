import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { buildMarket } from '../lib/build.js'
import { parseId, validateManifest } from '../lib/validate.js'

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))
const read = (name) => JSON.parse(readFileSync(fixture(name), 'utf8'))

test('合法清单通过，并解析出 owner/name', () => {
  const result = validateManifest(read('good.json'))
  assert.deepEqual(result.errors, [])
  assert.equal(result.manifest.aurabot.category, 'social')
  assert.deepEqual(parseId('@shangxueink/playmusic'), { owner: 'shangxueink', name: 'playmusic' })
})

test('缺 aurabot 段直接报错', () => {
  const { errors } = validateManifest({ name: '@a/b', version: '1.0.0' })
  assert.equal(errors.length, 1)
  assert.match(errors[0], /aurabot/)
})

test('分类必须是枚举里的一个', () => {
  const { errors } = validateManifest(read('bad-category.json'))
  assert.ok(errors.some((e) => e.includes('aurabot.category')))
})

test('产物必须是 https 的 zip + 合法 sha256 + 正整数大小', () => {
  const { errors } = validateManifest(read('bad-artifact.json'))
  assert.ok(errors.some((e) => e.includes('artifact.url')))
  assert.ok(errors.some((e) => e.includes('artifact.sha256')))
  assert.ok(errors.some((e) => e.includes('artifact.size')))
})

test('包名必须带 @owner/ 前缀', () => {
  const bad = read('good.json')
  bad.name = 'playmusic'
  const { errors } = validateManifest(bad)
  assert.ok(errors.some((e) => e.includes('name')))
})

test('同一 id 出现两次：后一条记为失败，不覆盖前一条', async () => {
  const { index, failures } = await buildMarket({
    schema: 1,
    sources: [{ package: fixture('good.json') }, { package: fixture('good.json') }],
  })
  assert.equal(index.entries.length, 1)
  assert.equal(failures.length, 1)
  assert.match(failures[0].reason, /id 重复/)
})

test('读不到来源：记失败，不影响其它条目', async () => {
  const { index, failures } = await buildMarket({
    schema: 1,
    sources: [{ package: fixture('nope.json') }, { package: fixture('good.json') }],
  })
  assert.equal(index.entries.length, 1)
  assert.equal(failures.length, 1)
})
