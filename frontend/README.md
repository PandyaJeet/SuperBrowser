# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Electron (Desktop) - Module 1 Scaffold

This project now includes a basic Electron scaffold.

### Run in desktop dev mode

```bash
npm install
npm run dev:electron
```

This starts:
- Vite dev server
- Electron window loading the Vite URL

### Run desktop from production build

```bash
npm run build
npm run start:electron
```

Electron files:
- `electron/main.cjs`
- `electron/preload.cjs`

## Frontend Integration Notes (Module 2)

- Shared API resolver: `src/config/apiBase.js`
- Electron renderer uses `window.superBrowserDesktop?.isElectron` to detect desktop mode
- Optional Electron API override env: `VITE_API_BASE_ELECTRON`
- Added baseline CSP in `index.html`

## Backend Integration (Module 3)

Electron now auto-manages the FastAPI backend:

- Finds a free local port (starting from `8000`)
- Spawns backend with `uvicorn main:app`
- Waits for `/health` before proceeding
- Exposes backend URL to renderer via preload (`window.superBrowserDesktop.backendUrl`)
- Gracefully stops backend on app quit

### Prerequisites

From `backend`:

```bash
pip install -r requirements.txt
```

If Python executable is non-standard, set `PYTHON_PATH` before launching Electron.

## IPC Integration (Module 4)

Added secure IPC channels via `contextBridge`:

- `superBrowserDesktop.backend.getStatus()`
- `superBrowserDesktop.backend.getUrl()`
- `superBrowserDesktop.settings.get()`
- `superBrowserDesktop.settings.set(partialSettings)`
- `superBrowserDesktop.context.getTab(sessionId, tabId)`
- `superBrowserDesktop.context.getSession(sessionId)`
- `superBrowserDesktop.context.clearTab(sessionId, tabId)`

Renderer uses IPC when in Electron, with HTTP fallback when running in browser mode.

## Desktop Native Features (Module 5)

Implemented in Electron main/preload:

- Native menu (File/Edit/View/Window/Help)
- System tray with Show/Hide/Quit
- Keyboard shortcuts (via menu accelerators)
- Desktop notifications (`superBrowserDesktop.app.notify`)
- Window bounds persistence in `settings.json`
- Deep link support: `superbrowser://...`

Also added:
- Single-instance lock (second launch focuses existing window)

## Build & Packaging (Module 6)

Added `electron-builder` pipeline.

### Build commands

```bash
npm run build         # build renderer
npm run pack          # unpacked electron app
npm run dist          # installer for current platform
npm run dist:win      # Windows NSIS installer
npm run dist:linux    # Linux AppImage
npm run dist:mac      # macOS DMG
```

### Packaging notes

- Output directory: `frontend/release`
- Includes:
  - `dist/` (Vite build)
  - `electron/` (main/preload)
  - `../backend` as extra resource
- In packaged mode, Electron resolves backend from `process.resourcesPath/backend`

## Production Hardening (Module 7)

Implemented:

- Renderer error boundary (`src/ErrorBoundary.jsx`)
- Structured app logging to `app.getPath("userData")/app.log`
- IPC input validation for settings/context/notifications
- Safer BrowserWindow webPreferences:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true` in production
  - devtools disabled in production
- Renderer crash event logging (`render-process-gone`)
