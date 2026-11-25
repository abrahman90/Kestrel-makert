import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BellPlus,
  CandlestickChart,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  GitCompare,
  Maximize,
  Maximize2,
  Minimize2,
  PanelBottomClose,
  PanelBottomOpen,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Search,
  Settings2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
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
  DrawingTool,
  IndicatorConfig,
  Timeframe,
} from '../../types/market';
import { formatPrice } from '../../utils/indicators';
import { Button, Modal, PriceChangeText, Select, SignalLabel } from '../ui/DesignSystem';
import { DrawingContextualToolbar } from './DrawingContextualToolbar';
import { DrawingObjectManager } from './DrawingObjectManager';
import { DrawingToolbar } from './DrawingToolbar';
import { ChartVisualSettings, NavCommand, TradingChartCanvas } from './TradingChartCanvas';

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'];

const INITIAL_INDICATORS: IndicatorConfig[] = [
  { id: 'volume', label: 'Volume Histogram', shortName: 'Vol', category: 'Overlay', enabled: true, color: '#089981', params: {} },
  { id: 'ema20', label: 'Exponential Moving Average (20)', shortName: 'EMA 20', category: 'Overlay', enabled: true, color: '#F0B90B', params: { period: 20 } },
  { id: 'ema50', label: 'Exponential Moving Average (50)', shortName: 'EMA 50', category: 'Overlay', enabled: true, color: '#2962FF', params: { period: 50 } },
  { id: 'sma200', label: 'Long-Term Moving Average (100)', shortName: 'SMA 100', category: 'Overlay', enabled: false, color: '#AB47BC', params: { period: 100 } },
  { id: 'bb', label: 'Bollinger Bands (20, 2)', shortName: 'BB(20,2)', category: 'Overlay', enabled: false, color: '#2962FF', params: { period: 20, mult: 2 } },
  { id: 'rsi', label: 'Relative Strength Index (14)', shortName: 'RSI(14)', category: 'Oscillator', enabled: true, color: '#AB47BC', params: { period: 14 } },
  { id: 'macd', label: 'MACD (12, 26, 9)', shortName: 'MACD', category: 'Oscillator', enabled: false, color: '#2962FF', params: { fast: 12, slow: 26, signal: 9 } },
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
    watchlists,
    activeWatchlistId,
    alerts,
    openCreateAlertModal,
    setIsSearchModalOpen,
    openTechnicalAnalysis,
  } = usePlatform();

  const workspaceRef = useRef<HTMLDivElement>(null);

  const instrument = useMemo(
    () => instruments.find((i) => i.symbol === selectedSymbol) ?? instruments[0],
    [instruments, selectedSymbol]
  );

  const [chartStyle, setChartStyle] = useState<ChartStyle>('candles');
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(INITIAL_INDICATORS);
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

  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [stayInDrawingMode, setStayInDrawingMode] = useState(false);
  const [magnetMode, setMagnetMode] = useState(false);
  const [hideAllDrawings, setHideAllDrawings] = useState(false);
  const [lockAllDrawings, setLockAllDrawings] = useState(false);
  const [crosshairEnabled, setCrosshairEnabled] = useState(true);

  const [compareSymbol, setCompareSymbol] = useState<string>('');
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<'market' | 'objects'>('market');
  const [bottomPanelOpen, setBottomPanelOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [indicatorsModalOpen, setIndicatorsModalOpen] = useState(false);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [navCommand, setNavCommand] = useState<NavCommand | null>(null);

  const [visualSettings, setVisualSettings] = useState<ChartVisualSettings>({
    showGrid: true,
    showPriceLine: true,
    showVolume: true,
    logScale: false,
  });

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

  const handleDuplicateDrawing = useCallback(
    (id: string) => {
      const orig = drawings.find((d) => d.id === id);
      if (!orig) return;
      const dup: ChartDrawing = {
        ...orig,
        id: `dr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: `${orig.name} Copy`,
        locked: false,
        points: orig.points.map((p) => ({
          index: Math.min(179, p.index + 3),
          price: p.price * 0.998,
        })),
      };
      commitDrawings((prev) => [...prev, dup], true);
      setSelectedDrawingId(dup.id);
    },
    [drawings, commitDrawings]
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
  }, [commitDrawings, instrument.symbol]);

  const handleToggleLockAll = useCallback(() => {
    const nextLock = !lockAllDrawings;
    setLockAllDrawings(nextLock);
    commitDrawings(
      (prev) =>
        prev.map((d) => (d.symbol === instrument.symbol ? { ...d, locked: nextLock } : d)),
      true
    );
  }, [lockAllDrawings, commitDrawings, instrument.symbol]);

  // Keyboard Shortcuts: Alt+T, Alt+H, Alt+J, Alt+V, Alt+C, Ctrl+Z, Ctrl+Y, Delete
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
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDrawingId) {
        e.preventDefault();
        handleDeleteDrawing(selectedDrawingId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSelectTool, handleUndo, handleRedo, selectedDrawingId, handleDeleteDrawing]);

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

  const activeWatchlist = useMemo(
    () => watchlists.find((w) => w.id === activeWatchlistId) ?? watchlists[0],
    [watchlists, activeWatchlistId]
  );

  const symbolAlerts = useMemo(
    () => alerts.filter((a) => a.symbol === instrument.symbol),
    [alerts, instrument.symbol]
  );

  const toggleIndicator = (id: IndicatorConfig['id']) => {
    setIndicators((prev) => prev.map((ind) => (ind.id === id ? { ...ind, enabled: !ind.enabled } : ind)));
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

  const displayBar = hoveredCandle ?? candles[candles.length - 1];
  const enabledIndicators = indicators.filter((i) => i.enabled);
  const activeToolDef = getDrawingToolDef(activeTool);

  return (
    <div
      ref={workspaceRef}
      className={`flex flex-col bg-[var(--bg-canvas)] ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen' : 'h-[calc(100vh-48px)]'
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
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-1 shrink-0">
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
          onRemoveAll={handleRemoveAllForSymbol}
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
                onUpdate={(id, patch) => handleUpdateDrawing(id, patch, true)}
                onDuplicate={handleDuplicateDrawing}
                onDelete={handleDeleteDrawing}
                decimals={instrument.decimals}
              />
            )}

            <TradingChartCanvas
              instrument={instrument}
              candles={candles}
              timeframe={timeframe}
              chartStyle={chartStyle}
              indicators={indicators}
              compareInstrument={compareInstrument}
              compareCandles={compareCandles}
              activeTool={activeTool}
              drawings={activeDrawings}
              selectedDrawingId={selectedDrawingId}
              onSelectDrawing={setSelectedDrawingId}
              onAddDrawing={handleAddDrawing}
              onUpdateDrawing={handleUpdateDrawing}
              magnetMode={magnetMode}
              hideAllDrawings={hideAllDrawings}
              crosshairEnabled={crosshairEnabled}
              visualSettings={visualSettings}
              theme={theme}
              onHoverCandle={(c) => setHoveredCandle(c)}
              navCommand={navCommand}
              onCancelTool={() => setActiveTool('cursor')}
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

          {/* BOTTOM PANEL */}
          <div className="shrink-0 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)]">
            <div className="h-7 px-3 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-3 overflow-x-auto whitespace-nowrap">
                <span className="font-semibold text-[var(--text-primary)]">
                  {instrument.name} ({instrument.symbol})
                </span>
                <span className="text-[var(--text-muted)]">·</span>
                <span className="text-[var(--text-secondary)]">
                  Session: <span className="text-[var(--text-primary)] font-medium">{instrument.status}</span>
                </span>
                <span className="text-[var(--text-muted)]">·</span>
                <span className="text-[var(--text-secondary)]">
                  TF: <span className="font-mono text-[var(--text-primary)]">{timeframe}</span>
                </span>
                {activeToolDef && (
                  <>
                    <span className="text-[var(--text-muted)]">·</span>
                    <span className="text-[#2962FF] font-medium">
                      Drawing: {activeToolDef.name}
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setBottomPanelOpen((o) => !o)}
                className="flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer shrink-0 ml-2"
              >
                {bottomPanelOpen ? <PanelBottomClose className="w-3.5 h-3.5" /> : <PanelBottomOpen className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{bottomPanelOpen ? 'Minimize' : 'Details'}</span>
              </button>
            </div>

            {bottomPanelOpen && displayBar && (
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
                    {enabledIndicators.map((i) => i.shortName).join(', ') || 'None'}
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
                  onSelectDrawing={(id) => {
                    setSelectedDrawingId(id);
                    setActiveTool('cursor');
                  }}
                  onLocateDrawing={(d) => {
                    if (d.points[0]) {
                      issueNav('locate', d.points[0].index);
                    }
                  }}
                  onUpdateDrawing={(id, patch) => handleUpdateDrawing(id, patch, true)}
                  onBatchUpdateDrawings={handleBatchUpdateDrawings}
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
                <div className="p-3 space-y-2">
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
              onSelectDrawing={(id) => {
                setSelectedDrawingId(id);
                setActiveTool('cursor');
              }}
              onLocateDrawing={(d) => {
                if (d.points[0]) {
                  issueNav('locate', d.points[0].index);
                }
              }}
              onUpdateDrawing={(id, patch) => handleUpdateDrawing(id, patch, true)}
              onBatchUpdateDrawings={handleBatchUpdateDrawings}
              onDeleteDrawing={handleDeleteDrawing}
              onClose={() => setRightPanelTab('market')}
            />
          </div>
        )}
      </div>

      {/* Indicators Modal */}
      <Modal
        open={indicatorsModalOpen}
        onClose={() => setIndicatorsModalOpen(false)}
        title="Technical Indicators"
        subtitle={`Configure chart overlays and oscillators for ${instrument.symbol}`}
      >
        <div className="space-y-2">
          {indicators.map((ind) => (
            <label
              key={ind.id}
              className="flex items-center justify-between p-2.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-panel)] cursor-pointer transition-colors"
            >
              <div>
                <div className="text-xs font-medium text-[var(--text-primary)]">{ind.label}</div>
                <div className="text-[11px] text-[var(--text-muted)]">{ind.category}</div>
              </div>
              <input
                type="checkbox"
                checked={ind.enabled}
                onChange={() => toggleIndicator(ind.id)}
                className="w-4 h-4 accent-[#2962FF] cursor-pointer"
              />
            </label>
          ))}
        </div>
      </Modal>

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
                checked={visualSettings[item.key]}
                onChange={() =>
                  setVisualSettings((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                }
                className="w-4 h-4 accent-[#2962FF] cursor-pointer"
              />
            </label>
          ))}
        </div>
      </Modal>
    </div>
  );
}
