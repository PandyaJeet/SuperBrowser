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
    .catch(err => console.error(err))