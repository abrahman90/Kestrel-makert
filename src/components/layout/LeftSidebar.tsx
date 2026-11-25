import React from 'react';
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  BellRing,
  Briefcase,
  Calendar,
  CandlestickChart,
  ChevronLeft,
  ChevronRight,
  FileBarChart2,
  Filter,
  Globe2,
  LayoutDashboard,
  Newspaper,
  Settings,
  Shield,
  Star,
  X,
} from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { NavSection } from '../../types/market';

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'charts', label: 'Advanced Charts', icon: CandlestickChart },
  { id: 'markets', label: 'Markets', icon: Globe2 },
  { id: 'screener', label: 'Market Screener', icon: Filter },
  { id: 'watchlists', label: 'Watchlists', icon: Star },
  { id: 'technical', label: 'Technical Analysis', icon: Activity },
  { id: 'trading', label: 'Trading', icon: ArrowLeftRight },
  { id: 'portfolio', label: 'Portfolio', icon: Briefcase },
  { id: 'alerts', label: 'Price Alerts', icon: BellRing },
  { id: 'news', label: 'Market News', icon: Newspaper },
  { id: 'calendar', label: 'Economic Calendar', icon: Calendar },
  { id: 'reports', label: 'Reports', icon: FileBarChart2 },
  { id: 'admin', label: 'Admin Console', icon: Shield },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function LeftSidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const { activeScreen, setActiveScreen, alerts, openPositions } = usePlatform();
  const activeAlertCount = alerts.filter((a) => a.status === 'Active').length;

  const handleSelect = (id: NavSection) => {
    setActiveScreen(id);
    onCloseMobile();
  };

  const navContent = (isCompact: boolean) => (
    <div className="flex flex-col h-full bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] select-none">
      <div className="flex-1 py-2 px-1.5 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeScreen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              title={isCompact ? item.label : undefined}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#2962FF]/12 text-[#2962FF]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
              } ${isCompact ? 'justify-center px-0' : ''}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!isCompact && (
                <span className="flex-1 text-left truncate">{item.label}</span>
              )}
              {!isCompact && item.id === 'alerts' && activeAlertCount > 0 && (
                <span className="font-mono tabular-nums text-[11px] text-[var(--text-muted)]">
                  {activeAlertCount}
                </span>
              )}
              {!isCompact && item.id === 'trading' && openPositions.length > 0 && (
                <span className="font-mono tabular-nums text-[11px] text-[#089981]">
                  {openPositions.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop Collapse Control */}
      <div className="hidden lg:flex items-center justify-between p-2 border-t border-[var(--border-subtle)]">
        {!isCompact && (
          <div className="flex items-center gap-1.5 px-1.5 text-[11px] text-[var(--text-muted)] truncate">
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Multi-Market Feed</span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={isCompact ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer ${
            isCompact ? 'mx-auto' : ''
          }`}
        >
          {isCompact ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-[width] duration-150 ${
          collapsed ? 'w-14' : 'w-52'
        }`}
      >
        {navContent(collapsed)}
      </aside>

      {/* Mobile & Tablet Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/60" onClick={onCloseMobile} />
          <aside className="relative w-64 max-w-[80vw] h-full z-10 flex flex-col bg-[var(--bg-surface)]">
            <div className="h-12 px-4 flex items-center justify-between border-b border-[var(--border-subtle)]">
              <span className="text-sm font-bold text-[var(--text-primary)]">Kestrel Navigation</span>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Close menu"
                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{navContent(false)}</div>
          </aside>
        </div>
      )}
    </>
  );
}
