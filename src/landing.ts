import type { MarketEntry, MarketIndex } from './types.js'

/**
 * 给 GitHub Pages 根路径生成一个能直接打开看的落地页。
 *
 * 数据全部内联渲染：不开 JS 也能看到内容，抓取和存档都不会拿到空壳。
 * 样式跟着文档站的粉白扁平走，两边看起来是一套东西。
 */

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const CATEGORY_LABEL: Record<string, string> = {
  platform: '平台',
  social: '社交',
  creative: '创作',
  desktop: '桌面',
  manage: '管理',
  tool: '工具',
}

function renderCard(entry: MarketEntry): string {
  const tags = [
    `<span class="tag tag-category">${escapeHtml(CATEGORY_LABEL[entry.category] ?? entry.category)}</span>`,
    ...entry.capabilities.map((cap) => `<span class="tag">${escapeHtml(cap)}</span>`),
    ...entry.platforms.map((platform) => `<span class="tag tag-platform">${escapeHtml(platform)}</span>`),
  ].join('')

  const verified = entry.verified ? '<span class="tag tag-verified">已审核</span>' : ''
  const description = entry.description
    ? `<p class="desc">${escapeHtml(entry.description)}</p>`
    : '<p class="desc desc-empty">作者没写简介</p>'

  return `<article class="card">
  <header class="card-head">
    <h2>${escapeHtml(entry.displayName)}</h2>
    <code class="id">${escapeHtml(entry.id)}</code>
  </header>
  ${description}
  <div class="tags">${tags}${verified}</div>
  <footer class="card-foot">
    <span class="version">v${escapeHtml(entry.version)}</span>
    <a class="download" href="${escapeHtml(entry.artifact.url)}">下载 ${escapeHtml(String(entry.artifact.size))} 字节</a>
  </footer>
</article>`
}

export function renderLanding(index: MarketIndex): string {
  const generated = escapeHtml(index.generatedAt)
  const cards = index.entries.map(renderCard).join('\n')
  const empty =
    index.entries.length === 0
      ? '<p class="empty">这一版还没有收录任何插件。</p>'
      : ''

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AuraBot 插件市场</title>
<link rel="icon" href="data:,">
<style>
:root {
  --bg: #fff7fa;
  --fg: #2a2430;
  --muted: #7d7386;
  --card: #ffffff;
  --line: #f2d7e2;
  --accent: #ff6f9c;
  --accent-soft: #ffe6ee;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #17141c;
    --fg: #f3eef6;
    --muted: #a79fb2;
    --card: #201c27;
    --line: #332c3d;
    --accent: #ff8fb2;
    --accent-soft: #2c2230;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 40px 20px 64px;
  background: var(--bg);
  color: var(--fg);
  font: 15px/1.6 system-ui, -apple-system, 'Segoe UI', 'Noto Sans SC', sans-serif;
}
.wrap { max-width: 1080px; margin: 0 auto; }
header.top { margin-bottom: 28px; }
h1 { margin: 0 0 6px; font-size: 26px; letter-spacing: .02em; }
h1 span { color: var(--accent); }
.meta { color: var(--muted); font-size: 13px; }
.meta a { color: var(--accent); text-decoration: none; }
.meta a:hover { text-decoration: underline; }
.grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}
.card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.card-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.card-head h2 { margin: 0; font-size: 17px; }
.id { font-size: 12px; color: var(--muted); }
.desc { margin: 0; color: var(--muted); font-size: 13.5px; }
.desc-empty { font-style: italic; opacity: .7; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag {
  font-size: 11.5px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
}
.tag-category { background: var(--accent); color: #fff; }
.tag-verified { background: transparent; border: 1px solid var(--line); color: var(--muted); }
.card-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px dashed var(--line);
  padding-top: 10px;
  font-size: 12.5px;
}
.version { color: var(--muted); }
.download { color: var(--accent); text-decoration: none; }
.download:hover { text-decoration: underline; }
.empty { color: var(--muted); }
footer.bottom { margin-top: 36px; color: var(--muted); font-size: 12.5px; }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <h1>AuraBot <span>插件市场</span></h1>
    <p class="meta">
      收录 ${index.entries.length} 个插件 · 生成于 ${generated}<br>
      给宿主读的索引：<a href="./market.json">market.json</a> ·
      构建报告：<a href="./report.md">report.md</a>
    </p>
  </header>
  ${empty}
  <main class="grid">
${cards}
  </main>
  <footer class="bottom">
    想要收录自己的插件：往仓库的 <code>registry.jsonl</code> 提一个 PR，一行一个 <code>package.json</code> 链接。
  </footer>
</div>
</body>
</html>
`
}
