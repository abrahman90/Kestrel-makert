/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PlatformProvider, usePlatform } from './context/PlatformContext';
import { TopNavBar } from './components/layout/TopNavBar';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { BottomStatusBar } from './components/layout/BottomStatusBar';
import { HelpModal } from './components/layout/HelpModal';
import { CreateAlertModal, GlobalSearchModal } from './components/layout/GlobalModals';
import { AuthModalOrScreen } from './components/auth/AuthModalOrScreen';
import { ToastContainer } from './components/ui/DesignSystem';
import { OverviewScreen } from './components/screens/OverviewScreen';
import { ChartWorkspace } from './components/charts/ChartWorkspace';
import { MarketsScreen } from './components/screens/MarketsScreen';
import { ScreenerScreen } from './components/screens/ScreenerScreen';
import { WatchlistScreen } from './components/screens/WatchlistScreen';
import { TechnicalAnalysisScreen } from './components/screens/TechnicalAnalysisScreen';
import { AlertsScreen } from './components/screens/AlertsScreen';
import { NewsScreen } from './components/screens/NewsScreen';
import { CalendarScreen } from './components/screens/CalendarScreen';
import { PortfolioScreen } from './components/screens/PortfolioScreen';
import { TradingScreen } from './components/screens/TradingScreen';
import { ReportsScreen } from './components/screens/ReportsScreen';
import { AdminScreen } from './components/screens/AdminScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';

function WorkspaceRouter() {
  const { activeScreen } = usePlatform();

  switch (activeScreen) {
    case 'overview':
      return <OverviewScreen />;
    case 'charts':
      return <ChartWorkspace />;
    case 'markets':
      return <MarketsScreen />;
    case 'screener':
      return <ScreenerScreen />;
    case 'watchlists':
      return <WatchlistScreen />;
    case 'technical':
      return <TechnicalAnalysisScreen />;
    case 'trading':
      return <TradingScreen />;
    case 'alerts':
      return <AlertsScreen />;
    case 'news':
      return <NewsScreen />;
    case 'calendar':
      return <CalendarScreen />;
    case 'portfolio':
      return <PortfolioScreen />;
    case 'reports':
      return <ReportsScreen />;
    case 'admin':
      return <AdminScreen />;
    case 'settings':
      return <SettingsScreen />;
    default:
      return <OverviewScreen />;
  }
}

function PlatformShell() {
  const { activeScreen, toasts, dismissToast } = usePlatform();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)] overflow-hidden">
      <TopNavBar onToggleMobileNav={() => setMobileNavOpen((o) => !o)} />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <LeftSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />

        <main
          className={`flex-1 min-w-0 ${
            activeScreen === 'charts' ? 'overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          <WorkspaceRouter />
        </main>
      </div>

      <BottomStatusBar />

      <GlobalSearchModal />
      <CreateAlertModal />
      <HelpModal />
      <AuthModalOrScreen />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default function App() {
  return (
    <PlatformProvider>
      <PlatformShell />
    </PlatformProvider>
  );
}
