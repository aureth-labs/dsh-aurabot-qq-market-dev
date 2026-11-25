import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { buildMarket } from '../lib/build.js'
import { ownerFromSource, qualify, validateManifest } from '../lib/validate.js'

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))
const read = (name) => JSON.parse(readFileSync(fixture(name), 'utf8'))
const source = (name, owner) => ({ package: fixture(name), ...(owner ? { owner } : {}) })

test('合法清单通过：name 只写包名本身', () => {
  const result = validateManifest(read('good.json'))
  assert.deepEqual(result.errors, [])
  assert.equal(result.manifest.name, 'playmusic')
  assert.equal(result.manifest.aurabot.category, 'social')
})

test('缺 aurabot 段直接报错', () => {
  const { errors } = validateManifest({ name: 'playmusic', version: '1.0.0', type: 'module' })
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

test('name 不能带用户名前缀或 @', () => {
  for (const bad of ['shangxueink/playmusic', '@shangxueink/playmusic', 'PlayMusic']) {
    const { errors } = validateManifest({ ...read('good.json'), name: bad })
    assert.ok(errors.some((e) => e.includes('name')), `${bad} 应该被拒`)
  }
})

test('owner 取自收录地址：raw / blob / jsDelivr 都认', () => {
  assert.equal(ownerFromSource('https://raw.githubusercontent.com/shangxueink/r/main/a/package.json'), 'shangxueink')
  assert.equal(ownerFromSource('https://github.com/Another/r/blob/main/a/package.json'), 'another')
  assert.equal(ownerFromSource('https://cdn.jsdelivr.net/gh/SomeOne/r@main/a/package.json'), 'someone')
  assert.equal(ownerFromSource('https://example.com/a.json'), null)
  assert.equal(ownerFromSource('https://example.com/a.json', 'Local-Bot'), 'local-bot')
})

test('id 由市场拼成 owner/name', () => {
  assert.equal(qualify('shangxueink', 'playmusic'), 'shangxueink/playmusic')
})

test('没写 panel 时套默认 ./dist/panel.js', async () => {
  const { index } = await buildMarket({ schema: 1, sources: [source('good.json', 'shangxueink')] })
  assert.equal(index.entries[0].panel, './dist/panel.js')
  assert.equal(index.entries[0].id, 'shangxueink/playmusic')
})

test('同一 owner 下重名：按来源排序，后来者加 -2', async () => {
  const { index, failures, renamed } = await buildMarket({
    schema: 1,
    sources: [source('good.json', 'shangxueink'), source('good.json', 'shangxueink')],
  })
  assert.equal(failures.length, 0)
  assert.deepEqual(index.entries.map((e) => e.id).sort(), ['shangxueink/playmusic', 'shangxueink/playmusic-2'])
  assert.equal(renamed.length, 1)
})

test('同名不同 owner 可以共存', async () => {
  const { index } = await buildMarket({
    schema: 1,
    sources: [source('good.json', 'shangxueink'), source('same-name.json', 'another')],
  })
  assert.equal(index.entries.length, 2)
  assert.deepEqual(index.entries.map((e) => e.id).sort(), ['another/playmusic', 'shangxueink/playmusic'])
})

test('地址里看不出 owner 又没写 owner：跳过并说明', async () => {
  const { index, failures } = await buildMarket({ schema: 1, sources: [source('good.json')] })
  assert.equal(index.entries.length, 0)
  assert.match(failures[0].reason, /owner/)
})

test('读不到来源：记失败，不影响其它条目', async () => {
  const { index, failures } = await buildMarket({
    schema: 1,
    sources: [source('nope.json', 'shangxueink'), source('good.json', 'shangxueink')],
  })
  assert.equal(index.entries.length, 1)
  assert.equal(failures.length, 1)
})
