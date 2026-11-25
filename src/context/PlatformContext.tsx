import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  INITIAL_ADMIN_AUDIT_LOGS,
  INITIAL_ADMIN_RISK_CONFIG,
  INITIAL_ADMIN_USERS,
  INITIAL_ALERTS,
  INITIAL_ECONOMIC_EVENTS,
  INITIAL_HOLDINGS,
  INITIAL_INSTRUMENTS,
  INITIAL_NEWS,
  INITIAL_OPEN_POSITIONS,
  INITIAL_SCREENER_PRESETS,
  INITIAL_TRADE_HISTORY,
  INITIAL_TRANSACTIONS,
  INITIAL_USER_SETTINGS,
  INITIAL_WATCHLISTS,
  INITIAL_WORKING_ORDERS,
} from '../data/mockMarketData';
import {
  AdminAuditEntry,
  AdminRiskConfig,
  AdminUserAccount,
  AdminUserRole,
  AdminUserStatus,
  AlertCondition,
  AuthView,
  EconomicEvent,
  Instrument,
  MarketCategory,
  NavSection,
  NewsArticle,
  OpenPosition,
  OrderSide,
  OrderType,
  PortfolioHolding,
  PortfolioTransaction,
  PriceAlert,
  ScreenerPreset,
  Timeframe,
  TradeExecution,
  UserSettingsState,
  WatchlistGroup,
  WorkingOrder,
} from '../types/market';
import { mapLegacyTimezoneToId } from '../utils/timezone';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant: 'info' | 'success' | 'warning' | 'error';
}

export interface TradingAccountSummary {
  balance: number;
  equity: number;
  usedMargin: number;
  freeMargin: number;
  unrealizedPnl: number;
  marginLevelPct: number;
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
  chartTimezone: string;
  setChartTimezone: (tzId: string) => void;
  watchlists: WatchlistGroup[];
  activeWatchlistId: string;
  setActiveWatchlistId: (id: string) => void;
  createWatchlist: (name: string) => void;
  renameWatchlist: (id: string, name: string) => void;
  deleteWatchlist: (id: string) => void;
  addSymbolToWatchlist: (watchlistId: string, symbol: string) => void;
  removeSymbolFromWatchlist: (watchlistId: string, symbol: string) => void;
  reorderWatchlistSymbol: (watchlistId: string, symbol: string, direction: 'up' | 'down') => void;
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
  openPositions: OpenPosition[];
  workingOrders: WorkingOrder[];
  tradeHistory: TradeExecution[];
  accountSummary: TradingAccountSummary;
  placeOrder: (payload: {
    symbol: string;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    limitOrStopPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    leverage?: number;
    note?: string;
  }) => void;
  closePosition: (positionId: string) => void;
  cancelOrder: (orderId: string) => void;
  screenerPresets: ScreenerPreset[];
  saveScreenerPreset: (preset: Omit<ScreenerPreset, 'id'>) => void;
  deleteScreenerPreset: (id: string) => void;
  settings: UserSettingsState;
  updateSettings: (partial: Partial<UserSettingsState>) => void;
  toggleConnectedAccount: (id: string) => void;
  isSearchModalOpen: boolean;
  setIsSearchModalOpen: (open: boolean) => void;
  helpModalOpen: boolean;
  setHelpModalOpen: (open: boolean) => void;
  alertModalSymbol: string | null;
  openCreateAlertModal: (symbol?: string) => void;
  closeCreateAlertModal: () => void;
  isAuthenticated: boolean;
  authModalOpen: boolean;
  authView: AuthView;
  openAuthModal: (view?: AuthView) => void;
  closeAuthModal: () => void;
  completeAuth: (user?: { fullName?: string; email?: string }) => void;
  signOut: () => void;
  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  unreadNotifications: number;
  markNotificationsRead: () => void;
  adminUsers: AdminUserAccount[];
  adminRiskConfig: AdminRiskConfig;
  adminAuditLogs: AdminAuditEntry[];
  addAdminUser: (payload: {
    fullName: string;
    email: string;
    role: AdminUserRole;
    tier: 'Institutional' | 'Pro' | 'Standard';
    equityUsd: number;
    maxLeverage: number;
  }) => void;
  updateAdminUserRole: (userId: string, role: AdminUserRole) => void;
  updateAdminUserStatus: (userId: string, status: AdminUserStatus) => void;
  updateAdminUserLeverage: (userId: string, maxLeverage: number) => void;
  updateAdminRiskConfig: (partial: Partial<AdminRiskConfig>) => void;
  updateInstrumentStatus: (symbol: string, status: Instrument['status']) => void;
  appendAdminAuditLog: (entry: Omit<AdminAuditEntry, 'id' | 'timestamp'>) => void;
}

const TIMEZONE_STORAGE_KEY = 'kestrel_chart_timezone_v1';

const PlatformContext = createContext<PlatformContextValue | null>(null);

export function computePositionUnrealizedPnl(pos: OpenPosition, currentPrice: number): number {
  const diff = pos.side === 'Buy' ? currentPrice - pos.entryPrice : pos.entryPrice - currentPrice;
  // Normalize FX JPY pairs approximately in USD
  if (pos.symbol.endsWith('/JPY')) {
    return (diff * pos.quantity) / Math.max(1, currentPrice);
  }
  return diff * pos.quantity;
}

export function computePositionNotionalUsd(pos: OpenPosition, currentPrice: number): number {
  if (pos.symbol.endsWith('/JPY')) {
    return pos.quantity;
  }
  return pos.quantity * currentPrice;
}

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
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>(INITIAL_OPEN_POSITIONS);
  const [workingOrders, setWorkingOrders] = useState<WorkingOrder[]>(INITIAL_WORKING_ORDERS);
  const [tradeHistory, setTradeHistory] = useState<TradeExecution[]>(INITIAL_TRADE_HISTORY);
  const [accountBalance, setAccountBalance] = useState<number>(250000);
  const [screenerPresets, setScreenerPresets] = useState<ScreenerPreset[]>(INITIAL_SCREENER_PRESETS);
  const [settings, setSettings] = useState<UserSettingsState>(INITIAL_USER_SETTINGS);
  const [chartTimezone, setChartTimezoneState] = useState<string>(() => {
    try {
      const saved = window.localStorage.getItem(TIMEZONE_STORAGE_KEY);
      if (saved) return saved;
    } catch {
      // ignore storage errors
    }
    return mapLegacyTimezoneToId(INITIAL_USER_SETTINGS.timezone);
  });

  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [alertModalSymbol, setAlertModalSymbol] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(2);
  const [adminUsers, setAdminUsers] = useState<AdminUserAccount[]>(INITIAL_ADMIN_USERS);
  const [adminRiskConfig, setAdminRiskConfig] = useState<AdminRiskConfig>(INITIAL_ADMIN_RISK_CONFIG);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditEntry[]>(INITIAL_ADMIN_AUDIT_LOGS);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const setChartTimezone = useCallback((tzId: string) => {
    setChartTimezoneState(tzId);
    try {
      window.localStorage.setItem(TIMEZONE_STORAGE_KEY, tzId);
    } catch {
      // ignore storage errors
    }
  }, []);

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

  // Keyboard shortcuts: Cmd/Ctrl + K or '/' opens global search, '?' opens help
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      } else if (e.key === '/' && !inInput) {
        e.preventDefault();
        setIsSearchModalOpen(true);
      } else if (e.key === '?' && !inInput) {
        e.preventDefault();
        setHelpModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Realistic simulated live market ticks
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

  const accountSummary = useMemo<TradingAccountSummary>(() => {
    const priceMap = new Map(instruments.map((i) => [i.symbol, i.price]));
    let unrealizedPnl = 0;
    let usedMargin = 0;
    openPositions.forEach((pos) => {
      const px = priceMap.get(pos.symbol) ?? pos.entryPrice;
      unrealizedPnl += computePositionUnrealizedPnl(pos, px);
      const notional = computePositionNotionalUsd(pos, px);
      usedMargin += notional / Math.max(1, pos.leverage);
    });
    const equity = accountBalance + unrealizedPnl;
    const freeMargin = Math.max(0, equity - usedMargin);
    const marginLevelPct = usedMargin > 0 ? (equity / usedMargin) * 100 : 999;
    return {
      balance: accountBalance,
      equity,
      usedMargin,
      freeMargin,
      unrealizedPnl,
      marginLevelPct,
    };
  }, [accountBalance, instruments, openPositions]);

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

  const renameWatchlist = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setWatchlists((prev) => prev.map((w) => (w.id === id ? { ...w, name: trimmed } : w)));
      pushToast({ title: 'Watchlist renamed', description: trimmed, variant: 'info' });
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

  const reorderWatchlistSymbol = useCallback(
    (watchlistId: string, symbol: string, direction: 'up' | 'down') => {
      setWatchlists((prev) =>
        prev.map((w) => {
          if (w.id !== watchlistId) return w;
          const idx = w.symbols.indexOf(symbol);
          if (idx === -1) return w;
          const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (targetIdx < 0 || targetIdx >= w.symbols.length) return w;
          const next = [...w.symbols];
          const [item] = next.splice(idx, 1);
          next.splice(targetIdx, 0, item);
          return { ...w, symbols: next };
        })
      );
    },
    []
  );

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

  const placeOrder = useCallback(
    (payload: {
      symbol: string;
      side: OrderSide;
      type: OrderType;
      quantity: number;
      limitOrStopPrice?: number;
      stopLoss?: number;
      takeProfit?: number;
      leverage?: number;
      note?: string;
    }) => {
      const inst = instruments.find((i) => i.symbol === payload.symbol);
      if (!inst || payload.quantity <= 0) return;

      const stamp = '2026-11-25 ' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      const lev = payload.leverage ?? (inst.category === 'Forex' ? 20 : inst.category === 'Crypto' ? 3 : 5);

      if (payload.type === 'Market') {
        const fillPrice = payload.side === 'Buy' ? inst.ask : inst.bid;
        const notional = computePositionNotionalUsd(
          {
            id: 'tmp',
            symbol: payload.symbol,
            side: payload.side,
            quantity: payload.quantity,
            entryPrice: fillPrice,
            leverage: lev,
            openedAt: stamp,
          },
          fillPrice
        );
        const feeUsd = Number(Math.max(1.2, notional * 0.0003).toFixed(2));
        const newPos: OpenPosition = {
          id: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          symbol: payload.symbol,
          side: payload.side,
          quantity: payload.quantity,
          entryPrice: fillPrice,
          stopLoss: payload.stopLoss,
          takeProfit: payload.takeProfit,
          leverage: lev,
          openedAt: stamp,
          note: payload.note,
        };
        const exec: TradeExecution = {
          id: `trd-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          symbol: payload.symbol,
          side: payload.side,
          type: 'Market',
          quantity: payload.quantity,
          fillPrice,
          feeUsd,
          executedAt: stamp,
          status: 'Filled',
        };
        setOpenPositions((prev) => [newPos, ...prev]);
        setTradeHistory((prev) => [exec, ...prev]);
        setAccountBalance((b) => b - feeUsd);
        pushToast({
          title: `Market ${payload.side} Filled`,
          description: `${payload.quantity} ${payload.symbol} @ ${fillPrice}`,
          variant: 'success',
        });
      } else {
        const targetPx = payload.limitOrStopPrice ?? inst.price;
        const order: WorkingOrder = {
          id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          symbol: payload.symbol,
          side: payload.side,
          type: payload.type,
          quantity: payload.quantity,
          limitOrStopPrice: targetPx,
          stopLoss: payload.stopLoss,
          takeProfit: payload.takeProfit,
          createdAt: stamp,
          status: 'Working',
        };
        setWorkingOrders((prev) => [order, ...prev]);
        pushToast({
          title: `${payload.type} ${payload.side} Placed`,
          description: `${payload.quantity} ${payload.symbol} @ ${targetPx}`,
          variant: 'info',
        });
      }
    },
    [instruments, pushToast]
  );

  const closePosition = useCallback(
    (positionId: string) => {
      const target = openPositions.find((p) => p.id === positionId);
      if (!target) return;
      const inst = instruments.find((i) => i.symbol === target.symbol);
      const exitPrice = inst ? (target.side === 'Buy' ? inst.bid : inst.ask) : target.entryPrice;
      const pnl = Number(computePositionUnrealizedPnl(target, exitPrice).toFixed(2));
      const notional = computePositionNotionalUsd(target, exitPrice);
      const feeUsd = Number(Math.max(1.2, notional * 0.0003).toFixed(2));
      const stamp = '2026-11-25 ' + new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

      setOpenPositions((prev) => prev.filter((p) => p.id !== positionId));
      setAccountBalance((b) => b + pnl - feeUsd);
      setTradeHistory((prev) => [
        {
          id: `trd-${Date.now()}`,
          symbol: target.symbol,
          side: target.side,
          type: 'Market',
          quantity: target.quantity,
          fillPrice: exitPrice,
          realizedPnl: pnl,
          feeUsd,
          executedAt: stamp,
          status: 'Closed',
        },
        ...prev,
      ]);
      pushToast({
        title: `Position Closed: ${target.symbol}`,
        description: `Realized P&L: ${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}`,
        variant: pnl >= 0 ? 'success' : 'warning',
      });
    },
    [openPositions, instruments, pushToast]
  );

  const cancelOrder = useCallback(
    (orderId: string) => {
      setWorkingOrders((prev) => prev.filter((o) => o.id !== orderId));
      pushToast({ title: 'Working order cancelled', variant: 'info' });
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

  const openAuthModal = useCallback((view: AuthView = 'login') => {
    setAuthView(view);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const completeAuth = useCallback(
    (user?: { fullName?: string; email?: string }) => {
      if (user?.fullName || user?.email) {
        setSettings((prev) => ({
          ...prev,
          ...(user.fullName ? { fullName: user.fullName } : {}),
          ...(user.email ? { email: user.email } : {}),
        }));
      }
      setIsAuthenticated(true);
      setAuthModalOpen(false);
      pushToast({
        title: 'Authenticated to KESTREL',
        description: user?.email ?? settings.email,
        variant: 'success',
      });
    },
    [pushToast, settings.email]
  );

  const signOut = useCallback(() => {
    setIsAuthenticated(false);
    setAuthView('login');
    setAuthModalOpen(true);
  }, []);

  const markNotificationsRead = useCallback(() => {
    setUnreadNotifications(0);
  }, []);

  const appendAdminAuditLog = useCallback(
    (entry: Omit<AdminAuditEntry, 'id' | 'timestamp'>) => {
      const stamp =
        '2026-11-25 ' +
        new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
      setAdminAuditLogs((prev) => [
        {
          id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          timestamp: stamp,
          ...entry,
        },
        ...prev,
      ]);
    },
    []
  );

  const addAdminUser = useCallback(
    (payload: {
      fullName: string;
      email: string;
      role: AdminUserRole;
      tier: 'Institutional' | 'Pro' | 'Standard';
      equityUsd: number;
      maxLeverage: number;
    }) => {
      const next: AdminUserAccount = {
        id: `adm-u-${Date.now()}`,
        fullName: payload.fullName.trim(),
        email: payload.email.trim(),
        role: payload.role,
        tier: payload.tier,
        equityUsd: payload.equityUsd,
        maxLeverage: payload.maxLeverage,
        twoFactorEnabled: true,
        status: 'Active',
        lastActive: 'Provisioned now',
      };
      setAdminUsers((prev) => [next, ...prev]);
      appendAdminAuditLog({
        actor: settings.fullName,
        action: 'Account Provisioned',
        target: next.email,
        category: 'Access',
        details: `Created ${next.role} account (${next.tier}) with ${next.maxLeverage}x leverage cap.`,
      });
      pushToast({ title: 'User Account Provisioned', description: next.email, variant: 'success' });
    },
    [appendAdminAuditLog, pushToast, settings.fullName]
  );

  const updateAdminUserRole = useCallback(
    (userId: string, role: AdminUserRole) => {
      setAdminUsers((prev) =>
        prev.map((u) => {
          if (u.id !== userId) return u;
          appendAdminAuditLog({
            actor: settings.fullName,
            action: 'Role Updated',
            target: u.email,
            category: 'Access',
            details: `Changed role from ${u.role} to ${role}.`,
          });
          return { ...u, role };
        })
      );
    },
    [appendAdminAuditLog, settings.fullName]
  );

  const updateAdminUserStatus = useCallback(
    (userId: string, status: AdminUserStatus) => {
      setAdminUsers((prev) =>
        prev.map((u) => {
          if (u.id !== userId) return u;
          appendAdminAuditLog({
            actor: settings.fullName,
            action: `Status -> ${status}`,
            target: u.email,
            category: 'Access',
            details: `Updated account status from ${u.status} to ${status}.`,
          });
          return { ...u, status };
        })
      );
      pushToast({ title: 'Account Status Updated', description: status, variant: 'info' });
    },
    [appendAdminAuditLog, pushToast, settings.fullName]
  );

  const updateAdminUserLeverage = useCallback(
    (userId: string, maxLeverage: number) => {
      setAdminUsers((prev) =>
        prev.map((u) => {
          if (u.id !== userId) return u;
          appendAdminAuditLog({
            actor: settings.fullName,
            action: 'Leverage Cap Updated',
            target: u.email,
            category: 'Risk',
            details: `Adjusted account leverage cap to ${maxLeverage}x.`,
          });
          return { ...u, maxLeverage };
        })
      );
    },
    [appendAdminAuditLog, settings.fullName]
  );

  const updateAdminRiskConfig = useCallback(
    (partial: Partial<AdminRiskConfig>) => {
      setAdminRiskConfig((prev) => ({ ...prev, ...partial }));
      appendAdminAuditLog({
        actor: settings.fullName,
        action: 'Risk Policy Updated',
        target: 'Global Risk Policy',
        category: 'Risk',
        details: `Updated global parameters (${Object.keys(partial).join(', ')}).`,
      });
      pushToast({ title: 'Risk Policy Saved', variant: 'success' });
    },
    [appendAdminAuditLog, pushToast, settings.fullName]
  );

  const updateInstrumentStatus = useCallback(
    (symbol: string, status: Instrument['status']) => {
      setInstruments((prev) => prev.map((inst) => (inst.symbol === symbol ? { ...inst, status } : inst)));
      appendAdminAuditLog({
        actor: settings.fullName,
        action: 'Market Session Override',
        target: symbol,
        category: 'Feed',
        details: `Set market feed status for ${symbol} to ${status}.`,
      });
      pushToast({ title: `${symbol} Feed: ${status}`, variant: 'info' });
    },
    [appendAdminAuditLog, pushToast, settings.fullName]
  );

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
      chartTimezone,
      setChartTimezone,
      watchlists,
      activeWatchlistId,
      setActiveWatchlistId,
      createWatchlist,
      renameWatchlist,
      deleteWatchlist,
      addSymbolToWatchlist,
      removeSymbolFromWatchlist,
      reorderWatchlistSymbol,
      alerts,
      createAlert,
      deleteAlert,
      reactivateAlert,
      news,
      economicEvents,
      holdings,
      transactions,
      addPortfolioTransaction,
      openPositions,
      workingOrders,
      tradeHistory,
      accountSummary,
      placeOrder,
      closePosition,
      cancelOrder,
      screenerPresets,
      saveScreenerPreset,
      deleteScreenerPreset,
      settings,
      updateSettings,
      toggleConnectedAccount,
      isSearchModalOpen,
      setIsSearchModalOpen,
      helpModalOpen,
      setHelpModalOpen,
      alertModalSymbol,
      openCreateAlertModal,
      closeCreateAlertModal,
      isAuthenticated,
      authModalOpen,
      authView,
      openAuthModal,
      closeAuthModal,
      completeAuth,
      signOut,
      toasts,
      pushToast,
      dismissToast,
      unreadNotifications,
      markNotificationsRead,
      adminUsers,
      adminRiskConfig,
      adminAuditLogs,
      addAdminUser,
      updateAdminUserRole,
      updateAdminUserStatus,
      updateAdminUserLeverage,
      updateAdminRiskConfig,
      updateInstrumentStatus,
      appendAdminAuditLog,
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
      chartTimezone,
      setChartTimezone,
      watchlists,
      activeWatchlistId,
      createWatchlist,
      renameWatchlist,
      deleteWatchlist,
      addSymbolToWatchlist,
      removeSymbolFromWatchlist,
      reorderWatchlistSymbol,
      alerts,
      createAlert,
      deleteAlert,
      reactivateAlert,
      news,
      economicEvents,
      holdings,
      transactions,
      addPortfolioTransaction,
      openPositions,
      workingOrders,
      tradeHistory,
      accountSummary,
      placeOrder,
      closePosition,
      cancelOrder,
      screenerPresets,
      saveScreenerPreset,
      deleteScreenerPreset,
      settings,
      updateSettings,
      toggleConnectedAccount,
      isSearchModalOpen,
      helpModalOpen,
      alertModalSymbol,
      openCreateAlertModal,
      closeCreateAlertModal,
      isAuthenticated,
      authModalOpen,
      authView,
      openAuthModal,
      closeAuthModal,
      completeAuth,
      signOut,
      toasts,
      pushToast,
      dismissToast,
      unreadNotifications,
      markNotificationsRead,
      adminUsers,
      adminRiskConfig,
      adminAuditLogs,
      addAdminUser,
      updateAdminUserRole,
      updateAdminUserStatus,
      updateAdminUserLeverage,
      updateAdminRiskConfig,
      updateInstrumentStatus,
      appendAdminAuditLog,
    ]
  );

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider');
  return ctx;
}
