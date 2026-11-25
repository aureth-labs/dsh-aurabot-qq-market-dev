import type { BuildResult, Failure } from './build.js'
import type { MarketEntry } from './types.js'

/**
 * 给 GitHub Pages 根路径生成插件市场的前端页。
 *
 * 三件产出里这个是给人看的那个；`market.json` 给宿主，`report.md` 给排查。
 * 配色直接抄 VitePress 默认主题的变量（indigo 品牌色），后期塞进文档站里不会打架。
 *
 * 卡片全部服务端渲染：没 JS 也能看到全部插件，JS 只负责翻页、列数和右下角菜单。
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

/** 20018 → 19.6 KB。卡片上只留一位小数，太精确没意义。 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function renderCard(entry: MarketEntry): string {
  const categoryLabel = CATEGORY_LABEL[entry.category] ?? entry.category
  const badges = [
    `<span class="pill pill-brand">${escapeHtml(categoryLabel)}</span>`,
    ...entry.capabilities.map((cap) => `<span class="pill">${escapeHtml(cap)}</span>`),
    ...entry.platforms.map((platform) => `<span class="pill">${escapeHtml(platform)}</span>`),
  ]
  if (entry.verified) badges.push('<span class="pill pill-ok">已审核</span>')

  const description = entry.description
    ? `<p class="desc">${escapeHtml(entry.description)}</p>`
    : '<p class="desc desc-empty">作者没写简介</p>'

  return `<article class="card" data-name="${escapeHtml(
    `${entry.displayName} ${entry.id} ${entry.description}`.toLowerCase(),
  )}">
  <div class="card-head">
    <span class="badge" aria-hidden="true">${escapeHtml(categoryLabel.slice(0, 1))}</span>
    <div class="card-title">
      <h2>${escapeHtml(entry.displayName)}</h2>
      <code class="ident">${escapeHtml(entry.id)}</code>
    </div>
  </div>
  ${description}
  <div class="pills">${badges.join('')}</div>
  <div class="card-foot">
    <span class="version">v${escapeHtml(entry.version)}</span>
    <details class="menu">
      <summary aria-label="更多操作" title="更多操作">···</summary>
      <div class="menu-pop">
        <a href="${escapeHtml(entry.source)}" target="_blank" rel="noreferrer noopener">在 GitHub 查看 package.json</a>
        <a href="${escapeHtml(entry.artifact.url)}" download>下载 ZIP<span class="menu-size">${escapeHtml(
          formatSize(entry.artifact.size),
        )}</span></a>
      </div>
    </details>
  </div>
</article>`
}

function renderFailureRows(failures: Failure[]): string {
  return failures
    .map(
      (failure) => `<tr>
  <td><code>${escapeHtml(failure.id ?? '—')}</code></td>
  <td class="why">${escapeHtml(failure.reason)}</td>
  <td class="src"><a href="${escapeHtml(failure.source)}" target="_blank" rel="noreferrer noopener">来源</a></td>
</tr>`,
    )
    .join('\n')
}

function renderReport(result: BuildResult): string {
  const { index, failures, renamed } = result
  const blocks: string[] = []

  if (failures.length) {
    blocks.push(`<details class="report-block">
  <summary>跳过 ${failures.length} 个（清单不合法）</summary>
  <table class="report-table">
    <thead><tr><th>id</th><th>原因</th><th></th></tr></thead>
    <tbody>
${renderFailureRows(failures)}
    </tbody>
  </table>
</details>`)
  }

  if (renamed.length) {
    const rows = renamed
      .map((item) => `<tr><td><code>${escapeHtml(item.from)}</code></td><td><code>${escapeHtml(item.to)}</code></td></tr>`)
      .join('\n')
    blocks.push(`<details class="report-block">
  <summary>改名 ${renamed.length} 个（id 冲突）</summary>
  <table class="report-table">
    <thead><tr><th>原 id</th><th>改为</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
</details>`)
  }

  if (!blocks.length) {
    blocks.push('<p class="report-clean">这一版没有跳过也没有改名，清单全是干净的。</p>')
  }

  return `<section class="report">
  <div class="report-head">
    <h2>构建报告</h2>
    <span class="report-counts">收录 ${index.entries.length} · 跳过 ${failures.length} · 改名 ${renamed.length}</span>
  </div>
  ${blocks.join('\n')}
  <p class="report-link"><a href="./report.md">完整报告 report.md</a></p>
</section>`
}

const STYLE = `
:root {
  color-scheme: light dark;
  --vp-c-bg: #ffffff;
  --vp-c-bg-alt: #f6f6f7;
  --vp-c-bg-elv: #ffffff;
  --vp-c-bg-soft: #f6f6f7;
  --vp-c-text-1: #3c3c43;
  --vp-c-text-2: #67676c;
  --vp-c-text-3: #929295;
  --vp-c-divider: #e2e2e3;
  --vp-c-border: #c2c2c4;
  --vp-c-brand-1: #3451b2;
  --vp-c-brand-2: #3a5ccc;
  --vp-c-brand-3: #5672cd;
  --vp-c-brand-soft: rgba(100, 108, 255, 0.14);
  --vp-c-default-soft: rgba(142, 150, 170, 0.14);
  --vp-c-success-1: #18794e;
  --vp-c-success-soft: rgba(16, 185, 129, 0.14);
  --vp-shadow-2: 0 3px 12px rgba(0, 0, 0, 0.07), 0 1px 4px rgba(0, 0, 0, 0.07);
  --vp-shadow-3: 0 12px 32px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.08);
}
@media (prefers-color-scheme: dark) {
  :root {
    --vp-c-bg: #1b1b1f;
    --vp-c-bg-alt: #161618;
    --vp-c-bg-elv: #202127;
    --vp-c-bg-soft: #202127;
    --vp-c-text-1: #dfdfd6;
    --vp-c-text-2: #98989f;
    --vp-c-text-3: #6a6a71;
    --vp-c-divider: #2e2e32;
    --vp-c-border: #3c3f44;
    --vp-c-brand-1: #a8b1ff;
    --vp-c-brand-2: #5c73e7;
    --vp-c-brand-3: #3e63dd;
    --vp-c-brand-soft: rgba(100, 108, 255, 0.16);
    --vp-c-default-soft: rgba(101, 117, 133, 0.16);
    --vp-c-success-1: #3dd68c;
    --vp-c-success-soft: rgba(16, 185, 129, 0.16);
  }
}
html.dark {
  --vp-c-bg: #1b1b1f;
  --vp-c-bg-alt: #161618;
  --vp-c-bg-elv: #202127;
  --vp-c-bg-soft: #202127;
  --vp-c-text-1: #dfdfd6;
  --vp-c-text-2: #98989f;
  --vp-c-text-3: #6a6a71;
  --vp-c-divider: #2e2e32;
  --vp-c-border: #3c3f44;
  --vp-c-brand-1: #a8b1ff;
  --vp-c-brand-2: #5c73e7;
  --vp-c-brand-3: #3e63dd;
  --vp-c-brand-soft: rgba(100, 108, 255, 0.16);
  --vp-c-default-soft: rgba(101, 117, 133, 0.16);
  --vp-c-success-1: #3dd68c;
  --vp-c-success-soft: rgba(16, 185, 129, 0.16);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 32px 24px 72px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font: 15px/1.6 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'Noto Sans SC', sans-serif;
  -webkit-font-smoothing: antialiased;
}
.wrap { max-width: 1200px; margin: 0 auto; }
a { color: var(--vp-c-brand-1); text-decoration: none; }
a:hover { color: var(--vp-c-brand-2); text-decoration: underline; }
code { font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace; }

.top { margin-bottom: 22px; }
.top h1 { margin: 0 0 8px; font-size: 28px; font-weight: 700; letter-spacing: -0.01em; }
.top h1 em { font-style: normal; color: var(--vp-c-brand-1); }
.meta { margin: 0; color: var(--vp-c-text-2); font-size: 13.5px; }
.meta .dot { color: var(--vp-c-text-3); margin: 0 6px; }

.toolbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  padding: 10px 0;
  margin-bottom: 16px;
  background: var(--vp-c-bg);
  border-bottom: 1px solid var(--vp-c-divider);
}
.field { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--vp-c-text-2); }
.field select {
  font: inherit;
  font-size: 13px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 4px 8px;
}
.toolbar .spacer { flex: 1 1 auto; }

.pager { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.pager button {
  font: inherit;
  font-size: 13px;
  min-width: 30px;
  height: 30px;
  padding: 0 9px;
  color: var(--vp-c-text-2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
}
.pager button:hover:not(:disabled) { background: var(--vp-c-default-soft); color: var(--vp-c-text-1); }
.pager button:disabled { opacity: 0.35; cursor: default; }
.pager button.is-active {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  border-color: transparent;
  font-weight: 600;
}
.pager .gap { color: var(--vp-c-text-3); padding: 0 2px; font-size: 13px; }
.pager-bottom { justify-content: center; margin-top: 26px; }

.grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr));
}
.card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px 14px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  transition: border-color 0.2s;
}
.card:hover { border-color: var(--vp-c-border); }
.card[hidden] { display: none; }
.card-head { display: flex; gap: 10px; align-items: flex-start; }
.badge {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 15px;
  font-weight: 600;
}
.card-title { min-width: 0; }
.card-title h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ident { font-size: 11.5px; color: var(--vp-c-text-3); }
.desc {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.desc-empty { font-style: italic; opacity: 0.7; }
.pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; }
.pill {
  font-size: 11.5px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
  white-space: nowrap;
}
.pill-brand { background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); }
.pill-ok { background: var(--vp-c-success-soft); color: var(--vp-c-success-1); }
.card-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 10px;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 12.5px;
  color: var(--vp-c-text-3);
}

.menu { position: relative; }
.menu > summary {
  list-style: none;
  cursor: pointer;
  width: 28px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  color: var(--vp-c-text-2);
  font-size: 14px;
  letter-spacing: 1px;
  line-height: 1;
  user-select: none;
}
.menu > summary::-webkit-details-marker { display: none; }
.menu > summary:hover { background: var(--vp-c-bg-alt); color: var(--vp-c-text-1); }
.menu[open] > summary { background: var(--vp-c-default-soft); color: var(--vp-c-text-1); }
.menu-pop {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  z-index: 30;
  min-width: 220px;
  padding: 6px;
  background: var(--vp-c-bg-elv);
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  box-shadow: var(--vp-shadow-3);
}
.menu-pop a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 10px;
  border-radius: 6px;
  color: var(--vp-c-text-1);
  font-size: 13px;
  white-space: nowrap;
}
.menu-pop a:hover { background: var(--vp-c-default-soft); text-decoration: none; }
.menu-size { color: var(--vp-c-text-3); font-size: 12px; }

.report { margin-top: 44px; padding-top: 22px; border-top: 1px solid var(--vp-c-divider); }
.report-head { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.report-head h2 { margin: 0; font-size: 17px; }
.report-counts { font-size: 13px; color: var(--vp-c-text-2); }
.report-block { margin-top: 12px; }
.report-block > summary {
  cursor: pointer;
  font-size: 13.5px;
  color: var(--vp-c-text-2);
  padding: 4px 0;
}
.report-block > summary:hover { color: var(--vp-c-text-1); }
.report-table {
  width: 100%;
  margin-top: 8px;
  border-collapse: collapse;
  font-size: 13px;
}
.report-table th, .report-table td {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px solid var(--vp-c-divider);
  vertical-align: top;
}
.report-table th { color: var(--vp-c-text-3); font-weight: 500; font-size: 12px; }
.report-table td.why { color: var(--vp-c-text-2); }
.report-table td.src { text-align: right; white-space: nowrap; }
.report-clean { margin: 12px 0 0; font-size: 13.5px; color: var(--vp-c-text-2); }
.report-link { margin: 14px 0 0; font-size: 13px; }

.empty { color: var(--vp-c-text-2); font-size: 14px; }
.foot { margin-top: 40px; font-size: 12.5px; color: var(--vp-c-text-3); }
.foot code { font-size: 12px; }

.embed body, body.embed { padding: 16px 14px 40px; }
body.embed .top h1 { font-size: 20px; }
body.embed .report { margin-top: 28px; }

@media (max-width: 900px) {
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 620px) {
  body { padding: 20px 14px 56px; }
  .grid { grid-template-columns: minmax(0, 1fr); }
  .toolbar { gap: 10px; }
}
`

const SCRIPT = `
(function () {
  var grid = document.getElementById('grid');
  if (!grid) return;

  var cards = Array.prototype.slice.call(grid.children);
  var colsSel = document.getElementById('cols');
  var sizeSel = document.getElementById('size');
  var pagers = [document.getElementById('pager-top'), document.getElementById('pager-bottom')];
  var total = cards.length;
  var page = 1;

  if (window.self !== window.top || /(^|[?&])embed(=|&|$)/.test(location.search)) {
    document.body.classList.add('embed');
  }

  function size() { return parseInt(sizeSel.value, 10) || 12; }
  function pageCount() { return Math.max(1, Math.ceil(total / size())); }

  function label(cur, count) {
    var out = [];
    if (count <= 7) {
      for (var i = 1; i <= count; i++) out.push(i);
      return out;
    }
    out.push(1);
    var from = Math.max(2, cur - 1);
    var to = Math.min(count - 1, cur + 1);
    if (from > 2) out.push(null);
    for (var j = from; j <= to; j++) out.push(j);
    if (to < count - 1) out.push(null);
    out.push(count);
    return out;
  }

  function button(text, cls, disabled, onClick) {
    var el = document.createElement('button');
    el.type = 'button';
    el.textContent = text;
    if (cls) el.className = cls;
    if (disabled) el.disabled = true;
    else el.addEventListener('click', onClick);
    return el;
  }

  function paint(pager) {
    if (!pager) return;
    pager.textContent = '';
    var count = pageCount();
    pager.appendChild(button('上一页', null, page <= 1, function () { go(page - 1); }));
    label(page, count).forEach(function (item) {
      if (item === null) {
        var gap = document.createElement('span');
        gap.className = 'gap';
        gap.textContent = '…';
        pager.appendChild(gap);
        return;
      }
      var el = button(String(item), item === page ? 'is-active' : null, false, function () { go(item); });
      if (item === page) el.setAttribute('aria-current', 'page');
      pager.appendChild(el);
    });
    pager.appendChild(button('下一页', null, page >= count, function () { go(page + 1); }));
  }

  function apply() {
    var from = (page - 1) * size();
    var to = from + size();
    for (var i = 0; i < total; i++) {
      if (i >= from && i < to) cards[i].removeAttribute('hidden');
      else cards[i].setAttribute('hidden', '');
    }
    pagers.forEach(paint);
  }

  function go(target) {
    page = Math.min(Math.max(1, target), pageCount());
    apply();
    grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (colsSel) {
    grid.style.setProperty('--cols', colsSel.value);
    colsSel.addEventListener('change', function () {
      grid.style.setProperty('--cols', colsSel.value);
    });
  }
  if (sizeSel) {
    sizeSel.addEventListener('change', function () {
      page = 1;
      apply();
    });
  }

  // 一次只开一个菜单；点空白处或按 Esc 收起。
  var menus = Array.prototype.slice.call(document.querySelectorAll('details.menu'));
  menus.forEach(function (menu) {
    menu.addEventListener('toggle', function () {
      if (!menu.open) return;
      menus.forEach(function (other) {
        if (other !== menu) other.open = false;
      });
    });
  });
  document.addEventListener('click', function (event) {
    menus.forEach(function (menu) {
      if (menu.open && !menu.contains(event.target)) menu.open = false;
    });
  });
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    menus.forEach(function (menu) { menu.open = false; });
  });

  pagers.forEach(function (pager) {
    if (pager) pager.removeAttribute('hidden');
  });
  apply();
})();
`

export function renderLanding(result: BuildResult): string {
  const { index } = result
  const cards = index.entries.map(renderCard).join('\n')
  const empty = index.entries.length === 0 ? '<p class="empty">这一版还没有收录任何插件。</p>' : ''

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>AuraBot 插件市场</title>
<link rel="icon" href="data:,">
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <h1>AuraBot <em>插件市场</em></h1>
    <p class="meta">
      收录 ${index.entries.length} 个插件<span class="dot">·</span>生成于 ${escapeHtml(index.generatedAt)}<span class="dot">·</span>
      <a href="./market.json">market.json</a><span class="dot">·</span><a href="./report.md">report.md</a>
    </p>
  </header>

  <div class="toolbar">
    <label class="field">每行
      <select id="cols" aria-label="每行显示多少个插件">
        <option value="2">2 个</option>
        <option value="3" selected>3 个</option>
        <option value="4">4 个</option>
        <option value="6">6 个</option>
      </select>
    </label>
    <label class="field">每页
      <select id="size" aria-label="每页显示多少个插件">
        <option value="6">6 个</option>
        <option value="12" selected>12 个</option>
        <option value="24">24 个</option>
        <option value="48">48 个</option>
      </select>
    </label>
    <span class="spacer"></span>
    <nav class="pager" id="pager-top" aria-label="翻页" hidden></nav>
  </div>

  ${empty}
  <main class="grid" id="grid">
${cards}
  </main>

  <nav class="pager pager-bottom" id="pager-bottom" aria-label="翻页" hidden></nav>

  ${renderReport(result)}

  <p class="foot">想收录自己的插件：往仓库的 <code>registry.jsonl</code> 提一个 PR，一行一个 <code>package.json</code> 链接。</p>
</div>
<script>${SCRIPT}</script>
</body>
</html>
`
}
