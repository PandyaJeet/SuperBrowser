/**
 * Context Manager Hook
 * Manages browsing context for each tab - tracks queries, results, and visited pages
 */
import { useCallback, useRef } from 'react'
import { getApiBase } from './config/apiBase'

const API_BASE = getApiBase()

export function useContextManager() {
  // In-memory context storage per tab
  // Structure: { tabId: { queries: [], results: [], visited_pages: [] } }
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

  // Add a query to tab context
  const addQuery = useCallback((tabId, sessionId, query, mode) => {
    initializeTab(tabId, sessionId);
    
    const context = contextStore.current[tabId];
    context.queries.push(query);
    
    // Keep only last 20 queries
    if (context.queries.length > 20) {
      context.queries = context.queries.slice(-20);
    }

    // Send to backend (fire and forget)
    fetch(`${API_BASE}/api/context/add_query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, tab_id: tabId, query, mode })
    }).catch(() => {});
  }, [initializeTab]);

  // Add search results to tab context
  const addResults = useCallback((tabId, sessionId, results) => {
    initializeTab(tabId, sessionId);
    
    const context = contextStore.current[tabId];
    
    // Extract relevant data from results
    const resultsData = results.map(r => ({
      url: r.url || r.link || '',
      title: r.title || '',
      snippet: r.snippet || r.description || '',
      content: r.content || r.snippet || ''
    }));
    
    context.results = resultsData;

    // Send to backend
    fetch(`${API_BASE}/api/context/add_results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, tab_id: tabId, results: resultsData })
    }).catch(() => {});
  }, [initializeTab]);

  // Add a visited page to context
  const addVisitedPage = useCallback((tabId, sessionId, url, title, content) => {
    initializeTab(tabId, sessionId);
    
    const context = contextStore.current[tabId];
    const page = {
      url,
      title,
      content: content.substring(0, 5000), // Limit content size
      timestamp: new Date().toISOString()
    };
    
    context.visited_pages.push(page);
    
    // Keep only last 10 visited pages
    if (context.visited_pages.length > 10) {
      context.visited_pages = context.visited_pages.slice(-10);
    }

    // Send to backend
    fetch(`${API_BASE}/api/context/add_visited_page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, tab_id: tabId, page })
    }).catch(() => {});
  }, [initializeTab]);

  // Get context for a tab
  const getContext = useCallback((tabId) => {
    if (!contextStore.current[tabId]) {
      return {
        queries: [],
        results: [],
        visited_pages: []
      };
    }
    return contextStore.current[tabId];
  }, []);

  // Get context for AI (formats nicely)
  const getAIContext = useCallback((tabId) => {
    const context = getContext(tabId);
    return {
      queries: context.queries || [],
      results: (context.results || []).slice(0, 10), // Top 10 results
      visited_pages: (context.visited_pages || []).slice(-3) // Last 3 visited
    };
  }, [getContext]);

  // Clear context for a tab
  const clearTabContext = useCallback((tabId, sessionId) => {
    delete contextStore.current[tabId];
    
    // Clear from backend (prefer IPC in Electron)
    if (window.superBrowserDesktop?.isElectron && window.superBrowserDesktop?.context?.clearTab) {
      window.superBrowserDesktop.context.clearTab(sessionId, tabId).catch(() => {});
      return;
    }
    fetch(`${API_BASE}/api/context/clear/${sessionId}/${tabId}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  const fetchTabContext = useCallback(async (tabId, sessionId) => {
    if (window.superBrowserDesktop?.isElectron && window.superBrowserDesktop?.context?.getTab) {
      try {
        const data = await window.superBrowserDesktop.context.getTab(sessionId, tabId);
        return data;
      } catch {
        // fallback to HTTP
      }
    }
    const res = await fetch(`${API_BASE}/api/context/get/${sessionId}/${tabId}`);
    if (!res.ok) throw new Error(`Failed to fetch context: ${res.status}`);
    return res.json();
  }, []);

  // Get context summary (for UI display)
  const getContextSummary = useCallback((tabId) => {
    const context = getContext(tabId);
    return {
      queryCount: context.queries?.length || 0,
      resultCount: context.results?.length || 0,
      visitedCount: context.visited_pages?.length || 0,
      hasContext: (context.queries?.length || 0) > 0 || (context.results?.length || 0) > 0
    };
  }, [getContext]);

  return {
    initializeTab,
    addQuery,
    addResults,
    addVisitedPage,
    getContext,
    getAIContext,
    clearTabContext,
    getContextSummary,
    fetchTabContext
  };
}
