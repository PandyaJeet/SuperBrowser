const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");

function safeInvoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

contextBridge.exposeInMainWorld("superBrowserDesktop", {
  platform: process.platform,
  isElectron: true,
  isIncognito: process.argv.includes("--superbrowser-incognito=1"),
  backendUrl: process.env.SUPERBROWSER_BACKEND_URL || "http://127.0.0.1:8000",
  webviewPreloadPath: "file://" + path.join(__dirname, "webview-preload.cjs"),
  backend: {
    getStatus: () => safeInvoke("backend:get-status"),
    getUrl: () => safeInvoke("backend:get-url"),
  },
  settings: {
    get: () => safeInvoke("settings:get"),
    set: (partialSettings) => safeInvoke("settings:set", partialSettings),
  },
  blocking: {
    getStats: (webContentsId) => safeInvoke("blocking:get-stats", { webContentsId }),
    getSettings: () => safeInvoke("blocking:get-settings"),
    setDomainEnabled: (domain, enabled) => safeInvoke("blocking:set-domain-enabled", { domain, enabled }),
    toggle: (type) => safeInvoke("blocking:toggle", { type }),
    onStatsUpdate: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on("blocking-stats-update", handler);
      return () => ipcRenderer.removeListener("blocking-stats-update", handler);
    }
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
    newTab: () => safeInvoke("app:new-tab"),
    newWindow: () => safeInvoke("app:new-window"),
    newIncognitoWindow: () => safeInvoke("app:new-incognito-window"),
    openExternal: (url) => safeInvoke("app:open-external", { url }),
    print: () => safeInvoke("app:print"),
    printPreview: (title) => safeInvoke("app:print-preview", { title }),
    showPrintPreview: (pdfData, title) => safeInvoke("app:show-print-preview", { pdfData, title }),
    findInPage: (text, options) => safeInvoke("app:find-in-page", { text, options }),
    stopFindInPage: () => safeInvoke("app:stop-find-in-page"),
    clearBrowsingData: () => safeInvoke("app:clear-browsing-data"),
    toggleFullscreen: () => safeInvoke("app:toggle-fullscreen"),
    quit: () => safeInvoke("app:quit"),
    show: () => safeInvoke("app:show"),
    onNewTab: (callback) => {
      const handler = () => callback();
      ipcRenderer.on("app:new-tab", handler);
      return () => ipcRenderer.removeListener("app:new-tab", handler);
    },
    onFindInPage: (callback) => {
      const handler = () => callback();
      ipcRenderer.on("app:find-in-page", handler);
      return () => ipcRenderer.removeListener("app:find-in-page", handler);
    },
    onDeleteBrowsingData: (callback) => {
      const handler = () => callback();
      ipcRenderer.on("app:delete-browsing-data", handler);
      return () => ipcRenderer.removeListener("app:delete-browsing-data", handler);
    },
    onOpenDownloads: (callback) => {
      const handler = () => callback();
      ipcRenderer.on("app:open-downloads", handler);
      return () => ipcRenderer.removeListener("app:open-downloads", handler);
    },
    onDeepLink: (callback) => {
      const handler = (_event, url) => callback(url);
      ipcRenderer.on("deep-link", handler);
      return () => ipcRenderer.removeListener("deep-link", handler);
    },
  },
});

