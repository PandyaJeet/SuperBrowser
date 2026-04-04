const path = require("path");
const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");
const {
  app,
  BrowserWindow,
  shell,
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
let backendStatus = {
  running: false,
  url: backendBaseUrl,
  pid: null,
  lastError: null,
};

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

function validateString(value, name) {
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  return value;
}

function createAppMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "New Window",
          accelerator: "CmdOrCtrl+N",
          click: () => createMainWindow(),
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
    process.stdout.write(`[backend] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[backend] ${chunk}`);
  });

  return child;
}

async function startBackend() {
  const port = await findAvailablePort();
  backendBaseUrl = `http://${BACKEND_HOST}:${port}`;
  process.env.SUPERBROWSER_BACKEND_URL = backendBaseUrl;
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
    backendProcess.stdout.on("data", (chunk) => process.stdout.write(`[backend] ${chunk}`));
    backendProcess.stderr.on("data", (chunk) => process.stderr.write(`[backend] ${chunk}`));
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
  ipcMain.handle("backend:get-status", () => backendStatus);
  ipcMain.handle("backend:get-url", () => backendBaseUrl);

  ipcMain.handle("settings:get", () => readSettings());
  ipcMain.handle("settings:set", (_, partialSettings) => {
    if (!partialSettings || typeof partialSettings !== "object" || Array.isArray(partialSettings)) {
      throw new Error("settings payload must be an object");
    }
    return writeSettings(partialSettings);
  });

  ipcMain.handle("context:get-tab", async (_, { sessionId, tabId }) => {
    validateString(sessionId, "sessionId");
    validateString(tabId, "tabId");
    const res = await fetch(`${backendBaseUrl}/api/context/get/${sessionId}/${tabId}`);
    if (!res.ok) throw new Error(`Failed to fetch tab context: ${res.status}`);
    return res.json();
  });

  ipcMain.handle("context:get-session", async (_, { sessionId }) => {
    validateString(sessionId, "sessionId");
    const res = await fetch(`${backendBaseUrl}/api/context/session/${sessionId}`);
    if (!res.ok) throw new Error(`Failed to fetch session context: ${res.status}`);
    return res.json();
  });

  ipcMain.handle("context:clear-tab", async (_, { sessionId, tabId }) => {
    validateString(sessionId, "sessionId");
    validateString(tabId, "tabId");
    const res = await fetch(`${backendBaseUrl}/api/context/clear/${sessionId}/${tabId}`, {
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

  ipcMain.handle("app:show", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
    return { ok: true };
  });
}

function createMainWindow() {
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
    },
  });
  mainWindow = win;

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
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
    if (!mainWindow) return;
    const next = mainWindow.getBounds();
    writeSettings({ windowBounds: next });
  };
  win.on("resize", persistBounds);
  win.on("move", persistBounds);
  win.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  logEvent("info", "App starting", { isDev });
  app.setAsDefaultProtocolClient("superbrowser");
  createAppMenu();
  createTray();
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
