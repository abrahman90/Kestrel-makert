import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  TrendingUp,
  ChevronDown,
} from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { MarketCategory, NavSection } from '../../types/market';

const CATEGORIES: MarketCategory[] = ['All', 'Forex', 'Crypto', 'Stocks', 'Indices', 'Commodities'];

const QUICK_NAV: { id: NavSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'charts', label: 'Charts' },
  { id: 'screener', label: 'Screener' },
  { id: 'watchlists', label: 'Watchlists' },
  { id: 'calendar', label: 'Calendar' },
];

export function TopNavBar({ onToggleMobileNav }: { onToggleMobileNav: () => void }) {
  const {
    theme,
    toggleTheme,
    activeScreen,
    setActiveScreen,
    globalCategory,
    setGlobalCategory,
    setIsSearchModalOpen,
    alerts,
    unreadNotifications,
    markNotificationsRead,
    settings,
    openChart,
  } = usePlatform();

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const triggeredAlerts = alerts.filter((a) => a.status === 'Triggered');

  return (
    <header className="h-12 shrink-0 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-3 lg:px-4 flex items-center justify-between gap-4 z-30">
      {/* Left Zone: Mobile Menu + Brand Wordmark + Market Category Selector */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileNav}
          aria-label="Toggle navigation sidebar"
          className="lg:hidden p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
        >
          <Menu className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setActiveScreen('overview')}
          className="flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer group"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            className="shrink-0"
            aria-hidden="true"
          >
            <rect width="24" height="24" rx="4" fill="#2962FF" />
            <path
              d="M6 16.5L10.2 11.5L13.5 13.8L18 7.5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M15 7.5H18V10.5"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">
            Kestrel
          </span>
        </button>

        <div className="hidden xl:flex items-center gap-0.5 pl-3 ml-1 border-l border-[var(--border-subtle)]">
          {QUICK_NAV.map((item) => {
            const active = activeScreen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveScreen(item.id)}
                className={`px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                  active
                    ? 'text-[var(--text-primary)] border-[#2962FF]'
                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Center Zone: Global Search + Market Category Selector */}
      <div className="flex items-center gap-2 flex-1 max-w-xl justify-center">
        <button
          type="button"
          onClick={() => setIsSearchModalOpen(true)}
          className="flex items-center justify-between gap-2 h-8 w-full max-w-xs px-2.5 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] rounded text-xs text-[var(--text-secondary)] transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)]" />
            <span className="truncate">Search symbols, FX, crypto...</span>
          </span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded">
            ⌘K
          </kbd>
        </button>

        <div className="hidden md:flex items-center">
          <select
            aria-label="Global market category"
            value={globalCategory}
            onChange={(e) => setGlobalCategory(e.target.value as MarketCategory)}
            className="h-8 px-2.5 text-xs font-medium bg-[var(--bg-canvas)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] rounded focus:outline-none focus:border-[#2962FF] cursor-pointer"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'All' ? 'All Markets' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right Zone: Notifications, Theme Toggle, Settings, Profile */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => {
              setNotifOpen((prev) => !prev);
              markNotificationsRead();
            }}
            aria-label="Notifications"
            className="relative p-2 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] transition-colors cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-1 flex items-center justify-center rounded-sm bg-[#2962FF] text-[9px] font-mono font-semibold text-white">
                {unreadNotifications}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-1.5 w-80 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-md shadow-xl z-50 overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Alert Activity
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen(false);
                    setActiveScreen('alerts');
                  }}
                  className="text-[11px] font-medium text-[#2962FF] hover:underline cursor-pointer"
                >
                  Manage Alerts
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                {triggeredAlerts.length === 0 ? (
                  <p className="p-4 text-xs text-[var(--text-secondary)] text-center">
                    No triggered alerts yet.
                  </p>
                ) : (
                  triggeredAlerts.map((al) => (
                    <button
                      key={al.id}
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        openChart(al.symbol);
                      }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-[var(--bg-panel)] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold font-mono text-[var(--text-primary)]">
                          {al.symbol}
                        </span>
                        <span className="text-[11px] font-mono text-[var(--text-muted)]">
                          {al.triggeredAt ?? al.createdAt}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        {al.condition} {al.targetPrice}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme Selector */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} theme`}
          className="p-2 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] transition-colors cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Settings Shortcut */}
        <button
          type="button"
          onClick={() => setActiveScreen('settings')}
          aria-label="Settings"
          title="Settings"
          className={`hidden sm:flex p-2 rounded transition-colors cursor-pointer ${
            activeScreen === 'settings'
              ? 'text-[#2962FF] bg-[#2962FF]/10'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
          }`}
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Profile */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((p) => !p)}
            className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded hover:bg-[var(--bg-panel)] transition-colors cursor-pointer"
          >
            {!avatarFailed ? (
              <img
                src="/src/assets/images/avatar_analyst_user_1795600914271.jpg"
                alt={settings.fullName}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-6 h-6 rounded object-cover border border-[var(--border-subtle)]"
              />
            ) : (
              <div className="w-6 h-6 rounded bg-[#2962FF]/20 text-[#2962FF] text-[10px] font-semibold flex items-center justify-center">
                SD
              </div>
            )}
            <span className="hidden md:inline text-xs font-medium text-[var(--text-primary)] whitespace-nowrap max-w-[110px] truncate">
              {settings.fullName}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] hidden md:inline" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-1.5 w-60 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-md shadow-xl z-50 overflow-hidden">
              <div className="px-3.5 py-3 border-b border-[var(--border-subtle)]">
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                  {settings.fullName}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)] truncate">
                  {settings.roleTitle}
                </p>
                <p className="text-[11px] font-mono text-[var(--text-muted)] truncate mt-0.5">
                  {settings.email}
                </p>
              </div>
              <div className="p-1.5 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    setActiveScreen('portfolio');
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-panel)] rounded cursor-pointer"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  <span>Portfolio Analytics</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    setActiveScreen('settings');
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-panel)] rounded cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  <span>Account & Preferences</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
