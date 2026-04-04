import { Suspense, lazy, useState, useCallback, useEffect, useRef } from 'react'
import { useContextManager } from './useContextManager'
import { getApiBase } from './config/apiBase'

const LazyCommunityResults = lazy(() => import('./components/CommunityResults'))
const LazyBackgroundOrb = lazy(() => import('./components/BackgroundOrb'))
import { ContinuousPaginationDemo } from './components/ContinuousPagination'
import { AiInput } from './components/AiInput'

const PERSONAS = [
  { id: "default",    label: "Default",     desc: "Raw Groq"            },
  { id: "chatgpt",    label: "ChatGPT",      desc: "Concise & practical" },
  { id: "gemini",     label: "Gemini",       desc: "Analytical & broad"  },
  { id: "perplexity", label: "Perplexity",   desc: "Factual & cited"     },
  { id: "claude",     label: "Claude",       desc: "Nuanced & careful"   },
]

const API_BASE = getApiBase()

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

/* ── SVG Icons ── */
const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
)
const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
)
const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
)
const MinusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14"/></svg>
)
const SquareIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
)
const BrainIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a7 7 0 0 0-7 7c0 3 2 5.5 4 7.5L12 22l3-5.5c2-2 4-4.5 4-7.5a7 7 0 0 0-7-7z"/></svg>
)
const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
)
const ChevronLeftIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
const ChevronRightIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
const RefreshIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>

export default function App() {
  const [appSessionId] = useState(() => crypto.randomUUID())
  const [sessionStartedAt] = useState(() => new Date().toISOString())
  const [sessionStatus, setSessionStatus] = useState("starting")
  const [tabs, setTabs] = useState(() => [createNewTab(appSessionId)])
  const [activeTabId, setActiveTabId] = useState(tabs[0].id)
  const [showHistory, setShowHistory] = useState(false)
  const [persona, setPersona] = useState("default")
  const [showContextInfo, setShowContextInfo] = useState(false)
  const [backendStatus, setBackendStatus] = useState(null)
  
  const searchControllersRef = useRef({})
  const contextManager = useContextManager()
  const { startSession, stopSession: stopContextSession } = contextManager
  const activeTab = tabs.find(t => t.id === activeTabId)
  
  const isBrowserTab = Boolean(activeTab?.browserUrl)
  // Only transition out of New Tab when a search is loading, finished, or has errored
  const isNewTab = !activeTab?.results && !activeTab?.loading && !activeTab?.error && !isBrowserTab

  useEffect(() => {
    if (!window.superBrowserDesktop?.isElectron || !window.superBrowserDesktop?.backend?.getStatus) return
    window.superBrowserDesktop.backend.getStatus().then(setBackendStatus).catch(() => {})
  }, [])

  useEffect(() => {
    startSession(appSessionId)
      .then(() => setSessionStatus("active"))
      .catch(() => setSessionStatus("error"))
    const stopSession = () => {
      stopContextSession(appSessionId, { keepalive: true }).catch(() => {})
      setSessionStatus("stopped")
    }
    window.addEventListener("beforeunload", stopSession)
    return () => { window.removeEventListener("beforeunload", stopSession); stopSession() }
  }, [appSessionId, startSession, stopContextSession])

  const updateTab = useCallback((tabId, updates) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...updates } : t))
  }, [])

  const performSearch = useCallback((tabId, tabData, searchPersona = "default") => {
    const endpoints = { seo: `/api/search/seo`, ai: `/api/search/ai`, community: `/api/search/community` }
    const prev = searchControllersRef.current[tabId]
    if (prev) prev.abort()
    const controller = new AbortController()
    searchControllersRef.current[tabId] = controller
    const parseApiResponse = async (response) => {
      let payload = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }

      if (!response.ok) {
        const detail = payload?.detail || payload?.error || `HTTP ${response.status}`
        throw new Error(String(detail))
      }

      return payload
    }

    const onSuccess = (data) => {
      setTabs(p => p.map(t => t.id === tabId ? { ...t, results: data, loading: false } : t))
      if (Array.isArray(data?.results) && data.results.length > 0) contextManager.addResults(tabId, tabData.sessionId, data.results)
    }
    const onError = (error) => {
      if (error?.name === 'AbortError') return
      const message = error?.message ? `Search failed: ${error.message}` : "Search failed. Please try again."
      setTabs(p => p.map(t => t.id === tabId ? { ...t, error: message, loading: false } : t))
    }
    const onDone = () => { if (searchControllersRef.current[tabId] === controller) delete searchControllersRef.current[tabId] }
    
    if (tabData.activeMode === 'ai') {
      const context = contextManager.getAIContext(tabId)
      const hasContext = context.queries.length > 0 || context.results.length > 0 || context.visited_pages.length > 0
      if (hasContext) {
        fetch(`${API_BASE}/api/search/ai/contextual`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ query: tabData.query, persona: searchPersona, context }) })
          .then(parseApiResponse).then(onSuccess).catch(onError).finally(onDone)
        return
      }
    }
    let url = `${API_BASE}${endpoints[tabData.activeMode]}?q=${encodeURIComponent(tabData.query)}&session_id=${tabData.sessionId}`
    if (tabData.activeMode === 'ai') url += `&persona=${searchPersona}`
    fetch(url, { signal: controller.signal }).then(parseApiResponse).then(onSuccess).catch(onError).finally(onDone)
  }, [contextManager])

  const handleSearch = useCallback((tabId, searchPersona = "default") => {
    setTabs(currentTabs => {
      const tab = currentTabs.find(t => t.id === tabId)
      if (!tab?.query.trim()) return currentTabs
      contextManager.addQuery(tabId, tab.sessionId, tab.query, tab.activeMode)
      performSearch(tabId, tab, searchPersona)
      return currentTabs.map(t => {
        if (t.id !== tabId) return t
        return { ...t, loading: true, error: null, title: t.query.slice(0, 25), history: [...t.history, { query: t.query, mode: t.activeMode }].slice(-10) }
      })
    })
  }, [performSearch, contextManager])

  const handleModeChange = useCallback((mode) => {
    setTabs(currentTabs => {
      const tab = currentTabs.find(t => t.id === activeTabId)
      if (!tab) return currentTabs
      const shouldSearch = tab.query && tab.results
      const updatedTab = { ...tab, activeMode: mode }
      if (shouldSearch) {
        performSearch(activeTabId, updatedTab, persona)
        return currentTabs.map(t => { if (t.id !== activeTabId) return t; return { ...updatedTab, loading: true, error: null, history: [...t.history, { query: t.query, mode }].slice(-10) } })
      }
      return currentTabs.map(t => t.id === activeTabId ? updatedTab : t)
    })
  }, [activeTabId, performSearch, persona])

  function handleAddTab() { const n = createNewTab(appSessionId); setTabs(p => [...p, n]); setActiveTabId(n.id) }
  function handleCloseTab(tabId, e) {
    e.stopPropagation()
    if (tabs.length === 1) { const r = createNewTab(appSessionId); r.id = tabs[0].id; setTabs([r]); return }
    const nTabs = tabs.filter(t => t.id !== tabId); setTabs(nTabs)
    if (tabId === activeTabId) setActiveTabId(nTabs[Math.max(0, tabs.findIndex(t => t.id === tabId) - 1)].id)
  }
  function handleHistoryClick(item) { updateTab(activeTabId, { query: item.query, activeMode: item.mode }); setTimeout(() => handleSearch(activeTabId, persona), 0) }
  function openInAppUrl(url, title = "Web Page") {
    if (!url) return
    const bt = createNewTab(appSessionId); bt.browserUrl = url; bt.browserTitle = title; bt.title = (title || "Web").slice(0, 25); bt.query = url
    setTabs(p => [...p, bt]); setActiveTabId(bt.id)
    if (activeTab) contextManager.addVisitedPage(activeTabId, activeTab.sessionId, url, title, `Visited: ${url}`)
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-transparent text-[var(--text-primary)] relative z-10">
      <Suspense fallback={null}>
        <LazyBackgroundOrb isVisible={isNewTab} />
      </Suspense>

      {/* Hand-drawn style Tab Bar */}
      <TabBar tabs={tabs} activeTabId={activeTabId} onTabClick={setActiveTabId} onCloseTab={handleCloseTab} onAddTab={handleAddTab} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {window.superBrowserDesktop?.isElectron && <BackendStatusBanner status={backendStatus} />}

        {isBrowserTab ? (
          <div className="flex-1 min-h-0 bg-white">
            <BrowserPanel url={activeTab.browserUrl} title={activeTab.browserTitle} onClose={() => updateTab(activeTabId, { browserUrl: "", browserTitle: "" })} />
          </div>
        ) : isNewTab ? (
          /* Hand-drawn Centered Landing Page */
          <div className="flex-1 flex flex-col items-center justify-center p-4 animate-fade-in-up">
            <div className="relative mb-12">
              <div className="absolute inset-0 bg-white/70 blur-3xl -z-10 rounded-full scale-[1.3] pointer-events-none"></div>
              <h1 className="title-hero text-center select-none m-0">SUPER BROWSER</h1>
            </div>
            
            <div className="w-full max-w-2xl mb-8">
              <div className="pill-search flex items-center px-6 py-4 w-full cursor-text relative bg-white/80 backdrop-blur-sm" onClick={() => document.getElementById('search-input-home')?.focus()}>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleSearch(activeTabId, persona) }} 
                  className="text-[var(--text-secondary)] hover:text-[var(--action-primary)] transition-colors shrink-0"
                >
                  <SearchIcon />
                </button>
                <input id="search-input-home" type="text" value={activeTab?.query || ''} 
                  onChange={(e) => updateTab(activeTabId, { query: e.target.value })} 
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(activeTabId, persona)}
                  placeholder="Enter your search..."
                  className="flex-1 ml-4 outline-none text-xl bg-transparent text-[var(--text-primary)]"
                  style={{ letterSpacing: '-0.01em' }} />
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              <button onClick={() => updateTab(activeTabId, { activeMode: 'seo' })} className={`pill-btn px-6 py-2.5 ${activeTab?.activeMode === 'seo' ? 'active' : ''}`}>SUPER SEO</button>
              <button onClick={() => updateTab(activeTabId, { activeMode: 'ai' })} className={`pill-btn px-6 py-2.5 ${activeTab?.activeMode === 'ai' ? 'active' : ''}`}>SUPER AI</button>
              <button onClick={() => updateTab(activeTabId, { activeMode: 'community' })} className={`pill-btn px-6 py-2.5 ${activeTab?.activeMode === 'community' ? 'active' : ''}`}>SUPER REVIEW</button>
            </div>
          </div>
        ) : (
          /* Active Search View */
          <div className="flex-1 flex flex-col min-h-0 bg-white shadow-xl relative z-10">
            {/* Minimalist Top Header */}
            <div className="px-6 py-3 border-b border-[var(--border-color)] flex items-center gap-6 bg-white">
               {/* Browser Navigation Controls */}
               <div className="flex items-center gap-1 -mr-2">
                 <button onClick={() => {
                   if (activeTab?.history && activeTab.history.length > 1) {
                     const prev = activeTab.history[activeTab.history.length - 2];
                     updateTab(activeTabId, { query: prev.query, activeMode: prev.mode, history: activeTab.history.slice(0, -1) });
                     setTimeout(() => handleSearch(activeTabId, persona), 0);
                   } else {
                     updateTab(activeTabId, { query: "", results: null, loading: false });
                   }
                 }} className="p-2 flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-black transition-colors" title="Back">
                   <ChevronLeftIcon />
                 </button>
                 <button disabled className="p-2 flex items-center justify-center rounded-full text-[var(--text-secondary)] opacity-30 cursor-not-allowed transition-colors" title="Forward">
                   <ChevronRightIcon />
                 </button>
                 <button onClick={() => { if (activeTab?.query) handleSearch(activeTabId, persona) }} className="p-2 flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-black transition-colors" title="Reload">
                   <RefreshIcon />
                 </button>
               </div>

               <div className="pill-search flex items-center px-5 py-2.5 flex-1 max-w-3xl">
                  {activeTab?.loading ? <div className="w-[18px] h-[18px] rounded-full border-2 border-[var(--border-color)] border-t-[var(--action-primary)] animate-spin" /> : <span className="text-[var(--text-tertiary)]"><SearchIcon /></span>}
                  <input type="text" value={activeTab?.query || ''} 
                    onChange={(e) => updateTab(activeTabId, { query: e.target.value })} 
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch(activeTabId, persona)}
                    className="flex-1 ml-3 outline-none text-base bg-transparent text-[var(--text-primary)]" />
               </div>
               <div className="flex items-center gap-2">
                 <button onClick={() => handleModeChange('seo')} className={`pill-btn px-4 py-1.5 ${activeTab?.activeMode === 'seo' ? 'active' : ''}`}>SEO</button>
                 <button onClick={() => handleModeChange('ai')} className={`pill-btn px-4 py-1.5 ${activeTab?.activeMode === 'ai' ? 'active' : ''}`}>AI</button>
                 <button onClick={() => handleModeChange('community')} className={`pill-btn px-4 py-1.5 ${activeTab?.activeMode === 'community' ? 'active' : ''}`}>REVIEW</button>
               </div>
               <button onClick={() => setShowHistory(!showHistory)} className="btn-secondary px-4 py-1.5 text-sm ml-auto flex items-center gap-2"><ClockIcon /> History</button>
            </div>
            
            {/* Content Area */}
            <div className="flex-1 flex overflow-hidden bg-white">
               <div className="flex-1 overflow-auto p-6 md:p-10 max-w-5xl mx-auto">
                 {activeTab?.error && <div className="text-red-700 border border-red-200 bg-red-50 p-4 rounded-xl mb-6 text-sm max-w-4xl mx-auto">{activeTab.error}</div>}
                 
                 {/* AI Persona Bar inside results area for cleaner header */}
                 {activeTab?.activeMode === 'ai' && (
                   <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center">
                     <div className="flex items-center gap-3">
                       <span className="text-sm font-medium text-[var(--text-secondary)]">Persona:</span>
                       <select value={persona} onChange={e => setPersona(e.target.value)} className="bg-white border border-[var(--border-color)] rounded-md px-3 py-1.5 text-sm outline-none cursor-pointer">
                         {PERSONAS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                       </select>
                     </div>
                     <ContextIndicator tabId={activeTabId} contextManager={contextManager} onToggleInfo={() => setShowContextInfo(!showContextInfo)} />
                   </div>
                 )}

                 <ResultsPanel mode={activeTab?.activeMode} results={activeTab?.results} loading={activeTab?.loading} onOpenLink={openInAppUrl} />
               </div>
               
               {/* History Panel Sidebar */}
               {showHistory && (
                 <div className="w-80 border-l border-[var(--border-color)] bg-white p-4 overflow-y-auto">
                   <h3 className="font-semibold mb-4 text-[var(--text-primary)]">Tab History</h3>
                   <div className="space-y-2">
                     {activeTab?.history?.slice().reverse().map((item, i) => (
                       <button key={i} onClick={() => handleHistoryClick(item)} className="w-full text-left p-3 rounded-lg border border-[var(--border-color)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)] transition-colors">
                         <p className="text-sm truncate mb-1 text-[var(--text-primary)]">{item.query}</p>
                         <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-[var(--bg-elevated)] text-[var(--text-secondary)] uppercase">{item.mode}</span>
                       </button>
                     ))}
                   </div>
                 </div>
               )}
            </div>
          </div>
        )}
      </div>

      <ContextWindow show={showContextInfo} onClose={() => setShowContextInfo(false)} tabId={activeTabId} sessionId={appSessionId} sessionStartedAt={sessionStartedAt} sessionStatus={sessionStatus} contextManager={contextManager} />
    </div>
  )
}

/* ── UI Components ── */

function TabBar({ tabs, activeTabId, onTabClick, onCloseTab, onAddTab }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  return (
    <div className="flex border-b border-[var(--border-color)] w-full bg-white select-none" style={{ height: '44px' }}>
      <div className="flex-1 flex overflow-x-auto scrollbar-hide h-full">
        {tabs.map((tab, idx) => (
          <div key={tab.id} onClick={() => onTabClick(tab.id)}
            className={`flex items-center gap-2 px-4 h-full min-w-[140px] max-w-[240px] cursor-pointer border-r border-[var(--border-color)] group ${tab.id === activeTabId ? 'tab-active' : 'tab-inactive'}`}>
            <span className="truncate text-[13px] flex-1">
              {tab.id === activeTabId ? `TAB ${idx + 1}` : (tab.title.length > 20 ? tab.title.slice(0, 20) + '…' : tab.title)}
            </span>
            <button onClick={(e) => onCloseTab(tab.id, e)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/5 opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)]"><XIcon /></button>
          </div>
        ))}
        <button onClick={onAddTab} className="px-4 h-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border-r border-[var(--border-color)] flex items-center justify-center transition-colors">
          <PlusIcon />
        </button>
      </div>
      <div className="flex items-center h-full border-l border-[var(--border-color)] relative">
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`px-5 h-full text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors ${isMenuOpen ? 'bg-[var(--bg-hover)]' : ''}`}
        >
          BROWSER MENU
        </button>
        {isMenuOpen && <BrowserMenu onClose={() => setIsMenuOpen(false)} />}
        <div className="flex h-full pl-1 border-l border-[var(--border-color)]">
          <button className="w-12 h-full text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] flex items-center justify-center transition-colors"><MinusIcon /></button>
          <button className="w-12 h-full text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] flex items-center justify-center transition-colors"><SquareIcon /></button>
          <button className="w-12 h-full text-[var(--text-tertiary)] hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"><XIcon /></button>
        </div>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fade-in-up">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card-minimal p-6" style={{ animationDelay: `${i * 50}ms` }}>
          <div className="h-5 w-3/4 mb-4 rounded-full bg-[var(--border-color)] animate-pulse" />
          <div className="h-3 w-1/2 mb-3 rounded-full bg-[var(--border-color)] animate-pulse" />
          <div className="h-3 w-full rounded-full bg-[var(--border-color)] animate-pulse" />
        </div>
      ))}
    </div>
  )
}

function ResultsPanel({ mode, results, loading, onOpenLink }) {
  if (loading) return <LoadingSkeleton />
  if (!results) return null
  if (mode === 'seo') return <SEOResults results={results} onOpenLink={onOpenLink} />
  if (mode === 'ai') return <AIResults results={results} />
  if (mode === 'community') return <Suspense fallback={<LoadingSkeleton />}><LazyCommunityResults results={results} onOpenLink={onOpenLink} /></Suspense>
  return null
}

function SEOResults({ results, onOpenLink }) {
  const items = results?.results || results || []
  if (!items.length) return <p className="text-[var(--text-secondary)] text-center py-10">No results found.</p>
  return (
    <div className="space-y-6 max-w-3xl">
      {items.map((r, i) => (
        <div key={i} className={`pb-6 mb-6 border-b border-[var(--border-color)] last:border-0 animate-fade-in-up stagger-${Math.min(i + 1, 3)}`}>
          <div className="flex-1 min-w-0">
            <a href={r.url} onClick={(e) => { e.preventDefault(); onOpenLink?.(r.url, r.title || "Search Result") }} className="font-medium text-[22px] block mb-1 text-[#1a0dab] hover:underline truncate hover:text-[#2b6ce0] transition-colors">{r.title}</a>
            <p className="text-[13px] truncate mb-3 text-[#006621]">{r.url}</p>
            <p className="text-[15px] text-[var(--text-secondary)] line-clamp-3 leading-relaxed">{r.snippet || r.description}</p>
          </div>
        </div>
      ))}
      {items.length > 0 && <ContinuousPaginationDemo totalPages={5} defaultPage={2} />}
    </div>
  )
}

function AIResults({ results }) {
  const answer = results?.answer || ''
  return (
    <div className="max-w-3xl space-y-6 animate-fade-in-up">
      {answer ? (
        <div className="p-8 bg-white border border-[var(--border-color)] rounded-3xl" style={{ borderTop: '4px solid var(--action-primary)' }}>
          <h3 className="text-xl font-medium mb-6 flex items-center gap-3"><BrainIcon /> AI Answer</h3>
          <div className="leading-loose whitespace-pre-wrap text-[16px] text-[var(--text-primary)]">{answer}</div>
        </div>
      ) : <p className="text-[var(--text-secondary)] py-10">No AI results available.</p>}
    </div>
  )
}

function ContextIndicator({ tabId, contextManager, onToggleInfo }) {
  const summary = contextManager.getContextSummary(tabId)
  if (!summary.hasContext) return null
  return (
    <button onClick={onToggleInfo} className="text-xs px-3 py-1.5 rounded-full flex items-center gap-2 bg-[rgba(50,121,249,0.06)] text-[var(--action-primary)] hover:bg-[rgba(50,121,249,0.1)] transition-colors border border-[rgba(50,121,249,0.2)] font-medium">
      <BrainIcon /> Context active ({summary.queryCount})
    </button>
  )
}

function ContextWindow({ show, onClose }) {
  const [chatMessages, setChatMessages] = useState([])

  if (!show) return null

  const handleSend = (text) => {
    // Optimistically add user message
    const userMsg = { id: Date.now().toString(), text, sender: 'user' }
    setChatMessages(prev => [...prev, userMsg])

    // Mock AI response logic as provided in demo
    setTimeout(() => {
      const aiReply = {
        id: (Date.now() + 1).toString(),
        text: `I am your Super AI assistant! I see you are looking at context for this session. How can I help you analyze it?`,
        sender: 'ai'
      }
      setChatMessages(prev => [...prev, aiReply])
    }, 1000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in-up">
      <div className="w-full max-w-4xl bg-white rounded-2xl overflow-hidden shadow-2xl scale-100 flex flex-col">
        <div className="p-5 border-b border-[var(--border-color)] flex justify-between items-center bg-white relative z-20">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-medium tracking-tight">Super AI Context Session</h3>
            <span className="text-[11px] bg-black text-white px-2 py-0.5 rounded-full">BETA</span>
          </div>
          <button onClick={onClose} className="btn-secondary px-4 py-1.5 text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">Close Session</button>
        </div>
        
        {/* Injecting the AiInput UI here directly */}
        <AiInput
          messages={chatMessages}
          onSendMessage={handleSend}
          backgroundText="AI Input 001"
          placeholder="How can I help you analyze this context?"
        />
      </div>
    </div>
  )
}

function BackendStatusBanner() { return null } // Hidden for minimalist aesthetic

function BrowserPanel({ url, onClose }) {
  const reloadWebview = () => document.getElementById(`webview-${url}`)?.reload()

  return (
    <div className="h-full flex flex-col bg-white animate-fade-in-up">
      <div className="px-4 py-2 border-b border-[var(--border-color)] flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={onClose} className="p-1.5 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-black transition-colors" title="Back"><ChevronLeftIcon /></button>
          <button disabled className="p-1.5 rounded-full text-[var(--text-secondary)] opacity-30 cursor-not-allowed transition-colors" title="Forward"><ChevronRightIcon /></button>
          <button onClick={reloadWebview} className="p-1.5 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-black transition-colors" title="Reload"><RefreshIcon /></button>
        </div>
        <input value={url} readOnly className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-color)] text-sm rounded-lg px-3 py-1.5 outline-none text-[var(--text-secondary)]" />
      </div>
      <webview id={`webview-${url}`} src={url} className="w-full flex-1" style={{ minHeight: 0 }} allowpopups="true" />
    </div>
  )
}

/* eslint-disable react-hooks/static-components */
function BrowserMenu({ onClose }) {
  const menuRef = useRef()
  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const icons = {
    user: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>,
    key: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
    history: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>,
    download: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
    star: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    grid: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    puzzle: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 0-.253.902l.331 2.076c.12.758-.195 1.503-.82 1.961a2.126 2.126 0 0 1-1.282.428h-.197c-.366 0-.715-.145-.968-.398l-1.526-1.526a1.12 1.12 0 0 0-1.428-.15l-1.693 1.13c-.63.42-1.439.467-2.112.122A2.43 2.43 0 0 1 8 18V5c0-1.105.895-2 2-2h4a2 2 0 0 1 2 2v2.586a1 1 0 0 0 .293.707l1.414 1.414c.294.294.767.198.887-.198.24-.76.71-1.464 1.516-1.464H21a1 1 0 0 1 1 1v.707l-2.561.1z"/></svg>,
    trash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    zoom: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    fullscreen: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>,
    print: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
    lens: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="12" cy="12" r="3"/><path d="M3 9v6M9 3h6M9 21h6M21 9v6"/></svg>,
    translate: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>,
    find: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>,
    cast: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 16v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v3"/><path d="M2 12a10 10 0 0 1 10 10"/><path d="M2 8a14 14 0 0 1 14 14"/></svg>,
    briefcase: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
    help: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    settings: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    exit: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    window: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>,
    incognito: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7" cy="15" r="3"/><circle cx="17" cy="15" r="3"/><path d="M10 15h4M5 12V9a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3H5z"/></svg>,
    empty: <span className="w-4 h-4 inline-block" />
  }

  const divider = <div className="h-[1px] w-full bg-[var(--border-color)] my-1" />

  const MenuItem = ({ icon, label, shortcut, rightIcon }) => (
    <button className="w-full flex items-center px-4 py-1.5 text-[13px] hover:bg-[var(--bg-hover)] group transition-colors">
      <span className="text-[var(--text-tertiary)] mr-3">{icon || icons.empty}</span>
      <span className="text-[var(--text-primary)] flex-1 text-left">{label}</span>
      {shortcut && <span className="text-[#9aa0a6] text-[11px] font-medium ml-4">{shortcut}</span>}
      {rightIcon && <span className="text-[var(--text-tertiary)] ml-3">{rightIcon}</span>}
    </button>
  )

  const ProfileMenu = () => (
    <div className="px-3 py-2 flex items-center bg-[var(--bg-elevated)] mx-2 my-1.5 rounded-lg border border-[var(--border-color)] hover:border-gray-300 transition-colors cursor-pointer group">
      <div className="w-7 h-7 bg-[var(--border-color)] rounded-full flex items-center justify-center text-[var(--text-secondary)] mr-3">
        {icons.user}
      </div>
      <span className="text-[13px] text-[var(--text-primary)] flex-1 text-left font-medium">Your Browser</span>
      <span className="text-[11px] bg-[rgba(50,121,249,0.1)] text-[#3279f9] px-2 py-0.5 rounded-md font-medium border border-[rgba(50,121,249,0.2)]">Not signed in</span>
      <span className="text-[var(--text-tertiary)] ml-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity">▶</span>
    </div>
  )

  const ZoomControl = () => (
    <div className="w-full flex items-center px-4 py-1.5 text-[13px] hover:bg-[var(--bg-hover)] transition-colors">
      <span className="text-[var(--text-tertiary)] mr-3">{icons.zoom}</span>
      <span className="text-[var(--text-primary)] flex-1 text-left">Zoom</span>
      <div className="flex items-center ml-4 border border-[var(--border-color)] rounded-md overflow-hidden bg-white">
        <button className="px-2 hover:bg-[var(--bg-hover)] text-[16px] leading-none pb-0.5 text-[var(--text-secondary)]">−</button>
        <div className="w-[1px] h-4 bg-[var(--border-color)]"></div>
        <span className="px-2 text-[12px] font-medium text-[var(--text-primary)]">100%</span>
        <div className="w-[1px] h-4 bg-[var(--border-color)]"></div>
        <button className="px-2 hover:bg-[var(--bg-hover)] text-[16px] leading-none pb-0.5 text-[var(--text-secondary)]">+</button>
      </div>
      <button className="ml-3 p-1 rounded-md border border-[var(--border-color)] bg-white hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
        {icons.fullscreen}
      </button>
    </div>
  )

  return (
    <div ref={menuRef} className="absolute top-[44px] right-0 w-[300px] bg-white border border-[var(--border-color)] shadow-2xl rounded-bl-xl py-1 z-50 animate-fade-in-up origin-top-right">
      <MenuItem icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>} label="New tab" shortcut="Ctrl+T" />
      <MenuItem icon={icons.window} label="New window" shortcut="Ctrl+N" />
      <MenuItem icon={icons.incognito} label="New Incognito window" shortcut="Ctrl+Shift+N" />
      
      {divider}
      <ProfileMenu />
      {divider}

      <MenuItem icon={icons.key} label="Passwords and autofill" rightIcon="▶" />
      <MenuItem icon={icons.history} label="History" rightIcon="▶" />
      <MenuItem icon={icons.download} label="Downloads" shortcut="Ctrl+J" />
      <MenuItem icon={icons.star} label="Bookmarks and lists" rightIcon="▶" />
      <MenuItem icon={icons.grid} label="Tab groups" rightIcon="▶" />
      <MenuItem icon={icons.puzzle} label="Extensions" rightIcon="▶" />
      <MenuItem icon={icons.trash} label="Delete browsing data..." shortcut="Ctrl+Shift+Del" />

      {divider}
      <ZoomControl />
      {divider}

      <MenuItem icon={icons.print} label="Print..." shortcut="Ctrl+P" />
      <MenuItem icon={icons.lens} label="Search with Google Lens" />
      <MenuItem icon={icons.translate} label="Translate..." />
      <MenuItem icon={icons.find} label="Find and edit" rightIcon="▶" />
      <MenuItem icon={icons.cast} label="Cast, save, and share" rightIcon="▶" />
      <MenuItem icon={icons.briefcase} label="More tools" rightIcon="▶" />

      {divider}
      <MenuItem icon={icons.help} label="Help" rightIcon="▶" />
      <MenuItem icon={icons.settings} label="Settings" />
      <MenuItem icon={icons.exit} label="Exit" />
    </div>
  )
}
/* eslint-enable react-hooks/static-components */
