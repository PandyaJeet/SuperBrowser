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
    clearTab: (sessionId, tabId) =>
      safeInvoke("context:clear-tab", { sessionId, tabId }),
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
