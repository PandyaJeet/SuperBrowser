const path = require("path");
const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");
const {
  app,
  BrowserWindow,
  shell,
  session,
  dialog,
  ipcMain,
  Menu,
  Tray,
  nativeImage,
  Notification,
} = require("electron");

const isDev = !!process.env.VITE_DEV_SERVER_URL;
const DEFAULT_BACKEND_PORT = 8000;
const BACKEND_HOST = "127.0.0.1";
let backendProcess = null;
let backendBaseUrl = `http://${BACKEND_HOST}:${DEFAULT_BACKEND_PORT}`;
let mainWindow = null;
let tray = null;
let downloads = [];
let downloadsFolderCache = { ts: 0, items: [] };
const trackedDownloadSessions = new WeakSet();
let backendStatus = {
  running: false,
  url: backendBaseUrl,
  pid: null,
  lastError: null,
};

process.stdout.on?.("error", () => {});
process.stderr.on?.("error", () => {});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function getSettingsPath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function readSettings() {
  try {
    const settingsPath = getSettingsPath();
    if (!fs.existsSync(settingsPath)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch {
    return {};
  }
}

function writeSettings(nextSettings) {
  const current = readSettings();
  const merged = { ...current, ...nextSettings };
  fs.writeFileSync(getSettingsPath(), JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

function logEvent(level, message, meta = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  });
  const logPath = path.join(app.getPath("userData"), "app.log");
  fs.appendFileSync(logPath, `${line}\n`, "utf8");
}

function writeProcessOutput(stream, message) {
  if (!stream || stream.destroyed || !stream.writable) return;
  try {
    stream.write(message, () => {});
  } catch {
    // GUI Windows builds can have closed stdout/stderr pipes.
  }
}

function logBackendOutput(stream, chunk) {
  writeProcessOutput(stream, `[backend] ${chunk}`);
}

function createTrayImage() {
  // 1x1 transparent png
  return nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2qR7YAAAAASUVORK5CYII=",
  );
}

function showNotification(title, body) {
  if (!Notification.isSupported()) return;
  new Notification({ title, body }).show();
}

function createPdfPreviewWindow(pdfBuffer, title = "Print Preview") {
  const parent = BrowserWindow.getFocusedWindow() || mainWindow;
  const previewWindow = new BrowserWindow({
    width: 1100,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    title,
    parent: parent && !parent.isDestroyed() ? parent : undefined,
    backgroundColor: "#ffffff",
    webPreferences: {
      plugins: true,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const encoded = Buffer.from(pdfBuffer).toString("base64");
  previewWindow.loadURL(`data:application/pdf;base64,${encoded}`);
  return previewWindow;
}

function normalizePdfData(pdfData) {
  if (Buffer.isBuffer(pdfData)) return pdfData;
  if (Array.isArray(pdfData)) return Buffer.from(pdfData);
  if (pdfData instanceof ArrayBuffer) return Buffer.from(pdfData);
  if (ArrayBuffer.isView(pdfData)) {
    return Buffer.from(pdfData.buffer, pdfData.byteOffset, pdfData.byteLength);
  }
  throw new Error("PDF data must be bytes");
}

function validateString(value, name) {
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  return value;
}

function sendDownloadsToRenderer() {
  const targetWindow = BrowserWindow.getFocusedWindow() || mainWindow;
  if (!targetWindow || targetWindow.isDestroyed()) return;
  targetWindow.webContents.send("app:open-downloads");
  targetWindow.show();
  targetWindow.focus();
}

function serializeDownload(record) {
  return {
    id: record.id,
    fileName: record.fileName,
    savePath: record.savePath,
    fileSize: record.fileSize,
    receivedBytes: record.receivedBytes,
    state: record.state,
    startTime: record.startTime,
    endTime: record.endTime,
  };
}

async function getDownloadsFolderFiles() {
  if (Date.now() - downloadsFolderCache.ts < 5000) {
    return downloadsFolderCache.items;
  }

  const downloadsPath = app.getPath("downloads");
  const entries = await fs.promises.readdir(downloadsPath, { withFileTypes: true });
  const files = await Promise.all(entries
    .filter((entry) => entry.isFile())
    .map(async (entry) => {
      const savePath = path.join(downloadsPath, entry.name);
      try {
        const stats = await fs.promises.stat(savePath);
        return serializeDownload({
          id: `folder:${savePath}`,
          fileName: entry.name,
          savePath,
          fileSize: stats.size,
          receivedBytes: stats.size,
          state: "completed",
          startTime: stats.birthtime?.toISOString?.() || stats.mtime.toISOString(),
          endTime: stats.mtime.toISOString(),
        });
      } catch {
        return null;
      }
    }));

  const items = files
    .filter(Boolean)
    .sort((a, b) => new Date(b.endTime || 0) - new Date(a.endTime || 0))
    .slice(0, 200);
  downloadsFolderCache = { ts: Date.now(), items };
  return items;
}

function registerDownloadTracking(targetSession = session.defaultSession) {
  if (!targetSession || trackedDownloadSessions.has(targetSession)) return;
  trackedDownloadSessions.add(targetSession);

  targetSession.on("will-download", (_event, item) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const record = {
      id,
      fileName: item.getFilename(),
      savePath: item.getSavePath(),
      fileSize: item.getTotalBytes(),
      receivedBytes: item.getReceivedBytes(),
      state: "progress",
      startTime: new Date().toISOString(),
      endTime: null,
    };

    downloads = [record, ...downloads].slice(0, 200);

    item.on("updated", (_event, state) => {
      record.fileName = item.getFilename();
      record.savePath = item.getSavePath();
      record.fileSize = item.getTotalBytes();
      record.receivedBytes = item.getReceivedBytes();
      record.state = state === "interrupted" ? "interrupted" : "progress";
    });

    item.once("done", (_event, state) => {
      record.fileName = item.getFilename();
      record.savePath = item.getSavePath();
      record.fileSize = item.getTotalBytes();
      record.receivedBytes = item.getReceivedBytes();
      record.state = state;
      record.endTime = new Date().toISOString();
      downloadsFolderCache = { ts: 0, items: [] };
    });
  });
}

function createAppMenu() {
  const sendNewTabToRenderer = () => {
    const targetWindow = BrowserWindow.getFocusedWindow() || mainWindow;
    if (!targetWindow || targetWindow.isDestroyed()) return;
    targetWindow.webContents.send("app:new-tab");
    targetWindow.show();
    targetWindow.focus();
  };

  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "New Tab",
          accelerator: "CmdOrCtrl+T",
          click: sendNewTabToRenderer,
        },
        {
          label: "New Window",
          accelerator: "CmdOrCtrl+N",
          click: () => createMainWindow(),
        },
        {
          label: "New Incognito Window",
          accelerator: "CmdOrCtrl+Shift+N",
          click: () => createIncognitoWindow(),
        },
        {
          label: "Downloads",
          accelerator: "CmdOrCtrl+J",
          click: sendDownloadsToRenderer,
        },
        {
          label: "Delete Browsing Data",
          accelerator: "CmdOrCtrl+Shift+Delete",
          click: () => {
            const targetWindow = BrowserWindow.getFocusedWindow() || mainWindow;
            if (targetWindow && !targetWindow.isDestroyed()) {
              targetWindow.webContents.send("app:delete-browsing-data");
            }
          },
        },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        {
          label: "Find in Page",
          accelerator: "CmdOrCtrl+F",
          click: () => {
            const targetWindow = BrowserWindow.getFocusedWindow() || mainWindow;
            if (targetWindow && !targetWindow.isDestroyed()) {
              targetWindow.webContents.send("app:find-in-page");
            }
          },
        },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "SuperBrowser Website",
          click: () => shell.openExternal("https://github.com/"),
        },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray() {
  if (tray) return;
  tray = new Tray(createTrayImage());
  tray.setToolTip("SuperBrowser");
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => {
        if (!mainWindow) {
          createMainWindow();
          return;
        }
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: "Hide",
      click: () => {
        if (mainWindow) mainWindow.hide();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) mainWindow.hide();
    else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, BACKEND_HOST);
  });
}

async function findAvailablePort(startPort = DEFAULT_BACKEND_PORT, maxTries = 50) {
  for (let i = 0; i < maxTries; i += 1) {
    const candidate = startPort + i;
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(candidate)) return candidate;
  }
  throw new Error("No available backend port found.");
}

async function waitForBackendReady(url, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(`${url}/health`);
      if (res.ok) return true;
    } catch {
      // retry
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function resolveBackendDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "backend");
  }
  return path.resolve(__dirname, "..", "..", "backend");
}

function resolvePackagedBackendExecutable() {
  if (!app.isPackaged) return null;
  const backendDir = resolveBackendDir();
  const exeName = process.platform === "win32" ? "superbrowser-backend.exe" : "superbrowser-backend";
  const candidate = path.join(backendDir, exeName);
  return fs.existsSync(candidate) ? candidate : null;
}

function spawnBackend(pythonCmd, pythonArgs, port) {
  const backendDir = resolveBackendDir();
  const child = spawn(
    pythonCmd,
    [...pythonArgs, "-m", "uvicorn", "main:app", "--host", BACKEND_HOST, "--port", String(port)],
    {
      cwd: backendDir,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    },
  );

  child.stdout.on("data", (chunk) => {
    logBackendOutput(process.stdout, chunk);
  });
  child.stderr.on("data", (chunk) => {
    logBackendOutput(process.stderr, chunk);
  });

  return child;
}

async function startBackend() {
  const port = await findAvailablePort();
  backendBaseUrl = `http://${BACKEND_HOST}:${port}`;
  process.env.SUPERBROWSER_BACKEND_URL = backendBaseUrl;

  const settings = readSettings();
  if (!settings.sessionToken) {
    settings.sessionToken = require("crypto").randomBytes(32).toString('base64url');
    writeSettings({ sessionToken: settings.sessionToken });
  }
  process.env.SUPERBROWSER_SESSION_TOKEN = settings.sessionToken;

  backendStatus = { running: false, url: backendBaseUrl, pid: null, lastError: null };

  const packagedExe = resolvePackagedBackendExecutable();
  if (packagedExe) {
    backendProcess = spawn(packagedExe, ["--host", BACKEND_HOST, "--port", String(port)], {
      cwd: resolveBackendDir(),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    });
    backendProcess.stdout.on("data", (chunk) => logBackendOutput(process.stdout, chunk));
    backendProcess.stderr.on("data", (chunk) => logBackendOutput(process.stderr, chunk));
    const ready = await waitForBackendReady(backendBaseUrl, 12000);
    if (!ready) {
      stopBackend();
      throw new Error("Packaged backend executable failed to start.");
    }
    backendStatus = {
      running: true,
      url: backendBaseUrl,
      pid: backendProcess?.pid || null,
      lastError: null,
    };
    return;
  }

  const candidates = [
    { cmd: process.env.PYTHON_PATH || "python", args: [] },
    { cmd: "py", args: ["-3"] },
  ];

  let started = false;
  for (const candidate of candidates) {
    try {
      backendProcess = spawnBackend(candidate.cmd, candidate.args, port);
      const ready = await waitForBackendReady(backendBaseUrl, 10000);
      if (ready) {
        started = true;
        backendStatus = {
          running: true,
          url: backendBaseUrl,
          pid: backendProcess?.pid || null,
          lastError: null,
        };
        break;
      }
      backendProcess.kill();
    } catch {
      if (backendProcess) backendProcess.kill();
    }
  }

  if (!started) {
    backendStatus = {
      running: false,
      url: backendBaseUrl,
      pid: null,
      lastError: "Failed to start FastAPI backend.",
    };
    throw new Error(
      "Failed to start FastAPI backend. Ensure Python and backend dependencies are installed.",
    );
  }
}

function stopBackend() {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
  backendProcess = null;
  backendStatus = { ...backendStatus, running: false, pid: null };
}

function registerIpcHandlers() {
  const fetchContext = async (path, options = {}) => {
    const token = process.env.SUPERBROWSER_SESSION_TOKEN || readSettings().sessionToken;
    const headers = { ...options.headers, "x-session-token": token };
    return fetch(`${backendBaseUrl}${path}`, { ...options, headers });
  };

  ipcMain.handle("backend:get-status", () => backendStatus);
  ipcMain.handle("backend:get-url", () => backendBaseUrl);

  ipcMain.handle("settings:get", () => readSettings());
  ipcMain.handle("settings:set", (_, partialSettings) => {
    if (!partialSettings || typeof partialSettings !== "object" || Array.isArray(partialSettings)) {
      throw new Error("settings payload must be an object");
    }
    return writeSettings(partialSettings);
  });

  ipcMain.handle("context:start-session", async (_, { sessionId }) => {
    validateString(sessionId, "sessionId");
    const res = await fetchContext(`/api/context/session/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId })
    });
    if (!res.ok) throw new Error(`Failed to start session: ${res.status}`);
    return res.json();
  });

  ipcMain.handle("context:stop-session", async (_, { sessionId, options }) => {
    validateString(sessionId, "sessionId");
    const res = await fetchContext(`/api/context/session/stop/${sessionId}`, {
      method: "POST",
      keepalive: options?.keepalive
    });
    if (!res.ok) throw new Error(`Failed to stop session: ${res.status}`);
    return res.json();
  });

  ipcMain.handle("context:add-query", async (_, { sessionId, tabId, query, mode }) => {
    validateString(sessionId, "sessionId");
    validateString(tabId, "tabId");
    const res = await fetchContext(`/api/context/add_query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, tab_id: tabId, query, mode })
    });
    if (!res.ok) throw new Error(`Failed to add query: ${res.status}`);
    return res.json();
  });

  ipcMain.handle("context:add-results", async (_, { sessionId, tabId, results }) => {
    validateString(sessionId, "sessionId");
    validateString(tabId, "tabId");
    const res = await fetchContext(`/api/context/add_results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, tab_id: tabId, results })
    });
    if (!res.ok) throw new Error(`Failed to add results: ${res.status}`);
    return res.json();
  });

  ipcMain.handle("context:add-visited-page", async (_, { sessionId, tabId, page }) => {
    validateString(sessionId, "sessionId");
    validateString(tabId, "tabId");
    const res = await fetchContext(`/api/context/add_visited_page`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, tab_id: tabId, page })
    });
    if (!res.ok) throw new Error(`Failed to add visited page: ${res.status}`);
    return res.json();
  });

  ipcMain.handle("context:export-session", async (_, { sessionId }) => {
    validateString(sessionId, "sessionId");
    const res = await fetchContext(`/api/context/export/${sessionId}`);
    if (!res.ok) throw new Error(`Failed to export session context: ${res.status}`);
    return res.json();
  });

  ipcMain.handle("context:get-models", async () => {
    const res = await fetchContext(`/api/context/models`);
    if (!res.ok) throw new Error(`Failed to get models: ${res.status}`);
    return res.json();
  });

  ipcMain.handle("context:chat", async (_, { sessionId, message, tabId, model }) => {
    validateString(sessionId, "sessionId");
    const res = await fetchContext(`/api/context/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message, tab_id: tabId, model })
    });
    if (!res.ok) throw new Error(`Failed to chat: ${res.status}`);
    return res.json();
  });

  ipcMain.handle("context:get-tab", async (_, { sessionId, tabId }) => {
    validateString(sessionId, "sessionId");
    validateString(tabId, "tabId");
    const res = await fetchContext(`/api/context/get/${sessionId}/${tabId}`);
    if (!res.ok) throw new Error(`Failed to fetch tab context: ${res.status}`);
    return res.json();
  });

  ipcMain.handle("context:get-session", async (_, { sessionId }) => {
    validateString(sessionId, "sessionId");
    const res = await fetchContext(`/api/context/session/${sessionId}`);
    if (!res.ok) throw new Error(`Failed to fetch session context: ${res.status}`);
    return res.json();
  });

  ipcMain.handle("context:clear-tab", async (_, { sessionId, tabId }) => {
    validateString(sessionId, "sessionId");
    validateString(tabId, "tabId");
    const res = await fetchContext(`/api/context/clear/${sessionId}/${tabId}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error(`Failed to clear tab context: ${res.status}`);
    return res.json();
  });

  ipcMain.handle("app:notify", (_, { title, body }) => {
    if (title !== undefined) validateString(title, "title");
    if (body !== undefined) validateString(body, "body");
    showNotification(title || "SuperBrowser", body || "");
    return { ok: true };
  });

  ipcMain.handle("app:new-window", () => {
    createMainWindow();
    return { ok: true };
  });

  ipcMain.handle("app:new-incognito-window", () => {
    createIncognitoWindow();
    return { ok: true };
  });

  ipcMain.handle("app:new-tab", (event) => {
    const targetWindow = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getFocusedWindow() || mainWindow;
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send("app:new-tab");
      targetWindow.show();
      targetWindow.focus();
    }
    return { ok: true };
  });

  ipcMain.handle("downloads:get-list", async () => {
    const tracked = downloads.map(serializeDownload);
    const folderFiles = await getDownloadsFolderFiles();
    const seen = new Set(tracked.map(item => item.savePath).filter(Boolean));
    return [
      ...tracked,
      ...folderFiles.filter(item => !seen.has(item.savePath)),
    ].slice(0, 200);
  });

  ipcMain.handle("downloads:get-folder-files", () => getDownloadsFolderFiles());

  ipcMain.handle("downloads:open-folder", async () => {
    const errorMessage = await shell.openPath(app.getPath("downloads"));
    if (errorMessage) throw new Error(errorMessage);
    return { ok: true };
  });

  ipcMain.handle("downloads:open-file", async (_, { path: filePath } = {}) => {
    validateString(filePath, "path");
    const errorMessage = await shell.openPath(filePath);
    if (errorMessage) throw new Error(errorMessage);
    return { ok: true };
  });

  ipcMain.handle("downloads:show-in-folder", (_, { path: filePath } = {}) => {
    validateString(filePath, "path");
    shell.showItemInFolder(filePath);
    return { ok: true };
  });

  ipcMain.handle("downloads:clear-list", () => {
    downloads = [];
    downloadsFolderCache = { ts: 0, items: [] };
    return { ok: true };
  });

  ipcMain.handle("app:open-external", (_, { url }) => {
    validateString(url, "url");
    shell.openExternal(url);
    return { ok: true };
  });

  ipcMain.handle("app:print", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) win.webContents.print();
    return { ok: true };
  });

  ipcMain.handle("app:print-preview", async (event, { title } = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return { ok: false };
    const pdfBuffer = await win.webContents.printToPDF({
      printBackground: true,
      marginsType: 0,
      preferCSSPageSize: true,
    });
    createPdfPreviewWindow(pdfBuffer, title || "SuperBrowser Print Preview");
    return { ok: true };
  });

  ipcMain.handle("app:show-print-preview", (_, { pdfData, title } = {}) => {
    const pdfBuffer = normalizePdfData(pdfData);
    createPdfPreviewWindow(pdfBuffer, title || "SuperBrowser Print Preview");
    return { ok: true };
  });

  ipcMain.handle("app:find-in-page", (event, { text, options } = {}) => {
    validateString(text, "text");
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return { ok: false };
    const requestId = win.webContents.findInPage(text, options || {});
    return { ok: true, requestId };
  });

  ipcMain.handle("app:stop-find-in-page", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) win.webContents.stopFindInPage("clearSelection");
    return { ok: true };
  });

  ipcMain.handle("app:clear-browsing-data", async (event) => {
    const senderSession = event.sender.session || session.defaultSession;
    await Promise.all([
      senderSession.clearCache(),
      senderSession.clearStorageData({
        storages: ["cookies", "filesystem", "indexdb", "localstorage", "shadercache", "websql", "serviceworkers", "cachestorage"],
      }),
    ]);
    return { ok: true };
  });

  ipcMain.handle("app:toggle-fullscreen", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setFullScreen(!win.isFullScreen());
    return { ok: true };
  });

  ipcMain.handle("app:quit", () => {
    app.quit();
    return { ok: true };
  });

  ipcMain.handle("app:show", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
    return { ok: true };
  });
}

function clearTemporarySession(tempSession) {
  if (!tempSession) return;
  Promise.allSettled([
    tempSession.clearCache(),
    tempSession.clearStorageData({
      storages: ["cookies", "filesystem", "indexdb", "localstorage", "shadercache", "websql", "serviceworkers", "cachestorage"],
    }),
    tempSession.clearAuthCache?.(),
  ]).catch(() => {});
}

function createIncognitoWindow() {
  const incognitoPartition = `incognito:${Date.now()}`;
  return createMainWindow({
    incognito: true,
    partition: incognitoPartition,
    tempSession: session.fromPartition(incognitoPartition),
  });
}

function createMainWindow(options = {}) {
  const incognito = options.incognito === true;
  const windowPartition = options.partition;
  const tempSession = options.tempSession;
  const settings = readSettings();
  const bounds = settings.windowBounds || {};
  const win = new BrowserWindow({
    width: bounds.width || 1280,
    height: bounds.height || 800,
    x: Number.isInteger(bounds.x) ? bounds.x : undefined,
    y: Number.isInteger(bounds.y) ? bounds.y : undefined,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: "#111827",
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: !isDev,
      devTools: isDev,
      partition: windowPartition,
      additionalArguments: incognito ? ["--superbrowser-incognito=1"] : [],
    },
  });
  registerDownloadTracking(win.webContents.session);
  win.webContents.on("did-attach-webview", (_event, webContents) => {
    registerDownloadTracking(webContents.session);
  });
  if (incognito) {
    win.setTitle("SuperBrowser - Incognito");
  } else {
    mainWindow = win;
  }

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  win.webContents.on("render-process-gone", (_event, details) => {
    logEvent("error", "Renderer process gone", { reason: details?.reason, exitCode: details?.exitCode });
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    // Keep renderer shell intact. Link handling is done inside renderer.
    logEvent("info", "Blocked external window open", { url });
    return { action: "deny" };
  });

  const persistBounds = () => {
    if (incognito || !mainWindow) return;
    const next = mainWindow.getBounds();
    writeSettings({ windowBounds: next });
  };
  win.on("resize", persistBounds);
  win.on("move", persistBounds);
  if (incognito) {
    win.once("closed", () => clearTemporarySession(tempSession));
  }
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });
}

app.whenReady().then(() => {
  logEvent("info", "App starting", { isDev });
  app.setAsDefaultProtocolClient("superbrowser");
  createAppMenu();
  createTray();
  registerDownloadTracking();
  registerIpcHandlers();
  startBackend()
    .catch(async (error) => {
      logEvent("error", "Backend startup failed", { error: String(error.message || error) });
      backendStatus = {
        running: false,
        url: backendBaseUrl,
        pid: null,
        lastError: String(error.message || error),
      };
      await dialog.showErrorBox("Backend startup failed", String(error.message || error));
      showNotification("SuperBrowser", "Backend failed to start");
    })
    .finally(() => {
      createMainWindow();
      if (backendStatus.running) {
        showNotification("SuperBrowser", "Backend connected");
        logEvent("info", "Backend connected", { url: backendBaseUrl, pid: backendStatus.pid });
      }
    });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("second-instance", (_event, argv) => {
  const deepLink = argv.find((arg) => arg.startsWith("superbrowser://"));
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    if (deepLink) {
      mainWindow.webContents.send("deep-link", deepLink);
    }
  }
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  if (mainWindow) {
    mainWindow.webContents.send("deep-link", url);
  }
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  logEvent("info", "App shutting down");
  stopBackend();
});
