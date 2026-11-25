import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BellPlus,
  Bookmark,
  Camera,
  CandlestickChart,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Crosshair,
  Eye,
  EyeOff,
  GitCompare,
  Maximize,
  Maximize2,
  Minimize2,
  Newspaper,
  PanelBottomClose,
  PanelBottomOpen,
  PanelRightClose,
  PanelRightOpen,
  Redo2,
  RotateCcw,
  Search,
  Settings2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  computePositionUnrealizedPnl,
  usePlatform,
} from '../../context/PlatformContext';
import {
  applyTemplateConfigToDrawing,
  DEFAULT_DRAWING_TEMPLATES,
} from '../../data/drawingTemplatesCatalog';
import {
  DEFAULT_FIB_LEVELS,
  getDrawingToolDef,
} from '../../data/drawingToolsCatalog';
import { generateCandlesForInstrument } from '../../data/mockMarketData';
import {
  Candle,
  ChartDrawing,
  ChartStyle,
  DrawingCategoryId,
  DrawingTemplate,
  DrawingTemplateConfig,
  DrawingTool,
  IndicatorConfig,
  IndicatorId,
  OrderSide,
  OrderType,
  Timeframe,
} from '../../types/market';
import { formatPrice } from '../../utils/indicators';
import {
  CHART_TIMEZONE_OPTIONS,
  formatLiveClockInTimezone,
} from '../../utils/timezone';
import { Button, Modal, PriceChangeText, Select, SignalLabel } from '../ui/DesignSystem';
import {
  DrawingContextualToolbar,
  SelectionBounds,
  VisualOrderAction,
} from './DrawingContextualToolbar';
import { DrawingObjectManager } from './DrawingObjectManager';
import { DrawingTemplateManager } from './DrawingTemplateManager';
import { DrawingToolbar } from './DrawingToolbar';
import { IndicatorSelectorModal } from './IndicatorSelectorModal';
import { ChartVisualSettings, NavCommand, TradingChartCanvas } from './TradingChartCanvas';

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W', '1M'];
const TEMPLATES_STORAGE_KEY = 'kestrel_drawing_templates_v1';
const FAV_INDICATORS_KEY = 'kestrel_favorite_indicators_v1';

function loadInitialTemplates(): DrawingTemplate[] {
  try {
    const raw = window.localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as DrawingTemplate[];
      }
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_DRAWING_TEMPLATES;
}

function loadFavoriteIndicators(): IndicatorId[] {
  try {
    const raw = window.localStorage.getItem(FAV_INDICATORS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as IndicatorId[];
    }
  } catch {
    // ignore storage errors
  }
  return ['ema20', 'ema50', 'rsi', 'macd', 'bb'];
}

function deepCloneDrawing(
  orig: ChartDrawing,
  options?: {
    targetSymbol?: string;
    indexShift?: number;
    priceScale?: number;
    nameSuffix?: string;
  }
): ChartDrawing {
  const indexShift = options?.indexShift ?? 3;
  const priceScale = options?.priceScale ?? 1;
  const basePrice = orig.points[0]?.price || orig.positionData?.entryPrice || 1;
  const mapPrice = (p: number) =>
    options?.targetSymbol && options.targetSymbol !== orig.symbol
      ? basePrice * priceScale + (p - basePrice) * priceScale
      : p * priceScale;

  return {
    ...orig,
    id: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    symbol: options?.targetSymbol ?? orig.symbol,
    name: options?.nameSuffix ? `${orig.name} ${options.nameSuffix}` : orig.name,
    locked: false,
    points: orig.points.map((p) => ({
      index: Math.max(0, Math.min(179, p.index + indexShift)),
      price: mapPrice(p.price),
    })),
    fibLevels: orig.fibLevels ? orig.fibLevels.map((l) => ({ ...l })) : undefined,
    visibleIntervals: orig.visibleIntervals ? [...orig.visibleIntervals] : undefined,
    tableRows: orig.tableRows ? orig.tableRows.map((row) => [...row]) : undefined,
    positionData: orig.positionData
      ? {
          ...orig.positionData,
          entryPrice: mapPrice(orig.positionData.entryPrice),
          takeProfit: mapPrice(orig.positionData.takeProfit),
          stopLoss: mapPrice(orig.positionData.stopLoss),
          startIndex: Math.max(0, Math.min(175, orig.positionData.startIndex + indexShift)),
          endIndex: Math.max(2, Math.min(179, orig.positionData.endIndex + indexShift)),
        }
      : undefined,
  };
}

const INITIAL_INDICATORS: IndicatorConfig[] = [
  { id: 'volume', label: 'Volume Histogram', shortName: 'Vol', category: 'Overlay', group: 'Volume', enabled: false, color: '#089981', params: {} },
  { id: 'ema20', label: 'Exponential Moving Average (20)', shortName: 'EMA 20', category: 'Overlay', group: 'Trend', enabled: false, color: '#F0B90B', params: { period: 20 } },
  { id: 'ema50', label: 'Exponential Moving Average (50)', shortName: 'EMA 50', category: 'Overlay', group: 'Trend', enabled: false, color: '#2962FF', params: { period: 50 } },
  { id: 'sma200', label: 'Simple Moving Average (100)', shortName: 'SMA 100', category: 'Overlay', group: 'Trend', enabled: false, color: '#AB47BC', params: { period: 100 } },
  { id: 'ichimoku', label: 'Ichimoku Cloud (9, 26, 52)', shortName: 'Ichimoku', category: 'Overlay', group: 'Trend', enabled: false, color: '#089981', params: { tenkan: 9, kijun: 26, senkouB: 52 } },
  { id: 'bb', label: 'Bollinger Bands (20, 2)', shortName: 'BB(20,2)', category: 'Overlay', group: 'Volatility', enabled: false, color: '#2962FF', params: { period: 20, mult: 2 } },
  { id: 'keltner', label: 'Keltner Channels (20, 10, 2)', shortName: 'KC(20)', category: 'Overlay', group: 'Volatility', enabled: false, color: '#26A69A', params: { period: 20, atrPeriod: 10, mult: 2 } },
  { id: 'vp', label: 'Volume Profile (Visible Range)', shortName: 'Vol Profile', category: 'Overlay', group: 'Volume', enabled: false, color: '#2962FF', params: {} },
  { id: 'rsi', label: 'Relative Strength Index (14)', shortName: 'RSI(14)', category: 'Oscillator', group: 'Momentum', enabled: false, color: '#AB47BC', params: { period: 14 } },
  { id: 'macd', label: 'MACD (12, 26, 9)', shortName: 'MACD', category: 'Oscillator', group: 'Momentum', enabled: false, color: '#2962FF', params: { fast: 12, slow: 26, signal: 9 } },
  { id: 'stoch', label: 'Stochastic Oscillator (14, 3)', shortName: 'Stoch(14,3)', category: 'Oscillator', group: 'Momentum', enabled: false, color: '#2962FF', params: { kPeriod: 14, dPeriod: 3 } },
  { id: 'cci', label: 'Commodity Channel Index (20)', shortName: 'CCI(20)', category: 'Oscillator', group: 'Momentum', enabled: false, color: '#F0B90B', params: { period: 20 } },
  { id: 'atr', label: 'Average True Range (14)', shortName: 'ATR(14)', category: 'Oscillator', group: 'Volatility', enabled: false, color: '#F23645', params: { period: 14 } },
  { id: 'obv', label: 'On-Balance Volume (OBV)', shortName: 'OBV', category: 'Oscillator', group: 'Volume', enabled: false, color: '#089981', params: {} },
];

const INITIAL_CATEGORY_TOOLS: Record<DrawingCategoryId, Exclude<DrawingTool, 'cursor'>> = {
  lines: 'trendline',
  channels: 'parallel_channel',
  pitchforks: 'pitchfork',
  fibonacci: 'fibonacci',
  gann: 'gann_box',
  forecasting: 'long_position',
  volume: 'anchored_vwap',
  measurement: 'measure',
  shapes: 'rectangle',
  annotations: 'text',
};

const STARTER_DRAWINGS: ChartDrawing[] = [
  {
    id: 'dr-init-1',
    symbol: 'NVDA',
    tool: 'horizontal',
    category: 'lines',
    name: 'Key Breakout Support',
    groupName: 'Macro Levels',
    points: [{ index: 145, price: 136.4 }],
    color: '#089981',
    lineWidth: 1.5,
    lineStyle: 'dashed',
    opacity: 0.9,
    visible: true,
    locked: false,
  },
  {
    id: 'dr-init-2',
    symbol: 'NVDA',
    tool: 'trendline',
    category: 'lines',
    name: 'Ascending Support Trend',
    groupName: 'Macro Levels',
    points: [
      { index: 122, price: 129.8 },
      { index: 175, price: 139.2 },
    ],
    color: '#2962FF',
    lineWidth: 2,
    lineStyle: 'solid',
    opacity: 1,
    extendRight: true,
    visible: true,
    locked: false,
  },
];

export function ChartWorkspace() {
  const {
    theme,
    instruments,
    selectedSymbol,
    setSelectedSymbol,
    timeframe,
    setTimeframe,
    chartTimezone,
    setChartTimezone,
    watchlists,
    activeWatchlistId,
    alerts,
    news,
    openPositions,
    workingOrders,
    tradeHistory,
    accountSummary,
    placeOrder,
    closePosition,
    cancelOrder,
    openCreateAlertModal,
    setIsSearchModalOpen,
    openTechnicalAnalysis,
    setActiveScreen,
    pushToast,
  } = usePlatform();

  const workspaceRef = useRef<HTMLDivElement>(null);
  const timezoneMenuRef = useRef<HTMLDivElement>(null);
  const exportPngRef = useRef<(() => void) | null>(null);
  const lastActiveIndicatorIdsRef = useRef<IndicatorConfig['id'][]>([
    'ema20',
    'ema50',
    'volume',
    'rsi',
  ]);

  const instrument = useMemo(
    () => instruments.find((i) => i.symbol === selectedSymbol) ?? instruments[0],
    [instruments, selectedSymbol]
  );

  const [chartStyle, setChartStyle] = useState<ChartStyle>('candles');
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(INITIAL_INDICATORS);
  const [favoriteIndicatorIds, setFavoriteIndicatorIds] = useState<IndicatorId[]>(loadFavoriteIndicators);
  const [recentIndicatorIds, setRecentIndicatorIds] = useState<IndicatorId[]>(['ema20', 'rsi', 'macd', 'bb']);
  const [activeTool, setActiveTool] = useState<DrawingTool>('cursor');
  const [categoryLastTool, setCategoryLastTool] =
    useState<Record<DrawingCategoryId, Exclude<DrawingTool, 'cursor'>>>(INITIAL_CATEGORY_TOOLS);

  // Drawings + Atomic Undo/Redo History Stack
  const [historyState, setHistoryState] = useState<{
    stack: ChartDrawing[][];
    idx: number;
  }>({
    stack: [STARTER_DRAWINGS],
    idx: 0,
  });
  const drawings = historyState.stack[historyState.idx] ?? [];

  const [templates, setTemplates] = useState<DrawingTemplate[]>(loadInitialTemplates);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [selectionBounds, setSelectionBounds] = useState<SelectionBounds | null>(null);
  const [clipboardDrawing, setClipboardDrawing] = useState<ChartDrawing | null>(null);

  const [stayInDrawingMode, setStayInDrawingMode] = useState(false);
  const [magnetMode, setMagnetMode] = useState(false);
  const [hideAllDrawings, setHideAllDrawings] = useState(false);
  const [lockAllDrawings, setLockAllDrawings] = useState(false);
  const [crosshairEnabled, setCrosshairEnabled] = useState(true);

  const [compareSymbol, setCompareSymbol] = useState<string>('');
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<'market' | 'objects'>('market');
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true);
  const [bottomTab, setBottomTab] = useState<'ohlc' | 'trade' | 'positions' | 'orders' | 'history' | 'account'>('ohlc');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Quick Chart Trade Ticket local inputs
  const [quickOrderType, setQuickOrderType] = useState<OrderType>('Market');
  const [quickQty, setQuickQty] = useState('10');
  const [quickLimitPx, setQuickLimitPx] = useState('');
  const [quickSl, setQuickSl] = useState('');
  const [quickTp, setQuickTp] = useState('');

  const [indicatorsModalOpen, setIndicatorsModalOpen] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [confirmRemoveAllOpen, setConfirmRemoveAllOpen] = useState(false);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [navCommand, setNavCommand] = useState<NavCommand | null>(null);

  const [visualSettings, setVisualSettings] = useState<ChartVisualSettings>({
    showGrid: true,
    showPriceLine: true,
    showVolume: true,
    logScale: false,
  });

  const [timezoneMenuOpen, setTimezoneMenuOpen] = useState(false);
  const [nowDate, setNowDate] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNowDate(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(FAV_INDICATORS_KEY, JSON.stringify(favoriteIndicatorIds));
    } catch {
      // ignore storage errors
    }
  }, [favoriteIndicatorIds]);

  useEffect(() => {
    if (!timezoneMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (timezoneMenuRef.current && !timezoneMenuRef.current.contains(e.target as Node)) {
        setTimezoneMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTimezoneMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [timezoneMenuOpen]);

  useEffect(() => {
    try {
      window.localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
    } catch {
      // ignore storage quota errors
    }
  }, [templates]);

  useEffect(() => {
    if (!selectedDrawingId) {
      setSelectionBounds(null);
    }
  }, [selectedDrawingId]);

  const commitDrawings = useCallback(
    (updater: (prev: ChartDrawing[]) => ChartDrawing[], recordHistory = true) => {
      setHistoryState((prev) => {
        if (!recordHistory) {
          const copy = [...prev.stack];
          copy[prev.idx] = updater(copy[prev.idx] ?? []);
          return { stack: copy, idx: prev.idx };
        }
        const sliced = prev.stack.slice(0, prev.idx + 1);
        const nextList = updater(sliced[sliced.length - 1] ?? []);
        const nextStack = [...sliced, nextList].slice(-40);
        return {
          stack: nextStack,
          idx: nextStack.length - 1,
        };
      });
    },
    []
  );

  const canUndo = historyState.idx > 0;
  const canRedo = historyState.idx < historyState.stack.length - 1;

  const handleUndo = useCallback(() => {
    setHistoryState((prev) =>
      prev.idx > 0 ? { ...prev, idx: prev.idx - 1 } : prev
    );
    setSelectedDrawingId(null);
  }, []);

  const handleRedo = useCallback(() => {
    setHistoryState((prev) =>
      prev.idx < prev.stack.length - 1 ? { ...prev, idx: prev.idx + 1 } : prev
    );
    setSelectedDrawingId(null);
  }, []);

  const handleSelectTool = useCallback((tool: DrawingTool) => {
    setActiveTool(tool);
    if (tool !== 'cursor') {
      setSelectedDrawingId(null);
      const def = getDrawingToolDef(tool);
      if (def) {
        setCategoryLastTool((prev) => ({ ...prev, [def.category]: tool }));
      }
    }
  }, []);

  const handleAddDrawing = useCallback(
    (partial: Omit<ChartDrawing, 'id' | 'name' | 'groupName'>) => {
      const def = getDrawingToolDef(partial.tool);
      const countSame = drawings.filter(
        (d) => d.symbol === partial.symbol && d.tool === partial.tool
      ).length;
      const newObj: ChartDrawing = {
        ...partial,
        id: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: `${def?.name ?? partial.tool} ${countSame + 1}`,
        groupName:
          partial.category === 'fibonacci' || partial.category === 'gann'
            ? 'Fibonacci & Gann'
            : partial.category === 'volume'
            ? 'Volume Zones'
            : partial.category === 'annotations'
            ? 'Annotations'
            : partial.category === 'forecasting'
            ? 'Trade Setups'
            : 'Default',
        locked: lockAllDrawings,
        fibLevels:
          partial.fibLevels ??
          (partial.category === 'fibonacci'
            ? DEFAULT_FIB_LEVELS.map((l) => ({ ...l }))
            : undefined),
      };
      commitDrawings((prev) => [...prev, newObj], true);
      if (!stayInDrawingMode) {
        setActiveTool('cursor');
        setSelectedDrawingId(newObj.id);
      }
    },
    [drawings, commitDrawings, stayInDrawingMode, lockAllDrawings]
  );

  const handleUpdateDrawing = useCallback(
    (id: string, patch: Partial<ChartDrawing>, recordHistory = true) => {
      commitDrawings(
        (prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        recordHistory
      );
    },
    [commitDrawings]
  );

  const handleBatchUpdateDrawings = useCallback(
    (ids: string[], patch: Partial<ChartDrawing>) => {
      const idSet = new Set(ids);
      commitDrawings(
        (prev) => prev.map((d) => (idSet.has(d.id) ? { ...d, ...patch } : d)),
        true
      );
    },
    [commitDrawings]
  );

  const handleCloneDrawing = useCallback(
    (id: string) => {
      const orig = drawings.find((d) => d.id === id);
      if (!orig) return;
      const cloned = deepCloneDrawing(orig, {
        indexShift: 3,
        priceScale: 0.998,
        nameSuffix: 'Clone',
      });
      commitDrawings((prev) => [...prev, cloned], true);
      setSelectedDrawingId(cloned.id);
      pushToast({
        title: 'Drawing cloned',
        description: cloned.name,
        variant: 'info',
      });
    },
    [drawings, commitDrawings, pushToast]
  );

  const handleCopyDrawing = useCallback(
    (id: string) => {
      const orig = drawings.find((d) => d.id === id);
      if (!orig) return;
      setClipboardDrawing(deepCloneDrawing(orig, { indexShift: 0, priceScale: 1 }));
      pushToast({
        title: 'Drawing copied',
        description: `${orig.name} copied to clipboard`,
        variant: 'info',
      });
    },
    [drawings, pushToast]
  );

  const handlePasteDrawing = useCallback(() => {
    if (!clipboardDrawing) return;
    const sameSymbol = clipboardDrawing.symbol === instrument.symbol;
    const sourceAnchor =
      clipboardDrawing.points[0]?.price ||
      clipboardDrawing.positionData?.entryPrice ||
      instrument.price;
    const priceScale = sameSymbol
      ? 0.997
      : instrument.price / Math.max(1e-6, sourceAnchor);

    const pasted = deepCloneDrawing(clipboardDrawing, {
      targetSymbol: instrument.symbol,
      indexShift: sameSymbol ? 4 : 0,
      priceScale,
      nameSuffix: 'Copy',
    });
    commitDrawings((prev) => [...prev, pasted], true);
    setSelectedDrawingId(pasted.id);
    pushToast({
      title: 'Drawing pasted',
      description: `${pasted.name} added to ${instrument.symbol}`,
      variant: 'success',
    });
  }, [clipboardDrawing, instrument.symbol, instrument.price, commitDrawings, pushToast]);

  const handleVisualOrder = useCallback(
    (id: string, action: VisualOrderAction) => {
      commitDrawings((prev) => {
        const symbolItems = prev.filter((d) => d.symbol === instrument.symbol);
        const otherItems = prev.filter((d) => d.symbol !== instrument.symbol);
        const idx = symbolItems.findIndex((d) => d.id === id);
        if (idx === -1) return prev;

        const nextSymbol = [...symbolItems];
        const [item] = nextSymbol.splice(idx, 1);

        if (action === 'front') {
          nextSymbol.push(item);
        } else if (action === 'back') {
          nextSymbol.unshift(item);
        } else if (action === 'forward') {
          nextSymbol.splice(Math.min(nextSymbol.length, idx + 1), 0, item);
        } else if (action === 'backward') {
          nextSymbol.splice(Math.max(0, idx - 1), 0, item);
        }
        return [...otherItems, ...nextSymbol];
      }, true);
    },
    [commitDrawings, instrument.symbol]
  );

  const handleDeleteDrawing = useCallback(
    (id: string) => {
      commitDrawings((prev) => prev.filter((d) => d.id !== id), true);
      if (selectedDrawingId === id) setSelectedDrawingId(null);
    },
    [commitDrawings, selectedDrawingId]
  );

  const handleRemoveAllForSymbol = useCallback(() => {
    commitDrawings((prev) => prev.filter((d) => d.symbol !== instrument.symbol), true);
    setSelectedDrawingId(null);
    setConfirmRemoveAllOpen(false);
    pushToast({
      title: 'Drawings cleared',
      description: `Removed all drawings on ${instrument.symbol}`,
      variant: 'info',
    });
  }, [commitDrawings, instrument.symbol, pushToast]);

  const handleToggleLockAll = useCallback(() => {
    const nextLock = !lockAllDrawings;
    setLockAllDrawings(nextLock);
    commitDrawings(
      (prev) =>
        prev.map((d) => (d.symbol === instrument.symbol ? { ...d, locked: nextLock } : d)),
      true
    );
  }, [lockAllDrawings, commitDrawings, instrument.symbol]);

  // Template management handlers (strictly scoped by tool type)
  const handleCreateTemplate = useCallback(
    (payload: {
      name: string;
      tool: Exclude<DrawingTool, 'cursor'>;
      config: DrawingTemplateConfig;
    }) => {
      const def = getDrawingToolDef(payload.tool);
      const today = new Date().toISOString().slice(0, 10);
      const newTpl: DrawingTemplate = {
        id: `tpl-usr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: payload.name,
        tool: payload.tool,
        category: def?.category ?? 'lines',
        isSystemDefault: false,
        isDefaultForTool: true,
        createdAt: today,
        updatedAt: today,
        config: {
          ...payload.config,
          fibLevels: payload.config.fibLevels?.map((l) => ({ ...l })),
          visibleIntervals: payload.config.visibleIntervals
            ? [...payload.config.visibleIntervals]
            : undefined,
          positionStyle: payload.config.positionStyle
            ? { ...payload.config.positionStyle }
            : undefined,
        },
      };
      setTemplates((prev) => [
        newTpl,
        ...prev.map((t) =>
          t.tool === payload.tool ? { ...t, isDefaultForTool: false } : t
        ),
      ]);
      pushToast({
        title: 'Template saved',
        description: `"${newTpl.name}" saved for ${def?.name ?? payload.tool}`,
        variant: 'success',
      });
    },
    [pushToast]
  );

  const handleRenameTemplate = useCallback((id: string, name: string) => {
    const today = new Date().toISOString().slice(0, 10);
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name, updatedAt: today } : t))
    );
  }, []);

  const handleDuplicateTemplate = useCallback(
    (id: string) => {
      const today = new Date().toISOString().slice(0, 10);
      const orig = templates.find((t) => t.id === id);
      if (!orig) return;
      const copy: DrawingTemplate = {
        ...orig,
        id: `tpl-usr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: `${orig.name} Copy`,
        isSystemDefault: false,
        isDefaultForTool: false,
        createdAt: today,
        updatedAt: today,
        config: {
          ...orig.config,
          fibLevels: orig.config.fibLevels?.map((l) => ({ ...l })),
          visibleIntervals: orig.config.visibleIntervals
            ? [...orig.config.visibleIntervals]
            : undefined,
          positionStyle: orig.config.positionStyle
            ? { ...orig.config.positionStyle }
            : undefined,
        },
      };
      setTemplates((prev) => [copy, ...prev]);
      pushToast({
        title: 'Template duplicated',
        description: copy.name,
        variant: 'info',
      });
    },
    [templates, pushToast]
  );

  const handleDeleteTemplate = useCallback(
    (id: string) => {
      setTemplates((prev) => {
        const target = prev.find((t) => t.id === id);
        if (!target || target.isSystemDefault) return prev;
        const remaining = prev.filter((t) => t.id !== id);
        if (target.isDefaultForTool) {
          const fallback = remaining.find((t) => t.tool === target.tool);
          if (fallback) {
            return remaining.map((t) =>
              t.id === fallback.id ? { ...t, isDefaultForTool: true } : t
            );
          }
        }
        return remaining;
      });
      pushToast({
        title: 'Template deleted',
        variant: 'info',
      });
    },
    [pushToast]
  );

  const handleSetDefaultTemplate = useCallback(
    (id: string) => {
      const target = templates.find((t) => t.id === id);
      if (!target) return;
      setTemplates((prev) =>
        prev.map((t) =>
          t.tool === target.tool ? { ...t, isDefaultForTool: t.id === id } : t
        )
      );
      pushToast({
        title: 'Default template updated',
        description: `"${target.name}" is now default for ${getDrawingToolDef(target.tool)?.name ?? target.tool}`,
        variant: 'success',
      });
    },
    [templates, pushToast]
  );

  // Keyboard Shortcuts: Alt+T/H/J/V/C, Ctrl+Z/Y, Ctrl+C/V, Delete, Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 't') {
          e.preventDefault();
          handleSelectTool('trendline');
        } else if (key === 'h') {
          e.preventDefault();
          handleSelectTool('horizontal');
        } else if (key === 'j') {
          e.preventDefault();
          handleSelectTool('horizontal_ray');
        } else if (key === 'v') {
          e.preventDefault();
          handleSelectTool('vertical');
        } else if (key === 'c') {
          e.preventDefault();
          handleSelectTool('cross_line');
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && selectedDrawingId) {
        e.preventDefault();
        handleCopyDrawing(selectedDrawingId);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && clipboardDrawing) {
        e.preventDefault();
        handlePasteDrawing();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDrawingId) {
        e.preventDefault();
        handleDeleteDrawing(selectedDrawingId);
      } else if (e.key === 'Escape' && selectedDrawingId && activeTool === 'cursor') {
        setSelectedDrawingId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleSelectTool,
    handleUndo,
    handleRedo,
    selectedDrawingId,
    clipboardDrawing,
    activeTool,
    handleCopyDrawing,
    handlePasteDrawing,
    handleDeleteDrawing,
  ]);

  const issueNav = (type: NavCommand['type'], targetIndex?: number) => {
    setNavCommand((prev) => ({ seq: (prev?.seq ?? 0) + 1, type, targetIndex }));
  };

  const candles = useMemo(
    () => generateCandlesForInstrument(instrument, timeframe, 180),
    [instrument, timeframe]
  );

  const compareInstrument = useMemo(
    () => instruments.find((i) => i.symbol === compareSymbol && i.symbol !== instrument.symbol) ?? null,
    [instruments, compareSymbol, instrument.symbol]
  );

  const compareCandles = useMemo(() => {
    if (!compareInstrument) return null;
    return generateCandlesForInstrument(compareInstrument, timeframe, 180);
  }, [compareInstrument, timeframe]);

  const activeDrawings = useMemo(
    () => drawings.filter((d) => d.symbol === instrument.symbol),
    [drawings, instrument.symbol]
  );

  const selectedDrawing = useMemo(
    () => activeDrawings.find((d) => d.id === selectedDrawingId) ?? null,
    [activeDrawings, selectedDrawingId]
  );

  const handleApplyTemplate = useCallback(
    (tpl: DrawingTemplate) => {
      setTemplates((prev) =>
        prev.map((t) =>
          t.tool === tpl.tool ? { ...t, isDefaultForTool: t.id === tpl.id } : t
        )
      );

      if (selectedDrawing && selectedDrawing.tool === tpl.tool) {
        const patch = applyTemplateConfigToDrawing(selectedDrawing, tpl.config);
        handleUpdateDrawing(selectedDrawing.id, patch, true);
        pushToast({
          title: 'Template applied',
          description: `Applied "${tpl.name}" to ${selectedDrawing.name}`,
          variant: 'success',
        });
      } else {
        const def = getDrawingToolDef(tpl.tool);
        pushToast({
          title: 'Template activated',
          description: `"${tpl.name}" set for new ${def?.name ?? tpl.tool} drawings`,
          variant: 'success',
        });
      }
    },
    [selectedDrawing, handleUpdateDrawing, pushToast]
  );

  const activeWatchlist = useMemo(
    () => watchlists.find((w) => w.id === activeWatchlistId) ?? watchlists[0],
    [watchlists, activeWatchlistId]
  );

  const symbolAlerts = useMemo(
    () => alerts.filter((a) => a.symbol === instrument.symbol),
    [alerts, instrument.symbol]
  );

  const toggleIndicator = (id: IndicatorConfig['id']) => {
    setRecentIndicatorIds((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 6));
    setIndicators((prev) =>
      prev.map((ind) => {
        if (ind.id !== id) return ind;
        const nextEnabled = !ind.enabled;
        if (id === 'volume' && nextEnabled) {
          setVisualSettings((vs) => (vs.showVolume ? vs : { ...vs, showVolume: true }));
        }
        return { ...ind, enabled: nextEnabled };
      })
    );
  };

  const toggleFavoriteIndicator = (id: IndicatorId) => {
    setFavoriteIndicatorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const updateIndicatorConfig = (id: IndicatorId, patch: Partial<IndicatorConfig>) => {
    setIndicators((prev) =>
      prev.map((ind) => {
        if (ind.id !== id) return ind;
        const nextParams = patch.params ?? ind.params;
        let shortName = ind.shortName;
        if (id === 'ema20' || id === 'ema50') shortName = `EMA ${nextParams.period ?? 20}`;
        else if (id === 'sma200') shortName = `SMA ${nextParams.period ?? 100}`;
        else if (id === 'bb') shortName = `BB(${nextParams.period ?? 20},${nextParams.mult ?? 2})`;
        else if (id === 'keltner') shortName = `KC(${nextParams.period ?? 20})`;
        else if (id === 'rsi') shortName = `RSI(${nextParams.period ?? 14})`;
        else if (id === 'cci') shortName = `CCI(${nextParams.period ?? 20})`;
        else if (id === 'atr') shortName = `ATR(${nextParams.period ?? 14})`;
        else if (id === 'stoch') shortName = `Stoch(${nextParams.kPeriod ?? 14},${nextParams.dPeriod ?? 3})`;
        return { ...ind, ...patch, shortName };
      })
    );
  };

  const resetIndicatorConfig = (id: IndicatorId) => {
    const def = INITIAL_INDICATORS.find((i) => i.id === id);
    if (!def) return;
    setIndicators((prev) =>
      prev.map((ind) =>
        ind.id === id
          ? { ...def, enabled: ind.enabled }
          : ind
      )
    );
  };

  const clearAllIndicators = () => {
    const activeIds = indicators.filter((i) => i.enabled).map((i) => i.id);
    if (activeIds.length > 0) {
      lastActiveIndicatorIdsRef.current = activeIds;
    }
    setIndicators((prev) => prev.map((ind) => ({ ...ind, enabled: false })));
  };

  const enableStandardIndicators = () => {
    const target = new Set<IndicatorConfig['id']>(['ema20', 'ema50', 'volume', 'rsi']);
    setVisualSettings((vs) => (vs.showVolume ? vs : { ...vs, showVolume: true }));
    setIndicators((prev) => prev.map((ind) => ({ ...ind, enabled: target.has(ind.id) })));
  };

  const toggleAllLinesAndPanes = () => {
    const activeIds = indicators.filter((i) => i.enabled).map((i) => i.id);
    if (activeIds.length > 0) {
      lastActiveIndicatorIdsRef.current = activeIds;
      setIndicators((prev) => prev.map((ind) => ({ ...ind, enabled: false })));
    } else {
      const restoreSet = new Set(
        lastActiveIndicatorIdsRef.current.length > 0
          ? lastActiveIndicatorIdsRef.current
          : (['ema20', 'ema50', 'volume', 'rsi'] as IndicatorConfig['id'][])
      );
      if (restoreSet.has('volume')) {
        setVisualSettings((vs) => (vs.showVolume ? vs : { ...vs, showVolume: true }));
      }
      setIndicators((prev) => prev.map((ind) => ({ ...ind, enabled: restoreSet.has(ind.id) })));
    }
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement && workspaceRef.current?.requestFullscreen) {
      workspaceRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    } else {
      setIsFullscreen((prev) => !prev);
    }
  };

  const handleScreenshot = () => {
    if (exportPngRef.current) {
      exportPngRef.current();
      pushToast({
        title: 'Chart screenshot saved',
        description: `${instrument.symbol} (${timeframe}) exported as PNG`,
        variant: 'success',
      });
    }
  };

  const handleQuickOrder = (side: OrderSide) => {
    const qty = parseFloat(quickQty);
    if (!Number.isFinite(qty) || qty <= 0) return;
    const limitPx = quickLimitPx ? parseFloat(quickLimitPx) : undefined;
    const sl = quickSl ? parseFloat(quickSl) : undefined;
    const tp = quickTp ? parseFloat(quickTp) : undefined;
    placeOrder({
      symbol: instrument.symbol,
      side,
      type: quickOrderType,
      quantity: qty,
      limitOrStopPrice: quickOrderType !== 'Market' ? limitPx || instrument.price : undefined,
      stopLoss: Number.isFinite(sl) ? sl : undefined,
      takeProfit: Number.isFinite(tp) ? tp : undefined,
    });
  };

  const symbolNews = useMemo(() => {
    const matched = news.filter((n) => n.relatedSymbols.includes(instrument.symbol));
    return matched.length > 0 ? matched : news.slice(0, 2);
  }, [news, instrument.symbol]);

  const displayBar = hoveredCandle ?? candles[candles.length - 1];
  const enabledIndicators = indicators.filter((i) => i.enabled);
  const activeToolDef = getDrawingToolDef(activeTool);

  return (
    <div
      ref={workspaceRef}
      className={`flex flex-col bg-[var(--bg-canvas)] ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen' : 'h-[calc(100vh-72px)]'
      } overflow-hidden`}
    >
      {/* TOP CHART TOOLBAR */}
      <div className="h-10 shrink-0 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-2.5 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsSearchModalOpen(true)}
            className="h-7 px-2.5 flex items-center gap-2 bg-[var(--bg-canvas)] hover:bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded text-xs font-semibold text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
          >
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span className="font-mono">{instrument.symbol}</span>
            <span className="hidden sm:inline font-normal text-[var(--text-secondary)]">
              {instrument.exchange}
            </span>
          </button>

          <div className="hidden md:flex items-center gap-2 px-2 text-xs font-mono tabular-nums">
            <span className="font-semibold text-[var(--text-primary)]">
              {formatPrice(instrument.price, instrument.decimals)}
            </span>
            <PriceChangeText value={instrument.change} percent={instrument.changePercent} />
          </div>

          <div className="h-4 w-px bg-[var(--border-subtle)] mx-1" />

          {/* Timeframe Selector */}
          <div className="flex items-center gap-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`h-7 px-2 text-xs font-mono font-medium rounded transition-colors cursor-pointer ${
                  timeframe === tf
                    ? 'bg-[#2962FF]/15 text-[#2962FF]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-[var(--border-subtle)] mx-1" />

          {/* Candlestick Style Selector */}
          <div className="flex items-center gap-1">
            <CandlestickChart className="w-3.5 h-3.5 text-[var(--text-secondary)] hidden sm:block" />
            <select
              aria-label="Chart Style"
              value={chartStyle}
              onChange={(e) => setChartStyle(e.target.value as ChartStyle)}
              className="h-7 px-1.5 text-xs bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-panel)] rounded focus:outline-none cursor-pointer"
            >
              <option value="candles" className="bg-[var(--bg-surface)]">Candles</option>
              <option value="hollow" className="bg-[var(--bg-surface)]">Hollow Candles</option>
              <option value="heikin_ashi" className="bg-[var(--bg-surface)]">Heikin Ashi</option>
              <option value="line" className="bg-[var(--bg-surface)]">Line</option>
              <option value="area" className="bg-[var(--bg-surface)]">Area</option>
            </select>
          </div>

          {/* Indicators */}
          <button
            type="button"
            onClick={() => setIndicatorsModalOpen(true)}
            className="h-7 px-2.5 flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-panel)] rounded transition-colors cursor-pointer whitespace-nowrap"
          >
            <Activity className="w-3.5 h-3.5 text-[#2962FF]" />
            <span>Indicators</span>
            <span className="font-mono text-[11px] text-[var(--text-muted)]">
              ({enabledIndicators.length})
            </span>
          </button>

          {/* Quick Toggle for Overlay Lines, Volume & Lower Pane */}
          <button
            type="button"
            onClick={toggleAllLinesAndPanes}
            title={
              enabledIndicators.length > 0
                ? 'Hide all indicator lines, volume bars, and lower chart pane (Show candlesticks only)'
                : 'Show indicator lines and panes on chart'
            }
            className={`h-7 px-2 flex items-center gap-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              enabledIndicators.length > 0
                ? 'bg-[#2962FF]/15 text-[#2962FF]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
            }`}
          >
            {enabledIndicators.length > 0 ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
            <span className="hidden lg:inline">
              {enabledIndicators.length > 0 ? 'Lines On' : 'Chart Only'}
            </span>
          </button>

          {/* Compare */}
          <button
            type="button"
            onClick={() => setCompareModalOpen(true)}
            className={`h-7 px-2.5 flex items-center gap-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              compareInstrument
                ? 'bg-[#F0B90B]/15 text-[#F0B90B]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {compareInstrument ? `vs ${compareInstrument.symbol}` : 'Compare'}
            </span>
          </button>

          {/* TEMPLATE */}
          <button
            type="button"
            onClick={() => setTemplateModalOpen(true)}
            title="Manage Drawing Templates"
            className={`h-7 px-2.5 flex items-center gap-1.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
              templateModalOpen
                ? 'bg-[#2962FF]/15 text-[#2962FF]'
                : 'text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-[#2962FF]" />
            <span>TEMPLATE</span>
          </button>
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo Drawing (Ctrl+Z)"
            className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo Drawing (Ctrl+Y)"
            className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-[var(--border-subtle)] mx-0.5" />

          <button
            type="button"
            onClick={() => issueNav('zoom_in')}
            title="Zoom In"
            className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => issueNav('zoom_out')}
            title="Zoom Out"
            className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => issueNav('fit')}
            title="Fit Chart to Screen"
            className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => issueNav('reset')}
            title="Reset Chart View"
            className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-[var(--border-subtle)] mx-0.5" />

          <button
            type="button"
            onClick={() => openCreateAlertModal(instrument.symbol)}
            title="Create Alert"
            className="h-7 px-2 flex items-center gap-1 rounded text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            <BellPlus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Alert</span>
          </button>

          <button
            type="button"
            onClick={handleScreenshot}
            title="Save Chart Screenshot (PNG)"
            className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setSettingsModalOpen(true)}
            title="Chart Settings"
            className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Chart'}
            className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setRightPanelOpen((o) => !o)}
            title={rightPanelOpen ? 'Hide Right Panel' : 'Show Right Panel'}
            className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            {rightPanelOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* MAIN WORKSPACE BODY */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* UPGRADED LEFT DRAWING TOOLBAR (Categories A-J + Management Utilities) */}
        <DrawingToolbar
          activeTool={activeTool}
          onSelectTool={handleSelectTool}
          categoryLastTool={categoryLastTool}
          stayInDrawingMode={stayInDrawingMode}
          onToggleStayInDrawingMode={() => setStayInDrawingMode((v) => !v)}
          magnetMode={magnetMode}
          onToggleMagnetMode={() => setMagnetMode((v) => !v)}
          hideAllDrawings={hideAllDrawings}
          onToggleHideAll={() => setHideAllDrawings((v) => !v)}
          lockAllDrawings={lockAllDrawings}
          onToggleLockAll={handleToggleLockAll}
          hasSelectedDrawing={Boolean(selectedDrawingId)}
          hasAnyDrawings={activeDrawings.length > 0}
          onRemoveSelected={() => selectedDrawingId && handleDeleteDrawing(selectedDrawingId)}
          onRemoveAll={() => setConfirmRemoveAllOpen(true)}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          objectManagerOpen={rightPanelOpen && rightPanelTab === 'objects'}
          onToggleObjectManager={() => {
            if (rightPanelOpen && rightPanelTab === 'objects') {
              setRightPanelTab('market');
            } else {
              setRightPanelOpen(true);
              setRightPanelTab('objects');
            }
          }}
          drawingCount={activeDrawings.length}
        />

        {/* CENTER CHART + FLOATING CONTEXTUAL & NAVIGATION CONTROLS + BOTTOM STRIP */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 min-h-0 relative">
            {/* Floating Contextual Drawing Settings Toolbar when an object is selected */}
            {selectedDrawing && (
              <DrawingContextualToolbar
                drawing={selectedDrawing}
                instrument={instrument}
                anchorBounds={selectionBounds}
                hasClipboard={Boolean(clipboardDrawing)}
                onUpdate={(id, patch) => handleUpdateDrawing(id, patch, true)}
                onClone={handleCloneDrawing}
                onCopy={handleCopyDrawing}
                onPaste={handlePasteDrawing}
                onDelete={handleDeleteDrawing}
                onVisualOrder={handleVisualOrder}
                onOpenTemplates={() => setTemplateModalOpen(true)}
              />
            )}

            <TradingChartCanvas
              instrument={instrument}
              candles={candles}
              timeframe={timeframe}
              timezone={chartTimezone}
              chartStyle={chartStyle}
              indicators={indicators}
              compareInstrument={compareInstrument}
              compareCandles={compareCandles}
              activeTool={activeTool}
              drawings={activeDrawings}
              templates={templates}
              selectedDrawingId={selectedDrawingId}
              onSelectDrawing={setSelectedDrawingId}
              onAddDrawing={handleAddDrawing}
              onUpdateDrawing={handleUpdateDrawing}
              onSelectionBoundsChange={setSelectionBounds}
              magnetMode={magnetMode}
              hideAllDrawings={hideAllDrawings}
              crosshairEnabled={crosshairEnabled}
              visualSettings={visualSettings}
              theme={theme}
              onHoverCandle={(c) => setHoveredCandle(c)}
              navCommand={navCommand}
              onCancelTool={() => setActiveTool('cursor')}
              onToggleIndicator={toggleIndicator}
              onOpenIndicators={() => setIndicatorsModalOpen(true)}
              onRegisterExportPng={(fn) => {
                exportPngRef.current = fn;
              }}
            />

            {/* Floating Chart Navigation Controls Bar (Bottom-Center of Chart) */}
            <div className="hidden sm:flex items-center gap-0.5 px-1.5 py-1 rounded-md bg-[var(--bg-surface)]/92 backdrop-blur-[2px] border border-[var(--border-subtle)] shadow-lg absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
              <button
                type="button"
                title="Scroll Left"
                onClick={() => issueNav('scroll_left')}
                className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Zoom Out"
                onClick={() => issueNav('zoom_out')}
                className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Zoom In"
                onClick={() => issueNav('zoom_in')}
                className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Scroll Right"
                onClick={() => issueNav('scroll_right')}
                className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-3.5 bg-[var(--border-subtle)] mx-0.5" />
              <button
                type="button"
                title="Fit Chart to Screen"
                onClick={() => issueNav('fit')}
                className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
              >
                <Maximize className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Reset Chart View"
                onClick={() => issueNav('reset')}
                className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title={`Crosshair Mode: ${crosshairEnabled ? 'ON' : 'OFF'}`}
                onClick={() => setCrosshairEnabled((v) => !v)}
                className={`p-1.5 rounded cursor-pointer ${
                  crosshairEnabled
                    ? 'bg-[#2962FF]/15 text-[#2962FF]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* BOTTOM MULTI-TAB TRADING & BAR INFO PANEL */}
          <div className="shrink-0 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)]">
            <div className="h-7 px-2.5 flex items-center justify-between text-[11px] gap-2">
              <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap">
                {(
                  [
                    { id: 'ohlc', label: 'Bar OHLC' },
                    { id: 'trade', label: 'Trading Panel' },
                    { id: 'positions', label: `Open Positions (${openPositions.length})` },
                    { id: 'orders', label: `Orders (${workingOrders.length})` },
                    { id: 'history', label: 'Trade History' },
                    { id: 'account', label: 'Account Summary' },
                  ] as const
                ).map((tab) => {
                  const active = bottomTab === tab.id && bottomPanelOpen;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setBottomTab(tab.id);
                        setBottomPanelOpen(true);
                      }}
                      className={`h-5 px-2 rounded text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                        active
                          ? 'bg-[#2962FF]/15 text-[#2962FF]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
                {activeToolDef && (
                  <span className="ml-2 text-[#2962FF] font-medium">
                    · Drawing: {activeToolDef.name}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Chart Timezone Clock & Selector */}
                <div ref={timezoneMenuRef} className="relative">
                  {(() => {
                    const { timeText, offsetLabel } = formatLiveClockInTimezone(
                      nowDate,
                      chartTimezone,
                      instrument.exchange
                    );
                    return (
                      <button
                        type="button"
                        onClick={() => setTimezoneMenuOpen((o) => !o)}
                        title="Change Chart Timezone"
                        className={`h-5 px-2 flex items-center gap-1.5 rounded font-mono tabular-nums text-[11px] transition-colors cursor-pointer whitespace-nowrap ${
                          timezoneMenuOpen
                            ? 'bg-[#2962FF]/15 text-[#2962FF]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
                        }`}
                      >
                        <Clock className="w-3 h-3 opacity-80" />
                        <span>
                          {timeText} {offsetLabel}
                        </span>
                      </button>
                    );
                  })()}

                  {timezoneMenuOpen && (
                    <div className="absolute bottom-7 right-0 z-50 w-64 max-h-80 overflow-y-auto py-1 rounded-md bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-2xl">
                      <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                        Chart Timezone
                      </div>
                      {CHART_TIMEZONE_OPTIONS.map((tz) => {
                        const isSelected = chartTimezone === tz.id;
                        return (
                          <button
                            key={tz.id}
                            type="button"
                            onClick={() => {
                              setChartTimezone(tz.id);
                              setTimezoneMenuOpen(false);
                            }}
                            className={`w-full px-3 py-1.5 flex items-center justify-between gap-2 text-left text-xs transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#2962FF]/12 text-[#2962FF] font-medium'
                                : 'text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
                            }`}
                          >
                            <span className="truncate">{tz.displayLabel}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[#2962FF]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="w-px h-3.5 bg-[var(--border-subtle)]" />

                <button
                  type="button"
                  onClick={() => setBottomPanelOpen((o) => !o)}
                  className="flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer shrink-0"
                >
                  {bottomPanelOpen ? <PanelBottomClose className="w-3.5 h-3.5" /> : <PanelBottomOpen className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{bottomPanelOpen ? 'Minimize' : 'Expand'}</span>
                </button>
              </div>
            </div>

            {bottomPanelOpen && bottomTab === 'ohlc' && displayBar && (
              <div className="px-3 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-panel)] grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-[11px]">
                <div>
                  <span className="text-[var(--text-muted)] block">Open / Close</span>
                  <span className="font-mono tabular-nums text-[var(--text-primary)]">
                    {formatPrice(displayBar.open, instrument.decimals)} / {formatPrice(displayBar.close, instrument.decimals)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Bar High / Low</span>
                  <span className="font-mono tabular-nums text-[var(--text-primary)]">
                    {formatPrice(displayBar.high, instrument.decimals)} / {formatPrice(displayBar.low, instrument.decimals)}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Bar Volume</span>
                  <span className="font-mono tabular-nums text-[var(--text-primary)]">
                    {displayBar.volume.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Active Indicators</span>
                  <span className="text-[var(--text-primary)] truncate block">
                    {enabledIndicators.map((i) => i.shortName).join(', ') || 'None (Chart Only)'}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)] block">Drawing Objects</span>
                  <button
                    type="button"
                    onClick={() => {
                      setRightPanelOpen(true);
                      setRightPanelTab('objects');
                    }}
                    className="font-mono tabular-nums text-[#2962FF] hover:underline cursor-pointer"
                  >
                    {activeDrawings.length} on chart →
                  </button>
                </div>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => openTechnicalAnalysis(instrument.symbol)}
                    className="text-xs font-medium text-[#2962FF] hover:underline cursor-pointer"
                  >
                    Full Technical Breakdown →
                  </button>
                </div>
              </div>
            )}

            {bottomPanelOpen && bottomTab === 'trade' && (
              <div className="px-3 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-panel)] flex flex-wrap items-end gap-2.5 text-[11px]">
                <div className="min-w-[110px]">
                  <span className="block text-[10px] text-[var(--text-muted)] mb-1">Order Type</span>
                  <select
                    value={quickOrderType}
                    onChange={(e) => setQuickOrderType(e.target.value as OrderType)}
                    className="h-7 px-2 w-full rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                  >
                    <option value="Market">Market</option>
                    <option value="Limit">Limit</option>
                    <option value="Stop">Stop</option>
                  </select>
                </div>
                <div className="w-24">
                  <span className="block text-[10px] text-[var(--text-muted)] mb-1">Units / Lots</span>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={quickQty}
                    onChange={(e) => setQuickQty(e.target.value)}
                    className="h-7 px-2 w-full rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--text-primary)]"
                  />
                </div>
                {quickOrderType !== 'Market' && (
                  <div className="w-28">
                    <span className="block text-[10px] text-[var(--text-muted)] mb-1">{quickOrderType} Price</span>
                    <input
                      type="number"
                      step="any"
                      placeholder={formatPrice(instrument.price, instrument.decimals)}
                      value={quickLimitPx}
                      onChange={(e) => setQuickLimitPx(e.target.value)}
                      className="h-7 px-2 w-full rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--text-primary)]"
                    />
                  </div>
                )}
                <div className="w-24">
                  <span className="block text-[10px] text-[var(--text-muted)] mb-1">Stop Loss</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="Optional"
                    value={quickSl}
                    onChange={(e) => setQuickSl(e.target.value)}
                    className="h-7 px-2 w-full rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--text-primary)]"
                  />
                </div>
                <div className="w-24">
                  <span className="block text-[10px] text-[var(--text-muted)] mb-1">Take Profit</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="Optional"
                    value={quickTp}
                    onChange={(e) => setQuickTp(e.target.value)}
                    className="h-7 px-2 w-full rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--text-primary)]"
                  />
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => handleQuickOrder('Sell')}
                    className="h-7 px-3 rounded bg-[#F23645] hover:bg-[#D92D3C] text-white font-semibold text-xs font-mono cursor-pointer whitespace-nowrap"
                  >
                    SELL {formatPrice(instrument.bid, instrument.decimals)}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickOrder('Buy')}
                    className="h-7 px-3 rounded bg-[#089981] hover:bg-[#07826E] text-white font-semibold text-xs font-mono cursor-pointer whitespace-nowrap"
                  >
                    BUY {formatPrice(instrument.ask, instrument.decimals)}
                  </button>
                </div>
              </div>
            )}

            {bottomPanelOpen && bottomTab === 'positions' && (
              <div className="max-h-36 overflow-y-auto border-t border-[var(--border-subtle)] bg-[var(--bg-panel)]">
                {openPositions.length === 0 ? (
                  <div className="py-4 text-center text-[11px] text-[var(--text-muted)]">
                    No open positions. Use Trading Panel to submit an order.
                  </div>
                ) : (
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                        <th className="text-left font-medium px-3 py-1.5">Symbol</th>
                        <th className="text-left font-medium px-2 py-1.5">Side</th>
                        <th className="text-right font-medium px-2 py-1.5">Qty</th>
                        <th className="text-right font-medium px-2 py-1.5">Entry</th>
                        <th className="text-right font-medium px-2 py-1.5">Mark</th>
                        <th className="text-right font-medium px-2 py-1.5">Unrealized P&L</th>
                        <th className="text-right font-medium px-3 py-1.5">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]/60">
                      {openPositions.map((pos) => {
                        const inst = instruments.find((i) => i.symbol === pos.symbol);
                        const mark = inst?.price ?? pos.entryPrice;
                        const dec = inst?.decimals ?? 2;
                        const pnl = computePositionUnrealizedPnl(pos, mark);
                        return (
                          <tr key={pos.id} className="hover:bg-[var(--bg-surface)]/50">
                            <td className="px-3 py-1.5 font-mono font-semibold text-[var(--text-primary)]">{pos.symbol}</td>
                            <td className={`px-2 py-1.5 font-medium ${pos.side === 'Buy' ? 'text-[#089981]' : 'text-[#F23645]'}`}>
                              {pos.side}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono tabular-nums">{pos.quantity}</td>
                            <td className="px-2 py-1.5 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                              {formatPrice(pos.entryPrice, dec)}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                              {formatPrice(mark, dec)}
                            </td>
                            <td className={`px-2 py-1.5 text-right font-mono tabular-nums font-semibold ${pnl >= 0 ? 'text-[#089981]' : 'text-[#F23645]'}`}>
                              {pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toFixed(2)}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() => closePosition(pos.id)}
                                className="px-2 py-0.5 rounded bg-[#F23645]/12 text-[#F23645] hover:bg-[#F23645]/20 cursor-pointer"
                              >
                                Close
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {bottomPanelOpen && bottomTab === 'orders' && (
              <div className="max-h-36 overflow-y-auto border-t border-[var(--border-subtle)] bg-[var(--bg-panel)]">
                {workingOrders.length === 0 ? (
                  <div className="py-4 text-center text-[11px] text-[var(--text-muted)]">
                    No active Limit or Stop orders working.
                  </div>
                ) : (
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                        <th className="text-left font-medium px-3 py-1.5">Symbol</th>
                        <th className="text-left font-medium px-2 py-1.5">Order</th>
                        <th className="text-right font-medium px-2 py-1.5">Qty</th>
                        <th className="text-right font-medium px-2 py-1.5">Trigger Price</th>
                        <th className="text-right font-medium px-2 py-1.5">Created</th>
                        <th className="text-right font-medium px-3 py-1.5">Cancel</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]/60">
                      {workingOrders.map((ord) => {
                        const dec = instruments.find((i) => i.symbol === ord.symbol)?.decimals ?? 2;
                        return (
                          <tr key={ord.id}>
                            <td className="px-3 py-1.5 font-mono font-semibold text-[var(--text-primary)]">{ord.symbol}</td>
                            <td className={`px-2 py-1.5 font-medium ${ord.side === 'Buy' ? 'text-[#089981]' : 'text-[#F23645]'}`}>
                              {ord.side} {ord.type}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono tabular-nums">{ord.quantity}</td>
                            <td className="px-2 py-1.5 text-right font-mono tabular-nums">{formatPrice(ord.limitOrStopPrice, dec)}</td>
                            <td className="px-2 py-1.5 text-right font-mono text-[var(--text-muted)]">{ord.createdAt}</td>
                            <td className="px-3 py-1.5 text-right">
                              <button
                                type="button"
                                onClick={() => cancelOrder(ord.id)}
                                title="Cancel Order"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:text-[#F23645] cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                                Cancel
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {bottomPanelOpen && bottomTab === 'history' && (
              <div className="max-h-36 overflow-y-auto border-t border-[var(--border-subtle)] bg-[var(--bg-panel)]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)]">
                      <th className="text-left font-medium px-3 py-1.5">Time</th>
                      <th className="text-left font-medium px-2 py-1.5">Symbol</th>
                      <th className="text-left font-medium px-2 py-1.5">Side</th>
                      <th className="text-right font-medium px-2 py-1.5">Qty</th>
                      <th className="text-right font-medium px-2 py-1.5">Fill Price</th>
                      <th className="text-right font-medium px-3 py-1.5">Realized P&L</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]/60">
                    {tradeHistory.slice(0, 8).map((tr) => {
                      const dec = instruments.find((i) => i.symbol === tr.symbol)?.decimals ?? 2;
                      return (
                        <tr key={tr.id}>
                          <td className="px-3 py-1.5 font-mono text-[var(--text-muted)]">{tr.executedAt}</td>
                          <td className="px-2 py-1.5 font-mono font-semibold text-[var(--text-primary)]">{tr.symbol}</td>
                          <td className={`px-2 py-1.5 font-medium ${tr.side === 'Buy' ? 'text-[#089981]' : 'text-[#F23645]'}`}>
                            {tr.side} ({tr.type})
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums">{tr.quantity}</td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums">{formatPrice(tr.fillPrice, dec)}</td>
                          <td className={`px-3 py-1.5 text-right font-mono tabular-nums ${
                            tr.realizedPnl === undefined
                              ? 'text-[var(--text-muted)]'
                              : tr.realizedPnl >= 0
                              ? 'text-[#089981]'
                              : 'text-[#F23645]'
                          }`}>
                            {tr.realizedPnl === undefined
                              ? tr.status
                              : `${tr.realizedPnl >= 0 ? '+' : '-'}$${Math.abs(tr.realizedPnl).toFixed(2)}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {bottomPanelOpen && bottomTab === 'account' && (
              <div className="px-3 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-panel)] grid grid-cols-2 sm:grid-cols-5 gap-3 text-[11px] font-mono tabular-nums">
                <div>
                  <span className="font-sans text-[var(--text-muted)] block">Account Balance</span>
                  <span className="text-[var(--text-primary)] font-semibold">
                    ${accountSummary.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="font-sans text-[var(--text-muted)] block">Equity</span>
                  <span className="text-[var(--text-primary)] font-semibold">
                    ${accountSummary.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="font-sans text-[var(--text-muted)] block">Unrealized P&L</span>
                  <span className={accountSummary.unrealizedPnl >= 0 ? 'text-[#089981] font-semibold' : 'text-[#F23645] font-semibold'}>
                    {accountSummary.unrealizedPnl >= 0 ? '+' : '-'}$
                    {Math.abs(accountSummary.unrealizedPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="font-sans text-[var(--text-muted)] block">Used Margin</span>
                  <span className="text-[var(--text-primary)]">
                    ${accountSummary.usedMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="font-sans text-[var(--text-muted)] block">Free Margin</span>
                  <span className="text-[#089981]">
                    ${accountSummary.freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: WATCHLIST & STATS OR DRAWING OBJECT MANAGER */}
        {rightPanelOpen && (
          <aside className="hidden md:flex w-72 shrink-0 flex-col bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] overflow-hidden">
            {/* Panel Mode Switcher */}
            <div className="grid grid-cols-2 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)] shrink-0">
              <button
                type="button"
                onClick={() => setRightPanelTab('market')}
                className={`py-2 text-xs font-semibold transition-colors cursor-pointer border-b-2 ${
                  rightPanelTab === 'market'
                    ? 'text-[var(--text-primary)] border-[#2962FF] bg-[var(--bg-surface)]'
                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                }`}
              >
                Watchlist & Info
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('objects')}
                className={`py-2 text-xs font-semibold transition-colors cursor-pointer border-b-2 ${
                  rightPanelTab === 'objects'
                    ? 'text-[var(--text-primary)] border-[#2962FF] bg-[var(--bg-surface)]'
                    : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                }`}
              >
                Objects ({activeDrawings.length})
              </button>
            </div>

            {rightPanelTab === 'objects' ? (
              <div className="flex-1 min-h-0">
                <DrawingObjectManager
                  drawings={activeDrawings}
                  selectedId={selectedDrawingId}
                  currentTimeframe={timeframe}
                  onSelectDrawing={(id) => {
                    setSelectedDrawingId(id);
                    setActiveTool('cursor');
                  }}
                  onLocateDrawing={(d) => {
                    if (d.points[0]) {
                      issueNav('locate', d.points[0].index);
                    } else if (d.positionData) {
                      issueNav('locate', d.positionData.startIndex);
                    }
                  }}
                  onUpdateDrawing={(id, patch) => handleUpdateDrawing(id, patch, true)}
                  onBatchUpdateDrawings={handleBatchUpdateDrawings}
                  onVisualOrder={handleVisualOrder}
                  onDeleteDrawing={handleDeleteDrawing}
                />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {/* Quick Watchlist */}
                <div className="border-b border-[var(--border-subtle)]">
                  <div className="px-3 py-2 flex items-center justify-between bg-[var(--bg-panel)] border-b border-[var(--border-subtle)]">
                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {activeWatchlist.name}
                    </span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      {activeWatchlist.symbols.length}
                    </span>
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-[var(--border-subtle)]/60">
                    {activeWatchlist.symbols.map((sym) => {
                      const item = instruments.find((i) => i.symbol === sym);
                      if (!item) return null;
                      const selected = item.symbol === instrument.symbol;
                      return (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => setSelectedSymbol(sym)}
                          className={`w-full px-3 py-1.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                            selected ? 'bg-[#2962FF]/12' : 'hover:bg-[var(--bg-panel)]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-mono font-semibold text-[var(--text-primary)]">
                              {item.symbol}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] truncate max-w-[115px]">
                              {item.name}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-mono tabular-nums text-[var(--text-primary)]">
                              {formatPrice(item.price, item.decimals)}
                            </div>
                            <div className="text-[11px]">
                              <PriceChangeText value={item.change} percent={item.changePercent} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Instrument Details & Market Statistics */}
                <div className="p-3 border-b border-[var(--border-subtle)] space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold font-mono text-[var(--text-primary)]">
                        {instrument.symbol}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] truncate">{instrument.name}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {instrument.category} · {instrument.exchange}
                      </div>
                    </div>
                    <SignalLabel signal={instrument.maSignal} />
                  </div>

                  <div className="pt-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-mono tabular-nums font-bold text-[var(--text-primary)]">
                        {formatPrice(instrument.price, instrument.decimals)}
                      </span>
                      <span className="text-xs">
                        <PriceChangeText
                          value={instrument.change}
                          percent={instrument.changePercent}
                          decimals={instrument.decimals}
                          showPriceDelta
                        />
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px] text-[var(--text-muted)] font-mono tabular-nums">
                      <span>L {formatPrice(instrument.low24h, instrument.decimals)}</span>
                      <span>24h Range</span>
                      <span>H {formatPrice(instrument.high24h, instrument.decimals)}</span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-canvas)] rounded-full overflow-hidden relative">
                      <div
                        className="absolute top-0 bottom-0 w-2 bg-[#2962FF] rounded-full"
                        style={{
                          left: `calc(${Math.max(
                            0,
                            Math.min(
                              95,
                              ((instrument.price - instrument.low24h) /
                                Math.max(1e-9, instrument.high24h - instrument.low24h)) *
                                100
                            )
                          )}% - 4px)`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-2 gap-x-3 pt-2 text-[11px] border-t border-[var(--border-subtle)]">
                    <div>
                      <span className="text-[var(--text-muted)] block">Bid / Ask</span>
                      <span className="font-mono tabular-nums text-[var(--text-primary)]">
                        {formatPrice(instrument.bid, instrument.decimals)} / {formatPrice(instrument.ask, instrument.decimals)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block">Spread</span>
                      <span className="font-mono tabular-nums text-[var(--text-primary)]">{instrument.spread}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block">24h Volume</span>
                      <span className="font-mono tabular-nums text-[var(--text-primary)]">{instrument.volumeLabel}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block">RSI (14)</span>
                      <span className="font-mono tabular-nums text-[var(--text-primary)]">{instrument.rsi14.toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block">52W Range</span>
                      <span className="font-mono tabular-nums text-[var(--text-primary)]">
                        {formatPrice(instrument.low52w, instrument.decimals)} – {formatPrice(instrument.high52w, instrument.decimals)}
                      </span>
                    </div>
                    {instrument.marketCapLabel && (
                      <div>
                        <span className="text-[var(--text-muted)] block">Market Cap</span>
                        <span className="font-mono tabular-nums text-[var(--text-primary)]">{instrument.marketCapLabel}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Symbol Price Alerts */}
                <div className="p-3 border-b border-[var(--border-subtle)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      Price Alerts ({symbolAlerts.length})
                    </span>
                    <Button size="xs" variant="secondary" onClick={() => openCreateAlertModal(instrument.symbol)}>
                      <BellPlus className="w-3 h-3" />
                      Add
                    </Button>
                  </div>
                  {symbolAlerts.length === 0 ? (
                    <p className="text-[11px] text-[var(--text-muted)] py-2">
                      No alerts configured for {instrument.symbol}.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {symbolAlerts.map((al) => (
                        <div
                          key={al.id}
                          className="p-2 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[11px]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-[var(--text-primary)]">{al.condition}</span>
                            <span
                              className={`font-medium ${
                                al.status === 'Active'
                                  ? 'text-[#2962FF]'
                                  : al.status === 'Triggered'
                                  ? 'text-[#089981]'
                                  : 'text-[var(--text-muted)]'
                              }`}
                            >
                              {al.status}
                            </span>
                          </div>
                          <div className="font-mono tabular-nums text-[var(--text-secondary)] mt-0.5">
                            Target: {formatPrice(al.targetPrice, instrument.decimals)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Market News */}
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                      <Newspaper className="w-3.5 h-3.5 text-[#2962FF]" />
                      Recent News
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveScreen('news')}
                      className="text-[11px] text-[#2962FF] hover:underline cursor-pointer"
                    >
                      All →
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {symbolNews.slice(0, 3).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveScreen('news')}
                        className="w-full p-2 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                          <span>{item.source}</span>
                          <span>{item.publishedAt}</span>
                        </div>
                        <p className="text-[11px] font-medium text-[var(--text-primary)] mt-1 line-clamp-2 leading-snug">
                          {item.title}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}

        {/* MOBILE OBJECT MANAGER OVERLAY (< md screens) */}
        {rightPanelOpen && rightPanelTab === 'objects' && (
          <div className="md:hidden fixed inset-y-12 right-0 w-72 max-w-[85vw] z-40 border-l border-[var(--border-strong)] shadow-2xl bg-[var(--bg-surface)]">
            <DrawingObjectManager
              drawings={activeDrawings}
              selectedId={selectedDrawingId}
              currentTimeframe={timeframe}
              onSelectDrawing={(id) => {
                setSelectedDrawingId(id);
                setActiveTool('cursor');
              }}
              onLocateDrawing={(d) => {
                if (d.points[0]) {
                  issueNav('locate', d.points[0].index);
                } else if (d.positionData) {
                  issueNav('locate', d.positionData.startIndex);
                }
              }}
              onUpdateDrawing={(id, patch) => handleUpdateDrawing(id, patch, true)}
              onBatchUpdateDrawings={handleBatchUpdateDrawings}
              onVisualOrder={handleVisualOrder}
              onDeleteDrawing={handleDeleteDrawing}
              onClose={() => setRightPanelTab('market')}
            />
          </div>
        )}
      </div>

      {/* Upgraded Technical Indicators Selector Modal */}
      <IndicatorSelectorModal
        open={indicatorsModalOpen}
        onClose={() => setIndicatorsModalOpen(false)}
        symbol={instrument.symbol}
        indicators={indicators}
        favoriteIds={favoriteIndicatorIds}
        recentIds={recentIndicatorIds}
        onToggleIndicator={toggleIndicator}
        onToggleFavorite={toggleFavoriteIndicator}
        onUpdateIndicator={updateIndicatorConfig}
        onResetIndicator={resetIndicatorConfig}
        onEnableStandard={enableStandardIndicators}
        onClearAll={clearAllIndicators}
      />

      {/* Compare Symbol Modal */}
      <Modal
        open={compareModalOpen}
        onClose={() => setCompareModalOpen(false)}
        title="Compare Instrument"
        subtitle={`Overlay relative performance against ${instrument.symbol}`}
      >
        <div className="space-y-4">
          <Select
            value={compareSymbol}
            onChange={(e) => setCompareSymbol(e.target.value)}
            className="w-full"
          >
            <option value="">None (Disable comparison)</option>
            {instruments
              .filter((i) => i.symbol !== instrument.symbol)
              .map((i) => (
                <option key={i.symbol} value={i.symbol}>
                  {i.symbol} — {i.name} ({i.category})
                </option>
              ))}
          </Select>
          <div className="flex justify-end gap-2">
            {compareSymbol && (
              <Button
                variant="ghost"
                onClick={() => {
                  setCompareSymbol('');
                  setCompareModalOpen(false);
                }}
              >
                Clear Comparison
              </Button>
            )}
            <Button variant="primary" onClick={() => setCompareModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Chart Settings Modal */}
      <Modal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        title="Chart Appearance & Scale"
        subtitle="Customize visual grid lines, price axis scale, and overlays"
      >
        <div className="space-y-2.5">
          {[
            { key: 'showGrid' as const, label: 'Show Price & Time Grid Lines' },
            { key: 'showPriceLine' as const, label: 'Show Current Market Price Line' },
            { key: 'showVolume' as const, label: 'Show Volume Histogram' },
            { key: 'logScale' as const, label: 'Logarithmic Price Scale' },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between p-2.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] cursor-pointer"
            >
              <span className="text-xs font-medium text-[var(--text-primary)]">{item.label}</span>
              <input
                type="checkbox"
                checked={
                  item.key === 'showVolume'
                    ? visualSettings.showVolume &&
                      Boolean(indicators.find((i) => i.id === 'volume')?.enabled)
                    : visualSettings[item.key]
                }
                onChange={() => {
                  if (item.key === 'showVolume') {
                    const volEnabled = Boolean(indicators.find((i) => i.id === 'volume')?.enabled);
                    const nextVol = !(visualSettings.showVolume && volEnabled);
                    setVisualSettings((prev) => ({ ...prev, showVolume: nextVol }));
                    setIndicators((prev) =>
                      prev.map((ind) => (ind.id === 'volume' ? { ...ind, enabled: nextVol } : ind))
                    );
                  } else {
                    setVisualSettings((prev) => ({ ...prev, [item.key]: !prev[item.key] }));
                  }
                }}
                className="w-4 h-4 accent-[#2962FF] cursor-pointer"
              />
            </label>
          ))}
        </div>
      </Modal>

      {/* Drawing Template Manager Modal */}
      <DrawingTemplateManager
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        templates={templates}
        selectedDrawing={selectedDrawing}
        activeTool={activeTool}
        onCreateTemplate={handleCreateTemplate}
        onApplyTemplate={handleApplyTemplate}
        onRenameTemplate={handleRenameTemplate}
        onDuplicateTemplate={handleDuplicateTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        onSetDefaultTemplate={handleSetDefaultTemplate}
      />

      {/* Destructive Confirmation: Remove All Drawings for Symbol */}
      <Modal
        open={confirmRemoveAllOpen}
        onClose={() => setConfirmRemoveAllOpen(false)}
        title={`Remove All Drawings on ${instrument.symbol}?`}
        subtitle="You can undo this action immediately with Ctrl+Z if needed."
      >
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-secondary)]">
            This will remove all <span className="font-mono font-semibold text-[var(--text-primary)]">{activeDrawings.length}</span> drawing object{activeDrawings.length === 1 ? '' : 's'} currently placed on <span className="font-mono font-semibold text-[var(--text-primary)]">{instrument.symbol}</span>.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmRemoveAllOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRemoveAllForSymbol}>
              Remove All
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
