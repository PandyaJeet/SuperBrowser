/**
 * Context Manager Hook
 * Manages browsing context for each tab - tracks queries, results, and visited pages
 */
import { useCallback, useMemo, useRef } from 'react'
import { getApiBase } from './config/apiBase'

const API_BASE = getApiBase()

// to get the session token
const getSessionToken = () => {
  return import.meta.env.VITE_SUPERBROWSER_SESSION_TOKEN || "";
};

export function useContextManager() {
  // In-memory context storage per tab
  const contextStore = useRef({});

  // Initialize context for a tab
  const initializeTab = useCallback((tabId, sessionId) => {
    if (!contextStore.current[tabId]) {
      contextStore.current[tabId] = {
        sessionId,
        queries: [],
        results: [],
        visited_pages: []
      };
    }
  }, []);

  const startSession = useCallback(async (sessionId) => {
    if (!sessionId) return null
    if (window.superBrowserDesktop?.isElectron && window.superBrowserDesktop?.context?.startSession) {
      return window.superBrowserDesktop.context.startSession(sessionId)
    }
    const res = await fetch(`${API_BASE}/api/context/session/start`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Session-Token': getSessionToken()
      },
      body: JSON.stringify({ session_id: sessionId })
    })
    if (!res.ok) throw new Error(`Failed to start session: ${res.status}`)
    return res.json()
  }, [])

  const stopSession = useCallback(async (sessionId, options = {}) => {
    if (!sessionId) return null
    const { keepalive = false } = options
    if (window.superBrowserDesktop?.isElectron && window.superBrowserDesktop?.context?.stopSession) {
      return window.superBrowserDesktop.context.stopSession(sessionId, { keepalive })
    }
    const res = await fetch(`${API_BASE}/api/context/session/stop/${sessionId}`, {
      method: 'POST',
      headers: {
        'X-Session-Token': getSessionToken()
      },
      keepalive
    })
    if (!res.ok) throw new Error(`Failed to stop session: ${res.status}`)
    return res.json()
  }, [])

  // Add a query to tab context
  const addQuery = useCallback((tabId, sessionId, query, mode) => {
    initializeTab(tabId, sessionId);
    
    const context = contextStore.current[tabId];
    context.queries.push(query);
    
    if (context.queries.length > 20) {
      context.queries = context.queries.slice(-20);
    }

    if (window.superBrowserDesktop?.isElectron && window.superBrowserDesktop?.context?.addQuery) {
      window.superBrowserDesktop.context.addQuery(sessionId, tabId, query, mode).catch(() => {});
      return;
    }
    fetch(`${API_BASE}/api/context/add_query`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Session-Token': getSessionToken()
      },
      body: JSON.stringify({ session_id: sessionId, tab_id: tabId, query, mode })
    }).catch(() => {});
  }, [initializeTab]);

  // Add search results to tab context
  const addResults = useCallback((tabId, sessionId, results) => {
    initializeTab(tabId, sessionId);
    
    const context = contextStore.current[tabId];
    const resultsData = results.map(r => ({
      url: r.url || r.link || '',
      title: r.title || '',
      snippet: r.snippet || r.description || '',
      content: r.content || r.snippet || ''
    }));
    
    context.results = resultsData;

    if (window.superBrowserDesktop?.isElectron && window.superBrowserDesktop?.context?.addResults) {
      window.superBrowserDesktop.context.addResults(sessionId, tabId, resultsData).catch(() => {});
      return;
    }
    fetch(`${API_BASE}/api/context/add_results`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Session-Token': getSessionToken()
      },
      body: JSON.stringify({ session_id: sessionId, tab_id: tabId, results: resultsData })
    }).catch(() => {});
  }, [initializeTab]);

  // Add a visited page to context
  const addVisitedPage = useCallback((tabId, sessionId, url, title, content) => {
    initializeTab(tabId, sessionId);
    
    const context = contextStore.current[tabId];
    const lastPage = context.visited_pages[context.visited_pages.length - 1]
    if (lastPage?.url === url) {
      return
    }

    const page = {
      url,
      title,
      content: (content || '').substring(0, 5000),
      timestamp: new Date().toISOString()
    };
    
    context.visited_pages.push(page);
    
    if (context.visited_pages.length > 10) {
      context.visited_pages = context.visited_pages.slice(-10);
    }

    if (window.superBrowserDesktop?.isElectron && window.superBrowserDesktop?.context?.addVisitedPage) {
      window.superBrowserDesktop.context.addVisitedPage(sessionId, tabId, page).catch(() => {});
      return;
    }
    fetch(`${API_BASE}/api/context/add_visited_page`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Session-Token': getSessionToken()
      },
      body: JSON.stringify({ session_id: sessionId, tab_id: tabId, page })
    }).catch(() => {});
  }, [initializeTab]);

  // Get context for a tab
  const getContext = useCallback((tabId) => {
    if (!contextStore.current[tabId]) {
      return { queries: [], results: [], visited_pages: [] };
    }
    return contextStore.current[tabId];
  }, []);

  // Get context for AI
  const getAIContext = useCallback((tabId) => {
    const context = getContext(tabId);
    return {
      queries: context.queries || [],
      results: (context.results || []).slice(0, 10),
      visited_pages: (context.visited_pages || []).slice(-3)
    };
  }, [getContext]);

  // Clear context for a tab
  const clearTabContext = useCallback((tabId, sessionId) => {
    delete contextStore.current[tabId];
    
    if (window.superBrowserDesktop?.isElectron && window.superBrowserDesktop?.context?.clearTab) {
      window.superBrowserDesktop.context.clearTab(sessionId, tabId).catch(() => {});
      return;
    }
    fetch(`${API_BASE}/api/context/clear/${sessionId}/${tabId}`, { 
      method: 'DELETE',
      headers: { 'X-Session-Token': getSessionToken() }
    }).catch(() => {});
  }, []);

  const fetchTabContext = useCallback(async (tabId, sessionId) => {
    if (window.superBrowserDesktop?.isElectron && window.superBrowserDesktop?.context?.getTab) {
      try {
        return await window.superBrowserDesktop.context.getTab(sessionId, tabId);
      } catch {}
    }
    const res = await fetch(`${API_BASE}/api/context/get/${sessionId}/${tabId}`, {
      headers: { 'X-Session-Token': getSessionToken() }
    });
    if (!res.ok) throw new Error(`Failed to fetch context: ${res.status}`);
    return res.json();
  }, []);

  const fetchSessionContext = useCallback(async (sessionId) => {
    if (window.superBrowserDesktop?.isElectron && window.superBrowserDesktop?.context?.getSession) {
      try {
        return await window.superBrowserDesktop.context.getSession(sessionId)
      } catch {}
    }
    const res = await fetch(`${API_BASE}/api/context/session/${sessionId}`, {
      headers: { 'X-Session-Token': getSessionToken() }
    })
    if (!res.ok) throw new Error(`Failed to fetch session context: ${res.status}`)
    return res.json()
  }, [])

  const downloadSessionContext = useCallback(async (sessionId) => {
    let data;
    if (window.superBrowserDesktop?.isElectron && window.superBrowserDesktop?.context?.exportSession) {
      data = await window.superBrowserDesktop.context.exportSession(sessionId);
    } else {
      const res = await fetch(`${API_BASE}/api/context/export/${sessionId}`, {
        headers: { 'X-Session-Token': getSessionToken() }
      });
      if (!res.ok) throw new Error(`Failed to export session context: ${res.status}`);
      data = await res.json();
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const safeSession = (sessionId || 'session').slice(0, 8)
    const filename = `superbrowser-context-${safeSession}-${timestamp}.json`

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(objectUrl)

    return { filename, stats: data?.stats || {} }
  }, [])

  const getContextSummary = useCallback((tabId) => {
    const context = getContext(tabId);
    return {
      queryCount: context.queries?.length || 0,
      resultCount: context.results?.length || 0,
      visitedCount: context.visited_pages?.length || 0,
      hasContext: (context.queries?.length || 0) > 0 || (context.results?.length || 0) > 0
    };
  }, [getContext]);
  
  const wipeWorkspace = useCallback(async (sessionId) => {
    await clearEntireSessionWorkspace(sessionId);
    window.location.reload(); 
  }, []);

  return useMemo(() => ({
    startSession,
    stopSession,
    initializeTab,
    addQuery,
    addResults,
    addVisitedPage,
    getContext,
    getAIContext,
    clearTabContext,
    getContextSummary,
    fetchTabContext,
    fetchSessionContext,
    wipeWorkspace,
    downloadSessionContext
  }), [
    startSession,
    stopSession,
    initializeTab,
    addQuery,
    addResults,
    addVisitedPage,
    getContext,
    getAIContext,
    clearTabContext,
    getContextSummary,
    fetchTabContext,
    fetchSessionContext,
    downloadSessionContext
  ]);
}

// 
export const clearEntireSessionWorkspace = async (sessionId) => {
  try {
    const response = await fetch(`${API_BASE}/api/context/clear/${sessionId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Token": getSessionToken()
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to wipe session: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error during global workspace wipe:", error);
    return null;
  }
};