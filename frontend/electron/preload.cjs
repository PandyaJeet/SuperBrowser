const { contextBridge, ipcRenderer } = require("electron");

function safeInvoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

contextBridge.exposeInMainWorld("superBrowserDesktop", {
  platform: process.platform,
  isElectron: true,
  backendUrl: process.env.SUPERBROWSER_BACKEND_URL || "http://127.0.0.1:8000",
  backend: {
    getStatus: () => safeInvoke("backend:get-status"),
    getUrl: () => safeInvoke("backend:get-url"),
  },
  settings: {
    get: () => safeInvoke("settings:get"),
    set: (partialSettings) => safeInvoke("settings:set", partialSettings),
  },
  context: {
    getTab: (sessionId, tabId) => safeInvoke("context:get-tab", { sessionId, tabId }),
    getSession: (sessionId) => safeInvoke("context:get-session", { sessionId }),
    clearTab: (sessionId, tabId) => safeInvoke("context:clear-tab", { sessionId, tabId }),
    startSession: (sessionId) => safeInvoke("context:start-session", { sessionId }),
    stopSession: (sessionId, options) => safeInvoke("context:stop-session", { sessionId, options }),
    addQuery: (sessionId, tabId, query, mode) => safeInvoke("context:add-query", { sessionId, tabId, query, mode }),
    addResults: (sessionId, tabId, results) => safeInvoke("context:add-results", { sessionId, tabId, results }),
    addVisitedPage: (sessionId, tabId, page) => safeInvoke("context:add-visited-page", { sessionId, tabId, page }),
    exportSession: (sessionId) => safeInvoke("context:export-session", { sessionId }),
    getModels: () => safeInvoke("context:get-models"),
    chat: (sessionId, message, tabId, model) => safeInvoke("context:chat", { sessionId, message, tabId, model }),
  },
  search: {
    seo: (q, sessionId, persona, gl) => safeInvoke("search:seo", { q, sessionId, persona, gl }),
    ai: (q, sessionId, persona, gl) => safeInvoke("search:ai", { q, sessionId, persona, gl }),
    community: (q, sessionId, persona, gl) => safeInvoke("search:community", { q, sessionId, persona, gl }),
  },
  app: {
    notify: (title, body) => safeInvoke("app:notify", { title, body }),
    show: () => safeInvoke("app:show"),
    onDeepLink: (callback) => {
      const handler = (_event, url) => callback(url);
      ipcRenderer.on("deep-link", handler);
      return () => ipcRenderer.removeListener("deep-link", handler);
    },
  },
});
