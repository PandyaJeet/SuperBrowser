import React, { useState, useEffect, useRef } from 'react';

const ShieldIcon = ({ active, className }) => {
  if (active) {
    return (
      <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
};

export default function ShieldsPanel({ url, webviewRef }) {
  const [isOpen, setIsOpen] = useState(false);
  const [webContentsId, setWebContentsId] = useState(null);
  const [stats, setStats] = useState({ ads: 0, trackers: 0 });
  const [settings, setSettings] = useState({ blockAds: true, blockTrackers: true, whitelist: [] });
  const [dirty, setDirty] = useState(false);
  
  const popoverRef = useRef(null);
  
  const getDomain = (urlStr) => {
    if (!urlStr) return '';
    try {
      const parsed = new URL(urlStr);
      return parsed.hostname;
    } catch {
      return '';
    }
  };
  
  const domain = getDomain(url);
  
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await window.superBrowserDesktop.blocking.getSettings();
        setSettings(res);
      } catch (err) {
        console.error('Failed to get blocking settings:', err);
      }
    };
    fetchSettings();
    
    const webview = webviewRef.current;
    if (!webview) return;
    
    const updateWcId = () => {
      try {
        const id = webview.getWebContentsId();
        setWebContentsId(id);
      } catch {
        // webContents might not be ready yet, ignore and wait for next event
      }
    };
    
    webview.addEventListener('dom-ready', updateWcId);
    webview.addEventListener('did-start-navigation', updateWcId);
    
    // Initial check
    if (webview.getWebContentsId) {
      updateWcId();
    }
    
    return () => {
      webview.removeEventListener('dom-ready', updateWcId);
      webview.removeEventListener('did-start-navigation', updateWcId);
    };
  }, [webviewRef, url]);
  
  useEffect(() => {
    if (!webContentsId) return;
    
    window.superBrowserDesktop.blocking.getStats(webContentsId).then(setStats);
    
    const unsubscribe = window.superBrowserDesktop.blocking.onStatsUpdate((data) => {
      if (data.webContentsId === webContentsId) {
        setStats(data.stats);
      }
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [webContentsId]);
  
  const isWhitelisted = settings.whitelist.includes(domain);
  const shieldsUp = !isWhitelisted;
  
  const handleToggleShields = async () => {
    const nextEnabled = !shieldsUp;
    await window.superBrowserDesktop.blocking.setDomainEnabled(domain, nextEnabled);
    const updatedSettings = await window.superBrowserDesktop.blocking.getSettings();
    setSettings(updatedSettings);
    setDirty(true);
  };
  
  const handleToggleAdBlock = async () => {
    await window.superBrowserDesktop.blocking.toggle('ads');
    const updatedSettings = await window.superBrowserDesktop.blocking.getSettings();
    setSettings(updatedSettings);
    setDirty(true);
  };
  
  const handleToggleTrackerBlock = async () => {
    await window.superBrowserDesktop.blocking.toggle('trackers');
    const updatedSettings = await window.superBrowserDesktop.blocking.getSettings();
    setSettings(updatedSettings);
    setDirty(true);
  };
  
  const handleReload = () => {
    if (webviewRef.current) {
      webviewRef.current.reload();
      setDirty(false);
      setIsOpen(false);
    }
  };
  
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);
  
  const totalBlocked = stats.ads + stats.trackers;
  
  return (
    <div className="relative" ref={popoverRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors relative flex items-center justify-center outline-none"
        title="Shields"
      >
        <ShieldIcon active={shieldsUp} className={shieldsUp ? "text-emerald-500" : "text-gray-400"} />
        {shieldsUp && totalBlocked > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center border-2 border-white dark:border-gray-900 shadow-sm animate-scale-up">
            {totalBlocked}
          </span>
        )}
      </button>
      
      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 shadow-xl z-50 animate-fade-in-up">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)] mb-3">
            <div className="flex items-center gap-2">
              <ShieldIcon active={shieldsUp} className={shieldsUp ? "text-emerald-500" : "text-gray-400"} />
              <span className="font-semibold text-sm text-[var(--text-primary)] truncate max-w-[200px]">
                Shields for {domain || 'this site'}
              </span>
            </div>
          </div>
          
          {/* Master Toggle */}
          <div className="flex items-center justify-between py-2 mb-3">
            <span className="text-sm font-medium text-[var(--text-primary)]">Shields UP for this site</span>
            <button 
              onClick={handleToggleShields}
              className={`w-10 h-6 rounded-full transition-colors relative outline-none cursor-pointer ${shieldsUp ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${shieldsUp ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          {/* Stats breakdown */}
          <div className="space-y-2 py-2 px-3 bg-[var(--bg-elevated)] rounded-xl mb-3">
            <div className="flex justify-between text-xs text-[var(--text-secondary)]">
              <span>Ads & popups blocked:</span>
              <span className="font-semibold text-[var(--text-primary)]">{shieldsUp ? stats.ads : 0}</span>
            </div>
            <div className="flex justify-between text-xs text-[var(--text-secondary)]">
              <span>Trackers & cookies blocked:</span>
              <span className="font-semibold text-[var(--text-primary)]">{shieldsUp ? stats.trackers : 0}</span>
            </div>
            <div className="flex justify-between text-xs border-t border-[var(--border-color)] pt-1.5 font-medium text-[var(--text-primary)]">
              <span>Total blocked:</span>
              <span>{shieldsUp ? totalBlocked : 0}</span>
            </div>
          </div>

          {/* Independent Toggles */}
          <div className="space-y-3 pt-2 pb-1 border-t border-[var(--border-color)]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Block Ads & Popups</span>
              <button 
                onClick={handleToggleAdBlock}
                disabled={!shieldsUp}
                className={`w-8 h-5 rounded-full transition-colors relative outline-none cursor-pointer ${!shieldsUp ? 'opacity-50 cursor-not-allowed bg-gray-200 dark:bg-gray-800' : (settings.blockAds ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700')}`}
              >
                <div className={`w-3 h-3 rounded-full bg-white absolute top-1 transition-transform ${!shieldsUp ? 'left-1' : (settings.blockAds ? 'right-1' : 'left-1')}`} />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-secondary)]">Block Trackers</span>
              <button 
                onClick={handleToggleTrackerBlock}
                disabled={!shieldsUp}
                className={`w-8 h-5 rounded-full transition-colors relative outline-none cursor-pointer ${!shieldsUp ? 'opacity-50 cursor-not-allowed bg-gray-200 dark:bg-gray-800' : (settings.blockTrackers ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-700')}`}
              >
                <div className={`w-3 h-3 rounded-full bg-white absolute top-1 transition-transform ${!shieldsUp ? 'left-1' : (settings.blockTrackers ? 'right-1' : 'left-1')}`} />
              </button>
            </div>
          </div>

          {/* Dirty reload state */}
          {dirty && (
            <div className="mt-3 pt-3 border-t border-[var(--border-color)] text-center">
              <button 
                onClick={handleReload}
                className="text-xs font-semibold text-[var(--action-primary)] hover:text-[var(--action-hover)] transition-colors flex items-center justify-center gap-1.5 w-full py-2 hover:bg-[var(--bg-hover)] rounded-lg outline-none cursor-pointer"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Reload to apply changes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
