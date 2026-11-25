import React, { useEffect, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Bookmark,
  Clipboard,
  Copy,
  CopyPlus,
  Eye,
  EyeOff,
  Layers,
  Lock,
  MoreHorizontal,
  MoveHorizontal,
  Sliders,
  Trash2,
  Type,
  Unlock,
} from 'lucide-react';
import { DEFAULT_FIB_LEVELS, getDrawingToolDef } from '../../data/drawingToolsCatalog';
import { getToolCapabilities } from '../../data/drawingTemplatesCatalog';
import {
  ChartDrawing,
  Instrument,
  LineStyle,
  TextAlign,
  Timeframe,
} from '../../types/market';
import {
  ALL_TIMEFRAME_OPTIONS,
  computePositionMetrics,
  formatMetricNumber,
  validatePositionLevels,
} from '../../utils/positionMetrics';
import { Button, Input, Modal, Select } from '../ui/DesignSystem';

const COLOR_SWATCHES = [
  '#2962FF',
  '#089981',
  '#F23645',
  '#F0B90B',
  '#AB47BC',
  '#26A69A',
  '#FF6D00',
  '#D1D4DC',
  '#787B86',
  '#FFFFFF',
];

const FONT_FAMILIES = [
  'Plus Jakarta Sans',
  'IBM Plex Mono',
  'JetBrains Mono',
  'DM Sans',
  'Georgia',
];

export type VisualOrderAction = 'front' | 'back' | 'forward' | 'backward';

export interface SelectionBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  containerWidth: number;
  containerHeight: number;
}

interface DrawingContextualToolbarProps {
  drawing: ChartDrawing;
  instrument: Instrument;
  anchorBounds: SelectionBounds | null;
  hasClipboard: boolean;
  onUpdate: (id: string, patch: Partial<ChartDrawing>) => void;
  onClone: (id: string) => void;
  onCopy: (id: string) => void;
  onPaste: () => void;
  onDelete: (id: string) => void;
  onVisualOrder: (id: string, action: VisualOrderAction) => void;
  onOpenTemplates: () => void;
}

export function DrawingContextualToolbar({
  drawing,
  instrument,
  anchorBounds,
  hasClipboard,
  onUpdate,
  onClone,
  onCopy,
  onPaste,
  onDelete,
  onVisualOrder,
  onOpenTemplates,
}: DrawingContextualToolbarProps) {
  const [activePopover, setActivePopover] = useState<'lineColor' | 'fillColor' | 'text' | 'more' | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 90, left: 160 });
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'position' | 'intervals'>('general');

  // Position draft states for direct numerical editing with validation
  const isPosition = drawing.tool === 'long_position' || drawing.tool === 'short_position';
  const isLong = drawing.tool === 'long_position';
  const posData = drawing.positionData;

  const [draftEntry, setDraftEntry] = useState('');
  const [draftTp, setDraftTp] = useState('');
  const [draftSl, setDraftSl] = useState('');
  const [draftSize, setDraftSize] = useState('');
  const [posValidationError, setPosValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (posData) {
      setDraftEntry(posData.entryPrice.toFixed(instrument.decimals));
      setDraftTp(posData.takeProfit.toFixed(instrument.decimals));
      setDraftSl(posData.stopLoss.toFixed(instrument.decimals));
      setDraftSize(String(posData.positionSize));
      const v = validatePositionLevels(
        isLong,
        posData.entryPrice,
        posData.takeProfit,
        posData.stopLoss
      );
      setPosValidationError(v.validationMessage);
    }
  }, [
    drawing.id,
    posData?.entryPrice,
    posData?.takeProfit,
    posData?.stopLoss,
    posData?.positionSize,
    isLong,
    instrument.decimals,
  ]);

  const toolDef = getDrawingToolDef(drawing.tool);
  const caps = getToolCapabilities(drawing.tool, drawing.category);
  const fibLevels = drawing.fibLevels ?? DEFAULT_FIB_LEVELS;

  const openPopoverAt = (
    kind: 'lineColor' | 'fillColor' | 'text' | 'more',
    e: React.MouseEvent<HTMLButtonElement>,
    menuWidth = 190
  ) => {
    if (activePopover === kind) {
      setActivePopover(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setPopoverPos({
      top: Math.min(window.innerHeight - 260, rect.bottom + 6),
      left: Math.min(window.innerWidth - menuWidth - 8, Math.max(8, rect.left)),
    });
    setActivePopover(kind);
  };

  // Dynamic placement close to selected object without covering it
  const desktopBarStyle = React.useMemo<React.CSSProperties>(() => {
    if (!anchorBounds || typeof window !== 'undefined' && window.innerWidth < 768) {
      return {};
    }
    const cw = Math.max(400, anchorBounds.containerWidth);
    const ch = Math.max(300, anchorBounds.containerHeight);
    const estW = Math.min(cw - 24, 580);
    const cx = (anchorBounds.left + anchorBounds.right) / 2;
    const clampedLeft = Math.max(12, Math.min(cw - estW - 12, cx - estW / 2));

    // Prefer placing above the object; if too close to top, place below; if tall object, place at top edge
    let topPos = anchorBounds.top - 48;
    if (topPos < 42) {
      topPos = anchorBounds.bottom + 14;
      if (topPos > ch - 72) {
        topPos = 44;
      }
    }
    return {
      left: `${clampedLeft}px`,
      top: `${topPos}px`,
      transform: 'none',
    };
  }, [anchorBounds]);

  // Helper to commit independent position field updates
  const applyPositionFieldChange = (
    field: 'entry' | 'tp' | 'sl' | 'size',
    raw: string
  ) => {
    if (!posData) return;
    if (field === 'entry') setDraftEntry(raw);
    if (field === 'tp') setDraftTp(raw);
    if (field === 'sl') setDraftSl(raw);
    if (field === 'size') setDraftSize(raw);

    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setPosValidationError('Enter a valid positive number.');
      return;
    }

    if (field === 'size') {
      setPosValidationError(null);
      onUpdate(drawing.id, {
        positionData: { ...posData, positionSize: parsed },
      });
      return;
    }

    const nextEntry = field === 'entry' ? parsed : posData.entryPrice;
    const nextTp = field === 'tp' ? parsed : posData.takeProfit;
    const nextSl = field === 'sl' ? parsed : posData.stopLoss;

    const v = validatePositionLevels(isLong, nextEntry, nextTp, nextSl);
    setPosValidationError(v.validationMessage);
    if (!v.isValid) return;

    // Independent update: changing TP touches ONLY takeProfit; changing SL touches ONLY stopLoss
    onUpdate(drawing.id, {
      positionData: {
        ...posData,
        entryPrice: nextEntry,
        takeProfit: nextTp,
        stopLoss: nextSl,
      },
      points: [
        { index: posData.startIndex, price: nextEntry },
        { index: posData.endIndex, price: nextTp },
      ],
    });
  };

  const handleSwitchPositionSide = (targetSide: 'long_position' | 'short_position') => {
    if (!posData || targetSide === drawing.tool) return;
    const rewardDist = Math.abs(posData.takeProfit - posData.entryPrice);
    const riskDist = Math.abs(posData.entryPrice - posData.stopLoss);
    const nextIsLong = targetSide === 'long_position';
    const nextTp = nextIsLong
      ? posData.entryPrice + rewardDist
      : Math.max(0.0001, posData.entryPrice - rewardDist);
    const nextSl = nextIsLong
      ? Math.max(0.0001, posData.entryPrice - riskDist)
      : posData.entryPrice + riskDist;

    onUpdate(drawing.id, {
      tool: targetSide,
      color: nextIsLong ? posData.profitColor : posData.lossColor,
      positionData: {
        ...posData,
        takeProfit: nextTp,
        stopLoss: nextSl,
      },
      points: [
        { index: posData.startIndex, price: posData.entryPrice },
        { index: posData.endIndex, price: nextTp },
      ],
    });
  };

  const positionMetrics =
    isPosition && posData ? computePositionMetrics(isLong, posData, instrument) : null;

  const currentIntervals: Timeframe[] =
    drawing.visibleIntervals && drawing.visibleIntervals.length > 0
      ? drawing.visibleIntervals
      : ALL_TIMEFRAME_OPTIONS.map((o) => o.id);

  const toggleInterval = (tf: Timeframe) => {
    const exists = currentIntervals.includes(tf);
    let next = exists
      ? currentIntervals.filter((item) => item !== tf)
      : [...currentIntervals, tf];
    if (next.length === 0) next = [tf]; // keep at least one interval active
    onUpdate(drawing.id, {
      visibleIntervals:
        next.length === ALL_TIMEFRAME_OPTIONS.length ? undefined : next,
    });
  };

  return (
    <>
      <div
        style={desktopBarStyle}
        className="absolute top-11 left-1/2 -translate-x-1/2 md:translate-x-0 z-30 flex items-center gap-0.5 px-2 py-1 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-md shadow-xl max-w-[95%] overflow-x-auto transition-[top,left] duration-150"
      >
        {/* Object Title */}
        <span className="text-[11px] font-medium text-[var(--text-secondary)] px-1.5 whitespace-nowrap border-r border-[var(--border-subtle)] mr-0.5">
          {drawing.name || toolDef?.name}
        </span>

        {/* Line Colour */}
        <button
          type="button"
          title="Line Colour"
          onClick={(e) => openPopoverAt('lineColor', e, 176)}
          className="h-7 px-1.5 flex items-center gap-1 rounded hover:bg-[var(--bg-panel)] cursor-pointer shrink-0"
        >
          <span
            className="w-3.5 h-3.5 rounded-sm border border-white/25"
            style={{ backgroundColor: drawing.color }}
          />
        </button>

        {/* Fill Colour (for fillable objects) */}
        {caps.hasFill && (
          <button
            type="button"
            title="Fill Colour"
            onClick={(e) => openPopoverAt('fillColor', e, 176)}
            className="h-7 px-1.5 flex items-center gap-1 rounded hover:bg-[var(--bg-panel)] cursor-pointer shrink-0"
          >
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/25"
              style={{
                backgroundColor: drawing.fillColor ?? drawing.color,
                opacity: Math.max(0.35, drawing.fillOpacity ?? 0.5),
              }}
            />
          </button>
        )}

        {/* Line Width */}
        {caps.hasLineStyle && (
          <select
            aria-label="Line thickness"
            title="Line Thickness"
            value={drawing.lineWidth}
            onChange={(e) => onUpdate(drawing.id, { lineWidth: Number(e.target.value) })}
            className="h-7 px-1 text-[11px] font-mono bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-panel)] rounded focus:outline-none cursor-pointer shrink-0"
          >
            <option value={1} className="bg-[var(--bg-surface)]">1px</option>
            <option value={2} className="bg-[var(--bg-surface)]">2px</option>
            <option value={3} className="bg-[var(--bg-surface)]">3px</option>
            <option value={4} className="bg-[var(--bg-surface)]">4px</option>
          </select>
        )}

        {/* Line Style */}
        {caps.hasLineStyle && (
          <select
            aria-label="Line style"
            title="Line Style"
            value={drawing.lineStyle}
            onChange={(e) => onUpdate(drawing.id, { lineStyle: e.target.value as LineStyle })}
            className="h-7 px-1 text-[11px] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-panel)] rounded focus:outline-none cursor-pointer shrink-0"
          >
            <option value="solid" className="bg-[var(--bg-surface)]">Solid</option>
            <option value="dashed" className="bg-[var(--bg-surface)]">Dashed</option>
            <option value="dotted" className="bg-[var(--bg-surface)]">Dotted</option>
          </select>
        )}

        {/* Transparency */}
        <div
          className="hidden sm:flex items-center gap-1 px-1.5 border-l border-[var(--border-subtle)] shrink-0"
          title="Transparency"
        >
          <span className="text-[10px] font-mono text-[var(--text-muted)]">
            {Math.round(drawing.opacity * 100)}%
          </span>
          <input
            type="range"
            min={0.15}
            max={1}
            step={0.05}
            value={drawing.opacity}
            onChange={(e) => onUpdate(drawing.id, { opacity: Number(e.target.value) })}
            className="w-11 accent-[#2962FF] cursor-pointer"
          />
        </div>

        {/* Text Settings quick button for annotation/text tools */}
        {(caps.hasText || caps.hasTable) && (
          <button
            type="button"
            title="Text & Typography Settings"
            onClick={(e) => openPopoverAt('text', e, 240)}
            className={`h-7 px-1.5 flex items-center gap-1 rounded text-[11px] font-medium cursor-pointer shrink-0 ${
              activePopover === 'text'
                ? 'bg-[#2962FF]/20 text-[#2962FF]'
                : 'text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Text</span>
          </button>
        )}

        {/* Extend Left / Right */}
        {caps.hasExtend && (
          <div className="hidden md:flex items-center gap-0.5 pl-1 border-l border-[var(--border-subtle)] shrink-0">
            <button
              type="button"
              title="Extend Left"
              onClick={() => onUpdate(drawing.id, { extendLeft: !drawing.extendLeft })}
              className={`h-7 px-1.5 text-[10px] font-mono rounded cursor-pointer ${
                drawing.extendLeft
                  ? 'bg-[#2962FF]/20 text-[#2962FF]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-panel)]'
              }`}
            >
              ←Ext
            </button>
            <button
              type="button"
              title="Extend Right"
              onClick={() => onUpdate(drawing.id, { extendRight: !drawing.extendRight })}
              className={`h-7 px-1.5 text-[10px] font-mono rounded cursor-pointer ${
                drawing.extendRight
                  ? 'bg-[#2962FF]/20 text-[#2962FF]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-panel)]'
              }`}
            >
              Ext→
            </button>
          </div>
        )}

        <div className="h-4 w-px bg-[var(--border-subtle)] mx-0.5 shrink-0" />

        {/* Template Button */}
        <button
          type="button"
          title="Manage & Apply Drawing Templates"
          onClick={onOpenTemplates}
          className="h-7 px-2 flex items-center gap-1 rounded text-[11px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer whitespace-nowrap shrink-0"
        >
          <Bookmark className="w-3 h-3 text-[#2962FF]" />
          <span className="hidden sm:inline">Template</span>
        </button>

        {/* Settings Button */}
        <button
          type="button"
          title={isPosition ? 'Position Settings (Entry, TP, SL, Risk/Reward)' : 'Drawing Settings'}
          onClick={() => {
            setSettingsTab(isPosition ? 'position' : 'general');
            setSettingsModalOpen(true);
          }}
          className="h-7 px-2 flex items-center gap-1 rounded text-[11px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer whitespace-nowrap shrink-0"
        >
          <Sliders className="w-3 h-3" />
          <span className="hidden sm:inline">Settings</span>
        </button>

        {/* Clone */}
        <button
          type="button"
          title="Clone Drawing"
          onClick={() => onClone(drawing.id)}
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer shrink-0"
        >
          <CopyPlus className="w-3.5 h-3.5" />
        </button>

        {/* Copy */}
        <button
          type="button"
          title="Copy Drawing (Ctrl+C)"
          onClick={() => onCopy(drawing.id)}
          className="w-7 h-7 hidden sm:flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer shrink-0"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>

        {/* Lock / Unlock */}
        <button
          type="button"
          title={drawing.locked ? 'Unlock Drawing' : 'Lock Drawing'}
          onClick={() => onUpdate(drawing.id, { locked: !drawing.locked })}
          className={`w-7 h-7 flex items-center justify-center rounded cursor-pointer shrink-0 ${
            drawing.locked
              ? 'text-[#F0B90B] bg-[#F0B90B]/15'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
          }`}
        >
          {drawing.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>

        {/* Hide */}
        <button
          type="button"
          title={drawing.visible ? 'Hide Drawing' : 'Show Drawing'}
          onClick={() => onUpdate(drawing.id, { visible: !drawing.visible })}
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer shrink-0"
        >
          {drawing.visible ? (
            <Eye className="w-3.5 h-3.5" />
          ) : (
            <EyeOff className="w-3.5 h-3.5 text-[#F0B90B]" />
          )}
        </button>

        {/* Delete */}
        <button
          type="button"
          title="Delete Drawing (Delete)"
          onClick={() => onDelete(drawing.id)}
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[#F23645] hover:bg-[#F23645]/10 cursor-pointer shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* More Options Menu */}
        <button
          type="button"
          title="More Options (Visual Order, Visibility on Interval, Copy/Paste)"
          onClick={(e) => openPopoverAt('more', e, 224)}
          className={`w-7 h-7 flex items-center justify-center rounded cursor-pointer shrink-0 ${
            activePopover === 'more'
              ? 'bg-[#2962FF]/15 text-[#2962FF]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
          }`}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* PORTALED/FIXED POPOVERS */}
      {activePopover && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setActivePopover(null)}
        />
      )}

      {/* Line Color or Fill Color Popover */}
      {(activePopover === 'lineColor' || activePopover === 'fillColor') && (
        <div
          style={{ top: popoverPos.top, left: popoverPos.left }}
          className="fixed p-2.5 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-md shadow-xl z-50 w-44"
        >
          <div className="text-[11px] font-semibold text-[var(--text-secondary)] mb-2">
            {activePopover === 'fillColor' ? 'Fill Colour' : 'Line Colour'}
          </div>
          <div className="grid grid-cols-5 gap-1.5 mb-2">
            {COLOR_SWATCHES.map((c) => {
              const current =
                activePopover === 'fillColor'
                  ? drawing.fillColor ?? drawing.color
                  : drawing.color;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    if (activePopover === 'fillColor') {
                      onUpdate(drawing.id, { fillColor: c });
                    } else {
                      onUpdate(drawing.id, { color: c });
                    }
                    setActivePopover(null);
                  }}
                  className={`w-6 h-6 rounded-sm border cursor-pointer ${
                    current === c ? 'border-white scale-105' : 'border-white/15'
                  }`}
                  style={{ backgroundColor: c }}
                />
              );
            })}
          </div>
          {activePopover === 'fillColor' && (
            <div className="py-1.5 border-t border-[var(--border-subtle)] space-y-1">
              <div className="flex justify-between text-[10px] text-[var(--text-secondary)] font-mono">
                <span>Fill Opacity</span>
                <span>{Math.round((drawing.fillOpacity ?? 0.16) * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.04}
                max={0.8}
                step={0.04}
                value={drawing.fillOpacity ?? 0.16}
                onChange={(e) =>
                  onUpdate(drawing.id, { fillOpacity: Number(e.target.value) })
                }
                className="w-full accent-[#2962FF] cursor-pointer"
              />
            </div>
          )}
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] pt-1.5 border-t border-[var(--border-subtle)]">
            <span>Custom</span>
            <input
              type="color"
              value={
                activePopover === 'fillColor'
                  ? drawing.fillColor ?? drawing.color
                  : drawing.color
              }
              onChange={(e) => {
                if (activePopover === 'fillColor') {
                  onUpdate(drawing.id, { fillColor: e.target.value });
                } else {
                  onUpdate(drawing.id, { color: e.target.value });
                }
              }}
              className="w-7 h-5 bg-transparent cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Text & Typography Popover */}
      {activePopover === 'text' && (
        <div
          style={{ top: popoverPos.top, left: popoverPos.left }}
          className="fixed p-3 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-md shadow-xl z-50 w-60 space-y-2.5"
        >
          <div className="text-xs font-semibold text-[var(--text-primary)]">
            Text Settings
          </div>
          <div>
            <label className="block text-[10px] text-[var(--text-muted)] mb-1">
              Content
            </label>
            <Input
              value={drawing.text ?? ''}
              onChange={(e) => onUpdate(drawing.id, { text: e.target.value })}
              className="h-7 text-xs"
              placeholder="Annotation text..."
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-1">
                Font Family
              </label>
              <Select
                value={drawing.fontFamily ?? 'Plus Jakarta Sans'}
                onChange={(e) => onUpdate(drawing.id, { fontFamily: e.target.value })}
                className="w-full h-7 text-[11px]"
              >
                {FONT_FAMILIES.map((ff) => (
                  <option key={ff} value={ff}>
                    {ff}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] mb-1">
                Size (px)
              </label>
              <Select
                value={drawing.fontSize ?? 12}
                onChange={(e) => onUpdate(drawing.id, { fontSize: Number(e.target.value) })}
                className="w-full h-7 text-[11px] font-mono"
              >
                {[10, 11, 12, 14, 16, 18, 22].map((sz) => (
                  <option key={sz} value={sz}>
                    {sz}px
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-muted)]">Alignment</span>
            <div className="flex items-center gap-0.5 bg-[var(--bg-canvas)] p-0.5 rounded border border-[var(--border-subtle)]">
              {(['left', 'center', 'right'] as TextAlign[]).map((align) => {
                const Icon =
                  align === 'left'
                    ? AlignLeft
                    : align === 'center'
                    ? AlignCenter
                    : AlignRight;
                return (
                  <button
                    key={align}
                    type="button"
                    onClick={() => onUpdate(drawing.id, { textAlign: align })}
                    className={`p-1 rounded cursor-pointer ${
                      (drawing.textAlign ?? 'left') === align
                        ? 'bg-[#2962FF]/20 text-[#2962FF]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[var(--border-subtle)]">
            <label className="flex flex-col items-center gap-1 text-[10px] text-[var(--text-muted)]">
              Text
              <input
                type="color"
                value={drawing.textColor ?? drawing.color}
                onChange={(e) => onUpdate(drawing.id, { textColor: e.target.value })}
                className="w-7 h-5 bg-transparent cursor-pointer"
              />
            </label>
            <label className="flex flex-col items-center gap-1 text-[10px] text-[var(--text-muted)]">
              Background
              <input
                type="color"
                value={drawing.backgroundColor ?? '#1E222D'}
                onChange={(e) =>
                  onUpdate(drawing.id, { backgroundColor: e.target.value })
                }
                className="w-7 h-5 bg-transparent cursor-pointer"
              />
            </label>
            <label className="flex flex-col items-center gap-1 text-[10px] text-[var(--text-muted)]">
              Border
              <input
                type="color"
                value={drawing.borderColor ?? drawing.color}
                onChange={(e) => onUpdate(drawing.id, { borderColor: e.target.value })}
                className="w-7 h-5 bg-transparent cursor-pointer"
              />
            </label>
          </div>
        </div>
      )}

      {/* MORE OPTIONS MENU */}
      {activePopover === 'more' && (
        <div
          style={{ top: popoverPos.top, left: popoverPos.left }}
          className="fixed py-1.5 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-md shadow-2xl z-50 w-56 text-xs"
        >
          <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase flex items-center gap-1.5">
            <Layers className="w-3 h-3" />
            Visual Order
          </div>
          <button
            type="button"
            onClick={() => {
              onVisualOrder(drawing.id, 'front');
              setActivePopover(null);
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            <ArrowUpToLine className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            Bring to Front
          </button>
          <button
            type="button"
            onClick={() => {
              onVisualOrder(drawing.id, 'back');
              setActivePopover(null);
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            <ArrowDownToLine className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            Send to Back
          </button>
          <button
            type="button"
            onClick={() => {
              onVisualOrder(drawing.id, 'forward');
              setActivePopover(null);
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            <ArrowUp className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            Bring Forward
          </button>
          <button
            type="button"
            onClick={() => {
              onVisualOrder(drawing.id, 'backward');
              setActivePopover(null);
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            <ArrowDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            Send Backward
          </button>

          <div className="my-1 border-t border-[var(--border-subtle)]" />
          <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
            Visibility
          </div>
          <button
            type="button"
            onClick={() => {
              setSettingsTab('intervals');
              setSettingsModalOpen(true);
              setActivePopover(null);
            }}
            className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              Visibility on Interval
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {drawing.visibleIntervals?.length ?? 'All'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              onUpdate(drawing.id, { visible: !drawing.visible });
              setActivePopover(null);
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            {drawing.visible ? (
              <EyeOff className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            ) : (
              <Eye className="w-3.5 h-3.5 text-[#089981]" />
            )}
            {drawing.visible ? 'Hide' : 'Show'}
          </button>

          <div className="my-1 border-t border-[var(--border-subtle)]" />
          <button
            type="button"
            onClick={() => {
              onUpdate(drawing.id, { locked: !drawing.locked });
              setActivePopover(null);
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            {drawing.locked ? (
              <Unlock className="w-3.5 h-3.5 text-[#F0B90B]" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            )}
            {drawing.locked ? 'Unlock Drawing' : 'Lock Drawing'}
          </button>
          <button
            type="button"
            onClick={() => {
              onClone(drawing.id);
              setActivePopover(null);
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            <CopyPlus className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            Clone
          </button>
          <button
            type="button"
            onClick={() => {
              onCopy(drawing.id);
              setActivePopover(null);
            }}
            className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              Copy
            </span>
            <kbd className="text-[10px] font-mono text-[var(--text-muted)]">Ctrl+C</kbd>
          </button>
          <button
            type="button"
            disabled={!hasClipboard}
            onClick={() => {
              onPaste();
              setActivePopover(null);
            }}
            className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[var(--text-primary)] hover:bg-[var(--bg-panel)] disabled:opacity-35 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Clipboard className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              Paste
            </span>
            <kbd className="text-[10px] font-mono text-[var(--text-muted)]">Ctrl+V</kbd>
          </button>

          <div className="my-1 border-t border-[var(--border-subtle)]" />
          <button
            type="button"
            onClick={() => {
              onDelete(drawing.id);
              setActivePopover(null);
            }}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[#F23645] hover:bg-[#F23645]/10 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}

      {/* COMPREHENSIVE DRAWING & POSITION SETTINGS MODAL */}
      <Modal
        open={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        title={`${toolDef?.name ?? 'Drawing'} Settings`}
        subtitle="Configure coordinates, position risk parameters, style, and timeframe visibility"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded">
            {isPosition && (
              <button
                type="button"
                onClick={() => setSettingsTab('position')}
                className={`px-3 py-1.5 text-xs font-medium rounded-sm cursor-pointer ${
                  settingsTab === 'position'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                Position Parameters
              </button>
            )}
            <button
              type="button"
              onClick={() => setSettingsTab('general')}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm cursor-pointer ${
                settingsTab === 'general'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              Properties & Style
            </button>
            <button
              type="button"
              onClick={() => setSettingsTab('intervals')}
              className={`px-3 py-1.5 text-xs font-medium rounded-sm cursor-pointer ${
                settingsTab === 'intervals'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              Visibility on Interval
            </button>
          </div>

          {/* TAB 1: LONG / SHORT POSITION SETTINGS */}
          {settingsTab === 'position' && isPosition && posData && positionMetrics && (
            <div className="space-y-4">
              {/* Position Side Switcher */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Position Type
                </span>
                <div className="grid grid-cols-2 gap-1 p-0.5 bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded">
                  <button
                    type="button"
                    onClick={() => handleSwitchPositionSide('long_position')}
                    className={`px-3 py-1 text-xs font-semibold rounded-sm cursor-pointer ${
                      isLong
                        ? 'bg-[#089981] text-white'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Long Position
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchPositionSide('short_position')}
                    className={`px-3 py-1 text-xs font-semibold rounded-sm cursor-pointer ${
                      !isLong
                        ? 'bg-[#F23645] text-white'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Short Position
                  </button>
                </div>
              </div>

              {/* Independent Price Inputs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-[#2962FF] mb-1">
                    Entry Price
                  </label>
                  <Input
                    type="number"
                    step={Math.pow(10, -instrument.decimals)}
                    value={draftEntry}
                    onChange={(e) => applyPositionFieldChange('entry', e.target.value)}
                    className="font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#089981] mb-1">
                    Take Profit (TP)
                  </label>
                  <Input
                    type="number"
                    step={Math.pow(10, -instrument.decimals)}
                    value={draftTp}
                    onChange={(e) => applyPositionFieldChange('tp', e.target.value)}
                    className="font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#F23645] mb-1">
                    Stop Loss (SL)
                  </label>
                  <Input
                    type="number"
                    step={Math.pow(10, -instrument.decimals)}
                    value={draftSl}
                    onChange={(e) => applyPositionFieldChange('sl', e.target.value)}
                    className="font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                    Position Size
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min="0.0001"
                    value={draftSize}
                    onChange={(e) => applyPositionFieldChange('size', e.target.value)}
                    className="font-mono tabular-nums"
                  />
                </div>
              </div>

              {posValidationError && (
                <div className="p-2.5 rounded bg-[#F23645]/12 border border-[#F23645]/35 text-xs text-[#F23645]">
                  {posValidationError}
                </div>
              )}

              {/* Calculated Risk / Reward Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs">
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block">
                    Risk / Reward Ratio
                  </span>
                  <span className="font-mono tabular-nums font-bold text-[var(--text-primary)]">
                    1 : {positionMetrics.rrRatio.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block">
                    Reward Amount
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-[#089981]">
                    +${positionMetrics.rewardAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block">
                    Risk Amount
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-[#F23645]">
                    -${positionMetrics.riskAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block">
                    Profit Percentage
                  </span>
                  <span className="font-mono tabular-nums text-[#089981]">
                    +{positionMetrics.profitPct.toFixed(2)}% ({formatMetricNumber(positionMetrics.rewardPips)} {positionMetrics.pipLabel})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block">
                    Loss Percentage
                  </span>
                  <span className="font-mono tabular-nums text-[#F23645]">
                    -{positionMetrics.lossPct.toFixed(2)}% ({formatMetricNumber(positionMetrics.riskPips)} {positionMetrics.pipLabel})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] block">
                    Points (Reward / Risk)
                  </span>
                  <span className="font-mono tabular-nums text-[var(--text-primary)]">
                    {formatMetricNumber(positionMetrics.rewardPoints)} / {formatMetricNumber(positionMetrics.riskPoints)} pts
                  </span>
                </div>
              </div>

              {/* Position Zone Colours */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                <label className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs">
                  <span className="text-[var(--text-secondary)]">Profit Zone</span>
                  <input
                    type="color"
                    value={posData.profitColor}
                    onChange={(e) =>
                      onUpdate(drawing.id, {
                        positionData: { ...posData, profitColor: e.target.value },
                      })
                    }
                    className="w-6 h-5 bg-transparent cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs">
                  <span className="text-[var(--text-secondary)]">Loss Zone</span>
                  <input
                    type="color"
                    value={posData.lossColor}
                    onChange={(e) =>
                      onUpdate(drawing.id, {
                        positionData: { ...posData, lossColor: e.target.value },
                      })
                    }
                    className="w-6 h-5 bg-transparent cursor-pointer"
                  />
                </label>
                <label className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs">
                  <span className="text-[var(--text-secondary)]">Entry Line</span>
                  <input
                    type="color"
                    value={posData.entryColor}
                    onChange={(e) =>
                      onUpdate(drawing.id, {
                        positionData: { ...posData, entryColor: e.target.value },
                      })
                    }
                    className="w-6 h-5 bg-transparent cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: GENERAL PROPERTIES, TEXT, FIB LEVELS & COORDINATES */}
          {settingsTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                    Object Name
                  </label>
                  <Input
                    value={drawing.name}
                    onChange={(e) => onUpdate(drawing.id, { name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                    Group
                  </label>
                  <Select
                    value={drawing.groupName}
                    onChange={(e) => onUpdate(drawing.id, { groupName: e.target.value })}
                    className="w-full"
                  >
                    <option value="Default">Default</option>
                    <option value="Macro Levels">Macro Levels</option>
                    <option value="Fibonacci & Gann">Fibonacci & Gann</option>
                    <option value="Volume Zones">Volume Zones</option>
                    <option value="Trade Setups">Trade Setups</option>
                    <option value="Annotations">Annotations</option>
                  </Select>
                </div>
              </div>

              {caps.hasText && (
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                    Annotation Text
                  </label>
                  <Input
                    value={drawing.text ?? ''}
                    onChange={(e) => onUpdate(drawing.id, { text: e.target.value })}
                    placeholder="Enter text, note, or comment..."
                  />
                </div>
              )}

              {caps.hasTable && (
                <div>
                  <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                    Table Cells (CSV rows)
                  </label>
                  <textarea
                    rows={3}
                    value={(drawing.tableRows ?? [['Metric', 'Level'], ['Target', 'Active']])
                      .map((r) => r.join(', '))
                      .join('\n')}
                    onChange={(e) => {
                      const rows = e.target.value
                        .split('\n')
                        .map((line) => line.split(',').map((cell) => cell.trim()));
                      onUpdate(drawing.id, { tableRows: rows });
                    }}
                    className="w-full p-2 text-xs font-mono bg-[var(--bg-canvas)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded focus:outline-none focus:border-[#2962FF]"
                  />
                </div>
              )}

              {!isPosition && (
                <div>
                  <div className="text-[11px] font-medium text-[var(--text-secondary)] mb-1.5 flex items-center gap-1.5">
                    <MoveHorizontal className="w-3.5 h-3.5" />
                    <span>Anchor Coordinates ({drawing.points.length} points)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {drawing.points.slice(0, 4).map((pt, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] space-y-1"
                      >
                        <div className="text-[10px] font-mono text-[var(--text-muted)]">
                          Anchor #{idx + 1} (Bar {pt.index})
                        </div>
                        <Input
                          type="number"
                          step={Math.pow(10, -instrument.decimals)}
                          value={Number(pt.price.toFixed(instrument.decimals))}
                          onChange={(e) => {
                            const nextPrice = parseFloat(e.target.value);
                            if (!Number.isFinite(nextPrice)) return;
                            const nextPts = drawing.points.map((p, pIdx) =>
                              pIdx === idx ? { ...p, price: nextPrice } : p
                            );
                            onUpdate(drawing.id, { points: nextPts });
                          }}
                          className="font-mono h-7"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {caps.hasFibLevels && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                      Fibonacci Levels & Colors
                    </span>
                    <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={drawing.showLabels ?? true}
                        onChange={() =>
                          onUpdate(drawing.id, { showLabels: !(drawing.showLabels ?? true) })
                        }
                        className="accent-[#2962FF]"
                      />
                      Show Price Labels
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {fibLevels.map((lvl, idx) => (
                      <div
                        key={lvl.ratio}
                        className="flex items-center justify-between px-2 py-1.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)]"
                      >
                        <label className="flex items-center gap-2 text-xs font-mono text-[var(--text-primary)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={lvl.enabled}
                            onChange={() => {
                              const next = fibLevels.map((f, fIdx) =>
                                fIdx === idx ? { ...f, enabled: !f.enabled } : f
                              );
                              onUpdate(drawing.id, { fibLevels: next });
                            }}
                            className="accent-[#2962FF]"
                          />
                          <span>{(lvl.ratio * 100).toFixed(1)}%</span>
                        </label>
                        <input
                          type="color"
                          value={lvl.color}
                          onChange={(e) => {
                            const next = fibLevels.map((f, fIdx) =>
                              fIdx === idx ? { ...f, color: e.target.value } : f
                            );
                            onUpdate(drawing.id, { fibLevels: next });
                          }}
                          className="w-5 h-4 bg-transparent cursor-pointer"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VISIBILITY ON INTERVAL */}
          {settingsTab === 'intervals' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[var(--text-secondary)]">
                  Select chart timeframes where this drawing is visible:
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onUpdate(drawing.id, { visibleIntervals: undefined })}
                    className="text-[11px] font-medium text-[#2962FF] hover:underline cursor-pointer"
                  >
                    Enable All
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdate(drawing.id, {
                        visibleIntervals: ['1m', '5m', '15m', '30m', '1h', '4h'],
                      })
                    }
                    className="text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    Intraday Only
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {ALL_TIMEFRAME_OPTIONS.map((opt) => {
                  const enabled = currentIntervals.includes(opt.id);
                  return (
                    <label
                      key={opt.id}
                      className={`flex items-center justify-between px-3 py-2 rounded border cursor-pointer transition-colors ${
                        enabled
                          ? 'bg-[#2962FF]/12 border-[#2962FF]/40 text-[var(--text-primary)]'
                          : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-muted)]'
                      }`}
                    >
                      <span className="text-xs font-medium">{opt.label}</span>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => toggleInterval(opt.id)}
                        className="accent-[#2962FF] cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Drawings hidden on the current timeframe remain saved in the Object Tree.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
            <Button
              size="xs"
              variant="secondary"
              onClick={() => {
                setSettingsModalOpen(false);
                onOpenTemplates();
              }}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Save as Template
            </Button>
            <Button variant="primary" onClick={() => setSettingsModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
