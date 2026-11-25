import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  INITIAL_ALERTS,
  INITIAL_ECONOMIC_EVENTS,
  INITIAL_HOLDINGS,
  INITIAL_INSTRUMENTS,
  INITIAL_NEWS,
  INITIAL_SCREENER_PRESETS,
  INITIAL_TRANSACTIONS,
  INITIAL_USER_SETTINGS,
  INITIAL_WATCHLISTS,
} from '../data/mockMarketData';
import {
  AlertCondition,
  EconomicEvent,
  Instrument,
  MarketCategory,
  NavSection,
  NewsArticle,
  PortfolioHolding,
  PortfolioTransaction,
  PriceAlert,
  ScreenerPreset,
  Timeframe,
  UserSettingsState,
  WatchlistGroup,
} from '../types/market';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: 'info' | 'success' | 'warning' | 'error';
}

interface PlatformContextValue {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  setTheme: (theme: 'dark' | 'light') => void;
  activeScreen: NavSection;
  setActiveScreen: (screen: NavSection) => void;
  globalCategory: MarketCategory;
  setGlobalCategory: (cat: MarketCategory) => void;
  instruments: Instrument[];
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  openChart: (symbol: string) => void;
  openTechnicalAnalysis: (symbol: string) => void;
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
  watchlists: WatchlistGroup[];
  activeWatchlistId: string;
  setActiveWatchlistId: (id: string) => void;
  createWatchlist: (name: string) => void;
  deleteWatchlist: (id: string) => void;
  addSymbolToWatchlist: (watchlistId: string, symbol: string) => void;
  removeSymbolFromWatchlist: (watchlistId: string, symbol: string) => void;
  alerts: PriceAlert[];
  createAlert: (payload: {
    symbol: string;
    condition: AlertCondition;
    targetPrice: number;
    notificationMethod: ('In-App' | 'Email' | 'Webhook')[];
    expiresAt: string;
    note?: string;
  }) => void;
  deleteAlert: (id: string) => void;
  reactivateAlert: (id: string) => void;
  news: NewsArticle[];
  economicEvents: EconomicEvent[];
  holdings: PortfolioHolding[];
  transactions: PortfolioTransaction[];
  addPortfolioTransaction: (payload: {
    accountType: 'Simulated' | 'Real';
    symbol: string;
    side: 'Buy' | 'Sell';
    quantity: number;
    price: number;
  }) => void;
  screenerPresets: ScreenerPreset[];
  saveScreenerPreset: (preset: Omit<ScreenerPreset, 'id'>) => void;
  deleteScreenerPreset: (id: string) => void;
  settings: UserSettingsState;
  updateSettings: (partial: Partial<UserSettingsState>) => void;
  toggleConnectedAccount: (id: string) => void;
  isSearchModalOpen: boolean;
  setIsSearchModalOpen: (open: boolean) => void;
  alertModalSymbol: string | null;
  openCreateAlertModal: (symbol?: string) => void;
  closeCreateAlertModal: () => void;
  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  unreadNotifications: number;
  markNotificationsRead: () => void;
}

const PlatformContext = createContext<PlatformContextValue | null>(null);

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');
  const [activeScreen, setActiveScreen] = useState<NavSection>('overview');
  const [globalCategory, setGlobalCategory] = useState<MarketCategory>('All');
  const [instruments, setInstruments] = useState<Instrument[]>(INITIAL_INSTRUMENTS);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NVDA');
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [watchlists, setWatchlists] = useState<WatchlistGroup[]>(INITIAL_WATCHLISTS);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string>(INITIAL_WATCHLISTS[0].id);
  const [alerts, setAlerts] = useState<PriceAlert[]>(INITIAL_ALERTS);
  const [news] = useState<NewsArticle[]>(INITIAL_NEWS);
  const [economicEvents] = useState<EconomicEvent[]>(INITIAL_ECONOMIC_EVENTS);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(INITIAL_HOLDINGS);
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>(INITIAL_TRANSACTIONS);
  const [screenerPresets, setScreenerPresets] = useState<ScreenerPreset[]>(INITIAL_SCREENER_PRESETS);
  const [settings, setSettings] = useState<UserSettingsState>(INITIAL_USER_SETTINGS);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [alertModalSymbol, setAlertModalSymbol] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(2);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const setTheme = useCallback((next: 'dark' | 'light') => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const pushToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Keyboard shortcuts: Cmd/Ctrl + K or '/' opens global search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Realistic simulated live market ticks & alert evaluation
  useEffect(() => {
    if (!settings.liveTickSimulation) return;
    const interval = setInterval(() => {
      setInstruments((prev) =>
        prev.map((inst) => {
          if (inst.status === 'Closed') return inst;
          if (Math.random() > 0.45) return inst;
          const stepPct =
            inst.category === 'Crypto'
              ? 0.0009
              : inst.category === 'Forex'
              ? 0.00018
              : 0.00045;
          const delta = inst.price * (Math.random() - 0.495) * stepPct;
          const factor = Math.pow(10, inst.decimals);
          const nextPrice = Math.max(0.0001, Math.round((inst.price + delta) * factor) / factor);
          const nextChange = Math.round((nextPrice - inst.prevClose) * factor) / factor;
          const nextChangePct = Number(((nextChange / inst.prevClose) * 100).toFixed(2));
          const spreadVal = Math.max(1 / factor, inst.ask - inst.bid);
          return {
            ...inst,
            price: nextPrice,
            change: nextChange,
            changePercent: nextChangePct,
            high24h: Math.max(inst.high24h, nextPrice),
            low24h: Math.min(inst.low24h, nextPrice),
            bid: Math.round((nextPrice - spreadVal / 2) * factor) / factor,
            ask: Math.round((nextPrice + spreadVal / 2) * factor) / factor,
          };
        })
      );
    }, 1800);
    return () => clearInterval(interval);
  }, [settings.liveTickSimulation]);

  // Evaluate active price alerts against live instruments
  useEffect(() => {
    const priceMap = new Map(instruments.map((i) => [i.symbol, i.price]));
    setAlerts((prev) => {
      let changed = false;
      const next = prev.map((alert) => {
        if (alert.status !== 'Active') return alert;
        const cur = priceMap.get(alert.symbol);
        if (cur === undefined) return alert;

        let triggered = false;
        if (alert.condition === 'Greater Than' || alert.condition === 'Crossing Up') {
          if (cur >= alert.targetPrice) triggered = true;
        } else if (alert.condition === 'Less Than' || alert.condition === 'Crossing Down') {
          if (cur <= alert.targetPrice) triggered = true;
        } else if (alert.condition === 'Crossing') {
          const crossedFromBelow = alert.currentPriceAtCreate < alert.targetPrice && cur >= alert.targetPrice;
          const crossedFromAbove = alert.currentPriceAtCreate > alert.targetPrice && cur <= alert.targetPrice;
          if (crossedFromBelow || crossedFromAbove) triggered = true;
        }

        if (triggered) {
          changed = true;
          setUnreadNotifications((c) => c + 1);
          pushToast({
            title: `Alert Triggered: ${alert.symbol}`,
            description: `${alert.condition} ${alert.targetPrice} reached (Current: ${cur})`,
            variant: 'warning',
          });
          return {
            ...alert,
            status: 'Triggered' as const,
            triggeredAt: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          };
        }
        return alert;
      });
      return changed ? next : prev;
    });
  }, [instruments, pushToast]);

  const openChart = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
    setActiveScreen('charts');
  }, []);

  const openTechnicalAnalysis = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
    setActiveScreen('technical');
  }, []);

  const createWatchlist = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const id = `wl-${Date.now()}`;
      setWatchlists((prev) => [...prev, { id, name: trimmed, symbols: [] }]);
      setActiveWatchlistId(id);
      pushToast({ title: 'Watchlist created', description: trimmed, variant: 'success' });
    },
    [pushToast]
  );

  const deleteWatchlist = useCallback(
    (id: string) => {
      setWatchlists((prev) => {
        if (prev.length <= 1) return prev;
        const filtered = prev.filter((w) => w.id !== id);
        if (activeWatchlistId === id && filtered[0]) {
          setActiveWatchlistId(filtered[0].id);
        }
        return filtered;
      });
    },
    [activeWatchlistId]
  );

  const addSymbolToWatchlist = useCallback(
    (watchlistId: string, symbol: string) => {
      setWatchlists((prev) =>
        prev.map((w) => {
          if (w.id !== watchlistId) return w;
          if (w.symbols.includes(symbol)) return w;
          return { ...w, symbols: [...w.symbols, symbol] };
        })
      );
      pushToast({ title: `${symbol} added to watchlist`, variant: 'success' });
    },
    [pushToast]
  );

  const removeSymbolFromWatchlist = useCallback((watchlistId: string, symbol: string) => {
    setWatchlists((prev) =>
      prev.map((w) => (w.id === watchlistId ? { ...w, symbols: w.symbols.filter((s) => s !== symbol) } : w))
    );
  }, []);

  const createAlert = useCallback(
    (payload: {
      symbol: string;
      condition: AlertCondition;
      targetPrice: number;
      notificationMethod: ('In-App' | 'Email' | 'Webhook')[];
      expiresAt: string;
      note?: string;
    }) => {
      const inst = instruments.find((i) => i.symbol === payload.symbol);
      const newAlert: PriceAlert = {
        id: `al-${Date.now()}`,
        symbol: payload.symbol,
        condition: payload.condition,
        targetPrice: payload.targetPrice,
        currentPriceAtCreate: inst?.price ?? payload.targetPrice,
        notificationMethod: payload.notificationMethod,
        status: 'Active',
        createdAt: '2026-11-25 ' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        expiresAt: payload.expiresAt,
        note: payload.note,
      };
      setAlerts((prev) => [newAlert, ...prev]);
      pushToast({
        title: `Alert set for ${payload.symbol}`,
        description: `${payload.condition} ${payload.targetPrice}`,
        variant: 'success',
      });
    },
    [instruments, pushToast]
  );

  const deleteAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const reactivateAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'Active', triggeredAt: undefined } : a))
    );
  }, []);

  const addPortfolioTransaction = useCallback(
    (payload: {
      accountType: 'Simulated' | 'Real';
      symbol: string;
      side: 'Buy' | 'Sell';
      quantity: number;
      price: number;
    }) => {
      const totalUsd = Number((payload.quantity * payload.price).toFixed(2));
      const feeUsd = Number((totalUsd * 0.0005).toFixed(2));
      const tx: PortfolioTransaction = {
        id: `tx-${Date.now()}`,
        timestamp: '2026-11-25 ' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        accountType: payload.accountType,
        symbol: payload.symbol,
        side: payload.side,
        quantity: payload.quantity,
        price: payload.price,
        totalUsd,
        feeUsd,
        status: payload.accountType === 'Simulated' ? 'Executed' : 'Settled',
      };
      setTransactions((prev) => [tx, ...prev]);

      setHoldings((prev) => {
        const existingIdx = prev.findIndex(
          (h) => h.symbol === payload.symbol && h.accountType === payload.accountType
        );
        if (existingIdx === -1) {
          if (payload.side === 'Sell') return prev;
          return [
            ...prev,
            {
              id: `h-${Date.now()}`,
              symbol: payload.symbol,
              accountType: payload.accountType,
              quantity: payload.quantity,
              avgEntryPrice: payload.price,
              allocationTargetPct: 10,
            },
          ];
        }
        const existing = prev[existingIdx];
        if (payload.side === 'Buy') {
          const newQty = existing.quantity + payload.quantity;
          const newAvg =
            (existing.quantity * existing.avgEntryPrice + payload.quantity * payload.price) / newQty;
          const copy = [...prev];
          copy[existingIdx] = { ...existing, quantity: newQty, avgEntryPrice: newAvg };
          return copy;
        } else {
          const newQty = existing.quantity - payload.quantity;
          if (newQty <= 0.0001) {
            return prev.filter((_, idx) => idx !== existingIdx);
          }
          const copy = [...prev];
          copy[existingIdx] = { ...existing, quantity: newQty };
          return copy;
        }
      });

      pushToast({
        title: `${payload.accountType} ${payload.side} recorded`,
        description: `${payload.quantity} ${payload.symbol} @ ${payload.price}`,
        variant: 'success',
      });
    },
    [pushToast]
  );

  const saveScreenerPreset = useCallback(
    (preset: Omit<ScreenerPreset, 'id'>) => {
      const next: ScreenerPreset = { ...preset, id: `sp-${Date.now()}` };
      setScreenerPresets((prev) => [next, ...prev]);
      pushToast({ title: 'Screener preset saved', description: preset.name, variant: 'success' });
    },
    [pushToast]
  );

  const deleteScreenerPreset = useCallback((id: string) => {
    setScreenerPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updateSettings = useCallback(
    (partial: Partial<UserSettingsState>) => {
      setSettings((prev) => ({ ...prev, ...partial }));
      pushToast({ title: 'Preferences updated', variant: 'success' });
    },
    [pushToast]
  );

  const toggleConnectedAccount = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      connectedAccounts: prev.connectedAccounts.map((acc) =>
        acc.id === id
          ? {
              ...acc,
              status: acc.status === 'Connected' ? 'Disconnected' : 'Connected',
              lastSync: 'Just now',
            }
          : acc
      ),
    }));
  }, []);

  const openCreateAlertModal = useCallback(
    (symbol?: string) => {
      setAlertModalSymbol(symbol ?? selectedSymbol);
    },
    [selectedSymbol]
  );

  const closeCreateAlertModal = useCallback(() => {
    setAlertModalSymbol(null);
  }, []);

  const markNotificationsRead = useCallback(() => {
    setUnreadNotifications(0);
  }, []);

  const value = useMemo<PlatformContextValue>(
    () => ({
      theme,
      toggleTheme,
      setTheme,
      activeScreen,
      setActiveScreen,
      globalCategory,
      setGlobalCategory,
      instruments,
      selectedSymbol,
      setSelectedSymbol,
      openChart,
      openTechnicalAnalysis,
      timeframe,
      setTimeframe,
      watchlists,
      activeWatchlistId,
      setActiveWatchlistId,
      createWatchlist,
      deleteWatchlist,
      addSymbolToWatchlist,
      removeSymbolFromWatchlist,
      alerts,
      createAlert,
      deleteAlert,
      reactivateAlert,
      news,
      economicEvents,
      holdings,
      transactions,
      addPortfolioTransaction,
      screenerPresets,
      saveScreenerPreset,
      deleteScreenerPreset,
      settings,
      updateSettings,
      toggleConnectedAccount,
      isSearchModalOpen,
      setIsSearchModalOpen,
      alertModalSymbol,
      openCreateAlertModal,
      closeCreateAlertModal,
      toasts,
      pushToast,
      dismissToast,
      unreadNotifications,
      markNotificationsRead,
    }),
    [
      theme,
      toggleTheme,
      setTheme,
      activeScreen,
      globalCategory,
      instruments,
      selectedSymbol,
      openChart,
      openTechnicalAnalysis,
      timeframe,
      watchlists,
      activeWatchlistId,
      createWatchlist,
      deleteWatchlist,
      addSymbolToWatchlist,
      removeSymbolFromWatchlist,
      alerts,
      createAlert,
      deleteAlert,
      reactivateAlert,
      news,
      economicEvents,
      holdings,
      transactions,
      addPortfolioTransaction,
      screenerPresets,
      saveScreenerPreset,
      deleteScreenerPreset,
      settings,
      updateSettings,
      toggleConnectedAccount,
      isSearchModalOpen,
      alertModalSymbol,
      openCreateAlertModal,
      closeCreateAlertModal,
      toasts,
      pushToast,
      dismissToast,
      unreadNotifications,
      markNotificationsRead,
    ]
  );

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider');
  return ctx;
}
