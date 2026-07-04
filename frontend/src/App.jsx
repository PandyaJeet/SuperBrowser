import { Suspense, lazy, useState, useCallback, useEffect, useRef } from 'react'
import { clearEntireSessionWorkspace, useContextManager } from './useContextManager'
import { getApiBase } from './config/apiBase'

const LazyCommunityResults = lazy(() => import('./components/CommunityResults'))
const LazyBackgroundOrb = lazy(() => import('./components/BackgroundOrb'))
import { AiInput } from './components/AiInput'
import { ProductCarousel } from './components/ProductCarousel'

const PERSONAS = [
  { id: "default", label: "Default", desc: "Raw Groq" },
  { id: "chatgpt", label: "ChatGPT", desc: "Concise & practical" },
  { id: "gemini", label: "Gemini", desc: "Analytical & broad" },
  { id: "perplexity", label: "Perplexity", desc: "Factual & cited" },
  { id: "claude", label: "Claude", desc: "Nuanced & careful" },
]

const API_BASE = getApiBase()
const THEME_STORAGE_KEY = 'super-browser-theme'
const WEB_DOWNLOADS_STORAGE_KEY = 'superbrowser-web-downloads'
const WEB_HISTORY_STORAGE_KEY = 'superbrowser-web-history'
const BOOKMARKS_STORAGE_KEY = 'super-browser-bookmarks'

function isIncognitoRuntime() {
  if (window.superBrowserDesktop?.isIncognito) return true
  try {
    const url = new URL(window.location.href)
    return url.searchParams.get('incognito') === '1'
  } catch {
    return false
  }
}

function createWebIncognitoUrl() {
  const url = new URL(window.location.href)
  url.searchParams.set('incognito', '1')
  return url.toString()
}

function readWebDownloads() {
  try {
    const storage = isIncognitoRuntime() ? window.sessionStorage : window.localStorage
    const parsed = JSON.parse(storage.getItem(WEB_DOWNLOADS_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeWebDownloads(items) {
  try {
    const storage = isIncognitoRuntime() ? window.sessionStorage : window.localStorage
    storage.setItem(WEB_DOWNLOADS_STORAGE_KEY, JSON.stringify(items))
  } catch { }
}

function readWebHistory() {
  try {
    if (isIncognitoRuntime()) return []
    const parsed = JSON.parse(window.localStorage.getItem(WEB_HISTORY_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeWebHistory(items) {
  try {
    if (isIncognitoRuntime()) return
    window.localStorage.setItem(WEB_HISTORY_STORAGE_KEY, JSON.stringify(items))
  } catch { }
}

function readBookmarks() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BOOKMARKS_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeBookmarks(items) {
  try {
    window.localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(items))
  } catch { }
}

function createInstantSearchResults(query) {
  const cleanQuery = query?.trim().replace(/\s+/g, " ") || "search"
  const slug = cleanQuery.replace(/\s+/g, "_")
  const encoded = encodeURIComponent(cleanQuery)
  const siteSearch = (baseUrl, param) => `${baseUrl}?${param}=${encoded}`
  const result = (title, url, snippet, source = "instant") => ({ title, url, snippet, source })
  const knownTopicResults = {
    artificial: [
      result("Artificial intelligence - Wikipedia", "https://en.wikipedia.org/wiki/Artificial_intelligence", "Overview of artificial intelligence, its history, techniques, and applications."),
      result("Artificial intelligence - Britannica", "https://www.britannica.com/technology/artificial-intelligence", "Encyclopedia overview of AI concepts and development."),
      result("What is artificial intelligence? - IBM", "https://www.ibm.com/think/topics/artificial-intelligence", "Plain-language explanation of AI, machine learning, and enterprise uses."),
      result("What is AI? - Google Cloud", "https://cloud.google.com/learn/what-is-artificial-intelligence", "Google Cloud guide to AI concepts, models, and business use cases."),
      result("What is Artificial Intelligence? - AWS", "https://aws.amazon.com/what-is/artificial-intelligence/", "AWS overview of AI technologies and common implementation patterns."),
      result("AI Index Report - Stanford HAI", "https://aiindex.stanford.edu/report/", "Research-backed annual reports tracking AI trends, industry, and policy."),
      result("Machine learning - Wikipedia", "https://en.wikipedia.org/wiki/Machine_learning", "Related field covering algorithms that learn patterns from data."),
      result("Deep learning - Wikipedia", "https://en.wikipedia.org/wiki/Deep_learning", "Neural-network based methods used in modern AI systems."),
      result("Artificial Intelligence courses - Coursera", "https://www.coursera.org/search?query=artificial%20intelligence", "Courses and learning paths for AI foundations and applications."),
      result("Artificial Intelligence - Microsoft Azure", "https://azure.microsoft.com/en-us/resources/cloud-computing-dictionary/artificial-intelligence", "Microsoft explanation of AI in cloud and application development."),
      result("Artificial intelligence - NVIDIA", "https://www.nvidia.com/en-us/glossary/artificial-intelligence/", "Hardware and accelerated-computing view of AI workloads."),
      result("AI articles - MIT News", "https://news.mit.edu/topic/artificial-intelligence2", "Research news and explainers about artificial intelligence.")
    ],
    "machine learning": [
      result("Machine learning - Wikipedia", "https://en.wikipedia.org/wiki/Machine_learning", "Overview of machine learning algorithms, history, and applications."),
      result("What is machine learning? - IBM", "https://www.ibm.com/think/topics/machine-learning", "Explanation of supervised, unsupervised, and reinforcement learning."),
      result("Machine Learning Crash Course - Google", "https://developers.google.com/machine-learning/crash-course", "Hands-on Google course for machine learning basics."),
      result("Machine learning - AWS", "https://aws.amazon.com/what-is/machine-learning/", "Cloud-focused overview of machine learning systems."),
      result("Machine learning - Stanford Online", "https://online.stanford.edu/courses/sohs-ystatslearning-statistical-learning", "Learning resource connected to statistical learning concepts.")
    ],
    python: [
      result("Python programming language - Official site", "https://www.python.org/", "Official Python website with downloads, docs, and news."),
      result("Python documentation", "https://docs.python.org/3/", "Official Python 3 documentation and library reference."),
      result("Python tutorial", "https://docs.python.org/3/tutorial/", "Official beginner-friendly Python tutorial."),
      result("Python - Wikipedia", "https://en.wikipedia.org/wiki/Python_(programming_language)", "Overview of Python history, design, and ecosystem."),
      result("Real Python", "https://realpython.com/", "Python tutorials, examples, and practical guides.")
    ],
    react: [
      result("React official docs", "https://react.dev/", "Official React documentation, tutorials, and API references."),
      result("React Learn", "https://react.dev/learn", "Official learning path for components, state, and hooks."),
      result("React - Wikipedia", "https://en.wikipedia.org/wiki/React_(software)", "Overview of the React JavaScript library."),
      result("React GitHub repository", "https://github.com/facebook/react", "Source code and issues for React."),
      result("React package - npm", "https://www.npmjs.com/package/react", "React package metadata and versions on npm.")
    ],
    electron: [
      result("Electron official site", "https://www.electronjs.org/", "Official Electron framework site."),
      result("Electron documentation", "https://www.electronjs.org/docs/latest/", "Official Electron API and guide documentation."),
      result("Electron - GitHub", "https://github.com/electron/electron", "Electron source code, releases, and issues."),
      result("Electron - Wikipedia", "https://en.wikipedia.org/wiki/Electron_(software_framework)", "Overview of the Electron desktop application framework."),
      result("Electron Forge", "https://www.electronforge.io/", "Tooling for packaging and publishing Electron apps.")
    ]
  }
  knownTopicResults.ai = knownTopicResults.artificial
  knownTopicResults["artificial intelligence"] = knownTopicResults.artificial

  const genericResults = [
    result(`${cleanQuery} - Wikipedia`, `https://en.wikipedia.org/wiki/${slug}`, `Open the main Wikipedia page for ${cleanQuery}.`),
    result(`Wikipedia search for ${cleanQuery}`, siteSearch("https://en.wikipedia.org/w/index.php", "search"), `Browse matching Wikipedia pages for ${cleanQuery}.`),
    result(`Britannica search for ${cleanQuery}`, siteSearch("https://www.britannica.com/search", "query"), `Browse encyclopedia results for ${cleanQuery}.`),
    result(`Internet Archive search for ${cleanQuery}`, siteSearch("https://archive.org/search", "query"), `Find archived pages, books, and media for ${cleanQuery}.`),
    result(`GitHub search for ${cleanQuery}`, siteSearch("https://github.com/search", "q"), `Find repositories and code related to ${cleanQuery}.`),
    result(`Stack Overflow search for ${cleanQuery}`, siteSearch("https://stackoverflow.com/search", "q"), `Find developer questions and answers for ${cleanQuery}.`),
    result(`MDN search for ${cleanQuery}`, siteSearch("https://developer.mozilla.org/en-US/search", "q"), `Search MDN documentation for ${cleanQuery}.`),
    result(`Coursera search for ${cleanQuery}`, siteSearch("https://www.coursera.org/search", "query"), `Find courses and learning paths for ${cleanQuery}.`),
    result(`MIT News search for ${cleanQuery}`, siteSearch("https://news.mit.edu/search", "keyword"), `Find research news related to ${cleanQuery}.`),
    result(`YouTube search for ${cleanQuery}`, siteSearch("https://www.youtube.com/results", "search_query"), `Find videos about ${cleanQuery}.`),
    result(`Reddit search for ${cleanQuery}`, siteSearch("https://www.reddit.com/search/", "q"), `Find community discussions about ${cleanQuery}.`),
    result(`Google Scholar search for ${cleanQuery}`, siteSearch("https://scholar.google.com/scholar", "q"), `Find scholarly results for ${cleanQuery}.`)
  ]

  const seenUrls = new Set()
  const results = [...(knownTopicResults[cleanQuery.toLowerCase()] || []), ...genericResults]
    .filter(item => {
      if (!item.url || seenUrls.has(item.url)) return false
      seenUrls.add(item.url)
      return true
    })
    .slice(0, 12)

  return { results, shopping_results: [] }
}

function createInstantAiResults(query, persona = "default") {
  const searchResults = createInstantSearchResults(query).results.slice(0, 8)
  return {
    query,
    answer: [
      `Here are fast SuperBrowser results for "${query || "search"}".`,
      "Live AI synthesis is unavailable or still loading, so this answer is grounded in the sources below.",
      "",
      "Top places to start:",
      ...searchResults.slice(0, 5).map(item => `- ${item.title}: ${item.url}`),
      "",
      "Open any result to continue browsing inside SuperBrowser."
    ].join("\n"),
    sources: searchResults,
    persona,
    live_data: false,
    sources_scraped: searchResults.length,
    status: "fallback"
  }
}

function getInitialTheme() {
  if (isIncognitoRuntime()) return 'dark'
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch { return 'dark' }
}

// Icons
const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

function createNewTab(sessionId = null) {
  return {
    id: crypto.randomUUID(),
    title: "New Tab",
    tabNumber: 1,
    query: "",
    activeMode: "seo",
    results: null,
    loading: false,
    error: null,
    sessionId: sessionId || crypto.randomUUID(),
    history: [],
    browserUrl: "",
    browserTitle: "",
    createdAt: Date.now()
  }
}

function getNextTabNumber(tabs) {
  return Math.max(0, ...tabs.map(tab => Number(tab.tabNumber) || 0)) + 1
}

function createInitialTabState(appSessionId) {
  const initialTab = {
    ...createNewTab(appSessionId),
    tabNumber: 1,
    title: "New Tab"
  }

  return {
    tabs: [initialTab],
    activeTabId: initialTab.id
  }
}

function normalizeTabState(state, appSessionId) {
  const tabs = Array.isArray(state?.tabs) ? state.tabs.filter(Boolean) : []
  if (tabs.length === 0) {
    return createInitialTabState(appSessionId)
  }

  const activeTabId = tabs.some(tab => tab.id === state.activeTabId)
    ? state.activeTabId
    : tabs[tabs.length - 1].id

  return {
    ...state,
    tabs,
    activeTabId
  }
}

/* ── SVG Icons ── */
const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
)
const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
)
const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
)
const MinusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14" /></svg>
)
const SquareIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
)
const BrainIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2a7 7 0 0 0-7 7c0 3 2 5.5 4 7.5L12 22l3-5.5c2-2 4-4.5 4-7.5a7 7 0 0 0-7-7z" /></svg>
)
const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
)
const ChevronLeftIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
const ChevronRightIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
const RefreshIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
const HomeIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
const ChevronDownIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme)
  const [appSessionId] = useState(() => crypto.randomUUID())
  const [sessionStartedAt] = useState(() => new Date().toISOString())
  const [sessionStatus, setSessionStatus] = useState("starting")

  const searchInputHomeRef = useRef(null)
  const searchInputHeaderRef = useRef(null)
  const [tabState, setTabState] = useState(() => createInitialTabState(appSessionId))

  const tabs = tabState.tabs
  const activeTabId = tabState.activeTabId
  const setTabs = useCallback((updater) => {
    setTabState(current => {
      return normalizeTabState({
        ...current,
        tabs: typeof updater === 'function' ? updater(current.tabs) : updater
      }, appSessionId)
    })
  }, [appSessionId])

  const setActiveTabId = useCallback((updater) => {
    setTabState(current => {
      return normalizeTabState({
        ...current,
        activeTabId: typeof updater === 'function' ? updater(current.activeTabId) : updater
      }, appSessionId)
    })
  }, [appSessionId])
  const [showHistory, setShowHistory] = useState(false)
  const [browserHistory, setBrowserHistory] = useState(() => readWebHistory())
  const [showPricing, setShowPricing] = useState(false)
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false)
  const [showFindBox, setShowFindBox] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [placeholderModal, setPlaceholderModal] = useState(null)
  const [persona, setPersona] = useState("default")
  const [showContextInfo, setShowContextInfo] = useState(false)
  const [backendStatus, setBackendStatus] = useState(null)
  const [userRegion] = useState(() => {
    try {
      const lang = navigator.language || navigator.userLanguage || 'en-US'
      const parts = lang.split('-')
      return parts.length > 1 ? parts[1].toLowerCase() : 'us'
    } catch { return 'us' }
  })

  const searchControllersRef = useRef({})
  const searchCacheRef = useRef({})
  const contextManager = useContextManager()
  const activeTab = tabs.find(t => t.id === activeTabId)
  const isIncognito = isIncognitoRuntime()

  const isBrowserTab = Boolean(activeTab?.browserUrl)
  const isDownloadsTab = activeTab?.tabType === "downloads"
  const isBookmarksTab = activeTab?.tabType === "bookmarks"
  const isNewTab = !activeTab?.tabType && !activeTab?.results && !activeTab?.loading && !activeTab?.error && !isBrowserTab

  const toggleTheme = useCallback(() => {
    if (isIncognito) return
    setTheme(current => current === 'dark' ? 'light' : 'dark')
  }, [isIncognito])

  useEffect(() => {
    if (!window.superBrowserDesktop?.isElectron || !window.superBrowserDesktop?.backend?.getStatus) return
    window.superBrowserDesktop.backend.getStatus().then(setBackendStatus).catch(() => { })
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = isIncognito ? 'dark' : theme
    document.documentElement.dataset.incognito = isIncognito ? 'true' : 'false'
    try {
      if (isIncognito) return
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch { }
  }, [theme, isIncognito])

  useEffect(() => {
    console.log(`[App] App initialized:`, {
      activeTabId,
      totalTabs: tabs.length,
      firstTabId: tabs[0]?.id,
      sessionId: appSessionId,
      isNewTab: !tabs[0]?.results && !tabs[0]?.loading && !tabs[0]?.error && !tabs[0]?.browserUrl
    })
  }, [])

  useEffect(() => {
    if (isIncognito) {
      setSessionStatus("incognito")
      try {
        window.sessionStorage.clear()
      } catch { }
      return
    }
    contextManager.startSession(appSessionId)
      .then(() => setSessionStatus("active"))
      .catch(() => setSessionStatus("error"))
    const stopSession = () => {
      contextManager.stopSession(appSessionId, { keepalive: true }).catch(() => { })
    }
    window.addEventListener("beforeunload", stopSession)
    return () => { window.removeEventListener("beforeunload", stopSession); stopSession() }
  }, [appSessionId, contextManager, isIncognito])

  const updateTab = useCallback((tabId, updates) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...updates } : t))
  }, [])

  const recordHistoryItem = useCallback((item) => {
    if (isIncognito || !item) return
    const normalized = {
      ...item,
      id: item.id || crypto.randomUUID(),
      time: item.time || new Date().toISOString()
    }
    const keyFor = (entry) => entry.type === "page"
      ? `page:${entry.url}`
      : `search:${entry.mode}:${entry.query}`
    const nextKey = keyFor(normalized)

    setBrowserHistory(current => {
      const next = [normalized, ...current.filter(entry => keyFor(entry) !== nextKey)].slice(0, 100)
      writeWebHistory(next)
      return next
    })
  }, [isIncognito])

  const performSearch = useCallback((tabId, tabData, searchPersona = "default") => {
    const endpoints = { seo: `/api/search/seo`, ai: `/api/search/ai`, community: `/api/search/community` }
    const prev = searchControllersRef.current[tabId]
    if (prev) prev.abort()
    const controller = new AbortController()
    searchControllersRef.current[tabId] = controller

    const onSuccess = (data) => {
      const normalizedData = tabData.activeMode === 'seo' && (!Array.isArray(data?.results) || data.results.length === 0)
        ? createInstantSearchResults(tabData.query)
        : tabData.activeMode === 'ai' && !data?.answer
          ? createInstantAiResults(tabData.query, searchPersona)
          : data
      console.log(`[Search] Results received for tab ${tabId}:`, normalizedData)
      setTabs(p => p.map(t => t.id === tabId ? { ...t, results: normalizedData, loading: false, error: null } : t))
      if (!isIncognito && Array.isArray(normalizedData?.results) && normalizedData.results.length > 0) {
        contextManager.addResults(tabId, tabData.sessionId, normalizedData.results)
      }
    }

    const onError = (error) => {
      if (error?.name === 'AbortError') {
        console.log(`[Search] Request aborted for tab ${tabId}`)
        return
      }
      console.error(`[Search] Error for tab ${tabId}:`, error)
      if (tabData.activeMode === 'seo') {
        const fallbackData = createInstantSearchResults(tabData.query)
        setTabs(p => p.map(t => t.id === tabId ? { ...t, error: null, loading: false, results: fallbackData } : t))
        if (!isIncognito) contextManager.addResults(tabId, tabData.sessionId, fallbackData.results)
        return
      }
      if (tabData.activeMode === 'ai') {
        const fallbackData = createInstantAiResults(tabData.query, searchPersona)
        setTabs(p => p.map(t => t.id === tabId ? { ...t, error: null, loading: false, results: fallbackData } : t))
        if (!isIncognito) contextManager.addResults(tabId, tabData.sessionId, fallbackData.sources || [])
        return
      }
      const errorMessage = error?.message || "Search failed. Please try again."
      setTabs(p => p.map(t => t.id === tabId ? { ...t, error: errorMessage, loading: false, results: null } : t))
    }

    const onDone = () => {
      if (searchControllersRef.current[tabId] === controller) {
        delete searchControllersRef.current[tabId]
      }
    }

    if (tabData.activeMode === 'ai') {
      const context = contextManager.getAIContext(tabId)
      const hasContext = context.queries.length > 0 || context.results.length > 0 || context.visited_pages.length > 0
      if (hasContext) {
        const url = `${API_BASE}/api/search/ai/contextual`
        const payload = { query: tabData.query, persona: searchPersona, context, region: userRegion }
        console.log(`[Search] Making contextual AI request to ${url}`)
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(payload)
        })
          .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`)
            return r.json()
          })
          .then(onSuccess)
          .catch(onError)
          .finally(onDone)
        return
      }
    }

    let url = `${API_BASE}${endpoints[tabData.activeMode]}?q=${encodeURIComponent(tabData.query)}&session_id=${tabData.sessionId}&gl=${userRegion}`
    if (tabData.activeMode === 'ai') url += `&persona=${searchPersona}`
    const cacheKey = [
      'v5',
      tabData.activeMode,
      searchPersona,
      userRegion,
      tabData.query.trim().toLowerCase()
    ].join(':')
    const cached = searchCacheRef.current[cacheKey]
    if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
      onSuccess(cached.data)
      onDone()
      return
    }
    console.log(`[Search] Making ${tabData.activeMode} request to ${url}`)
    fetch(url, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`)
        return r.json()
      })
      .then(data => {
        const hasResults = Array.isArray(data?.results) ? data.results.length > 0 : Boolean(data?.answer || data?.insights)
        if (hasResults) searchCacheRef.current[cacheKey] = { data, ts: Date.now() }
        onSuccess(data)
      })
      .catch(onError)
      .finally(onDone)
  }, [contextManager, userRegion, isIncognito])

  const handleSearch = useCallback((tabId, searchPersona = "default") => {
    setTabs(currentTabs => {
      const tab = currentTabs.find(t => t.id === tabId)
      if (!tab?.query.trim()) {
        console.warn(`[Search] Empty query for tab ${tabId}`)
        return currentTabs
      }
      console.log(`[Search] Starting search on tab ${tabId}:`, { query: tab.query, mode: tab.activeMode, persona: searchPersona })
      if (!isIncognito) {
        contextManager.addQuery(tabId, tab.sessionId, tab.query, tab.activeMode)
        recordHistoryItem({
          type: "search",
          query: tab.query,
          mode: tab.activeMode,
          title: tab.query
        })
      }
      performSearch(tabId, tab, searchPersona)
      return currentTabs.map(t => {
        if (t.id !== tabId) return t
        const instantSeoResults = t.activeMode === 'seo' ? createInstantSearchResults(t.query) : null
        const updatedTab = {
          ...t,
          loading: t.activeMode !== 'seo',
          error: null,
          results: instantSeoResults || t.results,
          title: t.query.slice(0, 25),
          history: isIncognito ? [] : [...t.history, { query: t.query, mode: t.activeMode }].slice(-10)
        }
        console.log(`[Search] Tab ${tabId} updated to loading state`)
        return updatedTab
      })
    })
  }, [performSearch, contextManager, isIncognito, recordHistoryItem])

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

  const createAndActivateNewTab = useCallback(() => {
    setTabState(current => {
      const newTab = {
        ...createNewTab(appSessionId),
        tabNumber: getNextTabNumber(current.tabs),
        title: "New Tab"
      }

      const next = {
        ...current,
        tabs: [...current.tabs, newTab],
        activeTabId: newTab.id
      }
      console.log("[Tab] New tab created", {
        tabId: newTab.id,
        tabNumber: newTab.tabNumber,
        totalTabs: next.tabs.length
      })
      return normalizeTabState(next, appSessionId)
    })

    setShowHistory(false)
    setShowPricing(false)
  }, [appSessionId])

  useEffect(() => {
    if (!window.superBrowserDesktop?.app?.onNewTab) return
    return window.superBrowserDesktop.app.onNewTab(createAndActivateNewTab)
  }, [createAndActivateNewTab])

  const requestNewTab = useCallback(() => {
    createAndActivateNewTab()
  }, [createAndActivateNewTab])

  const handleNewWindow = useCallback(() => {
    if (window.superBrowserDesktop?.app?.newWindow) {
      window.superBrowserDesktop.app.newWindow().catch(() => { })
      return
    }
    window.open(window.location.href, '_blank', 'noopener,noreferrer')
  }, [])

  const handleNewIncognitoWindow = useCallback(() => {
    if (window.superBrowserDesktop?.isElectron && window.superBrowserDesktop?.app?.newIncognitoWindow) {
      window.superBrowserDesktop.app.newIncognitoWindow().catch(() => { })
      return
    }

    const opened = window.open(createWebIncognitoUrl(), '_blank', 'noopener,noreferrer')
    if (!opened) {
      setPlaceholderModal({
        title: "Incognito unavailable",
        message: "Allow pop-ups for this site to open a new Incognito window."
      })
    }
  }, [])

  const openDownloadsTab = useCallback(() => {
    setTabState(current => {
      const existing = current.tabs.find(tab => tab.tabType === "downloads")
      if (existing) {
        return normalizeTabState({
          ...current,
          activeTabId: existing.id
        }, appSessionId)
      }

      const downloadsTab = {
        ...createNewTab(appSessionId),
        tabNumber: getNextTabNumber(current.tabs),
        title: "Downloads",
        tabType: "downloads",
        query: "",
        history: []
      }

      return normalizeTabState({
        ...current,
        tabs: [...current.tabs, downloadsTab],
        activeTabId: downloadsTab.id
      }, appSessionId)
    })

    setShowHistory(false)
    setShowPricing(false)
  }, [appSessionId])

  const openBookmarksTab = useCallback(() => {
    setTabState(current => {
      const existing = current.tabs.find(tab => tab.tabType === "bookmarks")
      if (existing) {
        return normalizeTabState({
          ...current,
          activeTabId: existing.id
        }, appSessionId)
      }

      const bookmarksTab = {
        ...createNewTab(appSessionId),
        tabNumber: getNextTabNumber(current.tabs),
        title: "Bookmarks",
        tabType: "bookmarks",
        query: "",
        results: null,
        loading: false,
        error: null,
        browserUrl: "",
        browserTitle: "",
        history: []
      }

      return normalizeTabState({
        ...current,
        tabs: [...current.tabs, bookmarksTab],
        activeTabId: bookmarksTab.id
      }, appSessionId)
    })

    setShowHistory(false)
    setShowPricing(false)
  }, [appSessionId])

  const openBookmarkInNewTab = useCallback((bookmark) => {
    if (!bookmark) return
    setTabState(current => {
      const bookmarkTab = {
        ...createNewTab(appSessionId),
        tabNumber: getNextTabNumber(current.tabs),
        title: (bookmark.title || bookmark.url || bookmark.query || "Bookmark").slice(0, 25),
        query: bookmark.url ? "" : (bookmark.query || bookmark.value || bookmark.title || ""),
        results: null,
        loading: false,
        error: null,
        browserUrl: bookmark.url || "",
        browserTitle: bookmark.url ? (bookmark.title || bookmark.url) : "",
        tabType: undefined,
        history: []
      }

      return normalizeTabState({
        ...current,
        tabs: [...current.tabs, bookmarkTab],
        activeTabId: bookmarkTab.id
      }, appSessionId)
    })

    setShowHistory(false)
    setShowPricing(false)
  }, [appSessionId])

  const handleAddCurrentBookmark = useCallback(() => {
    const sourceTab = tabs.find(tab => tab.id === activeTabId) || activeTab
    const hasUrl = Boolean(sourceTab?.browserUrl)
    const hasQuery = Boolean(sourceTab?.query?.trim())
    const bookmark = {
      id: crypto.randomUUID(),
      title: hasUrl
        ? (sourceTab.browserTitle || sourceTab.browserUrl)
        : hasQuery
          ? sourceTab.query.trim()
          : "New Tab",
      url: hasUrl ? sourceTab.browserUrl : "",
      query: hasUrl ? "" : hasQuery ? sourceTab.query.trim() : "",
      createdAt: new Date().toISOString()
    }

    const nextBookmarks = [bookmark, ...readBookmarks()]
    writeBookmarks(nextBookmarks)
    window.dispatchEvent(new CustomEvent("superbrowser:bookmarks-updated", { detail: nextBookmarks }))
    return bookmark
  }, [activeTab, activeTabId, tabs])

  const handleOpenPlaceholder = useCallback((title, message) => {
    setPlaceholderModal({ title, message })
  }, [])

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true)
  }, [])

  const handleFindInPage = useCallback(() => {
    setShowFindBox(true)
  }, [])

  const handlePrint = useCallback(async () => {
    const openElectronPrintPreview = async (pdfData, title = "SuperBrowser Print Preview") => {
      const bytes = pdfData instanceof Uint8Array ? pdfData : new Uint8Array(pdfData)
      await window.superBrowserDesktop.app.showPrintPreview(Array.from(bytes), title)
    }

    const activeWebview = document.querySelector('webview[data-active-browser-view="true"]')
    if (window.superBrowserDesktop?.isElectron) {
      if (activeWebview?.printToPDF && window.superBrowserDesktop?.app?.showPrintPreview) {
        try {
          activeWebview.focus?.()
          const pdfData = await activeWebview.printToPDF({
            printBackground: true,
            marginsType: 0,
            preferCSSPageSize: true
          })
          await openElectronPrintPreview(pdfData, activeTab?.browserTitle || activeTab?.title || "SuperBrowser Print Preview")
          return
        } catch {
          // Fall through to Electron's direct print as a last resort.
        }
      }

      if (window.superBrowserDesktop?.app?.printPreview) {
        try {
          await window.superBrowserDesktop.app.printPreview(activeTab?.title || "SuperBrowser Print Preview")
          return
        } catch {
          // Fall through to direct printing below.
        }
      }

      if (activeWebview?.print) {
        activeWebview.print({ printBackground: true })
        return
      }

      window.superBrowserDesktop?.app?.print?.().catch(() => window.print())
      return
    }

    const activeFrame = document.querySelector('iframe[data-active-browser-view="true"]')
    if (activeFrame?.contentWindow) {
      try {
        activeFrame.contentWindow.focus()
        activeFrame.contentWindow.print()
        return
      } catch { }
    }

    if (activeTab?.browserUrl) {
      const printWindow = window.open(activeTab.browserUrl, '_blank', 'noopener,noreferrer')
      if (printWindow) {
        printWindow.addEventListener?.('load', () => printWindow.print(), { once: true })
        window.setTimeout(() => printWindow.print?.(), 1200)
        return
      }
    }

    window.print()
  }, [activeTab?.browserTitle, activeTab?.title, activeTab?.browserUrl])

  const handleDeleteBrowsingData = useCallback(() => {
    Object.values(searchControllersRef.current).forEach(controller => controller?.abort?.())
    searchControllersRef.current = {}
    searchCacheRef.current = {}
    setBrowserHistory([])

    const freshTabState = createInitialTabState(appSessionId)
    setTabState(freshTabState)
    setShowHistory(false)
    setShowPricing(false)
    setShowFindBox(false)
    setShowContextInfo(false)

    try {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
      const savedBookmarks = window.localStorage.getItem(BOOKMARKS_STORAGE_KEY)
      window.localStorage.clear()
      if (savedTheme) window.localStorage.setItem(THEME_STORAGE_KEY, savedTheme)
      if (savedBookmarks) window.localStorage.setItem(BOOKMARKS_STORAGE_KEY, savedBookmarks)
    } catch { }

    try {
      window.sessionStorage.clear()
    } catch { }

    if (window.superBrowserDesktop?.app?.clearBrowsingData) {
      window.superBrowserDesktop.app.clearBrowsingData().catch(() => { })
    }
  }, [appSessionId])

  const handleGlobalWorkspaceWipe = useCallback(async () => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently clear all tabs, browsing history, and AI contexts? This cannot be undone."
    )
    if (!confirmed) return

    try {
      await clearEntireSessionWorkspace(appSessionId || "default-session")
    } catch (error) {
      console.warn("Backend workspace wipe failed; clearing local browser state anyway.", error)
    }

    handleDeleteBrowsingData()
  }, [appSessionId, handleDeleteBrowsingData])

  useEffect(() => {
    if (!window.superBrowserDesktop?.app?.onFindInPage) return
    return window.superBrowserDesktop.app.onFindInPage(handleFindInPage)
  }, [handleFindInPage])

  useEffect(() => {
    if (!window.superBrowserDesktop?.app?.onDeleteBrowsingData) return
    return window.superBrowserDesktop.app.onDeleteBrowsingData(handleDeleteBrowsingData)
  }, [handleDeleteBrowsingData])

  useEffect(() => {
    if (!window.superBrowserDesktop?.app?.onOpenDownloads) return
    return window.superBrowserDesktop.app.onOpenDownloads(openDownloadsTab)
  }, [openDownloadsTab])

  const handleCloseTab = useCallback((tabId, e) => {
    if (e && e.stopPropagation) e.stopPropagation()
    setTabState(current => {
      if (current.tabs.length === 1) {
        const r = {
          ...createNewTab(appSessionId),
          tabNumber: 1,
          title: "New Tab"
        }
        const next = {
          tabs: [r],
          activeTabId: r.id
        }
        return normalizeTabState(next, appSessionId)
      }
      const filtered = current.tabs.filter(t => t.id !== tabId)
      if (tabId !== current.activeTabId) {
        return normalizeTabState({
          ...current,
          tabs: filtered
        }, appSessionId)
      }
      const index = current.tabs.findIndex(t => t.id === tabId)
      const fallbackIndex = Math.max(0, index - 1)
      return normalizeTabState({
        tabs: filtered,
        activeTabId: filtered[fallbackIndex]?.id || filtered[0]?.id || null
      }, appSessionId)
    })
  }, [appSessionId])

  // Unified Top-Level Keyboard Shortcuts Manager
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isTyping = e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.isContentEditable;

      // 1. Ctrl + L / Cmd + L : Focus and Select Search Input (Always works everywhere)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        const targetInput = searchInputHomeRef.current || searchInputHeaderRef.current
        if (targetInput) {
          targetInput.focus()
          targetInput.select()
        }
        return
      }

      // 2. Ctrl + T : New Tab
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        if (window.superBrowserDesktop?.isElectron) return
        e.preventDefault()
        requestNewTab()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        if (window.superBrowserDesktop?.isElectron) return
        e.preventDefault()
        handleNewIncognitoWindow()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        openDownloadsTab()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        openBookmarksTab()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Delete') {
        e.preventDefault()
        handleDeleteBrowsingData()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        handleFindInPage()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        handlePrint()
        return
      }

      // Stop handling other hotkeys if typing inside an interactive field
      if (isTyping) return

      // 4. Ctrl + W : Close Tab
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault()
        if (activeTabId) handleCloseTab(activeTabId)
        return
      }

      // 5. Ctrl + 1 / 2 / 3 : Switch Tab Operating Modes
      if ((e.ctrlKey || e.metaKey) && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault()
        const modes = ['seo', 'ai', 'community']
        handleModeChange(modes[parseInt(e.key) - 1])
        return
      }

      // 6. Escape : Clear Search Query
      if (e.key === 'Escape') {
        e.preventDefault()
        setActiveTabId(currentId => {
          if (currentId) updateTab(currentId, { query: "" })
          return currentId
        })
        return
      }

      // 7. '?' Key : Open Hotkeys Help Modal
      if (e.key === '?') {
        e.preventDefault()
        setShowShortcutsHelp(true)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTabId, handleModeChange, updateTab, requestNewTab, handleCloseTab, handleNewIncognitoWindow, openDownloadsTab, openBookmarksTab, handleDeleteBrowsingData, handleFindInPage, handlePrint])

  function handleHistoryClick(item) {
    if (item?.type === "page" && item.url) {
      openInAppUrl(item.url, item.title || item.url)
      setShowHistory(false)
      return
    }
    updateTab(activeTabId, {
      query: item.query,
      activeMode: item.mode || "seo",
      tabType: undefined,
      browserUrl: "",
      browserTitle: "",
      results: null,
      error: null
    })
    setTimeout(() => handleSearch(activeTabId, persona), 0)
    setShowHistory(false)
  }

  function openInAppUrl(url, title = "Web Page") {
    if (!url) return
    recordHistoryItem({
      type: "page",
      url,
      title: title || url
    })
    setTabState(current => {
      const targetTabId = current.activeTabId || activeTabId
      if (!targetTabId) return current
      const next = {
        ...current,
        tabs: current.tabs.map(tab => tab.id === targetTabId
          ? {
            ...tab,
            tabType: undefined,
            browserUrl: url,
            browserTitle: title,
            title: (title || "Web Page").slice(0, 25)
          }
          : tab),
        activeTabId: targetTabId
      }
      return normalizeTabState(next, appSessionId)
    })
    if (!isIncognito && activeTab) contextManager.addVisitedPage(activeTabId, activeTab.sessionId, url, title, `Visited: ${url}`)
  }

  function goHome() {
    updateTab(activeTabId, { query: "", results: null, loading: false, error: null, browserUrl: "", browserTitle: "" })
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-transparent text-[var(--text-primary)] relative z-10">
      <Suspense fallback={null}>
        <LazyBackgroundOrb isVisible={isNewTab} />
      </Suspense>

      {/* Hand-drawn style TabBar with theme toggle */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={(tabId) => { setShowPricing(false); setActiveTabId(tabId) }}
        onCloseTab={handleCloseTab}
        onAddTab={requestNewTab}
        onNewWindow={handleNewWindow}
        onNewIncognitoWindow={handleNewIncognitoWindow}
        onShowHistory={() => {
          setShowPricing(false)
          if (isIncognito) {
            setShowHistory(false)
            setPlaceholderModal({
              title: "History is off in Incognito",
              message: "Pages and searches from Incognito windows are not saved."
            })
            return
          }
          setShowHistory(true)
        }}
        onOpenPricing={() => { setShowHistory(false); setShowPricing(true) }}
        onOpenDownloads={openDownloadsTab}
        onOpenBookmarks={openBookmarksTab}
        onOpenExtensions={() => handleOpenPlaceholder("Extensions are not supported yet", "Extension management is not available in this version of SuperBrowser.")}
        onDeleteBrowsingData={handleDeleteBrowsingData}
        onFindInPage={handleFindInPage}
        onPrint={handlePrint}
        onOpenSettings={handleOpenSettings}
        isIncognito={isIncognito}
        theme={theme}
        onToggleTheme={toggleTheme}
        onWipeWorkspace={handleGlobalWorkspaceWipe}
      />

      {/* Main Content */}
      <div className="print-surface flex-1 flex flex-col min-h-0 relative">
        {window.superBrowserDesktop?.isElectron && <BackendStatusBanner status={backendStatus} />}

        {isBookmarksTab ? (
          <BookmarksPage
            activeTab={activeTab}
            onOpenBookmark={openBookmarkInNewTab}
            onAddCurrentPage={handleAddCurrentBookmark}
          />
        ) : isDownloadsTab ? (
          <DownloadsPage />
        ) : isBrowserTab ? (
          <div className="flex-1 min-h-0 bg-white">
            <BrowserPanel url={activeTab.browserUrl} title={activeTab.browserTitle} onClose={() => updateTab(activeTabId, { browserUrl: "", browserTitle: "" })} />
          </div>
        ) : isNewTab ? (
          /* Hand-drawn Centered Landing Page */
          <div className="flex-1 flex flex-col items-center justify-center p-4">
            <div className="relative mb-12 text-center">
              <div className="absolute inset-0 bg-white/70 blur-3xl -z-10 rounded-full scale-[1.3] pointer-events-none"></div>
              <h1 className="title-hero text-center select-none m-0">SUPER BROWSER</h1>
            </div>

            <div className="w-full max-w-2xl mb-8">
              <div className="pill-search flex items-center px-6 py-4 w-full cursor-text relative bg-white/80 backdrop-blur-sm" onClick={() => searchInputHomeRef.current?.focus()}>
                {activeTab?.loading ? (
                  <div className="w-[18px] h-[18px] rounded-full border-2 border-[var(--border-color)] border-t-[var(--action-primary)] animate-spin shrink-0" />
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (activeTab?.query.trim()) {
                        handleSearch(activeTabId, persona)
                      }
                    }}
                    className="text-[var(--text-secondary)] hover:text-[var(--action-primary)] transition-colors shrink-0"
                    title="Search"
                  >
                    <SearchIcon />
                  </button>
                )}
                <input
                  ref={searchInputHomeRef}
                  type="text"
                  value={activeTab?.query || ''}
                  onChange={(e) => updateTab(activeTabId, { query: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && activeTab?.query.trim()) {
                      e.preventDefault()
                      handleSearch(activeTabId, persona)
                    }
                  }}
                  placeholder="Enter your search..."
                  disabled={activeTab?.loading}
                  className="flex-1 ml-4 outline-none text-xl bg-transparent text-[var(--text-primary)] disabled:opacity-50"
                  style={{ letterSpacing: '-0.01em' }}
                />
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
            <div className="px-6 py-3 border-b border-[var(--border-color)] flex items-center gap-4 bg-white">
              {/* Browser Navigation Controls */}
              <div className="flex items-center gap-1">
                <button onClick={() => {
                  if (activeTab?.history && activeTab.history.length > 1) {
                    const prev = activeTab.history[activeTab.history.length - 2];
                    updateTab(activeTabId, { query: prev.query, activeMode: prev.mode, history: activeTab.history.slice(0, -1) });
                    setTimeout(() => handleSearch(activeTabId, persona), 0);
                  } else {
                    goHome();
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
                <button onClick={goHome} className="p-2 flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-black transition-colors" title="Home">
                  <HomeIcon />
                </button>
              </div>

              <div className="pill-search flex items-center px-5 py-2.5 flex-1 max-w-3xl">
                {activeTab?.loading ? <div className="w-[18px] h-[18px] rounded-full border-2 border-[var(--border-color)] border-t-[var(--action-primary)] animate-spin" /> : <span className="text-[var(--text-tertiary)]"><SearchIcon /></span>}
                <input
                  ref={searchInputHeaderRef}
                  type="text"
                  value={activeTab?.query || ''}
                  onChange={(e) => updateTab(activeTabId, { query: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(activeTabId, persona)}
                  placeholder="Search..."
                  className="flex-1 ml-3 outline-none text-base bg-transparent text-[var(--text-primary)]"
                />
                <button
                  onClick={() => handleSearch(activeTabId, persona)}
                  disabled={!activeTab?.query?.trim() || activeTab?.loading}
                  className="ml-2 px-4 py-1.5 rounded-full bg-[var(--action-primary)] text-white text-sm font-medium hover:bg-[var(--action-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Search
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleModeChange('seo')} className={`pill-btn px-4 py-1.5 ${activeTab?.activeMode === 'seo' ? 'active' : ''}`}>SEO</button>
                <button onClick={() => handleModeChange('ai')} className={`pill-btn px-4 py-1.5 ${activeTab?.activeMode === 'ai' ? 'active' : ''}`}>AI</button>
                <button onClick={() => handleModeChange('community')} className={`pill-btn px-4 py-1.5 ${activeTab?.activeMode === 'community' ? 'active' : ''}`}>REVIEW</button>
              </div>
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
                      <PersonaDropdown value={persona} onChange={setPersona} personas={PERSONAS} />
                    </div>
                    <ContextIndicator tabId={activeTabId} contextManager={contextManager} onToggleInfo={() => setShowContextInfo(!showContextInfo)} />
                  </div>
                )}

                <ResultsPanel mode={activeTab?.activeMode} results={activeTab?.results} loading={activeTab?.loading} onOpenLink={openInAppUrl} query={activeTab?.query} />
              </div>

            </div>
          </div>
        )}
        {showHistory && (
          <HistoryPanel
            items={browserHistory}
            onOpen={handleHistoryClick}
            onClose={() => setShowHistory(false)}
          />
        )}
      </div>

      {showPricing && <PricingPage onClose={() => setShowPricing(false)} />}
      {showShortcutsHelp && <ShortcutsHelpModal onClose={() => setShowShortcutsHelp(false)} />}
      {showFindBox && <FindInPageBox onClose={() => setShowFindBox(false)} />}
      {settingsOpen && <SettingsModal theme={theme} onToggleTheme={toggleTheme} onClose={() => setSettingsOpen(false)} />}
      {placeholderModal && (
        <PlaceholderModal
          title={placeholderModal.title}
          message={placeholderModal.message}
          onClose={() => setPlaceholderModal(null)}
        />
      )}
      <ContextWindow show={showContextInfo} onClose={() => setShowContextInfo(false)} tabId={activeTabId} sessionId={appSessionId} sessionStartedAt={sessionStartedAt} sessionStatus={sessionStatus} contextManager={contextManager} />
    </div>
  )
}

/* ── UI Components ── */

function TabBar({
  tabs,
  activeTabId,
  onTabClick,
  onCloseTab,
  onAddTab,
  onNewWindow,
  onNewIncognitoWindow,
  onShowHistory,
  onOpenPricing,
  onOpenDownloads,
  onOpenBookmarks,
  onOpenExtensions,
  onDeleteBrowsingData,
  onFindInPage,
  onPrint,
  onOpenSettings,
  isIncognito,
  theme,
  onToggleTheme,
  onWipeWorkspace
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const activeTabRef = useRef(null)

  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [activeTabId])

  return (
    <div className="no-print relative z-50 flex border-b border-[var(--border-color)] w-full bg-white select-none" style={{ height: '44px' }}>
      <div className="flex-1 min-w-0 flex overflow-x-auto scrollbar-hide h-full" role="tablist" aria-label="Browser tabs">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            ref={tab.id === activeTabId ? activeTabRef : null}
            data-tab-id={tab.id}
            role="tab"
            tabIndex={0}
            aria-selected={tab.id === activeTabId}
            onClick={() => onTabClick(tab.id)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              onTabClick(tab.id)
            }}
            className={`flex-none flex items-center gap-2 px-3 h-full w-[184px] cursor-pointer border-r border-[var(--border-color)] group text-left ${tab.id === activeTabId ? 'tab-active' : 'tab-inactive'}`}
            title={tab.title}
          >
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${tab.id === activeTabId ? 'bg-[rgba(50,121,249,0.12)] text-[var(--action-primary)]' : 'bg-white text-[var(--text-tertiary)]'}`}>
              TAB {tab.tabNumber || 1}
            </span>
            <span className="truncate text-[13px] flex-1 min-w-0">
              {tab.title.length > 20 ? tab.title.slice(0, 20) + '…' : tab.title}
            </span>
            <button
              type="button"
              onClick={(e) => onCloseTab(tab.id, e)}
              className="w-5 h-5 shrink-0 flex items-center justify-center rounded hover:bg-black/5 opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)]"
              title="Close tab"
            >
              <XIcon />
            </button>
          </div>
        ))}
        <button type="button" onClick={onAddTab} className="flex-none w-12 h-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border-r border-[var(--border-color)] flex items-center justify-center transition-colors" title="New Tab (Ctrl+T)" aria-label="New tab">
          <PlusIcon />
        </button>
      </div>
      <div className="shrink-0 flex items-center h-full border-l border-[var(--border-color)] relative">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`px-5 h-full text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors ${isMenuOpen ? 'bg-[var(--bg-hover)]' : ''}`}
        >
          BROWSER MENU
        </button>
        {isMenuOpen && (
          <BrowserMenu
            onClose={() => setIsMenuOpen(false)}
            onAddTab={onAddTab}
            onNewWindow={onNewWindow}
            onNewIncognitoWindow={onNewIncognitoWindow}
            onShowHistory={onShowHistory}
            onOpenPricing={onOpenPricing}
            onOpenDownloads={onOpenDownloads}
            onOpenBookmarks={onOpenBookmarks}
            onOpenExtensions={onOpenExtensions}
            onDeleteBrowsingData={onDeleteBrowsingData}
            onFindInPage={onFindInPage}
            onPrint={onPrint}
            onOpenSettings={onOpenSettings}
            isIncognito={isIncognito}
            onWipeWorkspace={onWipeWorkspace}
          />
        )}

        <button
          type="button"
          onClick={onWipeWorkspace}
          className="mx-2 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white hover:bg-red-700 rounded transition-colors"
          title="Clear all session data"
        >
          Wipe Workspace
        </button>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="theme-toggle w-12 h-full flex items-center justify-center transition-colors"
          aria-label={`Switch to ${nextTheme} mode`}
          aria-pressed={theme === 'dark'}
          title={`Switch to ${nextTheme} mode`}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Pricing Button */}
        <button
          onClick={() => { setIsMenuOpen(false); onOpenPricing() }}
          className="px-4 h-full text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors border-l border-[var(--border-color)]"
          title="Pricing"
        >
          PRICING
        </button>

        {/* Window Controls */}
        <div className="flex h-full pl-1 border-l border-[var(--border-color)]">
          <button onClick={() => window.superBrowserDesktop?.minimize?.()} className="w-12 h-full text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] flex items-center justify-center transition-colors" title="Minimize"><MinusIcon /></button>
          <button onClick={() => window.superBrowserDesktop?.maximize?.()} className="w-12 h-full text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] flex items-center justify-center transition-colors" title="Maximize"><SquareIcon /></button>
          <button onClick={() => window.superBrowserDesktop?.close?.() || window.close()} className="w-12 h-full text-[var(--text-tertiary)] hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors" title="Close"><XIcon /></button>
        </div>
      </div>
    </div>
  )
}

function ShortcutsHelpModal({ onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const bindings = [
    { keys: ["Ctrl + T", "Cmd + T"], desc: "Open a new application tab" },
    { keys: ["Ctrl + W", "Cmd + W"], desc: "Close the currently active tab" },
    { keys: ["Ctrl + L", "Cmd + L"], desc: "Highlight and focus your active search bar" },
    { keys: ["Ctrl + 1"], desc: "Switch mode to Super SEO Panel" },
    { keys: ["Ctrl + 2"], desc: "Switch mode to Super AI Analytics" },
    { keys: ["Ctrl + 3"], desc: "Switch mode to Super Community Review" },
    { keys: ["Escape"], desc: "Instantly clear contents inside the current search field" },
    { keys: ["Ctrl + P"], desc: "Print current active display page structure" },
    { keys: ["?"], desc: "Display this helpful keyboard shortcut reference modal" },
  ]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in-up" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 border border-[var(--border-color)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-[var(--border-color)]">
          <h3 className="text-lg font-semibold tracking-tight">Application Keyboard Shortcuts</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)]"><XIcon /></button>
        </div>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {bindings.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm gap-4 py-0.5">
              <span className="text-[var(--text-secondary)] font-medium text-left">{item.desc}</span>
              <div className="flex gap-1 shrink-0">
                {item.keys.map((k, kIdx) => (
                  <kbd key={kIdx} className="bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-primary)] rounded px-1.5 py-0.5 text-xs font-mono font-bold shadow-sm last:mr-0">
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PlaceholderModal({ title, message, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in-up" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 border border-[var(--border-color)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-[var(--border-color)]">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)]"><XIcon /></button>
        </div>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)] mb-5">{message}</p>
        <button onClick={onClose} className="btn-primary px-4 py-2 text-sm font-medium">OK</button>
      </div>
    </div>
  )
}

function HistoryPanel({ items, onOpen, onClose }) {
  const formatHistoryTime = (value) => {
    if (!value) return ""
    try {
      return new Date(value).toLocaleString()
    } catch {
      return ""
    }
  }

  return (
    <aside className="absolute inset-y-0 right-0 z-30 w-80 border-l border-[var(--border-color)] bg-white shadow-2xl p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text-primary)]">History</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)]"><XIcon /></button>
      </div>

      {items.length === 0 ? (
        <div className="card-minimal p-6 text-center">
          <p className="text-sm font-medium text-[var(--text-primary)] mb-1">No history</p>
          <p className="text-xs text-[var(--text-secondary)] m-0">Searches and opened pages will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onOpen(item)}
              className="w-full text-left p-3 rounded-lg border border-[var(--border-color)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <p className="text-sm truncate mb-1 text-[var(--text-primary)]">{item.title || item.query || item.url}</p>
              <p className="text-xs truncate mb-2 text-[var(--text-tertiary)]">{item.url || item.query}</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-[var(--bg-elevated)] text-[var(--text-secondary)] uppercase">
                  {item.type === "page" ? "page" : item.mode || "search"}
                </span>
                <span className="text-[11px] text-[var(--text-tertiary)]">{formatHistoryTime(item.time)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </aside>
  )
}

function BookmarksPage({ activeTab, onOpenBookmark, onAddCurrentPage }) {
  const [bookmarks, setBookmarks] = useState(() => readBookmarks())
  const [query, setQuery] = useState("")

  useEffect(() => {
    const handleBookmarksUpdated = (event) => {
      if (Array.isArray(event.detail)) {
        setBookmarks(event.detail)
        return
      }
      setBookmarks(readBookmarks())
    }
    window.addEventListener("superbrowser:bookmarks-updated", handleBookmarksUpdated)
    window.addEventListener("storage", handleBookmarksUpdated)
    return () => {
      window.removeEventListener("superbrowser:bookmarks-updated", handleBookmarksUpdated)
      window.removeEventListener("storage", handleBookmarksUpdated)
    }
  }, [])

  const saveBookmarks = (items) => {
    writeBookmarks(items)
    setBookmarks(items)
    window.dispatchEvent(new CustomEvent("superbrowser:bookmarks-updated", { detail: items }))
  }

  const addCurrentPage = () => {
    const bookmark = onAddCurrentPage?.(activeTab)
    if (bookmark) setBookmarks(readBookmarks())
  }

  const deleteBookmark = (bookmarkId) => {
    saveBookmarks(bookmarks.filter(bookmark => bookmark.id !== bookmarkId))
  }

  const formatDate = (value) => {
    if (!value) return ""
    try {
      return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    } catch {
      return value
    }
  }

  const filteredBookmarks = bookmarks.filter(bookmark => {
    const searchValue = `${bookmark.title || ""} ${bookmark.url || ""} ${bookmark.query || ""}`.toLowerCase()
    return searchValue.includes(query.trim().toLowerCase())
  })

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--bg-page)]">
      <div className="sticky top-0 z-10 bg-[var(--bg-page)]/95 backdrop-blur border-b border-[var(--border-color)]">
        <div className="max-w-6xl mx-auto px-6 py-4 grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-4 items-center">
          <h1 className="text-2xl font-semibold tracking-tight m-0">Bookmarks</h1>
          <div className="pill-search flex items-center px-4 py-2 bg-[var(--bg-surface)] shadow-none">
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search bookmarks"
              className="flex-1 ml-3 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            />
          </div>
          <button onClick={addCurrentPage} className="btn-secondary px-4 py-2 text-sm justify-self-end">
            Add current page
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {filteredBookmarks.length === 0 ? (
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-10 text-center">
            <p className="text-lg font-medium text-[var(--text-primary)] mb-1">No bookmarks yet</p>
            <p className="text-sm text-[var(--text-secondary)] m-0">Saved pages and searches will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBookmarks.map(bookmark => {
              const target = bookmark.url || bookmark.query || "New Tab"
              return (
                <div key={bookmark.id} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 flex items-center gap-4 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-tertiary)] shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--text-primary)] truncate mb-1">{bookmark.title || target}</p>
                    <p className="text-xs text-[var(--text-tertiary)] truncate mb-1">{target}</p>
                    <p className="text-xs text-[var(--text-secondary)] m-0">{formatDate(bookmark.createdAt)}</p>
                  </div>
                  <button onClick={() => onOpenBookmark?.(bookmark)} className="btn-secondary px-3 py-2 text-sm">
                    Open
                  </button>
                  <button
                    onClick={() => deleteBookmark(bookmark.id)}
                    className="p-2 rounded-full text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-red-600"
                    title="Delete bookmark"
                  >
                    <XIcon />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function DownloadsPage() {
  const [downloads, setDownloads] = useState([])
  const [query, setQuery] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const directoryInputRef = useRef(null)
  const hasLoadedDownloadsRef = useRef(false)
  const isDesktopDownloadsAvailable = Boolean(window.superBrowserDesktop?.downloads?.getList)
  const isWebDownloads = !isDesktopDownloadsAvailable

  const loadDownloads = useCallback(() => {
    if (!isDesktopDownloadsAvailable) {
      setDownloads(readWebDownloads())
      setLoading(false)
      hasLoadedDownloadsRef.current = true
      return
    }
    if (!hasLoadedDownloadsRef.current) setLoading(true)
    window.superBrowserDesktop.downloads.getList()
      .then(items => {
        setDownloads(Array.isArray(items) ? items : [])
        setError("")
      })
      .catch(() => setError("Unable to load downloads."))
      .finally(() => {
        hasLoadedDownloadsRef.current = true
        setLoading(false)
      })
  }, [isDesktopDownloadsAvailable])

  useEffect(() => {
    loadDownloads()
    if (!isDesktopDownloadsAvailable) return
    const interval = window.setInterval(loadDownloads, 5000)
    return () => window.clearInterval(interval)
  }, [loadDownloads, isDesktopDownloadsAvailable])

  const filteredDownloads = downloads.filter(item => {
    const text = `${item.fileName || ""} ${item.savePath || ""}`.toLowerCase()
    return text.includes(query.trim().toLowerCase())
  })

  const openFolder = () => {
    if (!window.superBrowserDesktop?.downloads?.openFolder) {
      setError("Opening the downloads folder is available in the desktop app.")
      return
    }
    window.superBrowserDesktop?.downloads?.openFolder?.().catch(() => setError("Unable to open downloads folder."))
  }

  const openFile = (path) => {
    if (!path) return
    if (!window.superBrowserDesktop?.downloads?.openFile) {
      window.open(path, '_blank', 'noopener,noreferrer')
      return
    }
    window.superBrowserDesktop?.downloads?.openFile?.(path).catch(() => setError("Unable to open file."))
  }

  const showInFolder = (path) => {
    if (!path) {
      openFolder()
      return
    }
    if (window.superBrowserDesktop?.downloads?.showInFolder) {
      window.superBrowserDesktop.downloads.showInFolder(path).catch(() => setError("Unable to show file in folder."))
      return
    }
    openFolder()
  }

  const clearList = () => {
    if (!isDesktopDownloadsAvailable) {
      writeWebDownloads([])
      setDownloads([])
      setError("")
      return
    }
    window.superBrowserDesktop?.downloads?.clearList?.()
      .then(() => setDownloads([]))
      .catch(() => setError("Unable to clear downloads."))
  }

  const saveWebDownloads = (items) => {
    const nextItems = items
      .sort((a, b) => new Date(b.endTime || 0) - new Date(a.endTime || 0))
      .slice(0, 200)
    writeWebDownloads(nextItems)
    setDownloads(nextItems)
    setError("")
  }

  const chooseDownloadsFolder = async () => {
    if (!isWebDownloads) {
      loadDownloads()
      return
    }

    if (window.showDirectoryPicker) {
      try {
        const directory = await window.showDirectoryPicker({ mode: "read" })
        const items = []
        for await (const [name, handle] of directory.entries()) {
          if (handle.kind !== "file") continue
          const file = await handle.getFile()
          items.push({
            id: `web:${directory.name}:${name}:${file.lastModified}:${file.size}`,
            fileName: name,
            savePath: `${directory.name}/${name}`,
            fileSize: file.size,
            receivedBytes: file.size,
            state: "completed",
            startTime: new Date(file.lastModified).toISOString(),
            endTime: new Date(file.lastModified).toISOString(),
          })
        }
        saveWebDownloads(items)
      } catch (error) {
        if (error?.name !== "AbortError") setError("Unable to read the selected downloads folder.")
      }
      return
    }

    directoryInputRef.current?.click()
  }

  const handleDirectoryInputChange = (event) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return
    const items = files.map(file => {
      const relativePath = file.webkitRelativePath || file.name
      return {
        id: `web:${relativePath}:${file.lastModified}:${file.size}`,
        fileName: file.name,
        savePath: relativePath,
        fileSize: file.size,
        receivedBytes: file.size,
        state: "completed",
        startTime: new Date(file.lastModified).toISOString(),
        endTime: new Date(file.lastModified).toISOString(),
      }
    })
    saveWebDownloads(items)
    event.target.value = ""
  }

  const formatBytes = (bytes) => {
    const value = Number(bytes) || 0
    if (value < 1024) return `${value} B`
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
    if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
    return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const formatTime = (value) => {
    if (!value) return ""
    try {
      return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    } catch {
      return value
    }
  }

  const formatStatus = (item) => {
    if (item.state === "progress") {
      return `${formatBytes(item.receivedBytes)}${item.fileSize ? ` of ${formatBytes(item.fileSize)}` : ""}`
    }
    if (item.state === "interrupted") return "Interrupted"
    if (item.state === "cancelled") return "Cancelled"
    return formatBytes(item.fileSize || item.receivedBytes)
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--bg-page)]">
      <div className="sticky top-0 z-10 bg-[var(--bg-page)]/95 backdrop-blur border-b border-[var(--border-color)]">
        <div className="max-w-6xl mx-auto px-6 py-4 grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-4 items-center">
          <h1 className="text-2xl font-semibold tracking-tight m-0">Downloads</h1>
          <div className="pill-search flex items-center px-4 py-2 bg-[var(--bg-surface)] shadow-none">
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search downloads"
              className="flex-1 ml-3 bg-transparent outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            {isWebDownloads && (
              <button onClick={chooseDownloadsFolder} className="btn-secondary px-4 py-2 text-sm">
                Choose folder
              </button>
            )}
            <button onClick={loadDownloads} className="btn-secondary px-3 py-2 text-sm">
              Refresh
            </button>
            <button onClick={clearList} className="btn-secondary px-3 py-2 text-sm">
              Clear all
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6">
        {isWebDownloads && (
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 mb-4 text-sm text-[var(--text-secondary)]">
            Browser mode cannot read your OS downloads folder until you choose it. Select your Downloads folder to list its files here.
          </div>
        )}

        <input
          ref={directoryInputRef}
          type="file"
          className="hidden"
          multiple
          webkitdirectory=""
          directory=""
          onChange={handleDirectoryInputChange}
        />

        {error ? (
          <div className="card-minimal p-5 text-sm text-red-600">{error}</div>
        ) : loading ? (
          <LoadingSkeleton />
        ) : filteredDownloads.length === 0 ? (
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-10 text-center">
            <p className="text-lg font-medium text-[var(--text-primary)] mb-1">No downloads</p>
            <p className="text-sm text-[var(--text-secondary)] m-0">Downloaded files will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDownloads.map(item => (
              <div key={item.id} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 flex items-center gap-4 shadow-sm">
                <div className="w-10 h-10 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-tertiary)] shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => openFile(item.savePath)}
                    className="block text-left text-[var(--link-primary)] hover:underline font-medium truncate max-w-full"
                    title={item.savePath || item.fileName}
                  >
                    {item.fileName || "Downloaded file"}
                  </button>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 mb-0">
                    {formatStatus(item)} - {formatTime(item.endTime || item.startTime)}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] truncate mt-1 mb-0">{item.savePath || "Unknown location"}</p>
                </div>
                <button onClick={() => showInFolder(item.savePath)} className="p-2 rounded-full text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]" title="Show in folder" disabled={!item.savePath && !window.superBrowserDesktop?.downloads?.openFolder}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  </svg>
                </button>
                <button onClick={() => openFile(item.savePath)} className="btn-secondary px-3 py-2 text-sm" disabled={!item.savePath}>
                  Open
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SettingsModal({ theme, onToggleTheme, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in-up" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 border border-[var(--border-color)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center pb-4 mb-4 border-b border-[var(--border-color)]">
          <h3 className="text-lg font-semibold tracking-tight">Settings</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)]"><XIcon /></button>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Theme</p>
              <p className="text-xs text-[var(--text-secondary)]">Current theme: {theme}</p>
            </div>
            <button onClick={onToggleTheme} className="btn-secondary px-4 py-2 text-sm font-medium">Toggle theme</button>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Desktop mode</p>
              <p className="text-xs text-[var(--text-secondary)]">{window.superBrowserDesktop?.isElectron ? 'Electron features enabled' : 'Web-only mode'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FindInPageBox({ onClose }) {
  const [query, setQuery] = useState("")
  const [lastResult, setLastResult] = useState(null)
  const inputRef = useRef(null)

  const runFind = useCallback((forward = true) => {
    const value = query.trim()
    if (!value) return

    const webview = document.querySelector('webview')
    if (webview?.findInPage) {
      const requestId = webview.findInPage(value, { forward, findNext: lastResult === value })
      setLastResult(value)
      return requestId
    }

    if (window.superBrowserDesktop?.app?.findInPage) {
      window.superBrowserDesktop.app.findInPage(value, { forward, findNext: lastResult === value }).catch(() => { })
      setLastResult(value)
      return
    }

    if (typeof window.find === 'function') {
      window.find(value, false, !forward, true, false, false, false)
      setLastResult(value)
    }
  }, [query, lastResult])

  const closeFind = useCallback(() => {
    const webview = document.querySelector('webview')
    webview?.stopFindInPage?.('clearSelection')
    window.superBrowserDesktop?.app?.stopFindInPage?.().catch(() => { })
    onClose()
  }, [onClose])

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  useEffect(() => {
    if (query.trim()) runFind(true)
  }, [query, runFind])

  return (
    <div className="fixed top-[56px] right-4 z-[100] flex items-center gap-2 bg-white border border-[var(--border-color)] shadow-xl rounded-xl px-3 py-2 animate-fade-in-up">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') closeFind()
          if (e.key === 'Enter') runFind(!e.shiftKey)
        }}
        placeholder="Find in page"
        className="w-56 bg-[var(--bg-elevated)] border border-[var(--border-color)] text-sm rounded-lg px-3 py-1.5 outline-none text-[var(--text-primary)]"
      />
      <button onClick={() => runFind(false)} className="btn-secondary px-2 py-1 text-sm" title="Previous match">Prev</button>
      <button onClick={() => runFind(true)} className="btn-secondary px-2 py-1 text-sm" title="Next match">Next</button>
      <button onClick={closeFind} className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)]" title="Close find"><XIcon /></button>
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

function ResultsPanel({ mode, results, loading, onOpenLink, query }) {
  if (loading) return <LoadingSkeleton />
  if (!results) return null
  if (mode === 'seo') return <SEOResults results={results} onOpenLink={onOpenLink} query={query} />
  if (mode === 'ai') return <AIResults results={results} onOpenLink={onOpenLink} />
  if (mode === 'community') return <Suspense fallback={<LoadingSkeleton />}><LazyCommunityResults results={results} onOpenLink={onOpenLink} /></Suspense>
  return null
}

function SEOResults({ results, onOpenLink, query = "" }) {
  const items = results?.results || results || []
  const shoppingData = results?.shopping_results || []
  const hasShoppingData = shoppingData.length > 0

  if (!items.length && !hasShoppingData) return <p className="text-[var(--text-secondary)] text-center py-10">No results found.</p>

  return (
    <div className="space-y-6 max-w-3xl">
      {hasShoppingData && <ProductCarousel products={shoppingData} />}
      {items.map((r, i) => {
        const resultUrl = r.url || r.link || r.href || ""
        const resultTitle = r.title || resultUrl || "Search Result"

        return (
          <div key={i} className={`pb-6 mb-6 border-b border-[var(--border-color)] last:border-0 animate-fade-in-up stagger-${Math.min(i + 1, 3)}`}>
            <div className="flex-1 min-w-0">
              <a
                href={resultUrl || "#"}
                onClick={(e) => {
                  e.preventDefault()
                  if (resultUrl) onOpenLink?.(resultUrl, resultTitle)
                }}
                className={`font-medium text-[22px] block mb-1 text-[#1a0dab] hover:underline truncate hover:text-[#2b6ce0] transition-colors ${!resultUrl ? 'pointer-events-none opacity-70' : ''}`}
              >
                {resultTitle}
              </a>
              {resultUrl && <p className="text-[13px] truncate mb-3 text-[#006621]">{resultUrl}</p>}
              <p className="text-[15px] text-[var(--text-secondary)] line-clamp-3 leading-relaxed">{r.snippet || r.description}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AIResults({ results, onOpenLink }) {
  const answer = results?.answer || ''
  const isLiveData = results?.live_data === true
  const sourceCount = results?.sources_scraped || results?.sources?.length || 0
  const sources = Array.isArray(results?.sources) ? results.sources : []
  return (
    <div className="max-w-3xl space-y-6 animate-fade-in-up">
      {answer ? (
        <>
          <div className="p-8 bg-white border border-[var(--border-color)] rounded-3xl" style={{ borderTop: `4px solid ${isLiveData ? '#10b981' : 'var(--action-primary)'}` }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-medium flex items-center gap-3"><BrainIcon /> AI Answer</h3>
              {sourceCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200">
                  Powered by {isLiveData ? 'live web data' : 'SuperBrowser sources'} ({sourceCount} sources)
                </span>
              )}
            </div>
            <div className="leading-loose whitespace-pre-wrap text-[16px] text-[var(--text-primary)]">{answer}</div>
          </div>
          {sources.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Sources</h3>
              {sources.map((source, index) => {
                const sourceUrl = source.url || source.link || source.href || ""
                const sourceTitle = source.title || sourceUrl || "Source"
                return (
                  <div key={`${sourceUrl}-${index}`} className="pb-4 border-b border-[var(--border-color)] last:border-0">
                    <a
                      href={sourceUrl || "#"}
                      onClick={(event) => {
                        event.preventDefault()
                        if (sourceUrl) onOpenLink?.(sourceUrl, sourceTitle)
                      }}
                      className="font-medium text-[18px] block mb-1 text-[#1a0dab] hover:underline truncate"
                    >
                      {sourceTitle}
                    </a>
                    {sourceUrl && <p className="text-[13px] truncate mb-2 text-[#006621]">{sourceUrl}</p>}
                    <p className="text-[14px] text-[var(--text-secondary)] line-clamp-2">{source.snippet || source.description}</p>
                  </div>
                )
              })}
            </div>
          )}
        </>
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

function PersonaDropdown({ value, onChange, personas }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef()
  const selected = personas.find(p => p.id === value) || personas[0]

  useEffect(() => {
    const handler = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="pill-btn px-4 py-1.5 flex items-center gap-2 min-w-[120px] justify-between"
      >
        <span>{selected.label}</span>
        <ChevronDownIcon />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-[var(--border-color)] rounded-xl shadow-lg py-2 z-50 animate-fade-in-up">
          {personas.map(p => (
            <button
              key={p.id}
              onClick={() => { onChange(p.id); setIsOpen(false) }}
              className={`w-full text-left px-4 py-2.5 hover:bg-[var(--bg-hover)] transition-colors flex flex-col ${value === p.id ? 'bg-[rgba(50,121,249,0.05)]' : ''}`}
            >
              <span className={`text-sm font-medium ${value === p.id ? 'text-[var(--action-primary)]' : 'text-[var(--text-primary)]'}`}>{p.label}</span>
              <span className="text-xs text-[var(--text-tertiary)]">{p.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ContextWindow({ show, onClose, tabId, sessionId, contextManager }) {
  const [chatMessages, setChatMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('llama-3.1-8b-instant')
  const [showModelSelector, setShowModelSelector] = useState(false)
  const modelSelectorRef = useRef(null)

  useEffect(() => {
    if (show) {
      fetch(`${API_BASE}/api/context/models`)
        .then(r => r.json())
        .then(data => {
          if (data.models) {
            setModels(data.models)
            setSelectedModel(data.default || 'llama-3.1-8b-instant')
          }
        })
        .catch(() => { })
    }
  }, [show])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(e.target)) {
        setShowModelSelector(false)
      }
    }
    if (showModelSelector) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showModelSelector])

  if (!show) return null

  const currentModel = models.find(m => m.id === selectedModel) || { name: 'Llama 3.1 8B', id: selectedModel }

  const handleSend = async (text, modelId) => {
    const userMsg = { id: Date.now().toString(), text, sender: 'user' }
    setChatMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    try {
      const response = await fetch(`${API_BASE}/api/context/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: text,
          tab_id: tabId,
          model: selectedModel
        })
      })

      if (!response.ok) throw new Error(`Chat failed: ${response.status}`)
      const data = await response.json()

      const aiReply = {
        id: (Date.now() + 1).toString(),
        text: data.response || 'Sorry, I could not generate a response.',
        sender: 'ai',
        model: data.model_used
      }
      setChatMessages(prev => [...prev, aiReply])
    } catch (error) {
      console.error('Chat error:', error)
      const errorReply = {
        id: (Date.now() + 1).toString(),
        text: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        sender: 'ai'
      }
      setChatMessages(prev => [...prev, errorReply])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in-up">
      <div className="w-full max-w-4xl bg-white rounded-2xl overflow-hidden shadow-2xl scale-100 flex flex-col">
        <div className="p-5 border-b border-[var(--border-color)] flex justify-between items-center bg-white relative z-20">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-medium tracking-tight">Super AI Context Session</h3>
            <span className="text-[11px] bg-black text-white px-2 py-0.5 rounded-full">BETA</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative" ref={modelSelectorRef}>
              <button
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a2 2 0 0 1 0 4h-1.17a7 7 0 0 1-6.83 5 7 7 0 0 1-6.83-5H6a2 2 0 0 1 0-4h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
                  <circle cx="12" cy="17" r="1" />
                </svg>
                <span className="font-medium">{currentModel.name}</span>
                <ChevronDownIcon />
              </button>

              {showModelSelector && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-[var(--border-color)] rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in-up">
                  <div className="p-3 border-b border-[var(--border-color)] bg-[var(--bg-elevated)]">
                    <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Select AI Model</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {models.map(model => (
                      <button
                        key={model.id}
                        onClick={() => { setSelectedModel(model.id); setShowModelSelector(false) }}
                        className={`w-full text-left px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-color)] last:border-b-0 ${selectedModel === model.id ? 'bg-[var(--bg-hover)]' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm text-[var(--text-primary)]">{model.name}</span>
                          {selectedModel === model.id && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--action-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{model.description}</p>
                        <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded mt-1 inline-block">{model.provider}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button onClick={onClose} className="btn-secondary px-4 py-1.5 text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">Close Session</button>
          </div>
        </div>

        <AiInput
          messages={chatMessages}
          onSendMessage={handleSend}
          backgroundText="AI Input 001"
          placeholder="How can I help you analyze this context?"
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}

function BackendStatusBanner() { return null }

function PagePreview({ url, title, onRetryBrowser }) {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")
    setPreview(null)

    fetch(`${API_BASE}/api/page/preview?url=${encodeURIComponent(url)}`)
      .then(response => {
        if (!response.ok) throw new Error(`Preview failed with ${response.status}`)
        return response.json()
      })
      .then(data => {
        if (!cancelled) setPreview(data)
      })
      .catch(() => {
        if (!cancelled) setError("This page cannot be previewed inside SuperBrowser.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex flex-wrap items-center gap-2 mb-5 no-print">
          {onRetryBrowser && (
            <button
              type="button"
              onClick={onRetryBrowser}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              Try browser view
            </button>
          )}
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="border border-[var(--border-color)] rounded-2xl p-8 bg-[var(--bg-elevated)]">
            <h2 className="text-2xl font-semibold mb-3 text-[var(--text-primary)]">{title || "Page preview unavailable"}</h2>
            <p className="text-[var(--text-secondary)] mb-5">{error}</p>
            <p className="text-sm text-[var(--text-tertiary)] break-all">{url}</p>
          </div>
        ) : (
          <article className="space-y-5">
            <p className="text-sm text-[#006621] break-all">{preview?.url || url}</p>
            <h1 className="text-4xl font-semibold tracking-normal text-[var(--text-primary)]">{preview?.title || title || "Page preview"}</h1>
            {preview?.description && (
              <p className="text-lg leading-relaxed text-[var(--text-secondary)]">{preview.description}</p>
            )}
            <div className="space-y-4 pt-2">
              {(preview?.content || []).length > 0 ? (
                preview.content.map((paragraph, index) => (
                  <p key={`${url}-${index}`} className="text-[16px] leading-8 text-[var(--text-primary)]">
                    {paragraph}
                  </p>
                ))
              ) : (
                <p className="text-[var(--text-secondary)]">No readable page content was found.</p>
              )}
            </div>
          </article>
        )}
      </div>
    </div>
  )
}

function BrowserPanel({ url, title, onClose }) {
  const isElectron = Boolean(window.superBrowserDesktop?.isElectron)
  const [frameKey, setFrameKey] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const webviewRef = useRef(null)

  useEffect(() => {
    setShowPreview(false)
  }, [isElectron, url])

  useEffect(() => {
    if (!isElectron || showPreview || !webviewRef.current) return
    const webview = webviewRef.current
    const handleFailedLoad = (event) => {
      if (event?.isMainFrame === false) return
      if (event?.errorCode === -3) return
      setShowPreview(true)
    }
    const handleNewWindow = (event) => {
      const nextUrl = event?.url
      if (!nextUrl || nextUrl === url) return
      event.preventDefault?.()
      webview.loadURL?.(nextUrl)
    }
    webview.addEventListener("did-fail-load", handleFailedLoad)
    webview.addEventListener("new-window", handleNewWindow)
    return () => {
      webview.removeEventListener("did-fail-load", handleFailedLoad)
      webview.removeEventListener("new-window", handleNewWindow)
    }
  }, [isElectron, showPreview, frameKey, url])

  const reloadPage = () => {
    if (isElectron) {
      if (showPreview) {
        setFrameKey(key => key + 1)
        return
      }
      webviewRef.current?.reload()
      return
    }
    setFrameKey(key => key + 1)
  }

  return (
    <div className="h-full flex flex-col bg-white animate-fade-in-up">
      <div className="no-print px-4 py-2 border-b border-[var(--border-color)] flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={onClose} className="p-1.5 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-black transition-colors" title="Back"><ChevronLeftIcon /></button>
          <button disabled className="p-1.5 rounded-full text-[var(--text-secondary)] opacity-30 cursor-not-allowed transition-colors" title="Forward"><ChevronRightIcon /></button>
          <button onClick={reloadPage} className="p-1.5 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-black transition-colors" title="Reload"><RefreshIcon /></button>
        </div>
        <input value={url} readOnly className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-color)] text-sm rounded-lg px-3 py-1.5 outline-none text-[var(--text-secondary)]" />
      </div>
      {showPreview ? (
        <PagePreview
          key={`${url}-${frameKey}`}
          url={url}
          title={title}
          onRetryBrowser={isElectron ? () => setShowPreview(false) : null}
        />
      ) : isElectron ? (
        <webview
          ref={webviewRef}
          data-active-browser-view="true"
          id={`webview-${url}`}
          src={url}
          className="w-full flex-1"
          style={{ minHeight: 0 }}
          allowpopups="true"
        />
      ) : (
        <iframe
          data-active-browser-view="true"
          key={frameKey}
          title={title || url}
          src={url}
          className="w-full flex-1 border-0 bg-white"
          style={{ minHeight: 0 }}
          sandbox="allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  )
}

function PricingPage({ onClose }) {
  const plans = [
    { name: 'Free', pricing: '0.0/-', tokens: '2000', contextWindow: '3', models: 'GPT 4o mini' },
    { name: 'Pro', pricing: '500.0/-', tokens: '10,000', contextWindow: '5', models: 'Perplexity,Gemini' },
    { name: 'Max', pricing: '1000.0/-', tokens: '20,000', contextWindow: '10', models: 'Perplexity, Gemini, Claude, ChatGPT, Grok' }
  ]

  const rows = [
    { key: 'pricing', label: 'Pricing' },
    { key: 'tokens', label: 'Tokens' },
    { key: 'contextWindow', label: 'Contexting Window(size)' },
    { key: 'models', label: 'Models' }
  ]

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pricing-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in-up"
      onClick={onClose}
    >
      <div className="w-full max-w-6xl max-h-[90vh] overflow-auto rounded-3xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-4 md:p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="card-minimal bg-white p-5 md:p-8 mb-5 md:mb-7">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[var(--text-tertiary)] mb-2">Plans</p>
              <h2 id="pricing-dialog-title" className="text-3xl md:text-4xl leading-tight tracking-tight m-0">Super Browser Pricing</h2>
              <p className="text-[var(--text-secondary)] mt-2 mb-0">Pick a plan that matches how deeply you research and compare answers.</p>
            </div>
            <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm font-medium">Close</button>
          </div>
        </div>

        <div className="pricing-layout">
          <div className="pricing-row-labels" aria-hidden="true">
            <div className="pricing-row-label pricing-row-label-header" />
            {rows.map((row) => (
              <div key={row.key} className={`pricing-row-label ${row.key === 'contextWindow' ? 'pricing-row-label-context' : ''}`}>
                {row.label}
              </div>
            ))}
          </div>

          <div className="pricing-shell card-minimal bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="pricing-table w-full min-w-[760px] border-collapse">
                <caption className="pricing-sr-only">Super Browser pricing plan</caption>
                <thead>
                  <tr>
                    {plans.map((plan) => (
                      <th key={plan.name}>{plan.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key}>
                      {plans.map((plan) => (
                        <td key={`${plan.name}-${row.key}`}>
                          <span className="pricing-sr-only">{row.label}: </span>
                          {plan[row.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BrowserMenu({
  onClose,
  onAddTab,
  onNewWindow,
  onNewIncognitoWindow,
  onShowHistory,
  onOpenPricing,
  onOpenDownloads,
  onOpenBookmarks,
  onOpenExtensions,
  onDeleteBrowsingData,
  onFindInPage,
  onPrint,
  onOpenSettings,
  isIncognito,
  onWipeWorkspace
}) {
  const [zoomLevel, setZoomLevel] = useState(() => Number(document.documentElement.dataset.zoomLevel) || 100)
  const isElectron = Boolean(window.superBrowserDesktop?.isElectron)

  const handleAction = (action) => {
    onClose()
    window.setTimeout(() => action?.(), 80)
  }

  const handleNewTabFromMenu = (event) => {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    onAddTab?.()
    onClose()
  }

  const applyZoom = (nextZoom) => {
    const clampedZoom = Math.min(200, Math.max(25, nextZoom))
    document.documentElement.style.zoom = `${clampedZoom}%`
    document.documentElement.dataset.zoomLevel = String(clampedZoom)
    setZoomLevel(clampedZoom)
  }

  const toggleFullscreen = () => {
    if (window.superBrowserDesktop?.app?.toggleFullscreen) {
      window.superBrowserDesktop.app.toggleFullscreen().catch(() => { })
      return
    }
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.()
  }

  const openHelp = () => {
    const helpUrl = 'https://github.com/'
    if (window.superBrowserDesktop?.app?.openExternal) {
      window.superBrowserDesktop.app.openExternal(helpUrl).catch(() => { })
      return
    }
    window.open(helpUrl, '_blank', 'noopener,noreferrer')
  }

  const exitApp = () => {
    if (window.superBrowserDesktop?.app?.quit) {
      window.superBrowserDesktop.app.quit().catch(() => { })
      return
    }
    window.open('', '_self')
    window.close()
    window.setTimeout(() => {
      if (!window.closed) window.location.replace('about:blank')
    }, 120)
  }

  const icons = {
    user: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 1 0-16 0" /></svg>,
    key: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>,
    history: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l4 2" /></svg>,
    download: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
    star: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
    grid: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>,
    puzzle: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 0-.253.902l.331 2.076c.12.758-.195 1.503-.82 1.961a2.126 2.126 0 0 1-1.282.428h-.197c-.366 0-.715-.145-.968-.398l-1.526-1.526a1.12 1.12 0 0 0-1.428-.15l-1.693 1.13c-.63.42-1.439.467-2.112.122A2.43 2.43 0 0 1 8 18V5c0-1.105.895-2 2-2h4a2 2 0 0 1 2 2v2.586a1 1 0 0 0 .293.707l1.414 1.414c.294.294.767.198.887-.198.24-.76.71-1.464 1.516-1.464H21a1 1 0 0 1 1 1v.707l-2.561.1z" /></svg>,
    trash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>,
    zoom: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>,
    fullscreen: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" /></svg>,
    print: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>,
    lens: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="12" cy="12" r="3" /><path d="M3 9v6M9 3h6M9 21h6M21 9v6" /></svg>,
    translate: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 8l6 6" /><path d="M4 14l6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1M22 22l-5-10-5 10" /><path d="M14 18h6" /></svg>,
    find: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="15" x2="15" y2="15" /></svg>,
    cast: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 16v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v3" /><path d="M2 12a10 10 0 0 1 10 10" /><path d="M2 8a14 14 0 0 1 14 14" /></svg>,
    briefcase: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>,
    pricing: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22" /><path d="M17 5H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H7" /></svg>,
    help: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
    settings: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
    exit: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>,
    window: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="9" x2="21" y2="9" /></svg>,
    incognito: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7" cy="15" r="3" /><circle cx="17" cy="15" r="3" /><path d="M10 15h4M5 12V9a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3H5z" /></svg>,
    empty: <span className="w-4 h-4 inline-block" />
  }

  const divider = <div className="h-[1px] w-full bg-[var(--border-color)] my-1" />

  const MenuItem = ({ icon, label, shortcut, rightIcon, onClick, disabled }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        if (!disabled) handleAction(onClick)
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        e.stopPropagation()
        if (!disabled) handleAction(onClick)
      }}
      disabled={disabled}
      className={`w-full flex items-center px-4 py-1.5 text-[13px] hover:bg-[var(--bg-hover)] group transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className="text-[var(--text-tertiary)] mr-3">{icon || icons.empty}</span>
      <span className="text-[var(--text-primary)] flex-1 text-left">{label}</span>
      {shortcut && <span className="text-[#9aa0a6] text-[11px] font-medium ml-4">{shortcut}</span>}
      {rightIcon && <span className="text-[var(--text-tertiary)] ml-3">{rightIcon}</span>}
    </button>
  )

  const ProfileMenu = () => (
    <button disabled className="w-[calc(100%-1rem)] px-3 py-2 flex items-center bg-[var(--bg-elevated)] mx-2 my-1.5 rounded-lg border border-[var(--border-color)] opacity-50 cursor-not-allowed">
      <div className="w-7 h-7 bg-[var(--border-color)] rounded-full flex items-center justify-center text-[var(--text-secondary)] mr-3">
        {icons.user}
      </div>
      <span className="text-[13px] text-[var(--text-primary)] flex-1 text-left font-medium">Your Browser</span>
      <span className="text-[11px] bg-[rgba(50,121,249,0.1)] text-[#3279f9] px-2 py-0.5 rounded-md font-medium border border-[rgba(50,121,249,0.2)]">Not signed in</span>
    </button>
  )

  const ZoomControl = () => (
    <div className="w-full flex items-center px-4 py-1.5 text-[13px] hover:bg-[var(--bg-hover)] transition-colors">
      <span className="text-[var(--text-tertiary)] mr-3">{icons.zoom}</span>
      <span className="text-[var(--text-primary)] flex-1 text-left">Zoom</span>
      <div className="flex items-center ml-4 border border-[var(--border-color)] rounded-md overflow-hidden bg-white">
        <button onClick={() => applyZoom(zoomLevel - 10)} className="px-2 hover:bg-[var(--bg-hover)] text-[16px] leading-none pb-0.5 text-[var(--text-secondary)]">−</button>
        <div className="w-[1px] h-4 bg-[var(--border-color)]"></div>
        <span className="px-2 text-[12px] font-medium text-[var(--text-primary)] min-w-[40px] text-center">{zoomLevel}%</span>
        <div className="w-[1px] h-4 bg-[var(--border-color)]"></div>
        <button onClick={() => applyZoom(zoomLevel + 10)} className="px-2 hover:bg-[var(--bg-hover)] text-[16px] leading-none pb-0.5 text-[var(--text-secondary)]">+</button>
      </div>
      <button onClick={toggleFullscreen} className="ml-3 p-1 rounded-md border border-[var(--border-color)] bg-white hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
        {icons.fullscreen}
      </button>
    </div>
  )

  return (
    <div
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      className="browser-menu no-print absolute top-[44px] right-0 w-[300px] bg-white border border-[var(--border-color)] shadow-2xl rounded-bl-xl py-1 z-50 animate-fade-in-up origin-top-right"
    >
      <button
        type="button"
        onMouseDown={handleNewTabFromMenu}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          handleNewTabFromMenu(event)
        }}
        className="w-full flex items-center px-4 py-1.5 text-[13px] hover:bg-[var(--bg-hover)] group transition-colors"
      >
        <span className="text-[var(--text-tertiary)] mr-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
        </span>
        <span className="text-[var(--text-primary)] flex-1 text-left">New tab</span>
        <span className="text-[#9aa0a6] text-[11px] font-medium ml-4">Ctrl+T</span>
      </button>
      <MenuItem icon={icons.window} label="New window" shortcut="Ctrl+N" onClick={onNewWindow} />
      <MenuItem icon={icons.incognito} label="New Incognito window" shortcut="Ctrl+Shift+N" onClick={onNewIncognitoWindow} />

      {divider}
      <ProfileMenu />
      {divider}

      <MenuItem icon={icons.key} label="Passwords and autofill" rightIcon="▶" disabled />
      <MenuItem icon={icons.history} label={isIncognito ? "History off in Incognito" : "History"} onClick={onShowHistory} disabled={isIncognito} />
      <MenuItem icon={icons.download} label="Downloads" shortcut="Ctrl+J" onClick={onOpenDownloads} />
      <MenuItem icon={icons.star} label="Bookmarks and lists" rightIcon="▶" onClick={onOpenBookmarks} />
      <MenuItem icon={icons.grid} label="Tab groups" rightIcon="▶" disabled />
      <MenuItem icon={icons.puzzle} label="Extensions" rightIcon="▶" onClick={onOpenExtensions} />
      <MenuItem icon={icons.trash} label="Delete browsing data..." shortcut="Ctrl+Shift+Del" onClick={onDeleteBrowsingData} />

      {divider}
      <ZoomControl />
      {divider}

      <MenuItem icon={icons.print} label="Print..." shortcut="Ctrl+P" onClick={onPrint} />
      <MenuItem icon={icons.lens} label="Search with Google Lens" disabled />
      <MenuItem icon={icons.translate} label="Translate..." disabled />
      <MenuItem icon={icons.find} label="Find in page" shortcut="Ctrl+F" onClick={onFindInPage} />
      <MenuItem icon={icons.cast} label="Cast, save, and share" rightIcon="▶" disabled />
      <MenuItem icon={icons.briefcase} label="More tools" rightIcon="▶" disabled />

      {divider}
      <MenuItem icon={icons.help} label="Help" onClick={openHelp} />
      <MenuItem icon={icons.pricing} label="Pricing" onClick={onOpenPricing} />
      <MenuItem icon={icons.settings} label="Settings" onClick={onOpenSettings} />
      <MenuItem icon={icons.trash} label="Wipe Workspace" onClick={onWipeWorkspace} />
      <MenuItem icon={icons.exit} label="Exit" onClick={exitApp} />
    </div>
  )
}
