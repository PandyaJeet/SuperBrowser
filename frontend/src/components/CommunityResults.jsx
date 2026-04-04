import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const tooltipStyle = {
  background: '#ffffff',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  fontSize: '13px',
  color: 'var(--text-primary)'
}

export default function CommunityResults({ results, onOpenLink }) {
  const insights = results?.insights || ""
  const stack_results = results?.stack_results || []
  const reddit_results = results?.reddit_results || []
  const hn_results = results?.hn_results || []
  const devto_results = results?.devto_results || []

  // Soft, Google-like light theme colors for charts
  const colors = { so: "#3279f9", hn: "#f26522", dev: "#242526", reddit: "#ff4500" }

  const coverageData = [
    { platform: "StackOverflow", count: stack_results.length, fill: colors.so },
    { platform: "Hacker News", count: hn_results.length, fill: colors.hn },
    { platform: "Dev.to", count: devto_results.length, fill: colors.dev },
    { platform: "Reddit", count: reddit_results.length, fill: colors.reddit },
  ].filter(d => d.count > 0)

  const engagementData = [
    { name: "StackOverflow", value: stack_results.reduce((s, r) => s + (r.score || 0), 0), color: colors.so },
    { name: "Hacker News", value: hn_results.reduce((s, r) => s + (r.score || 0), 0), color: colors.hn },
    { name: "Dev.to", value: devto_results.reduce((s, r) => s + (r.reactions || 0), 0), color: colors.dev },
    { name: "Reddit", value: reddit_results.reduce((s, r) => s + (r.post_score || 0), 0), color: colors.reddit },
  ].filter(d => d.value > 0)

  const allResults = [
    ...stack_results.map(r => ({ title: (r.title || "").slice(0, 30) + '...', score: r.score || 0, platform: 'SO', color: colors.so })),
    ...hn_results.map(r => ({ title: (r.title || "").slice(0, 30) + '...', score: r.score || 0, platform: 'HN', color: colors.hn })),
    ...devto_results.map(r => ({ title: (r.title || "").slice(0, 30) + '...', score: r.reactions || 0, platform: 'DEV', color: colors.dev })),
    ...reddit_results.map(r => ({ title: (r.title || "").slice(0, 30) + '...', score: r.post_score || 0, platform: 'R/', color: colors.reddit })),
  ].sort((a, b) => b.score - a.score).slice(0, 6)

  const hasAnyResults = coverageData.length > 0

  const platformSections = [
    { key: 'stack', title: 'Stack Overflow', icon: '📚', data: stack_results,
      getLink: i => i.link || i.url, getTitle: i => i.title, getMeta: i => i.score !== undefined ? [{ label: 'Score', val: i.score }] : [] },
    { key: 'hn', title: 'Hacker News', icon: '🔶', data: hn_results,
      getLink: i => i.hn_link || i.url, getTitle: i => i.title, getMeta: i => [{ label: 'Score', val: i.score }, { label: 'Comments', val: i.num_comments }] },
    { key: 'devto', title: 'Dev.to', icon: '📝', data: devto_results,
      getLink: i => i.url, getTitle: i => i.title, getDesc: i => i.description,
      getMeta: i => [{ label: '❤️', val: i.reactions }, { label: '💬', val: i.comments_count }, { label: '⏱️', val: `${i.reading_time} min` }] },
    { key: 'reddit', title: 'Reddit', icon: '🔴', data: reddit_results,
      getLink: i => i.url, getTitle: i => i.title, getSub: i => `r/${i.subreddit}`,
      getMeta: i => [{ label: 'Score', val: i.post_score }, { label: 'Comments', val: i.num_comments }] },
  ]

  return (
    <div className="max-w-4xl space-y-12 animate-fade-in-up">
      {/* Charts */}
      {hasAnyResults && (
        <div className="pt-2">
          <h3 className="text-xl font-medium mb-6 text-[var(--text-primary)]">Data Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-[var(--border-color)] rounded-2xl p-5 bg-white">
              <p className="text-[13px] font-medium mb-4 text-[var(--text-secondary)]">Results per platform</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={coverageData} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#5f6368', fontSize: 11 }} axisLine={{stroke: '#e0e0e0'}} tickLine={false} />
                  <YAxis dataKey="platform" type="category" tick={{ fill: '#5f6368', fontSize: 11 }} width={80} axisLine={{stroke: '#e0e0e0'}} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {coverageData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="border border-[var(--border-color)] rounded-2xl p-5 bg-white">
              <p className="text-[13px] font-medium mb-4 text-[var(--text-secondary)]">Engagement</p>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={engagementData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value">
                    {engagementData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="border border-[var(--border-color)] rounded-2xl p-5 bg-white">
              <p className="text-[13px] font-medium mb-4 text-[var(--text-secondary)]">Top 6 by score</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={allResults}>
                  <XAxis dataKey="title" tick={{ fill: '#5f6368', fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={50} axisLine={{stroke: '#e0e0e0'}} tickLine={false} />
                  <YAxis tick={{ fill: '#5f6368', fontSize: 11 }} axisLine={{stroke: '#e0e0e0'}} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, n, p) => [v, `Score (${p.payload.platform})`]} />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {allResults.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* AI Insights */}
      {insights && (
        <div className="p-8 bg-blue-50/50 border border-blue-100 rounded-3xl mt-12">
          <h3 className="text-xl font-medium mb-6 flex items-center gap-2 text-[var(--text-primary)]">
            <span>💡</span> Community Insights
          </h3>
          <div className="whitespace-pre-wrap leading-relaxed text-[16px] text-[var(--text-primary)]">{insights}</div>
        </div>
      )}

      {/* Platform Cards */}
      <div className="space-y-10 mt-12">
        {platformSections.map(sec => sec.data.length > 0 && (
          <div key={sec.key} className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2 text-[var(--text-primary)] mb-4 pb-2 border-b border-[var(--border-color)]">
              <span>{sec.icon}</span> {sec.title}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {sec.data.map((item, idx) => (
                <div key={idx} className="p-5 border border-[var(--border-color)] rounded-xl hover:border-blue-400 hover:shadow-sm transition-all bg-white group">
                  <a href={sec.getLink(item)}
                    onClick={(e) => { e.preventDefault(); onOpenLink?.(sec.getLink(item), sec.getTitle(item) || sec.title) }}
                    className="font-medium text-[16px] block mb-2 text-[var(--text-primary)] group-hover:text-blue-600 transition-colors line-clamp-2">
                    {sec.getTitle(item)}
                  </a>
                  {sec.getDesc?.(item) && <p className="text-[14px] mb-3 text-[var(--text-secondary)] line-clamp-2">{sec.getDesc(item)}</p>}
                  {sec.getSub?.(item) && <p className="text-[13px] mb-2 font-medium text-red-600">{sec.getSub(item)}</p>}
                  {sec.getMeta(item).length > 0 && (
                    <div className="flex items-center gap-4 text-[13px] text-[var(--text-tertiary)] pt-2 mt-auto">
                      {sec.getMeta(item).map((m, mi) => (
                        <span key={mi} className="bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{m.label}: {m.val}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {!hasAnyResults && !insights && <p className="text-[var(--text-secondary)] py-10">No community results found.</p>}
    </div>
  )
}
