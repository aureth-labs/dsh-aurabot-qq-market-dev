import type { BuildResult } from './build.js'

const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

/** 给 CI 日志旁边留一份可点开看的人话报告。 */
export function renderReport(result: BuildResult): string {
  const { index, failures } = result
  const lines = [
    '# 插件市场构建报告',
    '',
    `- 生成时间：${index.generatedAt}`,
    `- 收录成功：${index.entries.length}`,
    `- 构建失败：${failures.length}`,
    '',
  ]

  if (failures.length) {
    lines.push('## 失败', '', '| 来源 | id | 原因 |', '| --- | --- | --- |')
    for (const failure of failures) {
      lines.push(`| ${cell(failure.source)} | ${cell(failure.id ?? '')} | ${cell(failure.reason)} |`)
    }
    lines.push('')
  }

  lines.push('## 已收录', '', '| id | 版本 | 分类 | 审核 |', '| --- | --- | --- | --- |')
  for (const entry of index.entries) {
    lines.push(`| ${cell(entry.id)} | ${cell(entry.version)} | ${entry.category} | ${entry.verified ? '已审核' : '未审核'} |`)
  }
  lines.push('')
  return lines.join('\n')
}

