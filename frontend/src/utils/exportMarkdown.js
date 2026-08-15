function asText(value, fallback = '') {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function slugify(value) {
  return asText(value, 'superbrowser')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'superbrowser'
}

function normalizeSource(source, fallbackTitle) {
  if (!source) return null

  if (typeof source === 'string') {
    return { title: source, url: source }
  }

  const url = asText(source.url || source.link || source.hn_link || source.permalink)
  const title = asText(source.title || source.name || source.description, fallbackTitle)

  if (!url && !title) return null

  return { title: title || url, url }
}

function formatSources(sources = []) {
  const normalizedSources = sources
    .map((source, index) => normalizeSource(source, `Source ${index + 1}`))
    .filter(Boolean)

  if (!normalizedSources.length) return 'No sources available.'

  return normalizedSources
    .map((source, index) => {
      if (!source.url) return `${index + 1}. ${source.title}`
      return `${index + 1}. [${source.title}](${source.url})`
    })
    .join('\n')
}

function collectCommunitySources(results = {}) {
  return [
    ...(results.stack_results || []).map(item => ({
      title: `Stack Overflow: ${asText(item.title, 'Untitled')}`,
      url: item.link || item.url,
    })),
    ...(results.hn_results || []).map(item => ({
      title: `Hacker News: ${asText(item.title, 'Untitled')}`,
      url: item.hn_link || item.url,
    })),
    ...(results.devto_results || []).map(item => ({
      title: `Dev.to: ${asText(item.title, 'Untitled')}`,
      url: item.url,
    })),
    ...(results.reddit_results || []).map(item => ({
      title: `Reddit: ${asText(item.title, 'Untitled')}`,
      url: item.url,
    })),
  ]
}

export function hasMarkdownExportContent(mode, results) {
  if (!results) return false
  if (mode === 'ai') return Boolean(asText(results.answer))
  if (mode === 'community') return Boolean(asText(results.insights) || collectCommunitySources(results).length)
  return false
}

export function buildMarkdownExport({ mode, query = '', results = {}, createdAt = new Date() }) {
  const exportedAt = createdAt.toISOString()
  const modeLabel = mode === 'community' ? 'Review' : 'AI'
  const safeQuery = asText(query, 'Untitled query')
  const sections = [
    `# SuperBrowser ${modeLabel} Export`,
    '',
    `- Query: ${safeQuery || 'Untitled query'}`,
    `- Mode: ${modeLabel}`,
    `- Exported: ${exportedAt}`,
    '',
  ]

  if (mode === 'ai') {
    sections.push('## Answer', '', asText(results.answer, 'No answer available.'), '')

    const sources = results.sources || results.source_links || results.citations || []
    sections.push('## Sources', '', formatSources(sources), '')
  }

  if (mode === 'community') {
    sections.push('## Review Summary', '', asText(results.insights, 'No review summary available.'), '')
    sections.push('## Sources', '', formatSources(collectCommunitySources(results)), '')
  }

  return sections.join('\n')
}

export function getMarkdownExportFilename(mode, query = '', date = new Date()) {
  const datePart = date.toISOString().slice(0, 10)
  return `superbrowser-${slugify(query || mode || 'export')}-${datePart}.md`
}

export function downloadMarkdownExport({ mode, query, results }) {
  const createdAt = new Date()
  const markdown = buildMarkdownExport({ mode, query, results, createdAt })
  const filename = getMarkdownExportFilename(mode, query, createdAt)
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
