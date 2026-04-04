import { useState, useCallback, useEffect, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { useContextManager } from './useContextManager'
import { getApiBase } from './config/apiBase'

const PERSONAS = [
  { id: "default",    label: "Default",     desc: "Raw Groq"            },
  { id: "chatgpt",    label: "ChatGPT",      desc: "Concise & practical" },
  { id: "gemini",     label: "Gemini",       desc: "Analytical & broad"  },
  { id: "perplexity", label: "Perplexity",   desc: "Factual & cited"     },
  { id: "claude",     label: "Claude",       desc: "Nuanced & careful"   },
]

const API_BASE = getApiBase()

// Helper to create a new tab object
function createNewTab(sessionId = null) {
  return {
    id: crypto.randomUUID(),
    title: "New Tab",
    query: "",
    activeMode: "seo",
    results: null,
    loading: false,
    error: null,
    sessionId: sessionId || crypto.randomUUID(),
    history: [],
    browserUrl: "",
    browserTitle: ""
  }
}

function App() {
  const [appSessionId] = useState(() => crypto.randomUUID())
  const [sessionStartedAt] = useState(() => new Date().toISOString())
  const [sessionStatus, setSessionStatus] = useState("starting")
  const [tabs, setTabs] = useState(() => [createNewTab(appSessionId)])
  const [activeTabId, setActiveTabId] = useState(tabs[0].id)
  const [showHistory, setShowHistory] = useState(false)
  const [persona, setPersona] = useState("default")
  const [showContextInfo, setShowContextInfo] = useState(false)
  const [backendStatus, setBackendStatus] = useState(null)

  // Initialize context manager
  const contextManager = useContextManager()

  const activeTab = tabs.find(t => t.id === activeTabId)
  const isBrowserTab = Boolean(activeTab?.browserUrl)

  useEffect(() => {
    if (!window.superBrowserDesktop?.isElectron || !window.superBrowserDesktop?.backend?.getStatus) return
    window.superBrowserDesktop.backend.getStatus().then(setBackendStatus).catch(() => {})
  }, [])

  const {
    startSession: startContextSession,
    stopSession: stopContextSession
  } = contextManager

  useEffect(() => {
    startContextSession(appSessionId)
      .then(() => setSessionStatus("active"))
      .catch(() => setSessionStatus("error"))

    const handleStopSession = () => {
      stopContextSession(appSessionId, { keepalive: true }).catch(() => {})
      setSessionStatus("stopped")
    }

    window.addEventListener("beforeunload", handleStopSession)
    return () => {
      window.removeEventListener("beforeunload", handleStopSession)
      handleStopSession()
    }
  }, [appSessionId, startContextSession, stopContextSession])

  const updateTab = useCallback((tabId, updates) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...updates } : t))
  }, [])

  const performSearch = useCallback((tabId, tabData, searchPersona = "default") => {
    const endpoints = {
      seo: `/api/search/seo`,
      ai: `/api/search/ai`,
      community: `/api/search/community`
    }

    // For AI mode, use contextual endpoint if we have context
    if (tabData.activeMode === 'ai') {
      const context = contextManager.getAIContext(tabId)
      const hasContext =
        context.queries.length > 0 ||
        context.results.length > 0 ||
        context.visited_pages.length > 0
      
      if (hasContext) {
        // Use POST endpoint with context
        fetch(`${API_BASE}/api/search/ai/contextual`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: tabData.query,
            persona: searchPersona,
            context: context
          })
        })
          .then(res => res.json())
          .then(data => {
            setTabs(prev => prev.map(t => t.id === tabId ? { ...t, results: data, loading: false } : t))
            // Track results in context
            contextManager.addResults(tabId, tabData.sessionId, data.results || [])
          })
          .catch(() => {
            setTabs(prev => prev.map(t => t.id === tabId ? { ...t, error: "Search failed. Please try again.", loading: false } : t))
          })
        return
      }
    }

    // Regular search (non-AI or AI without context)
    let url = `${API_BASE}${endpoints[tabData.activeMode]}?q=${encodeURIComponent(tabData.query)}&session_id=${tabData.sessionId}`
    if (tabData.activeMode === 'ai') {
      url += `&persona=${searchPersona}`
    }

    fetch(url)
      .then(res => res.json())
      .then(data => {
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, results: data, loading: false } : t))
        
        // Track results in context for future use
        if (data.results && Array.isArray(data.results)) {
          contextManager.addResults(tabId, tabData.sessionId, data.results)
        }
      })
      .catch(() => {
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, error: "Search failed. Please try again.", loading: false } : t))
      })
  }, [contextManager])

  const handleSearch = useCallback((tabId, searchPersona = "default") => {
    setTabs(currentTabs => {
      const tab = currentTabs.find(t => t.id === tabId)
      if (!tab?.query.trim()) return currentTabs
      
      // Track query in context
      contextManager.addQuery(tabId, tab.sessionId, tab.query, tab.activeMode)
      
      // Trigger the async fetch with current tab data
      performSearch(tabId, tab, searchPersona)

      // Return updated tabs with loading state
      return currentTabs.map(t => {
        if (t.id !== tabId) return t
        return {
          ...t,
          loading: true,
          error: null,
          title: t.query.slice(0, 25),
          history: [...t.history, { query: t.query, mode: t.activeMode }].slice(-10)
        }
      })
    })
  }, [performSearch, contextManager])

  // Handle mode change - update mode and trigger search if there's an active query with results
  const handleModeChange = useCallback((mode) => {
    setTabs(currentTabs => {
      const tab = currentTabs.find(t => t.id === activeTabId)
      if (!tab) return currentTabs

      const shouldSearch = tab.query && tab.results
      const updatedTab = { ...tab, activeMode: mode }

      if (shouldSearch) {
        // Trigger search with new mode
        performSearch(activeTabId, updatedTab, persona)
        return currentTabs.map(t => {
          if (t.id !== activeTabId) return t
          return {
            ...updatedTab,
            loading: true,
            error: null,
            history: [...t.history, { query: t.query, mode }].slice(-10)
          }
        })
      }

      return currentTabs.map(t => t.id === activeTabId ? updatedTab : t)
    })
  }, [activeTabId, performSearch, persona])

  function handleAddTab() {
    const newTab = createNewTab(appSessionId)
    setTabs(prev => [...prev, newTab])
    setActiveTabId(newTab.id)
  }

  function handleCloseTab(tabId, e) {
    e.stopPropagation()
    if (tabs.length === 1) {
      // Reset the only tab instead of closing
      const resetTab = createNewTab(appSessionId)
      resetTab.id = tabs[0].id
      setTabs([resetTab])
      return
    }

    const tabIndex = tabs.findIndex(t => t.id === tabId)
    const newTabs = tabs.filter(t => t.id !== tabId)
    setTabs(newTabs)

    if (tabId === activeTabId) {
      // Switch to tab on the left, or first tab if closing first
      const newIndex = Math.max(0, tabIndex - 1)
      setActiveTabId(newTabs[newIndex].id)
    }
  }

  function handleHistoryClick(historyItem) {
    updateTab(activeTabId, { 
      query: historyItem.query, 
      activeMode: historyItem.mode 
    })
    setTimeout(() => handleSearch(activeTabId, persona), 0)
  }

  function handleSuggestedSearch(query) {
    updateTab(activeTabId, { query, browserUrl: "", browserTitle: "" })
  }

  function openInAppUrl(url, title = "Web Page") {
    if (!url) return
    const browserTab = createNewTab(appSessionId)
    browserTab.browserUrl = url
    browserTab.browserTitle = title
    browserTab.title = (title || "Web").slice(0, 25)
    browserTab.query = url
    setTabs(prev => [...prev, browserTab])
    setActiveTabId(browserTab.id)
    if (activeTab) {
      contextManager.addVisitedPage(activeTabId, activeTab.sessionId, url, title, `Visited: ${url}`)
    }
  }

  return (
    <div className="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
      {/* Tab Bar */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={setActiveTabId}
        onCloseTab={handleCloseTab}
        onAddTab={handleAddTab}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {!isBrowserTab && (
          <>
            {/* Address Bar */}
            <AddressBar
              query={activeTab?.query || ""}
              loading={activeTab?.loading || false}
              onQueryChange={(q) => updateTab(activeTabId, { query: q })}
              onSearch={() => handleSearch(activeTabId, persona)}
            />

            {/* Mode Selector */}
            <ModeSelector
              activeMode={activeTab?.activeMode || "seo"}
              onModeChange={handleModeChange}
            />

            {window.superBrowserDesktop?.isElectron && (
              <BackendStatusBanner status={backendStatus} />
            )}

            {/* Persona Selector (AI mode only) */}
            {activeTab?.activeMode === 'ai' && (
              <div className="flex justify-center items-center gap-4 pb-4 bg-gray-950">
                <select
                  value={persona}
                  onChange={e => setPersona(e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 
                             rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 
                             text-gray-700 dark:text-gray-200 cursor-pointer"
                >
                  {PERSONAS.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.label} — {p.desc}
                    </option>
                  ))}
                </select>
                
                {/* Context Indicator */}
                <ContextIndicator 
                  tabId={activeTabId}
                  contextManager={contextManager}
                  onToggleInfo={() => setShowContextInfo(!showContextInfo)}
                />
              </div>
            )}
          </>
        )}

        {/* Content Area with optional sidebar */}
        <div className="flex-1 flex relative min-h-0">
          <div className={`flex-1 min-h-0 ${isBrowserTab ? 'overflow-hidden p-0' : 'overflow-auto p-4'}`}>
            {activeTab?.error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-4 text-red-200">
                {activeTab.error}
              </div>
            )}

            {activeTab?.browserUrl ? (
              <BrowserPanel
                url={activeTab.browserUrl}
                title={activeTab.browserTitle}
                onPageVisit={(visitedUrl, visitedTitle) => {
                  if (!activeTab) return
                  contextManager.addVisitedPage(
                    activeTabId,
                    activeTab.sessionId,
                    visitedUrl,
                    visitedTitle || "Visited Page",
                    `Visited: ${visitedUrl}`
                  )
                }}
                onClose={() => updateTab(activeTabId, { browserUrl: "", browserTitle: "" })}
              />
            ) : !activeTab?.results && !activeTab?.query ? (
              <NewTabPage onSuggestedSearch={handleSuggestedSearch} />
            ) : (
              <ResultsPanel
                mode={activeTab?.activeMode}
                results={activeTab?.results}
                loading={activeTab?.loading}
                onOpenLink={openInAppUrl}
              />
            )}
          </div>

          {/* History Sidebar */}
          {!isBrowserTab && (
            <HistorySidebar
              show={showHistory}
              onToggle={() => setShowHistory(!showHistory)}
              history={activeTab?.history || []}
              onHistoryClick={handleHistoryClick}
            />
          )}
        </div>
      </div>

      <ContextWindow
        show={showContextInfo}
        onClose={() => setShowContextInfo(false)}
        tabId={activeTabId}
        sessionId={appSessionId}
        sessionStartedAt={sessionStartedAt}
        sessionStatus={sessionStatus}
        contextManager={contextManager}
      />
    </div>
  )
}

// Tab Bar Component
function TabBar({ tabs, activeTabId, onTabClick, onCloseTab, onAddTab }) {
  return (
    <div className="bg-gray-800 flex items-center overflow-x-auto scrollbar-hide md:flex hidden">
      <div className="flex items-center min-w-0 flex-1">
        {tabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 min-w-[120px] max-w-[200px] cursor-pointer border-r border-gray-700 group transition-colors ${
              tab.id === activeTabId
                ? 'bg-gray-950'
                : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            {/* Favicon circle */}
            <div className="w-4 h-4 rounded-full bg-indigo-500 flex-shrink-0" />
            {/* Title */}
            <span className="truncate text-sm flex-1">
              {tab.title.length > 20 ? tab.title.slice(0, 20) + '…' : tab.title}
            </span>
            {/* Close button */}
            <button
              onClick={(e) => onCloseTab(tab.id, e)}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {/* Add tab button */}
      <button
        onClick={onAddTab}
        className="px-4 py-2 hover:bg-gray-700 transition-colors text-xl"
        title="New Tab"
      >
        +
      </button>
    </div>
  )
}

// Address Bar Component
function AddressBar({ query, loading, onQueryChange, onSearch }) {
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      onSearch()
    }
  }

  return (
    <div className="p-4 bg-gray-950">
      <div className="flex items-center bg-gray-900 border border-gray-700 rounded-full px-4 py-2 max-w-4xl mx-auto">
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search anything..."
          className="flex-1 bg-transparent outline-none text-white placeholder-gray-500"
        />
        {loading ? (
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <button
            onClick={onSearch}
            className="text-indigo-500 hover:text-indigo-400 transition-colors font-medium"
          >
            Search
          </button>
        )}
      </div>
    </div>
  )
}

// Mode Selector Component
function ModeSelector({ activeMode, onModeChange }) {
  const modes = [
    { id: 'seo', label: 'SuperSEO' },
    { id: 'ai', label: 'SuperAI' },
    { id: 'community', label: 'SuperReview' }
  ]

  return (
    <div className="flex justify-center gap-2 pb-4 bg-gray-950">
      {modes.map(mode => (
        <button
          key={mode.id}
          onClick={() => onModeChange(mode.id)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeMode === mode.id
              ? 'bg-indigo-500 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  )
}

// New Tab Page Component
function NewTabPage({ onSuggestedSearch }) {
  const features = [
    {
      title: 'SuperSEO',
      description: 'Cross-validated search results from multiple sources',
      icon: '🔍'
    },
    {
      title: 'SuperAI',
      description: 'AI-powered summaries and comprehensive answers',
      icon: '🤖'
    },
    {
      title: 'SuperReview',
      description: 'Community insights and Stack Overflow answers',
      icon: '💬'
    }
  ]

  const suggestedSearches = [
    "what is machine learning",
    "python vs javascript",
    "how does the internet work"
  ]

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
        SuperBrowser
      </h1>
      <p className="text-gray-400 text-lg mb-12">
        One search. Multiple sources. Zero ads.
      </p>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 max-w-4xl">
        {features.map(feature => (
          <div
            key={feature.title}
            className="bg-gray-900 rounded-xl p-6 border border-gray-800"
          >
            <div className="text-4xl mb-3">{feature.icon}</div>
            <h3 className="text-lg font-semibold mb-2 text-indigo-400">
              {feature.title}
            </h3>
            <p className="text-gray-400 text-sm">{feature.description}</p>
          </div>
        ))}
      </div>

      {/* Suggested Searches */}
      <div>
        <p className="text-gray-500 text-sm mb-3">Try searching for:</p>
        <div className="flex flex-wrap justify-center gap-2">
          {suggestedSearches.map(search => (
            <button
              key={search}
              onClick={() => onSuggestedSearch(search)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-full text-sm transition-colors"
            >
              {search}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Results Panel Component
function ResultsPanel({ mode, results, loading, onOpenLink }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Searching...</p>
        </div>
      </div>
    )
  }

  if (!results) {
    return null
  }

  if (mode === 'seo') {
    return <SEOResults results={results} onOpenLink={onOpenLink} />
  } else if (mode === 'ai') {
    return <AIResults results={results} />
  } else if (mode === 'community') {
    return <CommunityResults results={results} onOpenLink={onOpenLink} />
  }

  return null
}

// SEO Results Component
function SEOResults({ results, onOpenLink }) {
  const items = results?.results || results || []

  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-gray-400">No results found.</p>
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {items.map((result, index) => (
        <div
          key={index}
          className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <a
                href={result.url}
                onClick={(e) => {
                  e.preventDefault()
                  onOpenLink?.(result.url, result.title || "Search Result")
                }}
                className="text-indigo-400 hover:text-indigo-300 font-medium text-lg block truncate"
              >
                {result.title}
              </a>
              <p className="text-green-500 text-sm truncate mb-2">{result.url}</p>
              <p className="text-gray-400 text-sm line-clamp-2">{result.snippet || result.description}</p>
            </div>
            {result.cross_validated && (
              <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 py-1 rounded-full whitespace-nowrap">
                ✓ Cross-validated
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// AI Results Component
function AIResults({ results }) {
  const answer = results?.answer || ''
  const personaUsed = results?.persona_used
  const modelUsed = results?.model_used

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* AI Answer Card */}
      {answer && (
        <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 rounded-xl p-6 border border-indigo-800">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span>🤖</span> AI Answer
            {personaUsed && personaUsed !== "Default" && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 
                               dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 
                               font-medium">
                {personaUsed} style
              </span>
            )}
          </h3>
          <div className="text-gray-200 leading-relaxed whitespace-pre-wrap">{answer}</div>
          {modelUsed && (
            <p className="text-gray-500 text-xs mt-4">Model: {modelUsed}</p>
          )}
        </div>
      )}

      {!answer && (
        <p className="text-gray-400">No AI results available.</p>
      )}
    </div>
  )
}

// Community Results Component
function CommunityResults({ results, onOpenLink }) {
  const insights = results?.insights || ""
  const stack_results = results?.stack_results || []
  const reddit_results = results?.reddit_results || []
  const hn_results = results?.hn_results || []
  const devto_results = results?.devto_results || []

  // Chart 1 - Source Coverage Data
  const coverageData = [
    { platform: "StackOverflow", count: stack_results.length, fill: "#6366f1" },
    { platform: "Hacker News", count: hn_results.length, fill: "#f97316" },
    { platform: "Dev.to", count: devto_results.length, fill: "#a855f7" },
    { platform: "Reddit", count: reddit_results.length, fill: "#ef4444" },
  ].filter(d => d.count > 0)

  // Chart 2 - Engagement Data
  const stack_engagement = stack_results.reduce((sum, r) => sum + (r.score || 0), 0)
  const hn_engagement = hn_results.reduce((sum, r) => sum + (r.score || 0), 0)
  const devto_engagement = devto_results.reduce((sum, r) => sum + (r.reactions || 0), 0)
  const reddit_engagement = reddit_results.reduce((sum, r) => sum + (r.post_score || 0), 0)

  const engagementData = [
    { name: "StackOverflow", value: stack_engagement, color: "#6366f1" },
    { name: "Hacker News", value: hn_engagement, color: "#f97316" },
    { name: "Dev.to", value: devto_engagement, color: "#a855f7" },
    { name: "Reddit", value: reddit_engagement, color: "#ef4444" },
  ].filter(d => d.value > 0)

  // Chart 3 - Top Results Data
  const allResults = [
    ...stack_results.map(r => ({
      title: (r.title || "").slice(0, 30) + '...',
      score: r.score || 0,
      platform: 'SO',
      color: '#6366f1'
    })),
    ...hn_results.map(r => ({
      title: (r.title || "").slice(0, 30) + '...',
      score: r.score || 0,
      platform: 'HN',
      color: '#f97316'
    })),
    ...devto_results.map(r => ({
      title: (r.title || "").slice(0, 30) + '...',
      score: r.reactions || 0,
      platform: 'DEV',
      color: '#a855f7'
    })),
    ...reddit_results.map(r => ({
      title: (r.title || "").slice(0, 30) + '...',
      score: r.post_score || 0,
      platform: 'R/',
      color: '#ef4444'
    })),
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)

  const hasAnyResults = coverageData.length > 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Charts Section */}
      {hasAnyResults && (
        <div>
          <h3 className="text-lg font-semibold mb-4 text-gray-200">📊 Community Data Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Chart 1 - Source Coverage */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-xs mb-3">Results per platform</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={coverageData} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis dataKey="platform" type="category" tick={{ fill: '#9ca3af', fontSize: 11 }} width={100} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f9fafb' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {coverageData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 2 - Engagement Pie */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-xs mb-3">Community engagement distribution</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={engagementData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {engagementData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f9fafb' }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span style={{ color: '#9ca3af', fontSize: '12px' }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 3 - Top Results */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <p className="text-gray-400 text-xs mb-3">Top results by community score</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={allResults}>
                  <XAxis
                    dataKey="title"
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f9fafb', fontSize: '12px' }}
                    formatter={(value, name, props) => [value, `Score (${props.payload.platform})`]}
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                    {allResults.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* AI Insights */}
      {insights && (
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>💡</span> Community Insights
          </h3>
          <div className="text-gray-300 whitespace-pre-wrap">{insights}</div>
        </div>
      )}

      {/* Stack Overflow Cards */}
      {stack_results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span>📚</span> Stack Overflow
          </h3>
          {stack_results.map((item, index) => (
            <div
              key={index}
              className="bg-gray-900 rounded-lg p-4 border border-gray-800"
            >
              <a
                href={item.link || item.url}
                onClick={(e) => {
                  e.preventDefault()
                  onOpenLink?.(item.link || item.url, item.title || "Stack Overflow")
                }}
                className="text-indigo-400 hover:text-indigo-300 font-medium block mb-2"
              >
                {item.title}
              </a>
              {item.score !== undefined && (
                <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                  <span>Score: {item.score}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hacker News Cards */}
      {hn_results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span>🔶</span> Hacker News
          </h3>
          {hn_results.map((item, index) => (
            <div
              key={index}
              className="bg-gray-900 rounded-lg p-4 border border-gray-800"
            >
              <a
                href={item.hn_link || item.url}
                onClick={(e) => {
                  e.preventDefault()
                  onOpenLink?.(item.hn_link || item.url, item.title || "Hacker News")
                }}
                className="text-orange-400 hover:text-orange-300 font-medium block mb-2"
              >
                {item.title}
              </a>
              <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                <span>Score: {item.score}</span>
                <span>Comments: {item.num_comments}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dev.to Cards */}
      {devto_results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span>📝</span> Dev.to
          </h3>
          {devto_results.map((item, index) => (
            <div
              key={index}
              className="bg-gray-900 rounded-lg p-4 border border-gray-800"
            >
              <a
                href={item.url}
                onClick={(e) => {
                  e.preventDefault()
                  onOpenLink?.(item.url, item.title || "Dev.to")
                }}
                className="text-purple-400 hover:text-purple-300 font-medium block mb-2"
              >
                {item.title}
              </a>
              <p className="text-gray-400 text-sm mb-2">{item.description}</p>
              <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                <span>❤️ {item.reactions}</span>
                <span>💬 {item.comments_count}</span>
                <span>⏱️ {item.reading_time} min</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reddit Cards */}
      {reddit_results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span>🔴</span> Reddit
          </h3>
          {reddit_results.map((item, index) => (
            <div
              key={index}
              className="bg-gray-900 rounded-lg p-4 border border-gray-800"
            >
              <a
                href={item.url}
                onClick={(e) => {
                  e.preventDefault()
                  onOpenLink?.(item.url, item.title || "Reddit")
                }}
                className="text-red-400 hover:text-red-300 font-medium block mb-2"
              >
                {item.title}
              </a>
              <p className="text-gray-500 text-sm mb-2">r/{item.subreddit}</p>
              <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                <span>Score: {item.post_score}</span>
                <span>Comments: {item.num_comments}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasAnyResults && !insights && (
        <p className="text-gray-400">No community results found.</p>
      )}
    </div>
  )
}

// History Sidebar Component
function HistorySidebar({ show, onToggle, history, onHistoryClick }) {
  const modeColors = {
    seo: 'bg-green-500/20 text-green-400',
    ai: 'bg-purple-500/20 text-purple-400',
    community: 'bg-orange-500/20 text-orange-400'
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute top-0 right-0 m-2 px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
      >
        {show ? 'Hide' : 'History'}
      </button>

      {/* Sidebar */}
      {show && (
        <div className="w-72 bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4 text-gray-200">Tab History</h3>
          {history.length === 0 ? (
            <p className="text-gray-500 text-sm">No searches yet</p>
          ) : (
            <div className="space-y-2">
              {history.slice().reverse().map((item, index) => (
                <button
                  key={index}
                  onClick={() => onHistoryClick(item)}
                  className="w-full text-left p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <p className="text-sm text-gray-200 truncate mb-1">
                    {item.query}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded ${modeColors[item.mode]}`}>
                    {item.mode}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

// Context Indicator Component
function ContextIndicator({ tabId, contextManager, onToggleInfo }) {
  const summary = contextManager.getContextSummary(tabId)
  
  if (!summary.hasContext) {
    return (
      <div className="text-xs text-gray-500 px-3 py-1.5 border border-gray-700 rounded-lg flex items-center gap-2">
        <span>🧠</span>
        <span>No context yet</span>
      </div>
    )
  }
  
  return (
    <button
      onClick={onToggleInfo}
      className="text-xs px-3 py-1.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/50 rounded-lg hover:bg-indigo-500/30 transition-colors flex items-center gap-2"
      title="AI has context from your browsing"
    >
      <span>🧠</span>
      <span>Context: {summary.queryCount} searches, {summary.resultCount} results</span>
    </button>
  )
}

function ContextWindow({
  show,
  onClose,
  tabId,
  sessionId,
  sessionStartedAt,
  sessionStatus,
  contextManager,
}) {
  const [downloadState, setDownloadState] = useState("")
  const [downloading, setDownloading] = useState(false)

  if (!show) return null

  const context = contextManager.getContext(tabId)
  const summary = contextManager.getContextSummary(tabId)
  const queries = context.queries || []
  const results = context.results || []
  const visitedPages = context.visited_pages || []

  async function handleDownloadContext() {
    setDownloading(true)
    setDownloadState("")
    try {
      const exported = await contextManager.downloadSessionContext(sessionId)
      setDownloadState(`Downloaded ${exported.filename}`)
    } catch {
      setDownloadState("Download failed. Please try again.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[85vh] bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 bg-gray-950">
          <div>
            <h3 className="text-lg font-semibold text-gray-100">Context Window</h3>
            <p className="text-xs text-gray-400 mt-1">
              Session: {sessionId} • Started: {new Date(sessionStartedAt).toLocaleString()} • Status: {sessionStatus}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadContext}
              disabled={downloading}
              className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white"
            >
              {downloading ? "Exporting..." : "Download Context JSON"}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-100"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto max-h-[72vh] space-y-5">
          {downloadState && (
            <div className="text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-3 py-2">
              {downloadState}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Queries</p>
              <p className="text-gray-100 text-xl font-semibold">{summary.queryCount}</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Results</p>
              <p className="text-gray-100 text-xl font-semibold">{summary.resultCount}</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
              <p className="text-gray-400 text-xs">Visited Pages</p>
              <p className="text-gray-100 text-xl font-semibold">{summary.visitedCount}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-indigo-300">Recent Queries</h4>
            {queries.length === 0 ? (
              <p className="text-sm text-gray-500">No queries in this session yet.</p>
            ) : (
              <div className="space-y-2">
                {queries.slice(-10).reverse().map((q, idx) => (
                  <div key={`${q}-${idx}`} className="text-sm text-gray-200 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
                    {q}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-emerald-300">Recent Results</h4>
            {results.length === 0 ? (
              <p className="text-sm text-gray-500">No results stored yet.</p>
            ) : (
              <div className="space-y-2">
                {results.slice(0, 8).map((r, idx) => (
                  <div key={`${r.url}-${idx}`} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
                    <p className="text-sm text-gray-200 font-medium truncate">{r.title || 'Untitled'}</p>
                    <p className="text-xs text-green-400 truncate">{r.url}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-orange-300">Visited Pages</h4>
            {visitedPages.length === 0 ? (
              <p className="text-sm text-gray-500">No visited pages captured yet.</p>
            ) : (
              <div className="space-y-2">
                {visitedPages.slice(-8).reverse().map((page, idx) => (
                  <div key={`${page.url}-${idx}`} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
                    <p className="text-sm text-gray-200 font-medium truncate">{page.title || 'Visited Page'}</p>
                    <p className="text-xs text-green-400 truncate">{page.url}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function BackendStatusBanner({ status }) {
  if (!status) return null
  const isHealthy = status.running
  return (
    <div
      className={`mx-auto mt-1 mb-2 px-3 py-1 rounded text-xs border ${
        isHealthy
          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
          : 'bg-red-500/10 text-red-300 border-red-500/30'
      }`}
    >
      {isHealthy ? `Desktop backend connected (${status.url})` : `Backend issue: ${status.lastError || 'not running'}`}
    </div>
  )
}

function BrowserPanel({ url, title, onPageVisit, onClose }) {
  const webviewRef = useRef(null)
  const [address, setAddress] = useState(url)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)

  useEffect(() => {
    setAddress(url)
  }, [url])

  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return
    const onNavigate = () => {
      setAddress(wv.getURL() || url)
      setCanGoBack(wv.canGoBack())
      setCanGoForward(wv.canGoForward())
      onPageVisit?.(wv.getURL() || url, wv.getTitle?.() || title || "Web Page")
    }
    wv.addEventListener('did-navigate', onNavigate)
    wv.addEventListener('did-navigate-in-page', onNavigate)
    wv.addEventListener('dom-ready', onNavigate)
    return () => {
      wv.removeEventListener('did-navigate', onNavigate)
      wv.removeEventListener('did-navigate-in-page', onNavigate)
      wv.removeEventListener('dom-ready', onNavigate)
    }
  }, [onPageVisit, title, url])

  const navigateToAddress = () => {
    const wv = webviewRef.current
    if (!wv || !address) return
    const next = /^https?:\/\//i.test(address) ? address : `https://${address}`
    wv.loadURL(next)
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-white">
      <div className="bg-gray-900 px-3 py-2 flex items-center gap-2 border-b border-gray-800">
        <button
          onClick={() => webviewRef.current?.goBack()}
          disabled={!canGoBack}
          className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200"
        >
          ←
        </button>
        <button
          onClick={() => webviewRef.current?.goForward()}
          disabled={!canGoForward}
          className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-200"
        >
          →
        </button>
        <button
          onClick={() => webviewRef.current?.reload()}
          className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200"
        >
          ↻
        </button>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && navigateToAddress()}
          className="flex-1 min-w-0 text-sm bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-gray-200"
        />
        <button
          onClick={navigateToAddress}
          className="text-xs px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white"
        >
          Go
        </button>
        <div className="min-w-0 max-w-[220px] hidden md:block">
          <p className="text-xs text-gray-400 truncate">{title || 'Web Page'}</p>
        </div>
        <button
          onClick={onClose}
          className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200"
        >
          Back to Results
        </button>
      </div>
      <webview
        ref={webviewRef}
        src={url}
        className="w-full flex-1 bg-white"
        style={{ minHeight: 0 }}
        allowpopups="true"
      />
    </div>
  )
}

export default App
