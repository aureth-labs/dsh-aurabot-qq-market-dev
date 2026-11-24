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
  assert.deepEqual(parseId('shangxueink/playmusic'), { owner: 'shangxueink', name: 'playmusic' })
})

test('缺 aurabot 段直接报错', () => {
  const { errors } = validateManifest({ name: 'a/b', version: '1.0.0', type: 'module' })
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

test('包名必须写成 scope/name（不带 @）', () => {
  const bad = read('good.json')
  bad.name = '@shangxueink/playmusic'
  const { errors } = validateManifest(bad)
  assert.ok(errors.some((e) => e.includes('name')))
})

test('没写 panel 时套默认 ./client/panel.js', async () => {
  const { index } = await buildMarket({ schema: 1, sources: [{ package: fixture('good.json') }] })
  assert.equal(index.entries[0].panel, './client/panel.js')
})

test('同一 id 出现两次：按 owner 排序，后来者加 -2', async () => {
  const { index, failures, renamed } = await buildMarket({
    schema: 1,
    sources: [{ package: fixture('good.json') }, { package: fixture('good.json') }],
  })
  assert.equal(failures.length, 0)
  assert.equal(index.entries.length, 2)
  assert.deepEqual(index.entries.map((e) => e.id).sort(), ['shangxueink/playmusic', 'shangxueink/playmusic-2'])
  assert.equal(renamed.length, 1)
})

test('同名不同 scope 可以共存', async () => {
  const { index } = await buildMarket({
    schema: 1,
    sources: [{ package: fixture('good.json') }, { package: fixture('same-name.json') }],
  })
  assert.equal(index.entries.length, 2)
  assert.deepEqual(index.entries.map((e) => e.id).sort(), ['another/playmusic', 'shangxueink/playmusic'])
})

test('读不到来源：记失败，不影响其它条目', async () => {
  const { index, failures } = await buildMarket({
    schema: 1,
    sources: [{ package: fixture('nope.json') }, { package: fixture('good.json') }],
  })
  assert.equal(index.entries.length, 1)
  assert.equal(failures.length, 1)
})
