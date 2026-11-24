import type { BuildResult } from './build.js'

const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

/** 给 CI 日志旁边留一份可点开看的人话报告。 */
export function renderReport(result: BuildResult): string {
  const { index, failures, renamed } = result
  const lines = [
    '# 插件市场构建报告',
    '',
    `- 生成时间：${index.generatedAt}`,
    `- 收录成功：${index.entries.length}`,
    `- 跳过（清单不合法）：${failures.length}`,
    `- 重命名（id 冲突）：${renamed.length}`,
    '',
  ]

  if (failures.length) {
    lines.push('## 跳过', '', '| 来源 | id | 原因 |', '| --- | --- | --- |')
    for (const failure of failures) {
      lines.push(`| ${cell(failure.source)} | ${cell(failure.id ?? '')} | ${cell(failure.reason)} |`)
    }
    lines.push('')
  }

  if (renamed.length) {
    lines.push('## 重命名', '', '| 原 id | 改为 |', '| --- | --- |')
    for (const item of renamed) lines.push(`| ${cell(item.from)} | ${cell(item.to)} |`)
    lines.push('')
  }

  lines.push('## 已收录', '', '| id | 版本 | 分类 | 审核 |', '| --- | --- | --- | --- |')
  for (const entry of index.entries) {
    const mark = entry.revoked ? '已撤回' : entry.verified ? '已审核' : '未审核'
    lines.push(`| ${cell(entry.id)} | ${cell(entry.version)} | ${entry.category} | ${mark} |`)
  }
  lines.push('')
  return lines.join('\n')
}

