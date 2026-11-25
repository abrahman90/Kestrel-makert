import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Candle,
  ChartDrawing,
  ChartStyle,
  DrawingTool,
  IndicatorConfig,
  Instrument,
  LineStyle,
  Timeframe,
} from '../../types/market';
import {
  DEFAULT_FIB_LEVELS,
  getDrawingToolDef,
} from '../../data/drawingToolsCatalog';
import { getDefaultConfigForTool } from '../../data/drawingTemplatesCatalog';
import {
  calculateATR,
  calculateBollingerBands,
  calculateCCI,
  calculateEMA,
  calculateHeikinAshi,
  calculateIchimoku,
  calculateKeltnerChannels,
  calculateMACD,
  calculateOBV,
  calculateRSI,
  calculateSMA,
  calculateStochastic,
  calculateVolumeProfile,
  formatPrice,
} from '../../utils/indicators';
import {
  computePositionMetrics,
  formatMetricNumber,
  getInstrumentTickMeta,
} from '../../utils/positionMetrics';
import { formatChartTimestamp } from '../../utils/timezone';
import { SelectionBounds } from './DrawingContextualToolbar';
import { DrawingTemplate, PositionDrawingData } from '../../types/market';

export interface ChartVisualSettings {
  showGrid: boolean;
  showPriceLine: boolean;
  showVolume: boolean;
  logScale: boolean;
}

export interface NavCommand {
  seq: number;
  type: 'zoom_in' | 'zoom_out' | 'scroll_left' | 'scroll_right' | 'reset' | 'fit' | 'locate';
  targetIndex?: number;
}

interface TradingChartCanvasProps {
  instrument: Instrument;
  candles: Candle[];
  timeframe: Timeframe;
  timezone?: string;
  chartStyle: ChartStyle;
  indicators: IndicatorConfig[];
  compareInstrument: Instrument | null;
  compareCandles: Candle[] | null;
  activeTool: DrawingTool;
  drawings: ChartDrawing[];
  templates: DrawingTemplate[];
  selectedDrawingId: string | null;
  onSelectDrawing: (id: string | null) => void;
  onAddDrawing: (drawing: Omit<ChartDrawing, 'id' | 'name' | 'groupName'>) => void;
  onUpdateDrawing: (id: string, patch: Partial<ChartDrawing>, recordHistory?: boolean) => void;
  onSelectionBoundsChange?: (bounds: SelectionBounds | null) => void;
  magnetMode: boolean;
  hideAllDrawings: boolean;
  crosshairEnabled: boolean;
  visualSettings: ChartVisualSettings;
  theme: 'dark' | 'light';
  onHoverCandle?: (candle: Candle | null, index: number | null) => void;
  navCommand: NavCommand | null;
  onCancelTool: () => void;
  onToggleIndicator?: (id: IndicatorConfig['id']) => void;
  onOpenIndicators?: () => void;
  onRegisterExportPng?: (fn: (() => void) | null) => void;
}

interface PendingPoint {
  index: number;
  price: number;
}

type PositionHandleKind = 'tp' | 'sl' | 'entry' | 'left_time' | 'right_time';

interface HoveredHandleInfo {
  drawingId: string;
  handle: PositionHandleKind | number;
  x: number;
  y: number;
  label: string;
}

function isDrawingVisibleOnTimeframe(d: ChartDrawing, tf: Timeframe): boolean {
  if (!d.visible) return false;
  if (!d.visibleIntervals || d.visibleIntervals.length === 0) return true;
  return d.visibleIntervals.includes(tf);
}

function applyLineStyle(ctx: CanvasRenderingContext2D, style: LineStyle) {
  if (style === 'dashed') ctx.setLineDash([6, 4]);
  else if (style === 'dotted') ctx.setLineDash([2, 3]);
  else ctx.setLineDash([]);
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return hex;
}

export function TradingChartCanvas({
  instrument,
  candles,
  timeframe,
  timezone = 'America/New_York',
  chartStyle,
  indicators,
  compareInstrument,
  compareCandles,
  activeTool,
  drawings,
  templates,
  selectedDrawingId,
  onSelectDrawing,
  onAddDrawing,
  onUpdateDrawing,
  onSelectionBoundsChange,
  magnetMode,
  hideAllDrawings,
  crosshairEnabled,
  visualSettings,
  theme,
  onHoverCandle,
  navCommand,
  onCancelTool,
  onToggleIndicator,
  onOpenIndicators,
  onRegisterExportPng,
}: TradingChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!onRegisterExportPng) return;
    onRegisterExportPng(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `kestrel-${instrument.symbol.replace('/', '-')}-${timeframe}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
    return () => onRegisterExportPng(null);
  }, [onRegisterExportPng, instrument.symbol, timeframe]);

  const [size, setSize] = useState({ width: 900, height: 520 });
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [visibleCount, setVisibleCount] = useState(85);
  const [rightOffset, setRightOffset] = useState(0);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredDrawingId, setHoveredDrawingId] = useState<string | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<HoveredHandleInfo | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; startOffset: number } | null>(null);

  const [pendingPoints, setPendingPoints] = useState<PendingPoint[]>([]);
  const [brushPoints, setBrushPoints] = useState<PendingPoint[] | null>(null);
  const [textDraft, setTextDraft] = useState<{
    tool: Exclude<DrawingTool, 'cursor'>;
    index: number;
    price: number;
    x: number;
    y: number;
    value: string;
  } | null>(null);

  // Anchor, Position Handle, or Body Dragging state
  const [dragState, setDragState] = useState<
    | {
        mode: 'anchor';
        drawingId: string;
        pointIndex: number;
      }
    | {
        mode: 'position_handle';
        drawingId: string;
        handle: PositionHandleKind;
        origPos: PositionDrawingData;
        startPt: PendingPoint;
      }
    | {
        mode: 'body';
        drawingId: string;
        startPt: PendingPoint;
        origPoints: PendingPoint[];
        origPos?: PositionDrawingData;
      }
    | null
  >(null);

  // Reset pending drawing when tool or symbol changes
  useEffect(() => {
    setPendingPoints([]);
    setBrushPoints(null);
    setTextDraft(null);
  }, [activeTool, instrument.symbol]);

  useEffect(() => {
    setRightOffset(0);
    setVisibleCount(85);
  }, [instrument.symbol, timeframe]);

  // Handle Chart Navigation Commands
  useEffect(() => {
    if (!navCommand) return;
    const maxOffset = Math.max(0, candles.length - visibleCount);
    if (navCommand.type === 'zoom_in') {
      setVisibleCount((prev) => Math.max(20, prev - 14));
    } else if (navCommand.type === 'zoom_out') {
      setVisibleCount((prev) => Math.min(candles.length, prev + 14));
    } else if (navCommand.type === 'scroll_left') {
      setRightOffset((prev) => Math.min(maxOffset, prev + 14));
    } else if (navCommand.type === 'scroll_right') {
      setRightOffset((prev) => Math.max(0, prev - 14));
    } else if (navCommand.type === 'reset') {
      setRightOffset(0);
      setVisibleCount(85);
    } else if (navCommand.type === 'fit') {
      setRightOffset(0);
      setVisibleCount(candles.length);
    } else if (navCommand.type === 'locate' && navCommand.targetIndex !== undefined) {
      const target = navCommand.targetIndex;
      const half = Math.floor(visibleCount / 2);
      const desiredEnd = Math.min(candles.length, Math.max(visibleCount, target + half));
      setRightOffset(Math.max(0, candles.length - desiredEnd));
    }
  }, [navCommand, candles.length, visibleCount]);

  // Enter finishes multi-point poly drawing; Escape cancels
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingPoints.length > 0 || brushPoints || textDraft) {
          setPendingPoints([]);
          setBrushPoints(null);
          setTextDraft(null);
        } else {
          onSelectDrawing(null);
          onCancelTool();
        }
      } else if (
        e.key === 'Enter' &&
        (activeTool === 'path' || activeTool === 'polyline') &&
        pendingPoints.length >= 2
      ) {
        const def = getDrawingToolDef(activeTool);
        onAddDrawing({
          symbol: instrument.symbol,
          tool: activeTool,
          category: def?.category ?? 'shapes',
          points: pendingPoints,
          color: def?.defaultColor ?? '#2962FF',
          lineWidth: 2,
          lineStyle: 'solid',
          opacity: 1,
          visible: true,
          locked: false,
        });
        setPendingPoints([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    pendingPoints,
    brushPoints,
    textDraft,
    activeTool,
    instrument.symbol,
    onAddDrawing,
    onSelectDrawing,
    onCancelTool,
  ]);

  // ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(300, Math.floor(entry.contentRect.width));
        const h = Math.max(260, Math.floor(entry.contentRect.height));
        setSize({ width: w, height: h });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const displayCandles = useMemo(() => {
    return chartStyle === 'heikin_ashi' ? calculateHeikinAshi(candles) : candles;
  }, [candles, chartStyle]);

  const closes = useMemo(() => displayCandles.map((c) => c.close), [displayCandles]);

  const indicatorSeries = useMemo(() => {
    const get = (id: IndicatorConfig['id']) => indicators.find((i) => i.id === id);
    const ema20Cfg = get('ema20');
    const ema50Cfg = get('ema50');
    const sma200Cfg = get('sma200');
    const bbCfg = get('bb');
    const keltnerCfg = get('keltner');
    const ichiCfg = get('ichimoku');
    const vpCfg = get('vp');
    const rsiCfg = get('rsi');
    const macdCfg = get('macd');
    const stochCfg = get('stoch');
    const cciCfg = get('cci');
    const atrCfg = get('atr');
    const obvCfg = get('obv');
    const volCfg = get('volume');

    return {
      ema20: ema20Cfg?.enabled ? { data: calculateEMA(closes, ema20Cfg.params.period ?? 20), color: ema20Cfg.color } : null,
      ema50: ema50Cfg?.enabled ? { data: calculateEMA(closes, ema50Cfg.params.period ?? 50), color: ema50Cfg.color } : null,
      sma200: sma200Cfg?.enabled ? { data: calculateSMA(closes, sma200Cfg.params.period ?? 100), color: sma200Cfg.color } : null,
      bb: bbCfg?.enabled
        ? {
            ...calculateBollingerBands(closes, bbCfg.params.period ?? 20, bbCfg.params.mult ?? 2),
            color: bbCfg.color,
          }
        : null,
      keltner: keltnerCfg?.enabled
        ? {
            ...calculateKeltnerChannels(
              displayCandles,
              keltnerCfg.params.period ?? 20,
              keltnerCfg.params.atrPeriod ?? 10,
              keltnerCfg.params.mult ?? 2
            ),
            color: keltnerCfg.color,
          }
        : null,
      ichimoku: ichiCfg?.enabled
        ? calculateIchimoku(
            displayCandles,
            ichiCfg.params.tenkan ?? 9,
            ichiCfg.params.kijun ?? 26,
            ichiCfg.params.senkouB ?? 52
          )
        : null,
      vpEnabled: Boolean(vpCfg?.enabled),
      vpColor: vpCfg?.color ?? '#2962FF',
      rsi: rsiCfg?.enabled ? { data: calculateRSI(closes, rsiCfg.params.period ?? 14), color: rsiCfg.color, period: rsiCfg.params.period ?? 14 } : null,
      macd: macdCfg?.enabled
        ? {
            ...calculateMACD(closes, macdCfg.params.fast ?? 12, macdCfg.params.slow ?? 26, macdCfg.params.signal ?? 9),
            color: macdCfg.color,
          }
        : null,
      stoch: stochCfg?.enabled
        ? {
            ...calculateStochastic(displayCandles, stochCfg.params.kPeriod ?? 14, stochCfg.params.dPeriod ?? 3),
            color: stochCfg.color,
          }
        : null,
      cci: cciCfg?.enabled
        ? { data: calculateCCI(displayCandles, cciCfg.params.period ?? 20), color: cciCfg.color, period: cciCfg.params.period ?? 20 }
        : null,
      atr: atrCfg?.enabled
        ? { data: calculateATR(displayCandles, atrCfg.params.period ?? 14), color: atrCfg.color, period: atrCfg.params.period ?? 14 }
        : null,
      obv: obvCfg?.enabled ? { data: calculateOBV(displayCandles), color: obvCfg.color } : null,
      volumeEnabled: volCfg?.enabled ?? false,
    };
  }, [closes, displayCandles, indicators]);

  // Viewport slice indices
  const totalBars = displayCandles.length;
  const endIndex = Math.max(visibleCount, totalBars - rightOffset);
  const startIndex = Math.max(0, endIndex - visibleCount);
  const actualCount = Math.max(1, endIndex - startIndex);

  const subPaneCount =
    (indicatorSeries.rsi ? 1 : 0) +
    (indicatorSeries.macd ? 1 : 0) +
    (indicatorSeries.stoch ? 1 : 0) +
    (indicatorSeries.cci ? 1 : 0) +
    (indicatorSeries.atr ? 1 : 0) +
    (indicatorSeries.obv ? 1 : 0);

  const priceAxisWidth = 76;
  const timeAxisHeight = 26;
  const topPad = 14;
  const plotWidth = Math.max(100, size.width - priceAxisWidth);
  const availableHeight = Math.max(120, size.height - timeAxisHeight - topPad);
  const subPaneHeight =
    subPaneCount > 0 ? Math.max(46, Math.min(76, Math.floor((availableHeight * 0.44) / subPaneCount))) : 0;
  const mainPaneHeight = Math.max(120, availableHeight - subPaneCount * (subPaneHeight + 6));

  const { minPrice, maxPrice } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = startIndex; i < endIndex; i++) {
      const c = displayCandles[i];
      if (!c) continue;
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (indicatorSeries.bb) {
        const up = indicatorSeries.bb.upper[i];
        const lo = indicatorSeries.bb.lower[i];
        if (up !== null && up > max) max = up;
        if (lo !== null && lo < min) min = lo;
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = instrument.price * 0.98;
      max = instrument.price * 1.02;
    }
    const pad = (max - min) * 0.09 || instrument.price * 0.01;
    return { minPrice: min - pad, maxPrice: max + pad };
  }, [displayCandles, startIndex, endIndex, indicatorSeries.bb, instrument.price]);

  const indexToX = (idx: number) => {
    const slotW = plotWidth / actualCount;
    return (idx - startIndex + 0.5) * slotW;
  };

  const xToIndex = (x: number) => {
    const slotW = plotWidth / actualCount;
    const raw = Math.floor(x / slotW) + startIndex;
    return Math.max(0, Math.min(totalBars - 1, raw));
  };

  const priceToY = (price: number) => {
    if (visualSettings.logScale && minPrice > 0 && price > 0) {
      const logMin = Math.log(minPrice);
      const logMax = Math.log(maxPrice);
      const ratio = (Math.log(price) - logMin) / (logMax - logMin || 1);
      return topPad + mainPaneHeight - ratio * mainPaneHeight;
    }
    const ratio = (price - minPrice) / (maxPrice - minPrice || 1);
    return topPad + mainPaneHeight - ratio * mainPaneHeight;
  };

  const yToPrice = (y: number) => {
    const clamped = Math.max(topPad, Math.min(topPad + mainPaneHeight, y));
    const ratio = (topPad + mainPaneHeight - clamped) / (mainPaneHeight || 1);
    if (visualSettings.logScale && minPrice > 0) {
      const logMin = Math.log(minPrice);
      const logMax = Math.log(maxPrice);
      return Math.exp(logMin + ratio * (logMax - logMin));
    }
    return minPrice + ratio * (maxPrice - minPrice);
  };

  const getChartPoint = (x: number, y: number): PendingPoint => {
    const idx = xToIndex(x);
    let price = yToPrice(y);
    if (magnetMode && displayCandles[idx]) {
      const c = displayCandles[idx];
      const candidates = [c.high, c.low, c.open, c.close];
      let bestPrice = price;
      let bestDist = Infinity;
      candidates.forEach((candPrice) => {
        const d = Math.abs(priceToY(candPrice) - y);
        if (d < bestDist) {
          bestDist = d;
          bestPrice = candPrice;
        }
      });
      if (bestDist <= 38) {
        price = bestPrice;
      }
    }
    return { index: idx, price };
  };

  const hoveredBarIndex = useMemo(() => {
    if (!hoverPos || hoverPos.x > plotWidth) return null;
    return xToIndex(hoverPos.x);
  }, [hoverPos, plotWidth, startIndex, actualCount]);

  useEffect(() => {
    if (!onHoverCandle) return;
    if (hoveredBarIndex === null || !displayCandles[hoveredBarIndex]) {
      onHoverCandle(null, null);
    } else {
      onHoverCandle(displayCandles[hoveredBarIndex], hoveredBarIndex);
    }
  }, [hoveredBarIndex, displayCandles, onHoverCandle]);

  const resolvePositionData = (d: Pick<ChartDrawing, 'tool' | 'points' | 'positionData'>): PositionDrawingData | null => {
    if (d.tool !== 'long_position' && d.tool !== 'short_position') return null;
    if (d.positionData) return d.positionData;
    const p0 = d.points[0];
    const p1 = d.points[1];
    if (!p0) return null;
    const isLong = d.tool === 'long_position';
    const meta = getInstrumentTickMeta(instrument);
    const span = Math.max(meta.pipSize * 10, (maxPrice - minPrice) * 0.12);
    const tp = p1
      ? isLong
        ? Math.max(p1.price, p0.price + span * 0.5)
        : Math.min(p1.price, p0.price - span * 0.5)
      : isLong
      ? p0.price + span
      : Math.max(0.0001, p0.price - span);
    const sl = isLong
      ? Math.max(0.0001, p0.price - Math.abs(tp - p0.price) * 0.5)
      : p0.price + Math.abs(p0.price - tp) * 0.5;
    const sIdx = p1 ? Math.min(p0.index, p1.index) : p0.index;
    const eIdx = p1 ? Math.max(sIdx + 10, Math.max(p0.index, p1.index)) : Math.min(totalBars - 1, sIdx + 14);
    return {
      entryPrice: p0.price,
      takeProfit: tp,
      stopLoss: sl,
      startIndex: sIdx,
      endIndex: eIdx,
      positionSize: meta.defaultPositionSize,
      profitColor: '#089981',
      lossColor: '#F23645',
      entryColor: '#2962FF',
    };
  };

  const getPositionHandles = (d: ChartDrawing): HoveredHandleInfo[] => {
    const pos = resolvePositionData(d);
    if (!pos) return [];
    const leftX = indexToX(pos.startIndex);
    const rightX = Math.max(leftX + 52, indexToX(pos.endIndex));
    const midX = (leftX + rightX) / 2;
    const entryY = priceToY(pos.entryPrice);
    const tpY = priceToY(pos.takeProfit);
    const slY = priceToY(pos.stopLoss);

    return [
      { drawingId: d.id, handle: 'tp', x: leftX, y: tpY, label: 'Take Profit' },
      { drawingId: d.id, handle: 'sl', x: leftX, y: slY, label: 'Stop Loss' },
      { drawingId: d.id, handle: 'left_time', x: leftX, y: entryY, label: 'Start Time' },
      { drawingId: d.id, handle: 'right_time', x: rightX, y: entryY, label: 'End Time' },
      { drawingId: d.id, handle: 'entry', x: midX, y: entryY, label: 'Entry Price' },
    ];
  };

  // Report selection bounds so Contextual Toolbar sits close to the selected object without covering it
  useEffect(() => {
    if (!onSelectionBoundsChange) return;
    if (!selectedDrawingId || hideAllDrawings) {
      onSelectionBoundsChange(null);
      return;
    }
    const sel = drawings.find((d) => d.id === selectedDrawingId);
    if (!sel || !isDrawingVisibleOnTimeframe(sel, timeframe) || sel.points.length === 0) {
      onSelectionBoundsChange(null);
      return;
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    if (sel.tool === 'long_position' || sel.tool === 'short_position') {
      const pos = resolvePositionData(sel);
      if (pos) {
        const lx = indexToX(pos.startIndex);
        const rx = Math.max(lx + 52, indexToX(pos.endIndex));
        const ty = priceToY(pos.takeProfit);
        const sy = priceToY(pos.stopLoss);
        const ey = priceToY(pos.entryPrice);
        minX = Math.min(lx, rx);
        maxX = Math.max(lx, rx);
        minY = Math.min(ty, sy, ey);
        maxY = Math.max(ty, sy, ey);
      }
    } else if (sel.tool === 'horizontal' || sel.tool === 'horizontal_ray') {
      const y0 = priceToY(sel.points[0].price);
      const x0 = sel.tool === 'horizontal' ? plotWidth * 0.25 : indexToX(sel.points[0].index);
      minX = x0;
      maxX = Math.min(plotWidth, x0 + 240);
      minY = y0 - 8;
      maxY = y0 + 8;
    } else {
      sel.points.forEach((pt) => {
        const ax = indexToX(pt.index);
        const ay = priceToY(pt.price);
        minX = Math.min(minX, ax);
        maxX = Math.max(maxX, ax);
        minY = Math.min(minY, ay);
        maxY = Math.max(maxY, ay);
      });
    }

    if (!Number.isFinite(minX)) {
      onSelectionBoundsChange(null);
      return;
    }
    onSelectionBoundsChange({
      left: minX,
      right: maxX,
      top: minY,
      bottom: maxY,
      containerWidth: size.width,
      containerHeight: size.height,
    });
  }, [
    selectedDrawingId,
    drawings,
    timeframe,
    hideAllDrawings,
    size.width,
    size.height,
    startIndex,
    endIndex,
    minPrice,
    maxPrice,
    onSelectionBoundsChange,
  ]);

  // Hit-testing for selecting & hovering drawings
  const hitTestDrawing = (px: number, py: number): string | null => {
    if (hideAllDrawings) return null;
    for (let i = drawings.length - 1; i >= 0; i--) {
      const d = drawings[i];
      if (!isDrawingVisibleOnTimeframe(d, timeframe) || d.points.length === 0) continue;

      if (d.tool === 'long_position' || d.tool === 'short_position') {
        const handles = getPositionHandles(d);
        for (const h of handles) {
          if (Math.hypot(px - h.x, py - h.y) <= 12) return d.id;
        }
        const pos = resolvePositionData(d);
        if (pos) {
          const lx = indexToX(pos.startIndex);
          const rx = Math.max(lx + 52, indexToX(pos.endIndex));
          const minY = Math.min(priceToY(pos.takeProfit), priceToY(pos.stopLoss), priceToY(pos.entryPrice)) - 6;
          const maxY = Math.max(priceToY(pos.takeProfit), priceToY(pos.stopLoss), priceToY(pos.entryPrice)) + 6;
          if (px >= lx - 6 && px <= rx + 6 && py >= minY && py <= maxY) return d.id;
        }
        continue;
      }

      // Anchor point quick hit
      for (const pt of d.points) {
        const ax = indexToX(pt.index);
        const ay = priceToY(pt.price);
        if (Math.hypot(px - ax, py - ay) <= 12) return d.id;
      }

      const p0 = d.points[0];
      const x0 = indexToX(p0.index);
      const y0 = priceToY(p0.price);

      if (d.tool === 'horizontal') {
        if (Math.abs(py - y0) <= 7) return d.id;
      } else if (d.tool === 'horizontal_ray') {
        if (Math.abs(py - y0) <= 7 && px >= x0 - 6) return d.id;
      } else if (d.tool === 'vertical') {
        if (Math.abs(px - x0) <= 7) return d.id;
      } else if (d.tool === 'cross_line') {
        if (Math.abs(px - x0) <= 7 || Math.abs(py - y0) <= 7) return d.id;
      } else if (d.points.length >= 2) {
        const p1 = d.points[1];
        const x1 = indexToX(p1.index);
        const y1 = priceToY(p1.price);

        if (
          d.tool === 'rectangle' ||
          d.tool === 'gann_box' ||
          d.tool === 'gann_square' ||
          d.tool === 'gann_square_fixed' ||
          d.tool === 'date_price_range' ||
          d.tool === 'measure' ||
          d.tool === 'fixed_range_vp'
        ) {
          const minX = Math.min(x0, x1) - 6;
          const maxX = Math.max(x0, x1) + 6;
          const minY = Math.min(y0, y1) - 6;
          const maxY = Math.max(y0, y1) + 6;
          if (px >= minX && px <= maxX && py >= minY && py <= maxY) return d.id;
        } else if (d.tool === 'circle' || d.tool === 'fib_circles') {
          const r = Math.hypot(x1 - x0, y1 - y0);
          if (Math.abs(Math.hypot(px - x0, py - y0) - r) <= 12) return d.id;
        } else {
          for (let k = 0; k < d.points.length - 1; k++) {
            const ax = indexToX(d.points[k].index);
            const ay = priceToY(d.points[k].price);
            const bx = indexToX(d.points[k + 1].index);
            const by = priceToY(d.points[k + 1].price);
            if (distToSegment(px, py, ax, ay, bx, by) <= 9) return d.id;
          }
        }
      } else {
        if (Math.hypot(px - x0, py - y0) <= 24) return d.id;
      }
    }
    return null;
  };

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(size.width * dpr);
    canvas.height = Math.floor(size.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const palette =
      theme === 'dark'
        ? {
            bg: '#0B0E11',
            grid: 'rgba(39, 49, 61, 0.72)',
            axisBorder: '#27313D',
            axisText: '#929EAD',
            crosshair: 'rgba(232, 237, 243, 0.35)',
            crosshairBadgeBg: '#1C2430',
            crosshairBadgeText: '#E8EDF3',
            up: '#089981',
            down: '#F23645',
            line: '#2962FF',
            compare: '#F0B90B',
            cardBg: '#171D26',
            cardText: '#E8EDF3',
          }
        : {
            bg: '#FFFFFF',
            grid: 'rgba(220, 225, 236, 0.85)',
            axisBorder: '#DCE1EC',
            axisText: '#626775',
            crosshair: 'rgba(19, 23, 34, 0.35)',
            crosshairBadgeBg: '#131722',
            crosshairBadgeText: '#FFFFFF',
            up: '#089981',
            down: '#F23645',
            line: '#2962FF',
            compare: '#D97706',
            cardBg: '#F4F6FA',
            cardText: '#131722',
          };

    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, size.width, size.height);

    // Grid & Y-axis labels
    const gridRows = 6;
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (let r = 0; r <= gridRows; r++) {
      const y = topPad + (mainPaneHeight / gridRows) * r;
      const priceAtY = yToPrice(y);

      if (visualSettings.showGrid) {
        ctx.strokeStyle = palette.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(plotWidth, Math.round(y) + 0.5);
        ctx.stroke();
      }

      ctx.fillStyle = palette.axisText;
      ctx.fillText(formatPrice(priceAtY, instrument.decimals), plotWidth + 8, y);
    }

    // Time grid & X-axis labels
    const xLabelEvery = Math.max(6, Math.floor(actualCount / 7));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = startIndex; i < endIndex; i++) {
      if ((i - startIndex) % xLabelEvery !== 0) continue;
      const x = indexToX(i);
      const c = displayCandles[i];
      if (!c) continue;

      if (visualSettings.showGrid) {
        ctx.strokeStyle = palette.grid;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, topPad);
        ctx.lineTo(Math.round(x) + 0.5, size.height - timeAxisHeight);
        ctx.stroke();
      }

      const label = formatChartTimestamp(
        c.time,
        timeframe,
        timezone,
        instrument.exchange,
        'axis'
      );
      ctx.fillStyle = palette.axisText;
      ctx.fillText(label, x, size.height - timeAxisHeight + 7);
    }

    // Volume Histogram
    if (visualSettings.showVolume && indicatorSeries.volumeEnabled) {
      let maxVol = 1;
      for (let i = startIndex; i < endIndex; i++) {
        if (displayCandles[i]?.volume > maxVol) maxVol = displayCandles[i].volume;
      }
      const volMaxH = mainPaneHeight * 0.18;
      const barW = Math.max(1.5, (plotWidth / actualCount) * 0.68);
      for (let i = startIndex; i < endIndex; i++) {
        const c = displayCandles[i];
        if (!c) continue;
        const x = indexToX(i);
        const h = (c.volume / maxVol) * volMaxH;
        const isUp = c.close >= c.open;
        ctx.fillStyle = isUp ? 'rgba(8, 153, 129, 0.25)' : 'rgba(242, 54, 69, 0.25)';
        ctx.fillRect(x - barW / 2, topPad + mainPaneHeight - h, barW, h);
      }
    }

    // Clip main price region
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, topPad, plotWidth, mainPaneHeight);
    ctx.clip();

    // Bollinger Bands & Keltner Channels & Ichimoku & Volume Profile
    if (indicatorSeries.bb) {
      const { upper, middle, lower, color } = indicatorSeries.bb;
      ctx.beginPath();
      let started = false;
      for (let i = startIndex; i < endIndex; i++) {
        const val = upper[i];
        if (val === null) continue;
        const x = indexToX(i);
        const y = priceToY(val);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      for (let i = endIndex - 1; i >= startIndex; i--) {
        const val = lower[i];
        if (val === null) continue;
        ctx.lineTo(indexToX(i), priceToY(val));
      }
      ctx.closePath();
      ctx.fillStyle = hexToRgba(color, 0.08);
      ctx.fill();

      const drawBandLine = (arr: (number | null)[], stroke: string) => {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        let active = false;
        for (let i = startIndex; i < endIndex; i++) {
          const v = arr[i];
          if (v === null) continue;
          const x = indexToX(i);
          const y = priceToY(v);
          if (!active) {
            ctx.moveTo(x, y);
            active = true;
          } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      drawBandLine(upper, hexToRgba(color, 0.6));
      drawBandLine(middle, hexToRgba(color, 0.9));
      drawBandLine(lower, hexToRgba(color, 0.6));
    }

    if (indicatorSeries.keltner) {
      const { upper, middle, lower, color } = indicatorSeries.keltner;
      const drawKC = (arr: (number | null)[], dashed: boolean) => {
        ctx.save();
        ctx.strokeStyle = hexToRgba(color, dashed ? 0.72 : 0.92);
        ctx.lineWidth = 1.25;
        if (dashed) ctx.setLineDash([4, 3]);
        ctx.beginPath();
        let active = false;
        for (let i = startIndex; i < endIndex; i++) {
          const v = arr[i];
          if (v === null) continue;
          const x = indexToX(i);
          const y = priceToY(v);
          if (!active) {
            ctx.moveTo(x, y);
            active = true;
          } else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      };
      drawKC(upper, true);
      drawKC(middle, false);
      drawKC(lower, true);
    }

    if (indicatorSeries.ichimoku) {
      const { tenkan, kijun, senkouA, senkouB } = indicatorSeries.ichimoku;
      for (let i = startIndex; i < endIndex - 1; i++) {
        const a0 = senkouA[i];
        const b0 = senkouB[i];
        const a1 = senkouA[i + 1];
        const b1 = senkouB[i + 1];
        if (a0 === null || b0 === null || a1 === null || b1 === null) continue;
        ctx.fillStyle = a0 >= b0 ? 'rgba(8, 153, 129, 0.14)' : 'rgba(242, 54, 69, 0.14)';
        ctx.beginPath();
        ctx.moveTo(indexToX(i), priceToY(a0));
        ctx.lineTo(indexToX(i + 1), priceToY(a1));
        ctx.lineTo(indexToX(i + 1), priceToY(b1));
        ctx.lineTo(indexToX(i), priceToY(b0));
        ctx.closePath();
        ctx.fill();
      }
      const drawIchi = (arr: (number | null)[], stroke: string) => {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        let active = false;
        for (let i = startIndex; i < endIndex; i++) {
          const v = arr[i];
          if (v === null) continue;
          const x = indexToX(i);
          const y = priceToY(v);
          if (!active) {
            ctx.moveTo(x, y);
            active = true;
          } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      drawIchi(tenkan, '#2962FF');
      drawIchi(kijun, '#F23645');
    }

    if (indicatorSeries.vpEnabled) {
      const bins = calculateVolumeProfile(displayCandles, startIndex, endIndex, 18);
      const maxBinVol = Math.max(1, ...bins.map((b) => b.volume));
      const maxBarW = Math.min(110, plotWidth * 0.18);
      bins.forEach((b) => {
        const yTop = priceToY(b.priceHigh);
        const yBot = priceToY(b.priceLow);
        const h = Math.max(2, Math.abs(yBot - yTop) - 1);
        const w = (b.volume / maxBinVol) * maxBarW;
        ctx.fillStyle = b.isPoc ? 'rgba(240, 185, 11, 0.42)' : hexToRgba(indicatorSeries.vpColor, 0.22);
        ctx.fillRect(plotWidth - w, Math.min(yTop, yBot), w, h);
      });
    }

    // Candles / Hollow / Line / Area
    const slotW = plotWidth / actualCount;
    const candleW = Math.max(2, Math.min(18, slotW * 0.68));

    if (chartStyle === 'line' || chartStyle === 'area') {
      ctx.beginPath();
      for (let i = startIndex; i < endIndex; i++) {
        const c = displayCandles[i];
        if (!c) continue;
        const x = indexToX(i);
        const y = priceToY(c.close);
        if (i === startIndex) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = palette.line;
      ctx.lineWidth = 2;
      ctx.stroke();

      if (chartStyle === 'area') {
        const lastX = indexToX(endIndex - 1);
        const firstX = indexToX(startIndex);
        ctx.lineTo(lastX, topPad + mainPaneHeight);
        ctx.lineTo(firstX, topPad + mainPaneHeight);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, topPad, 0, topPad + mainPaneHeight);
        grad.addColorStop(0, 'rgba(41, 98, 255, 0.28)');
        grad.addColorStop(1, 'rgba(41, 98, 255, 0.01)');
        ctx.fillStyle = grad;
        ctx.fill();
      }
    } else {
      for (let i = startIndex; i < endIndex; i++) {
        const c = displayCandles[i];
        if (!c) continue;
        const x = indexToX(i);
        const yOpen = priceToY(c.open);
        const yClose = priceToY(c.close);
        const yHigh = priceToY(c.high);
        const yLow = priceToY(c.low);
        const isUp = c.close >= c.open;
        const color = isUp ? palette.up : palette.down;

        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, yHigh);
        ctx.lineTo(Math.round(x) + 0.5, yLow);
        ctx.stroke();

        const bodyTop = Math.min(yOpen, yClose);
        const bodyH = Math.max(1.5, Math.abs(yClose - yOpen));
        if (chartStyle === 'hollow' && isUp) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.25;
          ctx.strokeRect(x - candleW / 2, bodyTop, candleW, bodyH);
        } else {
          ctx.fillStyle = color;
          ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
        }
      }
    }

    // Moving Averages
    const drawMA = (series: { data: (number | null)[]; color: string } | null) => {
      if (!series) return;
      ctx.strokeStyle = series.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      for (let i = startIndex; i < endIndex; i++) {
        const val = series.data[i];
        if (val === null) continue;
        const x = indexToX(i);
        const y = priceToY(val);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    drawMA(indicatorSeries.ema20);
    drawMA(indicatorSeries.ema50);
    drawMA(indicatorSeries.sma200);

    // Compare Instrument
    if (compareInstrument && compareCandles && compareCandles.length === displayCandles.length) {
      const baseMain = displayCandles[startIndex]?.close || 1;
      const baseComp = compareCandles[startIndex]?.close || 1;
      ctx.strokeStyle = palette.compare;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      for (let i = startIndex; i < endIndex; i++) {
        const compPrice = compareCandles[i]?.close;
        if (!compPrice) continue;
        const scaledPrice = (compPrice / baseComp) * baseMain;
        const x = indexToX(i);
        const y = priceToY(scaledPrice);
        if (i === startIndex) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Current Price Line
    const latestCandle = displayCandles[displayCandles.length - 1];
    if (visualSettings.showPriceLine && latestCandle) {
      const yCur = priceToY(latestCandle.close);
      const isUp = latestCandle.close >= latestCandle.open;
      const lineColor = isUp ? palette.up : palette.down;
      ctx.save();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(0, Math.round(yCur) + 0.5);
      ctx.lineTo(plotWidth, Math.round(yCur) + 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // Comprehensive Drawing Renderer (Categories A - J)
    const drawArrowHead = (x1: number, y1: number, x2: number, y2: number, color: string, sizePx = 9) => {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - sizePx * Math.cos(angle - Math.PI / 6), y2 - sizePx * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(x2 - sizePx * Math.cos(angle + Math.PI / 6), y2 - sizePx * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const drawLabelPill = (text: string, bx: number, by: number, bg: string, fg = '#FFFFFF') => {
      ctx.save();
      ctx.font = '10px "IBM Plex Mono", monospace';
      const w = ctx.measureText(text).width + 12;
      const clampedX = Math.max(4, Math.min(plotWidth - w - 4, bx));
      const clampedY = Math.max(topPad + 4, Math.min(topPad + mainPaneHeight - 22, by));
      ctx.fillStyle = bg;
      ctx.fillRect(clampedX, clampedY, w, 18);
      ctx.fillStyle = fg;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, clampedX + 6, clampedY + 9);
      ctx.restore();
    };

    const renderDrawing = (
      d: Partial<ChartDrawing> & {
        tool: Exclude<DrawingTool, 'cursor'>;
        points: { index: number; price: number }[];
        color: string;
        lineWidth: number;
        lineStyle: LineStyle;
        opacity: number;
      },
      isSelected = false,
      isHovered = false,
      isDraft = false
    ) => {
      if (d.points.length === 0) return;
      ctx.save();
      const alpha = isDraft ? 0.85 : d.opacity ?? 1;
      const strokeColor = hexToRgba(d.color, alpha);
      const baseFillHex = d.fillColor || d.color;
      const fillAlpha = d.fillOpacity !== undefined ? d.fillOpacity : Math.max(0.08, alpha * 0.14);
      const fillColor = hexToRgba(baseFillHex, fillAlpha);
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = strokeColor;
      ctx.lineWidth = (d.lineWidth || 1.5) + (isHovered && !isSelected ? 0.8 : 0);
      applyLineStyle(ctx, d.lineStyle || 'solid');

      const p0 = d.points[0];
      const p1 = d.points[1];
      const p2 = d.points[2];
      const x0 = indexToX(p0.index);
      const y0 = priceToY(p0.price);
      const x1 = p1 ? indexToX(p1.index) : x0;
      const y1 = p1 ? priceToY(p1.price) : y0;
      const x2 = p2 ? indexToX(p2.index) : x1;
      const y2 = p2 ? priceToY(p2.price) : y1;

      switch (d.tool) {
        // --- CATEGORY A: LINES ---
        case 'horizontal': {
          ctx.beginPath();
          ctx.moveTo(0, y0);
          ctx.lineTo(plotWidth, y0);
          ctx.stroke();
          break;
        }
        case 'horizontal_ray': {
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(plotWidth, y0);
          ctx.stroke();
          break;
        }
        case 'vertical': {
          ctx.beginPath();
          ctx.moveTo(x0, topPad);
          ctx.lineTo(x0, topPad + mainPaneHeight);
          ctx.stroke();
          break;
        }
        case 'cross_line': {
          ctx.beginPath();
          ctx.moveTo(0, y0);
          ctx.lineTo(plotWidth, y0);
          ctx.moveTo(x0, topPad);
          ctx.lineTo(x0, topPad + mainPaneHeight);
          ctx.stroke();
          break;
        }
        case 'trendline':
        case 'ray':
        case 'extended_line':
        case 'info_line':
        case 'trend_angle': {
          if (!p1) break;
          let sx = x0;
          let sy = y0;
          let ex = x1;
          let ey = y1;
          const dx = x1 - x0;
          const dy = y1 - y0;
          if (Math.abs(dx) > 0.5) {
            const slope = dy / dx;
            if (d.tool === 'extended_line' || (d.extendLeft && d.extendRight)) {
              sx = 0;
              sy = y0 + slope * (0 - x0);
              ex = plotWidth;
              ey = y0 + slope * (plotWidth - x0);
            } else {
              if (d.extendLeft) {
                const targetX = dx >= 0 ? 0 : plotWidth;
                sx = targetX;
                sy = y0 + slope * (targetX - x0);
              }
              if (d.tool === 'ray' || d.extendRight) {
                const targetX = dx >= 0 ? plotWidth : 0;
                ex = targetX;
                ey = y0 + slope * (targetX - x0);
              }
            }
          }
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          if (d.tool === 'info_line') {
            const delta = p1.price - p0.price;
            const pct = (delta / (p0.price || 1)) * 100;
            const bars = Math.abs(p1.index - p0.index);
            const deg = (Math.atan2(-(y1 - y0), x1 - x0) * 180) / Math.PI;
            drawLabelPill(
              `${delta >= 0 ? '+' : ''}${formatPrice(delta, instrument.decimals)} (${pct.toFixed(2)}%) · ${bars}b · ${deg.toFixed(1)}°`,
              (x0 + x1) / 2 - 50,
              (y0 + y1) / 2 - 22,
              d.color
            );
          } else if (d.tool === 'trend_angle') {
            const deg = (Math.atan2(-(y1 - y0), x1 - x0) * 180) / Math.PI;
            ctx.save();
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x0 + 55, y0);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x0, y0, 26, Math.min(0, -deg * (Math.PI / 180)), Math.max(0, -deg * (Math.PI / 180)));
            ctx.stroke();
            ctx.restore();
            drawLabelPill(`${deg.toFixed(1)}°`, x0 + 32, y0 - 20, d.color);
          }
          break;
        }

        // --- CATEGORY B: CHANNELS ---
        case 'parallel_channel': {
          if (!p1) break;
          const offsetY = p2 ? y2 - (y0 + ((y1 - y0) / (x1 - x0 || 1)) * (x2 - x0)) : -48;
          ctx.fillStyle = fillColor;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.lineTo(x1, y1 + offsetY);
          ctx.lineTo(x0, y0 + offsetY);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.moveTo(x0, y0 + offsetY);
          ctx.lineTo(x1, y1 + offsetY);
          ctx.stroke();

          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(x0, y0 + offsetY / 2);
          ctx.lineTo(x1, y1 + offsetY / 2);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'regression_trend': {
          if (!p1) break;
          const sIdx = Math.min(p0.index, p1.index);
          const eIdx = Math.max(p0.index, p1.index);
          const n = Math.max(2, eIdx - sIdx + 1);
          let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
          for (let i = 0; i < n; i++) {
            const c = displayCandles[sIdx + i];
            if (!c) continue;
            sumX += i;
            sumY += c.close;
            sumXY += i * c.close;
            sumX2 += i * i;
          }
          const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1);
          const intercept = (sumY - slope * sumX) / n;
          let sqErr = 0;
          for (let i = 0; i < n; i++) {
            const c = displayCandles[sIdx + i];
            if (!c) continue;
            const pred = intercept + slope * i;
            sqErr += (c.close - pred) ** 2;
          }
          const std = Math.sqrt(sqErr / n) * 2;
          const rx0 = indexToX(sIdx);
          const rx1 = indexToX(eIdx);
          const ry0 = priceToY(intercept);
          const ry1 = priceToY(intercept + slope * (n - 1));
          const ry0Up = priceToY(intercept + std);
          const ry1Up = priceToY(intercept + slope * (n - 1) + std);
          const ry0Lo = priceToY(intercept - std);
          const ry1Lo = priceToY(intercept + slope * (n - 1) - std);

          ctx.fillStyle = fillColor;
          ctx.beginPath();
          ctx.moveTo(rx0, ry0Up);
          ctx.lineTo(rx1, ry1Up);
          ctx.lineTo(rx1, ry1Lo);
          ctx.lineTo(rx0, ry0Lo);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(rx0, ry0Up);
          ctx.lineTo(rx1, ry1Up);
          ctx.moveTo(rx0, ry0Lo);
          ctx.lineTo(rx1, ry1Lo);
          ctx.stroke();

          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(rx0, ry0);
          ctx.lineTo(rx1, ry1);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'flat_top_bottom': {
          if (!p1) break;
          const flatY = p2 ? y2 : Math.min(y0, y1) - 40;
          ctx.fillStyle = fillColor;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.lineTo(x1, flatY);
          ctx.lineTo(x0, flatY);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.moveTo(x0, flatY);
          ctx.lineTo(x1, flatY);
          ctx.stroke();
          break;
        }
        case 'disjoint_channel': {
          if (!p1) break;
          const dyBase = y1 - y0;
          const offsetY = p2 ? y2 - y0 : -50;
          ctx.fillStyle = fillColor;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.lineTo(x1, y0 + offsetY - dyBase);
          ctx.lineTo(x0, y0 + offsetY);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.moveTo(x0, y0 + offsetY);
          ctx.lineTo(x1, y0 + offsetY - dyBase);
          ctx.stroke();
          break;
        }

        // --- CATEGORY C: PITCHFORKS ---
        case 'pitchfork':
        case 'schiff_pitchfork':
        case 'modified_schiff_pitchfork': {
          if (!p1) break;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          let origX = x0;
          let origY = y0;
          if (d.tool === 'schiff_pitchfork') {
            origY = (y0 + y1) / 2;
          } else if (d.tool === 'modified_schiff_pitchfork') {
            origX = (x0 + x1) / 2;
            origY = (y0 + y1) / 2;
          }
          const dx = midX - origX || 1;
          const dy = midY - origY;
          const extX = plotWidth;
          const slope = dy / dx;
          const endMidY = origY + slope * (extX - origX);
          const off1X = x1 - midX;
          const off1Y = y1 - midY;
          const off2X = x2 - midX;
          const off2Y = y2 - midY;

          ctx.fillStyle = fillColor;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(extX + off1X, endMidY + off1Y);
          ctx.lineTo(extX + off2X, endMidY + off2Y);
          ctx.lineTo(x2, y2);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(origX, origY);
          ctx.lineTo(extX, endMidY);
          ctx.moveTo(x1, y1);
          ctx.lineTo(extX + off1X, endMidY + off1Y);
          ctx.moveTo(x2, y2);
          ctx.lineTo(extX + off2X, endMidY + off2Y);
          ctx.stroke();
          break;
        }

        // --- CATEGORY D: FIBONACCI TOOLS ---
        case 'fibonacci': {
          if (!p1) break;
          const levels = d.fibLevels ?? DEFAULT_FIB_LEVELS;
          const xStart = Math.min(x0, x1);
          const xEnd = Math.max(x0, x1, xStart + 130);
          const diff = p1.price - p0.price;
          ctx.font = '10px "IBM Plex Mono", monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';

          levels
            .filter((l) => l.enabled)
            .forEach((lvl) => {
              const lvlPrice = p1.price - diff * lvl.ratio;
              const y = priceToY(lvlPrice);
              ctx.strokeStyle = hexToRgba(lvl.color, alpha);
              ctx.beginPath();
              ctx.moveTo(xStart, y);
              ctx.lineTo(Math.min(plotWidth, xEnd), y);
              ctx.stroke();
              if (d.showLabels ?? true) {
                ctx.fillStyle = hexToRgba(lvl.color, alpha);
                ctx.fillText(
                  `${(lvl.ratio * 100).toFixed(1)}% (${formatPrice(lvlPrice, instrument.decimals)})`,
                  xStart + 4,
                  y - 2
                );
              }
            });
          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = strokeColor;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'fib_extension': {
          if (!p1) break;
          const leg = p1.price - p0.price;
          const anchorPrice = p2 ? p2.price : p1.price;
          const anchorX = p2 ? x2 : x1;
          const xEnd = Math.min(plotWidth, Math.max(anchorX + 140, x1 + 80));
          const extRatios = [0, 0.382, 0.618, 1.0, 1.618, 2.618];
          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          if (p2) ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.restore();
          ctx.font = '10px "IBM Plex Mono", monospace';
          extRatios.forEach((r) => {
            const p = anchorPrice + leg * r;
            const y = priceToY(p);
            ctx.beginPath();
            ctx.moveTo(anchorX, y);
            ctx.lineTo(xEnd, y);
            ctx.stroke();
            ctx.fillText(`${r.toFixed(3)} (${formatPrice(p, instrument.decimals)})`, anchorX + 4, y - 3);
          });
          break;
        }
        case 'fib_channel': {
          if (!p1) break;
          const offsetY = p2 ? y2 - y0 : -60;
          [0, 0.382, 0.5, 0.618, 1].forEach((r) => {
            ctx.beginPath();
            ctx.moveTo(x0, y0 + offsetY * r);
            ctx.lineTo(x1, y1 + offsetY * r);
            ctx.stroke();
          });
          break;
        }
        case 'fib_time_zone':
        case 'trend_fib_time': {
          const span = Math.max(1, Math.abs(x1 - x0) || slotW * 3);
          const seq = [0, 1, 2, 3, 5, 8, 13, 21, 34];
          ctx.font = '10px "IBM Plex Mono", monospace';
          seq.forEach((f) => {
            const fx = x0 + f * span;
            if (fx > plotWidth) return;
            ctx.beginPath();
            ctx.moveTo(fx, topPad);
            ctx.lineTo(fx, topPad + mainPaneHeight);
            ctx.stroke();
            ctx.fillText(String(f), fx + 3, topPad + 14);
          });
          break;
        }
        case 'fib_speed_resistance':
        case 'fib_fan': {
          if (!p1) break;
          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
          ctx.restore();
          [0.382, 0.5, 0.618].forEach((r) => {
            const targetY = y0 + (y1 - y0) * r;
            const slope = (targetY - y0) / (x1 - x0 || 1);
            const extX = x1 >= x0 ? plotWidth : 0;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(extX, y0 + slope * (extX - x0));
            ctx.stroke();
          });
          break;
        }
        case 'fib_circles': {
          if (!p1) break;
          const rad = Math.max(8, Math.hypot(x1 - x0, y1 - y0));
          [0.382, 0.5, 0.618, 1, 1.618].forEach((r) => {
            ctx.beginPath();
            ctx.arc(x0, y0, rad * r, 0, Math.PI * 2);
            ctx.stroke();
          });
          break;
        }
        case 'fib_spirals': {
          if (!p1) break;
          const maxR = Math.max(20, Math.hypot(x1 - x0, y1 - y0));
          ctx.beginPath();
          for (let a = 0; a <= Math.PI * 6; a += 0.1) {
            const r = (a / (Math.PI * 6)) * maxR;
            const sx = x0 + Math.cos(a) * r;
            const sy = y0 + Math.sin(a) * r;
            if (a === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.stroke();
          break;
        }
        case 'fib_wedge': {
          if (!p1) break;
          const rad = Math.max(12, Math.hypot(x1 - x0, y1 - y0));
          const baseAng = Math.atan2(y1 - y0, x1 - x0);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.moveTo(x0, y0);
          ctx.lineTo(x0 + Math.cos(baseAng + 0.6) * rad, y0 + Math.sin(baseAng + 0.6) * rad);
          ctx.stroke();
          [0.382, 0.618, 1].forEach((r) => {
            ctx.beginPath();
            ctx.arc(x0, y0, rad * r, baseAng, baseAng + 0.6);
            ctx.stroke();
          });
          break;
        }

        // --- CATEGORY E: GANN TOOLS ---
        case 'gann_box':
        case 'gann_square':
        case 'gann_square_fixed': {
          if (!p1) break;
          const gx = Math.min(x0, x1);
          const gy = Math.min(y0, y1);
          const gw = Math.abs(x1 - x0);
          const gh = d.tool === 'gann_square_fixed' ? gw : Math.abs(y1 - y0);
          ctx.fillStyle = fillColor;
          ctx.fillRect(gx, gy, gw, gh);
          ctx.strokeRect(gx, gy, gw, gh);
          [0.25, 0.5, 0.75].forEach((r) => {
            ctx.beginPath();
            ctx.moveTo(gx, gy + gh * r);
            ctx.lineTo(gx + gw, gy + gh * r);
            ctx.moveTo(gx + gw * r, gy);
            ctx.lineTo(gx + gw * r, gy + gh);
            ctx.stroke();
          });
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx + gw, gy + gh);
          ctx.moveTo(gx, gy + gh);
          ctx.lineTo(gx + gw, gy);
          ctx.stroke();
          break;
        }

        // --- CATEGORY F: FORECASTING (INDEPENDENT TP/SL/ENTRY, TRADINGVIEW-STYLE LONG & SHORT) ---
        case 'long_position':
        case 'short_position': {
          const pos = resolvePositionData(d);
          if (!pos) break;
          const isLong = d.tool === 'long_position';
          const left = indexToX(pos.startIndex);
          const right = Math.max(left + 52, indexToX(pos.endIndex));
          const width = right - left;
          const centerX = left + width / 2;
          const entryY = priceToY(pos.entryPrice);
          const tpY = priceToY(pos.takeProfit);
          const slY = priceToY(pos.stopLoss);
          const zoneAlpha = Math.max(0.16, alpha * 0.25);

          // Dashed vertical time-boundary guides when selected or hovered (matches TradingView reference)
          if (isSelected || isHovered) {
            ctx.save();
            ctx.strokeStyle = hexToRgba(pos.entryColor, 0.55);
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(left, topPad);
            ctx.lineTo(left, topPad + mainPaneHeight);
            ctx.moveTo(right, topPad);
            ctx.lineTo(right, topPad + mainPaneHeight);
            ctx.stroke();
            ctx.restore();
          }

          // Profit Zone (Entry -> Take Profit)
          ctx.fillStyle = hexToRgba(pos.profitColor, zoneAlpha);
          ctx.fillRect(left, Math.min(entryY, tpY), width, Math.abs(tpY - entryY));

          // Loss Zone (Entry -> Stop Loss)
          ctx.fillStyle = hexToRgba(pos.lossColor, zoneAlpha);
          ctx.fillRect(left, Math.min(entryY, slY), width, Math.abs(slY - entryY));

          // Clean entry horizontal divider line
          ctx.save();
          ctx.strokeStyle = hexToRgba(pos.entryColor, isHovered || isSelected ? 0.95 : 0.75);
          ctx.lineWidth = Math.max(1.4, d.lineWidth || 1.5);
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(left, entryY);
          ctx.lineTo(right, entryY);
          ctx.stroke();
          ctx.restore();

          // Sleek attached Target / Open PnL & R:R / Stop callout banners when selected, hovered, or drafting
          if (isSelected || isHovered || isDraft) {
            const metrics = computePositionMetrics(isLong, pos, instrument);
            const liveMarket = latestCandle?.close ?? instrument.price;
            const openPnl =
              (isLong ? liveMarket - pos.entryPrice : pos.entryPrice - liveMarket) *
              pos.positionSize;

            const drawBanner = (
              lines: string[],
              anchorCenterX: number,
              boxY: number,
              bgColor: string,
              borderColor?: string
            ) => {
              ctx.save();
              ctx.font = '600 10.5px "Plus Jakarta Sans", sans-serif';
              const maxTextW = Math.max(...lines.map((ln) => ctx.measureText(ln).width));
              const pillW = maxTextW + 16;
              const lineH = 14;
              const pillH = lines.length * lineH + 8;
              const px = Math.max(4, Math.min(plotWidth - pillW - 4, anchorCenterX - pillW / 2));
              const py = Math.max(topPad + 3, Math.min(topPad + mainPaneHeight - pillH - 3, boxY));

              ctx.fillStyle = bgColor;
              ctx.beginPath();
              ctx.roundRect(px, py, pillW, pillH, 3);
              ctx.fill();
              if (borderColor) {
                ctx.strokeStyle = borderColor;
                ctx.lineWidth = 1;
                ctx.stroke();
              }

              ctx.fillStyle = '#FFFFFF';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              lines.forEach((ln, idx) => {
                ctx.fillText(ln, px + pillW / 2, py + 4 + lineH * (idx + 0.5));
              });
              ctx.restore();
            };

            const tpLabel = `Target: ${formatPrice(metrics.rewardDistance, instrument.decimals)} (${metrics.profitPct.toFixed(2)}%) ${formatMetricNumber(metrics.rewardPips)}, Amount: ${formatMetricNumber(metrics.rewardAmount)}`;
            const slLabel = `Stop: ${formatPrice(metrics.riskDistance, instrument.decimals)} (${metrics.lossPct.toFixed(2)}%) ${formatMetricNumber(metrics.riskPips)}, Amount: ${formatMetricNumber(metrics.riskAmount)}`;
            const midLines = [
              `Open PnL: ${openPnl >= 0 ? '' : '-'}${formatMetricNumber(Math.abs(openPnl))}, Qty: ${formatMetricNumber(pos.positionSize)}`,
              `Risk/reward ratio: ${metrics.rrRatio.toFixed(2)}`,
            ];

            // Target banner sits outside the profit edge (above for Long, below for Short)
            const tpBannerY = isLong ? tpY - 26 : tpY + 6;
            drawBanner([tpLabel], centerX, tpBannerY, pos.profitColor);

            // Middle PnL + Qty + R:R banner sits cleanly on the profit side of the entry line
            const midBannerY = isLong ? entryY - 40 : entryY + 6;
            drawBanner(midLines, centerX, midBannerY, pos.entryColor);

            // Stop banner sits outside the stop edge (below for Long, above for Short)
            const slBannerY = isLong ? slY + 6 : slY - 26;
            drawBanner(
              [slLabel],
              centerX,
              slBannerY,
              theme === 'dark' ? '#1E222D' : '#131722',
              pos.lossColor
            );
          }
          break;
        }
        case 'bar_pattern': {
          if (!p1) break;
          const sIdx = Math.min(p0.index, p1.index);
          const eIdx = Math.max(p0.index, p1.index);
          const count = Math.max(2, eIdx - sIdx + 1);
          const baseOpen = displayCandles[sIdx]?.open || p0.price;
          const anchorEndX = eIdx + 2;
          ctx.save();
          ctx.strokeStyle = strokeColor;
          ctx.fillStyle = fillColor;
          for (let k = 0; k < count; k++) {
            const c = displayCandles[sIdx + k];
            if (!c) continue;
            const px = indexToX(anchorEndX + k);
            if (px > plotWidth) break;
            const dyOpen = priceToY(c.open) - priceToY(baseOpen);
            const dyClose = priceToY(c.close) - priceToY(baseOpen);
            const dyHigh = priceToY(c.high) - priceToY(baseOpen);
            const dyLow = priceToY(c.low) - priceToY(baseOpen);
            ctx.beginPath();
            ctx.moveTo(px, y1 + dyHigh);
            ctx.lineTo(px, y1 + dyLow);
            ctx.stroke();
            ctx.fillRect(px - candleW * 0.4, y1 + Math.min(dyOpen, dyClose), candleW * 0.8, Math.max(2, Math.abs(dyClose - dyOpen)));
          }
          ctx.restore();
          break;
        }
        case 'ghost_feed': {
          if (!p1) break;
          const steps = Math.max(4, Math.min(20, Math.abs(p1.index - p0.index) || 8));
          for (let k = 0; k <= steps; k++) {
            const t = k / steps;
            const gx = x0 + (x1 - x0) * t;
            const wave = Math.sin(k * 1.4) * 14;
            const gy = y0 + (y1 - y0) * t + wave;
            ctx.fillStyle = k % 2 === 0 ? 'rgba(8,153,129,0.4)' : 'rgba(242,54,69,0.4)';
            ctx.fillRect(gx - 3, gy - 7, 6, 14);
          }
          break;
        }
        case 'projection': {
          if (!p1) break;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.quadraticCurveTo(x1, y1, p2 ? x2 : x1 + 40, p2 ? y2 : y1);
          ctx.stroke();
          if (p2) drawArrowHead(x1, y1, x2, y2, strokeColor);
          break;
        }

        // --- CATEGORY G: VOLUME-BASED TOOLS ---
        case 'anchored_vwap': {
          let cumPV = 0;
          let cumV = 0;
          ctx.beginPath();
          let started = false;
          for (let i = p0.index; i < displayCandles.length; i++) {
            const c = displayCandles[i];
            if (!c) continue;
            const tp = (c.high + c.low + c.close) / 3;
            cumPV += tp * c.volume;
            cumV += c.volume;
            const vwap = cumPV / (cumV || 1);
            if (i >= startIndex && i < endIndex) {
              const vx = indexToX(i);
              const vy = priceToY(vwap);
              if (!started) {
                ctx.moveTo(vx, vy);
                started = true;
              } else ctx.lineTo(vx, vy);
            }
          }
          ctx.stroke();
          drawLabelPill('AVWAP', x0 + 4, y0 - 18, d.color);
          break;
        }
        case 'fixed_range_vp':
        case 'anchored_vp': {
          const sIdx = p0.index;
          const eIdx = d.tool === 'fixed_range_vp' && p1 ? Math.max(sIdx + 1, p1.index) : displayCandles.length - 1;
          const leftIdx = Math.min(sIdx, eIdx);
          const rightIdx = Math.max(sIdx, eIdx);
          const buckets = 18;
          let lo = Infinity;
          let hi = -Infinity;
          for (let i = leftIdx; i <= rightIdx; i++) {
            const c = displayCandles[i];
            if (!c) continue;
            lo = Math.min(lo, c.low);
            hi = Math.max(hi, c.high);
          }
          if (!Number.isFinite(lo) || hi <= lo) break;
          const vols = new Array(buckets).fill(0);
          for (let i = leftIdx; i <= rightIdx; i++) {
            const c = displayCandles[i];
            if (!c) continue;
            const b = Math.min(buckets - 1, Math.floor(((c.close - lo) / (hi - lo)) * buckets));
            vols[b] += c.volume;
          }
          const maxV = Math.max(...vols, 1);
          const pocIdx = vols.indexOf(maxV);
          const boxLeft = indexToX(leftIdx);
          const boxRight = indexToX(rightIdx);
          const profileW = Math.max(48, Math.min(140, (boxRight - boxLeft) * 0.55));
          const topY = priceToY(hi);
          const botY = priceToY(lo);
          const rowH = Math.max(2, (botY - topY) / buckets);

          vols.forEach((v, b) => {
            const y = botY - (b + 1) * rowH;
            const w = (v / maxV) * profileW;
            ctx.fillStyle = b === pocIdx ? 'rgba(240, 185, 11, 0.72)' : hexToRgba(d.color, 0.35);
            ctx.fillRect(boxLeft, y, w, Math.max(1.5, rowH - 1));
          });
          const pocY = botY - (pocIdx + 0.5) * rowH;
          ctx.strokeStyle = '#F0B90B';
          ctx.beginPath();
          ctx.moveTo(boxLeft, pocY);
          ctx.lineTo(Math.max(boxRight, boxLeft + profileW), pocY);
          ctx.stroke();
          break;
        }

        // --- CATEGORY H: MEASUREMENT TOOLS ---
        case 'price_range':
        case 'date_range':
        case 'date_price_range':
        case 'measure': {
          if (!p1) break;
          const delta = p1.price - p0.price;
          const pct = (delta / (p0.price || 1)) * 100;
          const bars = Math.abs(p1.index - p0.index);
          const isPos = delta >= 0;
          const boxColor = d.tool === 'date_range' ? d.color : isPos ? palette.up : palette.down;
          ctx.fillStyle = hexToRgba(boxColor, 0.16);
          ctx.strokeStyle = boxColor;
          ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
          ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));

          const label =
            d.tool === 'price_range'
              ? `${delta >= 0 ? '+' : ''}${formatPrice(delta, instrument.decimals)} (${pct.toFixed(2)}%)`
              : d.tool === 'date_range'
              ? `${bars} bars (${timeframe})`
              : `${delta >= 0 ? '+' : ''}${formatPrice(delta, instrument.decimals)} (${pct.toFixed(2)}%) · ${bars} bars`;
          drawLabelPill(label, (x0 + x1) / 2 - 55, Math.min(y0, y1) - 24, boxColor);
          break;
        }

        // --- CATEGORY I: GEOMETRIC SHAPES ---
        case 'brush':
        case 'highlighter': {
          if (d.points.length < 2) break;
          ctx.save();
          if (d.tool === 'highlighter') {
            ctx.lineWidth = Math.max(10, (d.lineWidth || 2) * 5);
            ctx.strokeStyle = hexToRgba(d.color, 0.28);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
          }
          ctx.beginPath();
          d.points.forEach((pt, idx) => {
            const px = indexToX(pt.index);
            const py = priceToY(pt.price);
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'arrow':
        case 'arrow_marker': {
          if (!p1) break;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          drawArrowHead(x0, y0, x1, y1, strokeColor, d.tool === 'arrow_marker' ? 12 : 9);
          break;
        }
        case 'arrow_up': {
          drawArrowHead(x0, y0 + 20, x0, y0, strokeColor, 12);
          ctx.beginPath();
          ctx.moveTo(x0, y0 + 18);
          ctx.lineTo(x0, y0 + 6);
          ctx.stroke();
          break;
        }
        case 'arrow_down': {
          drawArrowHead(x0, y0 - 20, x0, y0, strokeColor, 12);
          ctx.beginPath();
          ctx.moveTo(x0, y0 - 18);
          ctx.lineTo(x0, y0 - 6);
          ctx.stroke();
          break;
        }
        case 'rectangle': {
          if (!p1) break;
          ctx.fillStyle = fillColor;
          ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
          ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
          break;
        }
        case 'rotated_rectangle': {
          if (!p1) break;
          const vx = x1 - x0;
          const vy = y1 - y0;
          const len = Math.hypot(vx, vy) || 1;
          const nx = -vy / len;
          const ny = vx / len;
          const proj = p2 ? (x2 - x0) * nx + (y2 - y0) * ny : 45;
          ctx.fillStyle = fillColor;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.lineTo(x1 + nx * proj, y1 + ny * proj);
          ctx.lineTo(x0 + nx * proj, y0 + ny * proj);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'circle': {
          if (!p1) break;
          const r = Math.max(6, Math.hypot(x1 - x0, y1 - y0));
          ctx.fillStyle = fillColor;
          ctx.beginPath();
          ctx.arc(x0, y0, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'ellipse': {
          if (!p1) break;
          const cx = (x0 + x1) / 2;
          const cy = (y0 + y1) / 2;
          const rx = Math.max(8, Math.abs(x1 - x0) / 2);
          const ry = Math.max(8, Math.abs(y1 - y0) / 2);
          ctx.fillStyle = fillColor;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'triangle': {
          if (!p1) break;
          ctx.fillStyle = fillColor;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.lineTo(p2 ? x2 : x0, p2 ? y2 : y1);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'arc': {
          if (!p1) break;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.quadraticCurveTo(p2 ? x2 : (x0 + x1) / 2, p2 ? y2 : Math.min(y0, y1) - 50, x1, y1);
          ctx.stroke();
          break;
        }
        case 'path':
        case 'polyline': {
          if (d.points.length < 2) break;
          ctx.beginPath();
          d.points.forEach((pt, idx) => {
            const px = indexToX(pt.index);
            const py = priceToY(pt.price);
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          if (d.tool === 'polyline') {
            ctx.closePath();
            ctx.fillStyle = fillColor;
            ctx.fill();
          }
          ctx.stroke();
          if (d.tool === 'path') {
            const prevPt = d.points[d.points.length - 2];
            const lastPt = d.points[d.points.length - 1];
            drawArrowHead(indexToX(prevPt.index), priceToY(prevPt.price), indexToX(lastPt.index), priceToY(lastPt.price), strokeColor);
          }
          break;
        }

        // --- CATEGORY J: ANNOTATIONS ---
        case 'text': {
          const fSize = d.fontSize || 12;
          const fFamily = d.fontFamily || 'Plus Jakarta Sans';
          ctx.font = `600 ${fSize}px "${fFamily}", sans-serif`;
          ctx.textAlign = d.textAlign || 'left';
          ctx.textBaseline = 'top';
          const content = d.text || 'Text';
          if (d.backgroundColor) {
            const tw = ctx.measureText(content).width + 12;
            const bx =
              ctx.textAlign === 'center'
                ? x0 - tw / 2
                : ctx.textAlign === 'right'
                ? x0 - tw
                : x0 - 4;
            ctx.fillStyle = hexToRgba(d.backgroundColor, alpha);
            ctx.fillRect(bx, y0 - 2, tw, fSize + 8);
            if (d.borderColor) {
              ctx.strokeStyle = hexToRgba(d.borderColor, alpha);
              ctx.strokeRect(bx, y0 - 2, tw, fSize + 8);
            }
          }
          ctx.fillStyle = hexToRgba(d.textColor || d.color, alpha);
          ctx.fillText(content, x0, y0 + 2);
          break;
        }
        case 'note':
        case 'comment':
        case 'signpost': {
          const msg = d.text || (d.tool === 'note' ? 'Note' : d.tool === 'comment' ? 'Comment' : 'Signpost');
          drawLabelPill(
            msg,
            x0,
            y0 - 10,
            d.backgroundColor || d.color,
            d.textColor || '#FFFFFF'
          );
          break;
        }
        case 'price_label': {
          drawLabelPill(
            `${formatPrice(p0.price, instrument.decimals)}`,
            x0 + 6,
            y0 - 9,
            d.backgroundColor || d.color,
            d.textColor || '#FFFFFF'
          );
          ctx.beginPath();
          ctx.arc(x0, y0, 3.5, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'price_note':
        case 'callout': {
          const bx = p1 ? x1 : x0 + 28;
          const by = p1 ? y1 : y0 - 28;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(bx, by);
          ctx.stroke();
          const label =
            d.tool === 'price_note'
              ? `${formatPrice(p0.price, instrument.decimals)}${d.text ? ` · ${d.text}` : ''}`
              : d.text || 'Callout';
          drawLabelPill(
            label,
            bx,
            by - 9,
            d.backgroundColor || d.color,
            d.textColor || '#FFFFFF'
          );
          break;
        }
        case 'pin':
        case 'flag_mark': {
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x0, y0 - 18);
          ctx.stroke();
          if (d.tool === 'flag_mark') {
            ctx.beginPath();
            ctx.moveTo(x0, y0 - 18);
            ctx.lineTo(x0 + 13, y0 - 13);
            ctx.lineTo(x0, y0 - 8);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(x0, y0 - 20, 5, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'table': {
          const rows = d.tableRows ?? [
            ['Level', formatPrice(p0.price, instrument.decimals)],
            ['Status', 'Active'],
          ];
          const cellW = 74;
          const cellH = 18;
          const totalW = cellW * (rows[0]?.length || 2);
          const totalH = cellH * rows.length;
          ctx.fillStyle = d.backgroundColor || palette.cardBg;
          ctx.fillRect(x0, y0, totalW, totalH);
          ctx.strokeStyle = d.borderColor || strokeColor;
          ctx.strokeRect(x0, y0, totalW, totalH);
          ctx.font = `${d.fontSize ? Math.min(13, d.fontSize) : 10}px "${d.fontFamily || 'IBM Plex Mono'}", monospace`;
          ctx.textAlign = d.textAlign || 'left';
          ctx.textBaseline = 'middle';
          rows.forEach((row, rIdx) => {
            row.forEach((cell, cIdx) => {
              const cx = x0 + cIdx * cellW;
              const cy = y0 + rIdx * cellH;
              ctx.strokeRect(cx, cy, cellW, cellH);
              ctx.fillStyle = d.textColor || palette.cardText;
              const tx =
                ctx.textAlign === 'center'
                  ? cx + cellW / 2
                  : ctx.textAlign === 'right'
                  ? cx + cellW - 5
                  : cx + 5;
              ctx.fillText(cell.slice(0, 11), tx, cy + cellH / 2);
            });
          });
          break;
        }
        case 'image': {
          ctx.fillStyle = d.backgroundColor || palette.cardBg;
          ctx.fillRect(x0, y0, 96, 54);
          ctx.strokeStyle = d.borderColor || strokeColor;
          ctx.strokeRect(x0, y0, 96, 54);
          ctx.font = `${d.fontSize || 10}px "${d.fontFamily || 'Plus Jakarta Sans'}", sans-serif`;
          ctx.fillStyle = d.textColor || palette.cardText;
          ctx.fillText(d.text || 'Chart Snapshot', x0 + 8, y0 + 28);
          break;
        }
      }

      // Draw Editable Selection Anchor Handles
      if (isSelected) {
        ctx.setLineDash([]);
        if ((d.tool === 'long_position' || d.tool === 'short_position') && 'id' in d && d.id) {
          const pos = resolvePositionData(d);
          if (pos) {
            const handles = getPositionHandles(d as ChartDrawing);
            handles.forEach((h) => {
              const isHandleActive =
                (hoveredHandle?.drawingId === d.id && hoveredHandle?.handle === h.handle) ||
                (dragState?.mode === 'position_handle' &&
                  dragState.drawingId === d.id &&
                  dragState.handle === h.handle);
              const accent =
                h.handle === 'tp'
                  ? pos.profitColor
                  : h.handle === 'sl'
                  ? pos.lossColor
                  : pos.entryColor;
              const radius = isHandleActive ? 7 : 5.5;

              if (isHandleActive) {
                ctx.fillStyle = hexToRgba(accent, 0.25);
                ctx.beginPath();
                ctx.arc(h.x, h.y, 12, 0, Math.PI * 2);
                ctx.fill();
              }

              ctx.fillStyle = '#FFFFFF';
              ctx.strokeStyle = accent;
              ctx.lineWidth = isHandleActive ? 2.6 : 2;
              ctx.beginPath();
              ctx.arc(h.x, h.y, radius, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            });
          }
        } else {
          d.points.forEach((pt, pIdx) => {
            const ax = indexToX(pt.index);
            const ay = priceToY(pt.price);
            const isHandleActive =
              ('id' in d &&
                hoveredHandle?.drawingId === d.id &&
                hoveredHandle?.handle === pIdx) ||
              (dragState?.mode === 'anchor' &&
                'id' in d &&
                dragState.drawingId === d.id &&
                dragState.pointIndex === pIdx);
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#2962FF';
            ctx.lineWidth = isHandleActive ? 2.5 : 2;
            ctx.beginPath();
            ctx.arc(ax, ay, isHandleActive ? 6.5 : 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });
        }
      }

      ctx.restore();
    };

    if (!hideAllDrawings) {
      drawings.forEach((d) => {
        if (!isDrawingVisibleOnTimeframe(d, timeframe)) return;
        renderDrawing(
          d,
          d.id === selectedDrawingId,
          d.id === hoveredDrawingId,
          false
        );
      });
    }

    // Pending Multi-Point Draft Preview
    if (pendingPoints.length > 0 && hoverPos && activeTool !== 'cursor') {
      const def = getDrawingToolDef(activeTool);
      const tplCfg = getDefaultConfigForTool(activeTool, templates);
      const hoverPt = getChartPoint(hoverPos.x, hoverPos.y);
      renderDrawing(
        {
          tool: activeTool,
          points: [...pendingPoints, hoverPt],
          color: tplCfg.color ?? def?.defaultColor ?? '#2962FF',
          fillColor: tplCfg.fillColor,
          fillOpacity: tplCfg.fillOpacity,
          lineWidth: tplCfg.lineWidth ?? 1.5,
          lineStyle: tplCfg.lineStyle ?? 'solid',
          opacity: tplCfg.opacity ?? 0.9,
          showLabels: tplCfg.showLabels ?? true,
          fibLevels: tplCfg.fibLevels,
        },
        false,
        false,
        true
      );
    }

    if (brushPoints && brushPoints.length > 1 && activeTool !== 'cursor') {
      const def = getDrawingToolDef(activeTool);
      const tplCfg = getDefaultConfigForTool(activeTool, templates);
      renderDrawing(
        {
          tool: activeTool,
          points: brushPoints,
          color: tplCfg.color ?? def?.defaultColor ?? '#F0B90B',
          lineWidth: tplCfg.lineWidth ?? 2,
          lineStyle: tplCfg.lineStyle ?? 'solid',
          opacity: tplCfg.opacity ?? 1,
        },
        false,
        false,
        true
      );
    }

    ctx.restore(); // End main price clip

    // Current Price Pill on Y-Axis
    if (visualSettings.showPriceLine && latestCandle) {
      const yCur = priceToY(latestCandle.close);
      if (yCur >= topPad && yCur <= topPad + mainPaneHeight) {
        const isUp = latestCandle.close >= latestCandle.open;
        ctx.fillStyle = isUp ? palette.up : palette.down;
        ctx.fillRect(plotWidth + 1, yCur - 9, priceAxisWidth - 3, 18);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatPrice(latestCandle.close, instrument.decimals), plotWidth + 7, yCur);
      }
    }

    // Horizontal Drawing Price Tags on Y-Axis
    if (!hideAllDrawings) {
      drawings
        .filter(
          (d) =>
            isDrawingVisibleOnTimeframe(d, timeframe) &&
            (d.tool === 'horizontal' || d.tool === 'horizontal_ray') &&
            d.points[0]
        )
        .forEach((d) => {
          const yTag = priceToY(d.points[0].price);
          if (yTag >= topPad && yTag <= topPad + mainPaneHeight) {
            ctx.fillStyle = d.color;
            ctx.fillRect(plotWidth + 1, yTag - 8, priceAxisWidth - 3, 16);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '10px "IBM Plex Mono", monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(formatPrice(d.points[0].price, instrument.decimals), plotWidth + 7, yTag);
          }
        });
    }

    // Oscillator Sub-Panes
    let subOffsetY = topPad + mainPaneHeight + 6;
    if (indicatorSeries.rsi) {
      const { data: rsi, color, period } = indicatorSeries.rsi;
      ctx.strokeStyle = palette.axisBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, subOffsetY);
      ctx.lineTo(size.width, subOffsetY);
      ctx.stroke();

      const rsiY = (val: number) => subOffsetY + subPaneHeight - (val / 100) * subPaneHeight;
      ctx.save();
      ctx.strokeStyle = palette.grid;
      ctx.setLineDash([3, 3]);
      [70, 30].forEach((lvl) => {
        ctx.beginPath();
        ctx.moveTo(0, rsiY(lvl));
        ctx.lineTo(plotWidth, rsiY(lvl));
        ctx.stroke();
      });
      ctx.restore();

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      let started = false;
      for (let i = startIndex; i < endIndex; i++) {
        const v = rsi[i];
        if (v === null) continue;
        const x = indexToX(i);
        const y = rsiY(v);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.fillStyle = palette.axisText;
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const lastRsi = rsi[rsi.length - 1];
      ctx.fillText(`RSI(${period}) ${lastRsi !== null ? lastRsi.toFixed(1) : '—'}`, 8, subOffsetY + 4);
      ctx.fillText('70', plotWidth + 8, rsiY(70) - 4);
      ctx.fillText('30', plotWidth + 8, rsiY(30) - 4);

      subOffsetY += subPaneHeight + 6;
    }

    if (indicatorSeries.macd) {
      const { macd, signal, histogram, color } = indicatorSeries.macd;
      ctx.strokeStyle = palette.axisBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, subOffsetY);
      ctx.lineTo(size.width, subOffsetY);
      ctx.stroke();

      let maxAbs = 0.0001;
      for (let i = startIndex; i < endIndex; i++) {
        const m = macd[i];
        const s = signal[i];
        const h = histogram[i];
        if (m !== null) maxAbs = Math.max(maxAbs, Math.abs(m));
        if (s !== null) maxAbs = Math.max(maxAbs, Math.abs(s));
        if (h !== null) maxAbs = Math.max(maxAbs, Math.abs(h));
      }
      const macdY = (v: number) => subOffsetY + subPaneHeight / 2 - (v / maxAbs) * (subPaneHeight * 0.42);
      const zeroY = macdY(0);

      const barW = Math.max(1.5, (plotWidth / actualCount) * 0.6);
      for (let i = startIndex; i < endIndex; i++) {
        const h = histogram[i];
        if (h === null) continue;
        const x = indexToX(i);
        const y = macdY(h);
        ctx.fillStyle = h >= 0 ? 'rgba(8, 153, 129, 0.55)' : 'rgba(242, 54, 69, 0.55)';
        ctx.fillRect(x - barW / 2, Math.min(zeroY, y), barW, Math.abs(y - zeroY));
      }

      const drawOsc = (arr: (number | null)[], stroke: string) => {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        let active = false;
        for (let i = startIndex; i < endIndex; i++) {
          const v = arr[i];
          if (v === null) continue;
          const x = indexToX(i);
          const y = macdY(v);
          if (!active) {
            ctx.moveTo(x, y);
            active = true;
          } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      drawOsc(macd, color);
      drawOsc(signal, '#F0B90B');

      ctx.fillStyle = palette.axisText;
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('MACD', 8, subOffsetY + 4);

      subOffsetY += subPaneHeight + 6;
    }

    if (indicatorSeries.stoch) {
      const { k, d, color } = indicatorSeries.stoch;
      ctx.strokeStyle = palette.axisBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, subOffsetY);
      ctx.lineTo(size.width, subOffsetY);
      ctx.stroke();

      const stY = (v: number) => subOffsetY + subPaneHeight - (v / 100) * subPaneHeight;
      ctx.save();
      ctx.strokeStyle = palette.grid;
      ctx.setLineDash([3, 3]);
      [80, 20].forEach((lvl) => {
        ctx.beginPath();
        ctx.moveTo(0, stY(lvl));
        ctx.lineTo(plotWidth, stY(lvl));
        ctx.stroke();
      });
      ctx.restore();

      const drawSt = (arr: (number | null)[], stroke: string) => {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        let active = false;
        for (let i = startIndex; i < endIndex; i++) {
          const v = arr[i];
          if (v === null) continue;
          const x = indexToX(i);
          const y = stY(v);
          if (!active) {
            ctx.moveTo(x, y);
            active = true;
          } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      drawSt(k, color);
      drawSt(d, '#F0B90B');

      ctx.fillStyle = palette.axisText;
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const lastK = k[k.length - 1];
      ctx.fillText(`Stoch %K ${lastK !== null ? lastK.toFixed(1) : '—'}`, 8, subOffsetY + 4);
      ctx.fillText('80', plotWidth + 8, stY(80) - 4);
      ctx.fillText('20', plotWidth + 8, stY(20) - 4);
      subOffsetY += subPaneHeight + 6;
    }

    if (indicatorSeries.cci) {
      const { data, color, period } = indicatorSeries.cci;
      ctx.strokeStyle = palette.axisBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, subOffsetY);
      ctx.lineTo(size.width, subOffsetY);
      ctx.stroke();

      let maxAbs = 150;
      for (let i = startIndex; i < endIndex; i++) {
        const v = data[i];
        if (v !== null) maxAbs = Math.max(maxAbs, Math.abs(v));
      }
      const cciY = (v: number) => subOffsetY + subPaneHeight / 2 - (v / maxAbs) * (subPaneHeight * 0.42);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      let active = false;
      for (let i = startIndex; i < endIndex; i++) {
        const v = data[i];
        if (v === null) continue;
        const x = indexToX(i);
        const y = cciY(v);
        if (!active) {
          ctx.moveTo(x, y);
          active = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = palette.axisText;
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const lastCci = data[data.length - 1];
      ctx.fillText(`CCI(${period}) ${lastCci !== null ? lastCci.toFixed(1) : '—'}`, 8, subOffsetY + 4);
      subOffsetY += subPaneHeight + 6;
    }

    if (indicatorSeries.atr) {
      const { data, color, period } = indicatorSeries.atr;
      ctx.strokeStyle = palette.axisBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, subOffsetY);
      ctx.lineTo(size.width, subOffsetY);
      ctx.stroke();

      let lo = Infinity;
      let hi = -Infinity;
      for (let i = startIndex; i < endIndex; i++) {
        const v = data[i];
        if (v !== null) {
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
      }
      const span = Math.max(1e-9, hi - lo);
      const atrY = (v: number) => subOffsetY + subPaneHeight - ((v - lo) / span) * (subPaneHeight - 12) - 6;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      let active = false;
      for (let i = startIndex; i < endIndex; i++) {
        const v = data[i];
        if (v === null) continue;
        const x = indexToX(i);
        const y = atrY(v);
        if (!active) {
          ctx.moveTo(x, y);
          active = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = palette.axisText;
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const lastAtr = data[data.length - 1];
      ctx.fillText(`ATR(${period}) ${lastAtr !== null ? formatPrice(lastAtr, instrument.decimals) : '—'}`, 8, subOffsetY + 4);
      subOffsetY += subPaneHeight + 6;
    }

    if (indicatorSeries.obv) {
      const { data, color } = indicatorSeries.obv;
      ctx.strokeStyle = palette.axisBorder;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, subOffsetY);
      ctx.lineTo(size.width, subOffsetY);
      ctx.stroke();

      let lo = Infinity;
      let hi = -Infinity;
      for (let i = startIndex; i < endIndex; i++) {
        const v = data[i];
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
      const span = Math.max(1, hi - lo);
      const obvY = (v: number) => subOffsetY + subPaneHeight - ((v - lo) / span) * (subPaneHeight - 12) - 6;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let i = startIndex; i < endIndex; i++) {
        const x = indexToX(i);
        const y = obvY(data[i]);
        if (i === startIndex) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = palette.axisText;
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('OBV', 8, subOffsetY + 4);
      subOffsetY += subPaneHeight + 6;
    }

    // Axis Dividers
    ctx.strokeStyle = palette.axisBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plotWidth + 0.5, 0);
    ctx.lineTo(plotWidth + 0.5, size.height - timeAxisHeight);
    ctx.moveTo(0, size.height - timeAxisHeight + 0.5);
    ctx.lineTo(size.width, size.height - timeAxisHeight + 0.5);
    ctx.stroke();

    // Selected Long / Short Position time range badges on X-axis (like TradingView)
    if (!hideAllDrawings && selectedDrawingId) {
      const selPosDrawing = drawings.find(
        (d) =>
          d.id === selectedDrawingId &&
          isDrawingVisibleOnTimeframe(d, timeframe) &&
          (d.tool === 'long_position' || d.tool === 'short_position')
      );
      if (selPosDrawing) {
        const pos = resolvePositionData(selPosDrawing);
        if (pos) {
          [pos.startIndex, pos.endIndex].forEach((bIdx) => {
            const clampedIdx = Math.max(0, Math.min(displayCandles.length - 1, bIdx));
            const c = displayCandles[clampedIdx];
            if (!c) return;
            const bx = indexToX(bIdx);
            if (bx < 0 || bx > plotWidth) return;
            const ts = formatChartTimestamp(
              c.time,
              timeframe,
              timezone,
              instrument.exchange,
              'badge'
            );
            ctx.save();
            ctx.font = '600 10px "IBM Plex Mono", monospace';
            const tw = ctx.measureText(ts).width + 12;
            const tx = Math.max(2, Math.min(plotWidth - tw, bx - tw / 2));
            ctx.fillStyle = '#2962FF';
            ctx.fillRect(tx, size.height - timeAxisHeight + 1, tw, timeAxisHeight - 3);
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(ts, tx + tw / 2, size.height - timeAxisHeight / 2);
            ctx.restore();
          });
        }
      }
    }

    // Crosshair & Magnet Indicator
    if (
      crosshairEnabled &&
      hoverPos &&
      hoverPos.x <= plotWidth &&
      hoverPos.y <= size.height - timeAxisHeight
    ) {
      const snapped = magnetMode ? getChartPoint(hoverPos.x, hoverPos.y) : null;
      const cx = snapped ? indexToX(snapped.index) : hoverPos.x;
      const cy = snapped ? priceToY(snapped.price) : hoverPos.y;

      ctx.save();
      ctx.strokeStyle = palette.crosshair;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(Math.round(cx) + 0.5, topPad);
      ctx.lineTo(Math.round(cx) + 0.5, size.height - timeAxisHeight);
      if (cy <= topPad + mainPaneHeight) {
        ctx.moveTo(0, Math.round(cy) + 0.5);
        ctx.lineTo(plotWidth, Math.round(cy) + 0.5);
      }
      ctx.stroke();
      ctx.restore();

      if (magnetMode && snapped && cy <= topPad + mainPaneHeight) {
        ctx.strokeStyle = '#2962FF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (cy <= topPad + mainPaneHeight) {
        const hoverPrice = yToPrice(cy);
        ctx.fillStyle = palette.crosshairBadgeBg;
        ctx.fillRect(plotWidth + 1, cy - 9, priceAxisWidth - 3, 18);
        ctx.fillStyle = palette.crosshairBadgeText;
        ctx.font = '11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatPrice(hoverPrice, instrument.decimals), plotWidth + 7, cy);
      }

      const idx = xToIndex(hoverPos.x);
      const hc = displayCandles[idx];
      if (hc) {
        const ts = formatChartTimestamp(
          hc.time,
          timeframe,
          timezone,
          instrument.exchange,
          'crosshair'
        );
        const tw = ctx.measureText(ts).width + 14;
        const tx = Math.max(2, Math.min(plotWidth - tw, cx - tw / 2));
        ctx.fillStyle = palette.crosshairBadgeBg;
        ctx.fillRect(tx, size.height - timeAxisHeight + 1, tw, timeAxisHeight - 3);
        ctx.fillStyle = palette.crosshairBadgeText;
        ctx.font = '10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ts, tx + tw / 2, size.height - timeAxisHeight / 2);
      }
    }
  }, [
    size,
    displayCandles,
    startIndex,
    endIndex,
    actualCount,
    minPrice,
    maxPrice,
    indicatorSeries,
    compareInstrument,
    compareCandles,
    drawings,
    templates,
    selectedDrawingId,
    hoveredDrawingId,
    hoveredHandle,
    dragState,
    pendingPoints,
    brushPoints,
    hoverPos,
    magnetMode,
    hideAllDrawings,
    crosshairEnabled,
    visualSettings,
    theme,
    chartStyle,
    timeframe,
    timezone,
    instrument.decimals,
    instrument.exchange,
    instrument.symbol,
    plotWidth,
    mainPaneHeight,
    subPaneHeight,
  ]);

  const beginInteraction = (x: number, y: number, isTouch = false) => {
    if (x > plotWidth || y > topPad + mainPaneHeight) return;
    const hitRadius = isTouch ? 18 : 11;
    const pt = getChartPoint(x, y);

    if (activeTool === 'cursor') {
      // 1. Check if clicking an anchor / position handle of selected drawing
      if (selectedDrawingId) {
        const sel = drawings.find((d) => d.id === selectedDrawingId);
        if (sel && !sel.locked && isDrawingVisibleOnTimeframe(sel, timeframe)) {
          if (sel.tool === 'long_position' || sel.tool === 'short_position') {
            const handles = getPositionHandles(sel);
            const pos = resolvePositionData(sel);
            if (pos) {
              for (const h of handles) {
                if (Math.hypot(x - h.x, y - h.y) <= hitRadius) {
                  setDragState({
                    mode: 'position_handle',
                    drawingId: sel.id,
                    handle: h.handle as PositionHandleKind,
                    origPos: { ...pos },
                    startPt: pt,
                  });
                  return;
                }
              }
            }
          } else {
            for (let i = 0; i < sel.points.length; i++) {
              const ax = indexToX(sel.points[i].index);
              const ay = priceToY(sel.points[i].price);
              if (Math.hypot(x - ax, y - ay) <= hitRadius) {
                setDragState({ mode: 'anchor', drawingId: sel.id, pointIndex: i });
                return;
              }
            }
          }
        }
      }

      // 2. Check if clicking a drawing body
      const hitId = hitTestDrawing(x, y);
      if (hitId) {
        onSelectDrawing(hitId);
        const hitObj = drawings.find((d) => d.id === hitId);
        if (hitObj && !hitObj.locked) {
          if (hitObj.tool === 'long_position' || hitObj.tool === 'short_position') {
            const pos = resolvePositionData(hitObj);
            if (pos) {
              // Check if user directly clicked a handle on first tap
              const handles = getPositionHandles(hitObj);
              for (const h of handles) {
                if (Math.hypot(x - h.x, y - h.y) <= hitRadius) {
                  setDragState({
                    mode: 'position_handle',
                    drawingId: hitId,
                    handle: h.handle as PositionHandleKind,
                    origPos: { ...pos },
                    startPt: pt,
                  });
                  return;
                }
              }
              setDragState({
                mode: 'body',
                drawingId: hitId,
                startPt: pt,
                origPoints: hitObj.points.map((p) => ({ ...p })),
                origPos: { ...pos },
              });
              return;
            }
          }
          setDragState({
            mode: 'body',
            drawingId: hitId,
            startPt: pt,
            origPoints: hitObj.points.map((p) => ({ ...p })),
          });
        }
        return;
      }

      onSelectDrawing(null);
      setIsPanning(true);
      panStartRef.current = { x, startOffset: rightOffset };
      return;
    }

    const def = getDrawingToolDef(activeTool);
    if (!def) return;
    const tplCfg = getDefaultConfigForTool(activeTool, templates);

    // Text / Note / Comment / Signpost / Image prompt on single point
    if (
      activeTool === 'text' ||
      activeTool === 'note' ||
      activeTool === 'comment' ||
      activeTool === 'signpost' ||
      activeTool === 'image'
    ) {
      setTextDraft({ tool: activeTool, index: pt.index, price: pt.price, x, y, value: '' });
      return;
    }

    if (def.pointsRequired === 'freehand') {
      setBrushPoints([pt]);
      return;
    }

    if (def.pointsRequired === 1) {
      onAddDrawing({
        symbol: instrument.symbol,
        tool: activeTool,
        category: def.category,
        points: [pt],
        color: tplCfg.color ?? def.defaultColor,
        fillColor: tplCfg.fillColor,
        fillOpacity: tplCfg.fillOpacity,
        textColor: tplCfg.textColor,
        lineWidth: tplCfg.lineWidth ?? 1.5,
        lineStyle: tplCfg.lineStyle ?? 'solid',
        opacity: tplCfg.opacity ?? 1,
        fontFamily: tplCfg.fontFamily,
        fontSize: tplCfg.fontSize,
        textAlign: tplCfg.textAlign,
        backgroundColor: tplCfg.backgroundColor,
        borderColor: tplCfg.borderColor,
        extendLeft: tplCfg.extendLeft,
        extendRight: tplCfg.extendRight,
        visible: true,
        visibleIntervals: tplCfg.visibleIntervals,
        locked: false,
        tableRows:
          activeTool === 'table'
            ? [
                ['Zone', 'Value'],
                ['Spot', formatPrice(pt.price, instrument.decimals)],
              ]
            : undefined,
      });
      return;
    }

    if (def.pointsRequired === 'poly') {
      setPendingPoints((prev) => [...prev, pt]);
      return;
    }

    // 2-point or 3-point tools
    const nextPts = [...pendingPoints, pt];
    if (nextPts.length >= def.pointsRequired) {
      if (activeTool === 'callout' || activeTool === 'price_note') {
        setTextDraft({
          tool: activeTool,
          index: nextPts[0].index,
          price: nextPts[0].price,
          x,
          y,
          value: '',
        });
        setPendingPoints(nextPts);
        return;
      }

      if (activeTool === 'long_position' || activeTool === 'short_position') {
        const isLong = activeTool === 'long_position';
        const pStart = nextPts[0];
        const pEnd = nextPts[1];
        const meta = getInstrumentTickMeta(instrument);
        const minSpan = Math.max(meta.pipSize * 8, (maxPrice - minPrice) * 0.1);
        const entryPrice = pStart.price;
        const takeProfit = isLong
          ? Math.max(pEnd.price, entryPrice + minSpan)
          : Math.max(0.0001, Math.min(pEnd.price, entryPrice - minSpan));
        const stopLoss = isLong
          ? Math.max(0.0001, entryPrice - Math.abs(takeProfit - entryPrice) * 0.5)
          : entryPrice + Math.abs(entryPrice - takeProfit) * 0.5;
        const startIdx = Math.min(pStart.index, pEnd.index);
        const endIdx = Math.min(totalBars - 1, Math.max(startIdx + 12, Math.max(pStart.index, pEnd.index)));

        onAddDrawing({
          symbol: instrument.symbol,
          tool: activeTool,
          category: def.category,
          points: [
            { index: startIdx, price: entryPrice },
            { index: endIdx, price: takeProfit },
          ],
          color: tplCfg.color ?? def.defaultColor,
          lineWidth: tplCfg.lineWidth ?? 1.5,
          lineStyle: tplCfg.lineStyle ?? 'solid',
          opacity: tplCfg.opacity ?? 0.9,
          visible: true,
          visibleIntervals: tplCfg.visibleIntervals,
          locked: false,
          positionData: {
            entryPrice,
            takeProfit,
            stopLoss,
            startIndex: startIdx,
            endIndex: endIdx,
            positionSize: tplCfg.positionStyle?.positionSize ?? meta.defaultPositionSize,
            profitColor: tplCfg.positionStyle?.profitColor ?? '#089981',
            lossColor: tplCfg.positionStyle?.lossColor ?? '#F23645',
            entryColor: tplCfg.positionStyle?.entryColor ?? '#2962FF',
          },
        });
        setPendingPoints([]);
        return;
      }

      onAddDrawing({
        symbol: instrument.symbol,
        tool: activeTool,
        category: def.category,
        points: nextPts,
        color: tplCfg.color ?? def.defaultColor,
        fillColor: tplCfg.fillColor ?? def.defaultColor,
        fillOpacity: tplCfg.fillOpacity,
        textColor: tplCfg.textColor,
        lineWidth: tplCfg.lineWidth ?? 1.5,
        lineStyle: tplCfg.lineStyle ?? 'solid',
        opacity: tplCfg.opacity ?? 1,
        extendLeft: tplCfg.extendLeft,
        extendRight: tplCfg.extendRight,
        visible: true,
        visibleIntervals: tplCfg.visibleIntervals,
        locked: false,
        showLabels: tplCfg.showLabels ?? true,
        fibLevels:
          def.category === 'fibonacci'
            ? (tplCfg.fibLevels ?? DEFAULT_FIB_LEVELS).map((l) => ({ ...l }))
            : undefined,
      });
      setPendingPoints([]);
    } else {
      setPendingPoints(nextPts);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    beginInteraction(e.clientX - rect.left, e.clientY - rect.top, false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;
    setHoverPos({ x, y });
    beginInteraction(x, y, true);
  };

  const handleDoubleClick = () => {
    if ((activeTool === 'path' || activeTool === 'polyline') && pendingPoints.length >= 2) {
      const def = getDrawingToolDef(activeTool);
      const tplCfg = getDefaultConfigForTool(activeTool, templates);
      onAddDrawing({
        symbol: instrument.symbol,
        tool: activeTool,
        category: def?.category ?? 'shapes',
        points: pendingPoints,
        color: tplCfg.color ?? def?.defaultColor ?? '#2962FF',
        fillColor: tplCfg.fillColor,
        fillOpacity: tplCfg.fillOpacity,
        lineWidth: tplCfg.lineWidth ?? 2,
        lineStyle: tplCfg.lineStyle ?? 'solid',
        opacity: tplCfg.opacity ?? 1,
        visible: true,
        locked: false,
      });
      setPendingPoints([]);
    }
  };

  const handlePointerMove = (x: number, y: number) => {
    setHoverPos({ x, y });

    if (dragState) {
      const pt = getChartPoint(x, y);
      const target = drawings.find((d) => d.id === dragState.drawingId);
      if (!target) return;

      if (dragState.mode === 'position_handle') {
        const isLong = target.tool === 'long_position';
        const orig = dragState.origPos;
        const minStep = Math.pow(10, -instrument.decimals);

        if (dragState.handle === 'tp') {
          // Independent Take Profit adjustment — Entry & SL untouched!
          const nextTp = isLong
            ? Math.max(orig.entryPrice + minStep, pt.price)
            : Math.max(0.0001, Math.min(orig.entryPrice - minStep, pt.price));
          const updated: PositionDrawingData = { ...orig, takeProfit: nextTp };
          onUpdateDrawing(
            target.id,
            {
              positionData: updated,
              points: [
                { index: updated.startIndex, price: updated.entryPrice },
                { index: updated.endIndex, price: updated.takeProfit },
              ],
            },
            false
          );
          setHoveredHandle({
            drawingId: target.id,
            handle: 'tp',
            x,
            y: priceToY(nextTp),
            label: 'Take Profit',
          });
        } else if (dragState.handle === 'sl') {
          // Independent Stop Loss adjustment — Entry & TP untouched!
          const nextSl = isLong
            ? Math.max(0.0001, Math.min(orig.entryPrice - minStep, pt.price))
            : Math.max(orig.entryPrice + minStep, pt.price);
          const updated: PositionDrawingData = { ...orig, stopLoss: nextSl };
          onUpdateDrawing(
            target.id,
            {
              positionData: updated,
              points: [
                { index: updated.startIndex, price: updated.entryPrice },
                { index: updated.endIndex, price: updated.takeProfit },
              ],
            },
            false
          );
          setHoveredHandle({
            drawingId: target.id,
            handle: 'sl',
            x,
            y: priceToY(nextSl),
            label: 'Stop Loss',
          });
        } else if (dragState.handle === 'entry') {
          // Moving Entry preserves exact relative distances to TP & SL!
          const dPrice = pt.price - dragState.startPt.price;
          const nextEntry = Math.max(0.0001, orig.entryPrice + dPrice);
          const actualDelta = nextEntry - orig.entryPrice;
          const updated: PositionDrawingData = {
            ...orig,
            entryPrice: nextEntry,
            takeProfit: Math.max(0.0001, orig.takeProfit + actualDelta),
            stopLoss: Math.max(0.0001, orig.stopLoss + actualDelta),
          };
          onUpdateDrawing(
            target.id,
            {
              positionData: updated,
              points: [
                { index: updated.startIndex, price: updated.entryPrice },
                { index: updated.endIndex, price: updated.takeProfit },
              ],
            },
            false
          );
          setHoveredHandle({
            drawingId: target.id,
            handle: 'entry',
            x,
            y: priceToY(nextEntry),
            label: 'Entry Price',
          });
        } else if (dragState.handle === 'left_time') {
          const nextStart = Math.max(0, Math.min(orig.endIndex - 2, pt.index));
          const updated: PositionDrawingData = { ...orig, startIndex: nextStart };
          onUpdateDrawing(
            target.id,
            {
              positionData: updated,
              points: [
                { index: updated.startIndex, price: updated.entryPrice },
                { index: updated.endIndex, price: updated.takeProfit },
              ],
            },
            false
          );
          setHoveredHandle({
            drawingId: target.id,
            handle: 'left_time',
            x: indexToX(nextStart),
            y: priceToY(orig.entryPrice),
            label: 'Start Time',
          });
        } else if (dragState.handle === 'right_time') {
          const nextEnd = Math.min(totalBars - 1, Math.max(orig.startIndex + 2, pt.index));
          const updated: PositionDrawingData = { ...orig, endIndex: nextEnd };
          onUpdateDrawing(
            target.id,
            {
              positionData: updated,
              points: [
                { index: updated.startIndex, price: updated.entryPrice },
                { index: updated.endIndex, price: updated.takeProfit },
              ],
            },
            false
          );
          setHoveredHandle({
            drawingId: target.id,
            handle: 'right_time',
            x: indexToX(nextEnd),
            y: priceToY(orig.entryPrice),
            label: 'End Time',
          });
        }
        return;
      }

      if (dragState.mode === 'anchor') {
        const nextPts = target.points.map((p, idx) =>
          idx === dragState.pointIndex ? pt : p
        );
        onUpdateDrawing(target.id, { points: nextPts }, false);
      } else if (dragState.mode === 'body') {
        const dIndex = pt.index - dragState.startPt.index;
        const dPrice = pt.price - dragState.startPt.price;
        if (dragState.origPos) {
          const orig = dragState.origPos;
          const span = orig.endIndex - orig.startIndex;
          const nextStart = Math.max(0, Math.min(totalBars - 1 - span, orig.startIndex + dIndex));
          const nextEntry = Math.max(0.0001, orig.entryPrice + dPrice);
          const actualDelta = nextEntry - orig.entryPrice;
          const updated: PositionDrawingData = {
            ...orig,
            startIndex: nextStart,
            endIndex: nextStart + span,
            entryPrice: nextEntry,
            takeProfit: Math.max(0.0001, orig.takeProfit + actualDelta),
            stopLoss: Math.max(0.0001, orig.stopLoss + actualDelta),
          };
          onUpdateDrawing(
            target.id,
            {
              positionData: updated,
              points: [
                { index: updated.startIndex, price: updated.entryPrice },
                { index: updated.endIndex, price: updated.takeProfit },
              ],
            },
            false
          );
          return;
        }
        const nextPts = dragState.origPoints.map((op) => ({
          index: Math.max(0, Math.min(totalBars - 1, op.index + dIndex)),
          price: Math.max(0.0001, op.price + dPrice),
        }));
        onUpdateDrawing(target.id, { points: nextPts }, false);
      }
      return;
    }

    if (isPanning && panStartRef.current) {
      const dx = x - panStartRef.current.x;
      const barsPerPx = actualCount / plotWidth;
      const deltaBars = Math.round(dx * barsPerPx);
      const maxOffset = Math.max(0, totalBars - visibleCount);
      setRightOffset(Math.max(0, Math.min(maxOffset, panStartRef.current.startOffset + deltaBars)));
      return;
    }

    if (brushPoints && (activeTool === 'brush' || activeTool === 'highlighter')) {
      setBrushPoints((prev) => (prev ? [...prev, getChartPoint(x, y)] : null));
      return;
    }

    // Hover Detection for Handles & Position Measurement Tooltip
    if (activeTool === 'cursor') {
      let foundHandle: HoveredHandleInfo | null = null;
      if (selectedDrawingId) {
        const sel = drawings.find((d) => d.id === selectedDrawingId);
        if (sel && isDrawingVisibleOnTimeframe(sel, timeframe)) {
          if (sel.tool === 'long_position' || sel.tool === 'short_position') {
            const handles = getPositionHandles(sel);
            for (const h of handles) {
              if (Math.hypot(x - h.x, y - h.y) <= 11) {
                foundHandle = h;
                break;
              }
            }
          } else {
            for (let i = 0; i < sel.points.length; i++) {
              const ax = indexToX(sel.points[i].index);
              const ay = priceToY(sel.points[i].price);
              if (Math.hypot(x - ax, y - ay) <= 11) {
                foundHandle = {
                  drawingId: sel.id,
                  handle: i,
                  x: ax,
                  y: ay,
                  label: `Anchor #${i + 1}`,
                };
                break;
              }
            }
          }
        }
      }
      setHoveredHandle(foundHandle);
      const hitId = hitTestDrawing(x, y);
      setHoveredDrawingId(hitId);
    } else {
      setHoveredHandle(null);
      setHoveredDrawingId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    handlePointerMove(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    handlePointerMove(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
  };

  const handleMouseUp = () => {
    if (dragState) {
      const target = drawings.find((d) => d.id === dragState.drawingId);
      if (target) {
        onUpdateDrawing(
          target.id,
          {
            points: target.points,
            ...(target.positionData ? { positionData: target.positionData } : {}),
          },
          true
        );
      }
      setDragState(null);
    }
    setIsPanning(false);
    panStartRef.current = null;
    if (brushPoints && brushPoints.length > 1 && activeTool !== 'cursor') {
      const def = getDrawingToolDef(activeTool);
      const tplCfg = getDefaultConfigForTool(activeTool, templates);
      onAddDrawing({
        symbol: instrument.symbol,
        tool: activeTool,
        category: def?.category ?? 'shapes',
        points: brushPoints,
        color: tplCfg.color ?? def?.defaultColor ?? '#F0B90B',
        lineWidth: tplCfg.lineWidth ?? (activeTool === 'highlighter' ? 3 : 2),
        lineStyle: tplCfg.lineStyle ?? 'solid',
        opacity: tplCfg.opacity ?? 1,
        visible: true,
        locked: false,
      });
    }
    setBrushPoints(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 8 : -8;
    setVisibleCount((prev) => Math.max(20, Math.min(totalBars, prev + delta)));
  };

  const activeCandle =
    hoveredBarIndex !== null && displayCandles[hoveredBarIndex]
      ? displayCandles[hoveredBarIndex]
      : displayCandles[displayCandles.length - 1];

  const isUpBar = activeCandle ? activeCandle.close >= activeCandle.open : true;
  const activeToolDef = getDrawingToolDef(activeTool);

  // Compute active Position Hover Tooltip data (when cursor hovers or drags a Long/Short position)
  const inspectedPositionId =
    dragState?.mode === 'position_handle' || dragState?.mode === 'body'
      ? dragState.drawingId
      : hoveredDrawingId;
  const inspectedPositionDrawing = inspectedPositionId
    ? drawings.find(
        (d) =>
          d.id === inspectedPositionId &&
          isDrawingVisibleOnTimeframe(d, timeframe) &&
          (d.tool === 'long_position' || d.tool === 'short_position')
      ) ?? null
    : null;
  const inspectedPositionData = inspectedPositionDrawing
    ? resolvePositionData(inspectedPositionDrawing)
    : null;
  const inspectedPositionMetrics =
    inspectedPositionDrawing && inspectedPositionData
      ? computePositionMetrics(
          inspectedPositionDrawing.tool === 'long_position',
          inspectedPositionData,
          instrument
        )
      : null;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none">
      {/* Live OHLC + Interactive Indicator Overlay Legend */}
      <div className="pointer-events-none absolute top-2 left-3 z-10 flex flex-col items-start gap-1 max-w-[calc(100%-84px)]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono tabular-nums bg-[var(--bg-canvas)]/75 backdrop-blur-[2px] px-2 py-1 rounded border border-[var(--border-subtle)]/60">
          <span className="font-sans font-semibold text-[var(--text-primary)]">
            {instrument.symbol} · {timeframe}
          </span>
          {activeCandle && (
            <>
              <span className="text-[var(--text-secondary)]">
                O <span className={isUpBar ? 'text-[#089981]' : 'text-[#F23645]'}>{formatPrice(activeCandle.open, instrument.decimals)}</span>
              </span>
              <span className="text-[var(--text-secondary)]">
                H <span className={isUpBar ? 'text-[#089981]' : 'text-[#F23645]'}>{formatPrice(activeCandle.high, instrument.decimals)}</span>
              </span>
              <span className="text-[var(--text-secondary)]">
                L <span className={isUpBar ? 'text-[#089981]' : 'text-[#F23645]'}>{formatPrice(activeCandle.low, instrument.decimals)}</span>
              </span>
              <span className="text-[var(--text-secondary)]">
                C <span className={isUpBar ? 'text-[#089981]' : 'text-[#F23645]'}>{formatPrice(activeCandle.close, instrument.decimals)}</span>
              </span>
              <span className="text-[var(--text-secondary)]">
                Vol <span className="text-[var(--text-primary)]">{activeCandle.volume.toLocaleString()}</span>
              </span>
            </>
          )}
          {compareInstrument && (
            <span className="text-[#F0B90B]">
              vs {compareInstrument.symbol} ({compareInstrument.changePercent >= 0 ? '+' : ''}
              {compareInstrument.changePercent.toFixed(2)}%)
            </span>
          )}
          {onOpenIndicators && (
            <button
              type="button"
              onClick={onOpenIndicators}
              title="Add or remove indicator lines, volume, and sub-pane oscillators"
              className="pointer-events-auto ml-1 px-1.5 py-0.5 rounded bg-[var(--bg-surface)]/90 hover:bg-[var(--bg-panel)] border border-[var(--border-subtle)] text-[10px] font-sans font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              {indicators.some((i) => i.enabled)
                ? `Lines (${indicators.filter((i) => i.enabled).length})`
                : '+ Lines'}
            </button>
          )}
        </div>

        {indicators.some((i) => i.enabled) && (
          <div className="pointer-events-auto flex flex-col items-start gap-1">
            {!legendCollapsed && (
              <div className="flex flex-wrap items-center gap-1">
                {indicators
                  .filter((i) => i.enabled)
                  .map((ind) => (
                    <div
                      key={ind.id}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--bg-canvas)]/80 backdrop-blur-[2px] border border-[var(--border-subtle)]/70 text-[10.5px] text-[var(--text-primary)]"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: ind.color }}
                      />
                      <span className="font-mono">{ind.shortName}</span>
                      {onToggleIndicator && (
                        <button
                          type="button"
                          onClick={() => onToggleIndicator(ind.id)}
                          title={`Remove ${ind.label}`}
                          className="ml-0.5 text-[var(--text-muted)] hover:text-[#F23645] leading-none cursor-pointer"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setLegendCollapsed((c) => !c)}
              title={legendCollapsed ? 'Show active lines list' : 'Collapse active lines list'}
              className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)]/80 hover:bg-[var(--bg-panel)] border border-[var(--border-subtle)]/70 text-[10px] text-[var(--text-secondary)] cursor-pointer leading-none"
            >
              {legendCollapsed ? `▾ ${indicators.filter((i) => i.enabled).length}` : '▴'}
            </button>
          </div>
        )}
      </div>

      {/* Placement Hint Banner while Drawing */}
      {activeToolDef && (
        <div className="pointer-events-none absolute bottom-12 left-3 z-10 px-2.5 py-1 rounded bg-[#2962FF]/90 text-white text-[11px] font-medium shadow">
          {activeToolDef.hint}
          {pendingPoints.length > 0 && ` (${pendingPoints.length} point placed)`}
        </div>
      )}

      {/* Handle Identifier Tooltip (Take Profit / Stop Loss / Entry Price / Time Boundary) */}
      {hoveredHandle && (
        <div
          style={{
            left: Math.max(8, Math.min(size.width - 130, hoveredHandle.x + 12)),
            top: Math.max(8, Math.min(size.height - 40, hoveredHandle.y - 26)),
          }}
          className="pointer-events-none absolute z-30 px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-strong)] text-[11px] font-medium text-[var(--text-primary)] shadow-md whitespace-nowrap"
        >
          {hoveredHandle.label}
        </div>
      )}

      {/* Long / Short Position Hover Measurement Tooltip (Risk/Reward, Pips, Points) */}
      {inspectedPositionDrawing &&
        inspectedPositionData &&
        inspectedPositionMetrics &&
        hoverPos && (() => {
          const boxRightX = Math.max(
            indexToX(inspectedPositionData.startIndex) + 52,
            indexToX(inspectedPositionData.endIndex)
          );
          const boxLeftX = indexToX(inspectedPositionData.startIndex);
          const placeRight = boxRightX + 240 < plotWidth;
          const cardLeft = placeRight
            ? Math.max(8, boxRightX + 14)
            : Math.max(8, Math.min(plotWidth - 232, boxLeftX - 234));
          return (
          <div
            style={{
              left: cardLeft,
              top: Math.max(40, Math.min(size.height - 175, hoverPos.y - 30)),
            }}
            className="pointer-events-none absolute z-20 w-56 p-2.5 rounded-md bg-[var(--bg-surface)]/96 backdrop-blur-[2px] border border-[var(--border-strong)] shadow-xl text-[11px]"
          >
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[var(--border-subtle)]">
              <span
                className={`font-semibold tracking-wide ${
                  inspectedPositionMetrics.isLong ? 'text-[#089981]' : 'text-[#F23645]'
                }`}
              >
                {inspectedPositionMetrics.isLong ? 'LONG POSITION' : 'SHORT POSITION'}
              </span>
              <span className="font-mono tabular-nums font-bold text-[var(--text-primary)]">
                1:{inspectedPositionMetrics.rrRatio.toFixed(2)}
              </span>
            </div>

            <div className="space-y-1 font-mono tabular-nums">
              <div className="flex justify-between">
                <span className="font-sans text-[var(--text-secondary)]">Entry</span>
                <span className="text-[var(--text-primary)]">
                  {formatPrice(inspectedPositionData.entryPrice, instrument.decimals)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-[var(--text-secondary)]">Take Profit</span>
                <span className="text-[#089981]">
                  {formatPrice(inspectedPositionData.takeProfit, instrument.decimals)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-sans text-[var(--text-secondary)]">Stop Loss</span>
                <span className="text-[#F23645]">
                  {formatPrice(inspectedPositionData.stopLoss, instrument.decimals)}
                </span>
              </div>
            </div>

            <div className="mt-1.5 pt-1.5 border-t border-[var(--border-subtle)] space-y-1 font-mono tabular-nums">
              <div className="flex justify-between text-[#089981]">
                <span className="font-sans">Reward</span>
                <span>
                  {formatMetricNumber(inspectedPositionMetrics.rewardPips)}{' '}
                  {inspectedPositionMetrics.pipLabel} ·{' '}
                  {formatMetricNumber(inspectedPositionMetrics.rewardPoints)} pts
                </span>
              </div>
              <div className="flex justify-between text-[#F23645]">
                <span className="font-sans">Risk</span>
                <span>
                  {formatMetricNumber(inspectedPositionMetrics.riskPips)}{' '}
                  {inspectedPositionMetrics.pipLabel} ·{' '}
                  {formatMetricNumber(inspectedPositionMetrics.riskPoints)} pts
                </span>
              </div>
            </div>
          </div>
          );
        })()}

      {/* Inline Text / Note / Callout Draft */}
      {textDraft && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const def = getDrawingToolDef(textDraft.tool);
            const tplCfg = getDefaultConfigForTool(textDraft.tool, templates);
            const pts =
              pendingPoints.length >= 2
                ? pendingPoints
                : [{ index: textDraft.index, price: textDraft.price }];
            onAddDrawing({
              symbol: instrument.symbol,
              tool: textDraft.tool,
              category: def?.category ?? 'annotations',
              points: pts,
              text: textDraft.value.trim() || def?.name || 'Annotation',
              color: tplCfg.color ?? def?.defaultColor ?? '#2962FF',
              textColor: tplCfg.textColor,
              fontFamily: tplCfg.fontFamily,
              fontSize: tplCfg.fontSize,
              textAlign: tplCfg.textAlign,
              backgroundColor: tplCfg.backgroundColor,
              borderColor: tplCfg.borderColor,
              lineWidth: tplCfg.lineWidth ?? 1.5,
              lineStyle: tplCfg.lineStyle ?? 'solid',
              opacity: tplCfg.opacity ?? 1,
              visible: true,
              visibleIntervals: tplCfg.visibleIntervals,
              locked: false,
            });
            setTextDraft(null);
            setPendingPoints([]);
          }}
          style={{ left: Math.min(size.width - 210, textDraft.x), top: Math.min(size.height - 54, textDraft.y) }}
          className="absolute z-30 flex items-center gap-1 bg-[var(--bg-surface)] border border-[#2962FF] rounded p-1 shadow-xl"
        >
          <input
            autoFocus
            value={textDraft.value}
            onChange={(e) => setTextDraft({ ...textDraft, value: e.target.value })}
            placeholder="Enter label..."
            className="w-40 px-1.5 py-0.5 text-xs bg-transparent text-[var(--text-primary)] focus:outline-none"
          />
          <button
            type="submit"
            className="px-2 py-0.5 text-[11px] font-medium bg-[#2962FF] text-white rounded cursor-pointer"
          >
            Place
          </button>
        </form>
      )}

      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        onMouseLeave={() => {
          setHoverPos(null);
          setHoveredDrawingId(null);
          setHoveredHandle(null);
          handleMouseUp();
        }}
        onWheel={handleWheel}
        className={`block w-full h-full touch-none ${
          dragState
            ? 'cursor-move'
            : hoveredHandle
            ? 'cursor-grab'
            : activeTool === 'cursor'
            ? isPanning
              ? 'cursor-grabbing'
              : hoveredDrawingId
              ? 'cursor-pointer'
              : crosshairEnabled
              ? 'cursor-crosshair'
              : 'cursor-default'
            : 'cursor-crosshair'
        }`}
      />
    </div>
  );
}
