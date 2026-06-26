const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const { Request } = require('@cliqz/adblocker');
const { session, ipcMain, webContents, app } = require('electron');
const fs = require('fs');
const path = require('path');

let blocker = null;
let trackersBlocker = null;

// Map to store per-page/tab blocked counts: webContentsId -> { ads, trackers }
const tabBlockedStats = new Map();

// Helper to read/write settings.json directly
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

const CACHE_PATH = path.join(app.getPath('userData'), 'adblock-cache');
const TRACKERS_CACHE_PATH = path.join(app.getPath('userData'), 'trackers-cache');

async function initBlocker() {
  try {
    const settings = readSettings();
    const now = Date.now();
    const lastUpdate = settings.filterListsUpdatedAt || 0;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    
    let shouldDownload = !fs.existsSync(CACHE_PATH) || !fs.existsSync(TRACKERS_CACHE_PATH) || (now - lastUpdate > sevenDays);
    let loaded = false;
    
    if (shouldDownload) {
      console.log('[SuperBrowser adblocker] Fetching fresh filter lists...');
      try {
        const easyListRes = await fetch('https://easylist.to/easylist/easylist.txt');
        const easyPrivacyRes = await fetch('https://easylist.to/easylist/easyprivacy.txt');
        
        if (easyListRes.ok && easyPrivacyRes.ok) {
          const easyListText = await easyListRes.text();
          const easyPrivacyText = await easyPrivacyRes.text();
          
          blocker = ElectronBlocker.parse(easyListText + '\n' + easyPrivacyText);
          trackersBlocker = ElectronBlocker.parse(easyPrivacyText);
          
          // Save to cache
          fs.writeFileSync(CACHE_PATH, blocker.serialize());
          fs.writeFileSync(TRACKERS_CACHE_PATH, trackersBlocker.serialize());
          
          writeSettings({ filterListsUpdatedAt: now });
          console.log('[SuperBrowser adblocker] Filter lists downloaded and cached successfully.');
          loaded = true;
        } else {
          console.warn('[SuperBrowser adblocker] Failed to fetch filter lists, status code:', easyListRes.status, easyPrivacyRes.status);
        }
      } catch (e) {
        console.error('[SuperBrowser adblocker] Failed to download filter lists, falling back to local files.', e);
      }
    }
    
    if (!loaded) {
      // Try loading from cached engines
      if (fs.existsSync(CACHE_PATH) && fs.existsSync(TRACKERS_CACHE_PATH)) {
        console.log('[SuperBrowser adblocker] Loading blocker from cached engines...');
        try {
          blocker = ElectronBlocker.deserialize(fs.readFileSync(CACHE_PATH));
          trackersBlocker = ElectronBlocker.deserialize(fs.readFileSync(TRACKERS_CACHE_PATH));
          loaded = true;
          console.log('[SuperBrowser adblocker] Cached blocker engines loaded successfully.');
        } catch (e) {
          console.error('[SuperBrowser adblocker] Failed to deserialize cached engines.', e);
        }
      }
    }
    
    if (!loaded) {
      // Fallback to local bundled snapshots
      console.log('[SuperBrowser adblocker] Loading blocker from local bundled snapshots...');
      const easyListPath = path.join(__dirname, 'filters', 'easylist.txt');
      const easyPrivacyPath = path.join(__dirname, 'filters', 'easyprivacy.txt');
      
      try {
        const easyListText = fs.readFileSync(easyListPath, 'utf8');
        const easyPrivacyText = fs.readFileSync(easyPrivacyPath, 'utf8');
        
        blocker = ElectronBlocker.parse(easyListText + '\n' + easyPrivacyText);
        trackersBlocker = ElectronBlocker.parse(easyPrivacyText);
        
        // Save to cache so next launch is fast
        fs.writeFileSync(CACHE_PATH, blocker.serialize());
        fs.writeFileSync(TRACKERS_CACHE_PATH, trackersBlocker.serialize());
        
        console.log('[SuperBrowser adblocker] Local bundled snapshots loaded and cached successfully.');
        loaded = true;
      } catch (e) {
        console.error('[SuperBrowser adblocker] Critical failure: Failed to load bundled snapshots.', e);
      }
    }
    
    if (loaded && blocker) {
      // Setup IPC handlers
      setupIpcHandlers();
      
      // Hook Electron sessions
      attachBlockingToSession(session.defaultSession);
      attachBlockingToSession(session.fromPartition('persist:superbrowser'));
      
      // Listen for navigation to reset stats
      setupNavigationListener();
    }
  } catch (err) {
    console.error('[SuperBrowser adblocker] Uncaught error during initialization:', err);
  }
}

function getPageHost(details) {
  let urlStr = '';
  if (details.resourceType === 'mainFrame') {
    urlStr = details.url;
  } else {
    if (details.webContentsId) {
      try {
        const wc = webContents.fromId(details.webContentsId);
        if (wc) {
          urlStr = wc.getURL();
        }
      } catch (err) {}
    }
    if (!urlStr) {
      urlStr = details.referrer || details.initiator || '';
    }
  }
  
  if (!urlStr) return '';
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname;
  } catch (e) {
    return '';
  }
}

function sendStatsUpdate(webContentsId, stats) {
  const windows = webContents.getAllWebContents();
  for (const wc of windows) {
    if (wc.getType() === 'window' && !wc.isDestroyed()) {
      try {
        const guestWc = webContents.fromId(webContentsId);
        const url = guestWc ? guestWc.getURL() : '';
        wc.send('blocking-stats-update', {
          webContentsId,
          url,
          stats
        });
      } catch (err) {}
    }
  }
}

function attachBlockingToSession(sessionInstance) {
  try {
    ipcMain.removeHandler('@cliqz/adblocker/inject-cosmetic-filters');
  } catch (e) {}
  try {
    ipcMain.removeHandler('@ghostery/adblocker/inject-cosmetic-filters');
  } catch (e) {}
  
  blocker.enableBlockingInSession(sessionInstance);
  
  sessionInstance.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, callback) => {
      const host = getPageHost(details);
      const settings = readSettings();
      const whitelist = settings.blockingWhitelist || [];
      
      const isWhitelisted = whitelist.some(domain => {
        return host === domain || host.endsWith('.' + domain);
      });
      
      if (isWhitelisted) {
        callback({ cancel: false });
        return;
      }
      
      const blockAds = settings.blockAds !== false;
      const blockTrackers = settings.blockTrackers !== false;
      
      if (!blockAds && !blockTrackers) {
        callback({ cancel: false });
        return;
      }
      
      blocker.onBeforeRequest(details, (response) => {
        if (response && response.cancel) {
          const req = Request.fromRawDetails({
            url: details.url,
            type: details.resourceType || 'other',
            sourceUrl: details.referrer
          });
          const isTracker = trackersBlocker.match(req);
          
          if (isTracker) {
            if (!blockTrackers) {
              callback({ cancel: false });
              return;
            }
          } else {
            if (!blockAds) {
              callback({ cancel: false });
              return;
            }
          }
          
          const wcId = details.webContentsId;
          if (wcId) {
            if (!tabBlockedStats.has(wcId)) {
              tabBlockedStats.set(wcId, { ads: 0, trackers: 0 });
            }
            const stats = tabBlockedStats.get(wcId);
            if (isTracker) {
              stats.trackers++;
            } else {
              stats.ads++;
            }
            sendStatsUpdate(wcId, stats);
          }
        }
        
        callback(response);
      });
    }
  );
}

function setupNavigationListener() {
  app.on('web-contents-created', (_, wc) => {
    if (wc.getType() === 'webview') {
      wc.on('did-start-navigation', (event, url, isInPlace, isMainFrame) => {
        if (isMainFrame && !isInPlace) {
          const stats = { ads: 0, trackers: 0 };
          tabBlockedStats.set(wc.id, stats);
          sendStatsUpdate(wc.id, stats);
        }
      });
      
      wc.on('destroyed', () => {
        tabBlockedStats.delete(wc.id);
      });
    }
  });
}

function setupIpcHandlers() {
  ipcMain.handle('blocking:get-stats', (_, { webContentsId }) => {
    return tabBlockedStats.get(webContentsId) || { ads: 0, trackers: 0 };
  });

  ipcMain.handle('blocking:get-settings', () => {
    const settings = readSettings();
    return {
      blockAds: settings.blockAds !== false,
      blockTrackers: settings.blockTrackers !== false,
      whitelist: settings.blockingWhitelist || []
    };
  });

  ipcMain.handle('blocking:set-domain-enabled', (_, { domain, enabled }) => {
    const settings = readSettings();
    let whitelist = settings.blockingWhitelist || [];
    if (enabled) {
      whitelist = whitelist.filter(d => d !== domain);
    } else {
      if (!whitelist.includes(domain)) {
        whitelist.push(domain);
      }
    }
    writeSettings({ blockingWhitelist: whitelist });
    return { ok: true };
  });

  ipcMain.handle('blocking:toggle', (_, { type }) => {
    const settings = readSettings();
    if (type === 'ads') {
      const blockAds = !(settings.blockAds !== false);
      writeSettings({ blockAds });
      return { blockAds };
    } else if (type === 'trackers') {
      const blockTrackers = !(settings.blockTrackers !== false);
      writeSettings({ blockTrackers });
      return { blockTrackers };
    }
    return { error: 'Invalid type' };
  });
}

module.exports = {
  initBlocker
};
