import React, { useEffect, useRef, useState } from 'react';
import {
  Crosshair,
  Eye,
  EyeOff,
  Infinity as InfinityIcon,
  Layers,
  Lock,
  Magnet,
  Redo2,
  Trash2,
  Undo2,
  Unlock,
  X,
  Eraser,
} from 'lucide-react';
import {
  ALL_DRAWING_TOOLS,
  CURSOR_TOOL_INFO,
  DRAWING_CATEGORIES,
  DrawingCategoryDef,
} from '../../data/drawingToolsCatalog';
import { DrawingCategoryId, DrawingTool } from '../../types/market';

interface DrawingToolbarProps {
  activeTool: DrawingTool;
  onSelectTool: (tool: DrawingTool) => void;
  categoryLastTool: Record<DrawingCategoryId, Exclude<DrawingTool, 'cursor'>>;
  stayInDrawingMode: boolean;
  onToggleStayInDrawingMode: () => void;
  magnetMode: boolean;
  onToggleMagnetMode: () => void;
  hideAllDrawings: boolean;
  onToggleHideAll: () => void;
  lockAllDrawings: boolean;
  onToggleLockAll: () => void;
  hasSelectedDrawing: boolean;
  hasAnyDrawings: boolean;
  onRemoveSelected: () => void;
  onRemoveAll: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  objectManagerOpen: boolean;
  onToggleObjectManager: () => void;
  drawingCount: number;
}

export function DrawingToolbar({
  activeTool,
  onSelectTool,
  categoryLastTool,
  stayInDrawingMode,
  onToggleStayInDrawingMode,
  magnetMode,
  onToggleMagnetMode,
  hideAllDrawings,
  onToggleHideAll,
  lockAllDrawings,
  onToggleLockAll,
  hasSelectedDrawing,
  hasAnyDrawings,
  onRemoveSelected,
  onRemoveAll,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  objectManagerOpen,
  onToggleObjectManager,
  drawingCount,
}: DrawingToolbarProps) {
  const [openCategoryId, setOpenCategoryId] = useState<DrawingCategoryId | null>(null);
  const [menuTop, setMenuTop] = useState<number>(8);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileCategory, setMobileCategory] = useState<DrawingCategoryId>('lines');
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openCategoryId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (railRef.current && !railRef.current.contains(e.target as Node)) {
        setOpenCategoryId(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenCategoryId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [openCategoryId]);

  const activeCategoryObj: DrawingCategoryDef | null = openCategoryId
    ? DRAWING_CATEGORIES.find((c) => c.id === openCategoryId) ?? null
    : null;

  const handleCategoryClick = (cat: DrawingCategoryDef, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const railRect = railRef.current?.getBoundingClientRect();
    if (railRect) {
      const relTop = Math.max(4, Math.min(railRect.height - 280, rect.top - railRect.top));
      setMenuTop(relTop);
    }
    setOpenCategoryId((prev) => (prev === cat.id ? null : cat.id));
  };

  const renderCategoryMenuContent = (cat: DrawingCategoryDef) => {
    // Group tools if subGroup exists (Category I: Brushes, Arrows, Shapes)
    const hasSubGroups = cat.tools.some((t) => t.subGroup);
    if (!hasSubGroups) {
      return (
        <div className="py-1">
          {cat.tools.map((tool) => {
            const Icon = tool.icon;
            const isSelected = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => {
                  onSelectTool(tool.id);
                  setOpenCategoryId(null);
                  setMobileDrawerOpen(false);
                }}
                className={`w-full px-3 py-1.5 flex items-center justify-between gap-3 text-left text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#2962FF]/15 text-[#2962FF] font-medium'
                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-3.5 h-3.5 shrink-0 opacity-85" />
                  <span className="truncate">{tool.name}</span>
                </span>
                {tool.shortcut && (
                  <kbd className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                    {tool.shortcut}
                  </kbd>
                )}
              </button>
            );
          })}
        </div>
      );
    }

    const subGroups = Array.from(new Set(cat.tools.map((t) => t.subGroup ?? 'General')));
    return (
      <div className="py-1">
        {subGroups.map((sg) => (
          <div key={sg} className="mb-1 last:mb-0">
            <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              {sg}
            </div>
            {cat.tools
              .filter((t) => (t.subGroup ?? 'General') === sg)
              .map((tool) => {
                const Icon = tool.icon;
                const isSelected = activeTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => {
                      onSelectTool(tool.id);
                      setOpenCategoryId(null);
                      setMobileDrawerOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 flex items-center justify-between gap-3 text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#2962FF]/15 text-[#2962FF] font-medium'
                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-3.5 h-3.5 shrink-0 opacity-85" />
                      <span className="truncate">{tool.name}</span>
                    </span>
                    {tool.shortcut && (
                      <kbd className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                        {tool.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {/* DESKTOP & TABLET VERTICAL DRAWING TOOLBAR */}
      <div
        ref={railRef}
        className="hidden sm:flex relative w-11 shrink-0 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex-col items-center justify-between select-none z-30"
      >
        {/* Top Scrollable Tool Categories */}
        <div className="w-full py-1.5 flex flex-col items-center gap-0.5 overflow-y-auto overflow-x-hidden">
          {/* Cursor / Crosshair */}
          <button
            type="button"
            title={`${CURSOR_TOOL_INFO.name} (${CURSOR_TOOL_INFO.shortcut})`}
            aria-label={CURSOR_TOOL_INFO.name}
            onClick={() => {
              onSelectTool('cursor');
              setOpenCategoryId(null);
            }}
            className={`w-8 h-8 flex items-center justify-center rounded transition-colors cursor-pointer shrink-0 ${
              activeTool === 'cursor'
                ? 'bg-[#2962FF]/15 text-[#2962FF]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
            }`}
          >
            <Crosshair className="w-4 h-4" />
          </button>

          <div className="w-6 h-px bg-[var(--border-subtle)] my-0.5 shrink-0" />

          {/* 10 Categorized Drawing Buttons */}
          {DRAWING_CATEGORIES.map((cat) => {
            const lastToolId = categoryLastTool[cat.id];
            const lastToolDef =
              ALL_DRAWING_TOOLS.find((t) => t.id === lastToolId) ?? cat.tools[0];
            const Icon = lastToolDef.icon;
            const isCategoryActive = cat.tools.some((t) => t.id === activeTool);
            const isMenuOpen = openCategoryId === cat.id;

            return (
              <div key={cat.id} className="relative flex items-center justify-center w-full">
                <button
                  type="button"
                  title={`${cat.shortLabel}: ${lastToolDef.name}${
                    lastToolDef.shortcut ? ` (${lastToolDef.shortcut})` : ''
                  } — Click for all ${cat.tools.length} tools`}
                  aria-label={`${cat.shortLabel} tools`}
                  onClick={(e) => handleCategoryClick(cat, e)}
                  className={`relative w-8 h-8 flex items-center justify-center rounded transition-colors cursor-pointer shrink-0 ${
                    isCategoryActive || isMenuOpen
                      ? 'bg-[#2962FF]/15 text-[#2962FF]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {/* Signature TradingView-style bottom-right category indicator */}
                  <span
                    className="absolute right-0.5 bottom-0.5 w-0 h-0 border-l-[4px] border-l-transparent border-b-[4px] border-b-current opacity-70"
                    aria-hidden="true"
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/* Separate Utility & Drawing Management Section */}
        <div className="w-full py-1.5 border-t border-[var(--border-subtle)] flex flex-col items-center gap-0.5 bg-[var(--bg-surface)] shrink-0">
          {/* Magnet Mode */}
          <button
            type="button"
            title={`Magnet Mode (Snap to OHLC): ${magnetMode ? 'ON' : 'OFF'}`}
            aria-label="Toggle Magnet Mode"
            onClick={onToggleMagnetMode}
            className={`w-8 h-7 flex items-center justify-center rounded transition-colors cursor-pointer ${
              magnetMode
                ? 'bg-[#2962FF]/18 text-[#2962FF]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
            }`}
          >
            <Magnet className="w-3.5 h-3.5" />
          </button>

          {/* Stay in Drawing Mode */}
          <button
            type="button"
            title={`Stay in Drawing Mode: ${stayInDrawingMode ? 'ON' : 'OFF'}`}
            aria-label="Toggle Stay in Drawing Mode"
            onClick={onToggleStayInDrawingMode}
            className={`w-8 h-7 flex items-center justify-center rounded transition-colors cursor-pointer ${
              stayInDrawingMode
                ? 'bg-[#2962FF]/18 text-[#2962FF]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
            }`}
          >
            <InfinityIcon className="w-3.5 h-3.5" />
          </button>

          {/* Lock / Unlock All Drawings */}
          <button
            type="button"
            title={lockAllDrawings ? 'Unlock All Drawings' : 'Lock All Drawings'}
            aria-label={lockAllDrawings ? 'Unlock All Drawings' : 'Lock All Drawings'}
            onClick={onToggleLockAll}
            className={`w-8 h-7 flex items-center justify-center rounded transition-colors cursor-pointer ${
              lockAllDrawings
                ? 'bg-[#F0B90B]/15 text-[#F0B90B]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
            }`}
          >
            {lockAllDrawings ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>

          {/* Hide / Show All Drawings */}
          <button
            type="button"
            title={hideAllDrawings ? 'Show All Drawings' : 'Hide All Drawings'}
            aria-label={hideAllDrawings ? 'Show All Drawings' : 'Hide All Drawings'}
            onClick={onToggleHideAll}
            className={`w-8 h-7 flex items-center justify-center rounded transition-colors cursor-pointer ${
              hideAllDrawings
                ? 'bg-[#F0B90B]/15 text-[#F0B90B]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
            }`}
          >
            {hideAllDrawings ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>

          <div className="w-6 h-px bg-[var(--border-subtle)] my-0.5" />

          {/* Undo / Redo */}
          <button
            type="button"
            title="Undo Drawing Action (Ctrl+Z)"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={onUndo}
            className="w-8 h-7 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] disabled:opacity-30 cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Redo Drawing Action (Ctrl+Y)"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={onRedo}
            className="w-8 h-7 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] disabled:opacity-30 cursor-pointer"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          {/* Remove Selected / Remove All */}
          <button
            type="button"
            title="Remove Selected Drawing (Delete)"
            aria-label="Remove Selected Drawing"
            disabled={!hasSelectedDrawing}
            onClick={onRemoveSelected}
            className="w-8 h-7 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[#F23645] hover:bg-[#F23645]/10 disabled:opacity-30 cursor-pointer"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Remove All Drawings"
            aria-label="Remove All Drawings"
            disabled={!hasAnyDrawings}
            onClick={onRemoveAll}
            className="w-8 h-7 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[#F23645] hover:bg-[#F23645]/10 disabled:opacity-30 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Object Manager Toggle */}
          <button
            type="button"
            title={`Drawing Object Manager (${drawingCount})`}
            aria-label="Toggle Drawing Object Manager"
            onClick={onToggleObjectManager}
            className={`relative w-8 h-7 flex items-center justify-center rounded transition-colors cursor-pointer ${
              objectManagerOpen
                ? 'bg-[#2962FF]/15 text-[#2962FF]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {drawingCount > 0 && (
              <span className="absolute -top-0.5 right-0 text-[9px] font-mono font-semibold text-[#2962FF]">
                {drawingCount}
              </span>
            )}
          </button>
        </div>

        {/* FLOATING SCROLLABLE CATEGORY DROPDOWN MENU */}
        {activeCategoryObj && (
          <div
            style={{ top: menuTop }}
            className="absolute left-11 ml-1 w-64 max-h-[68vh] flex flex-col bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-md shadow-2xl z-50 overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] flex items-center justify-between shrink-0">
              <span className="text-[11px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase">
                {activeCategoryObj.label}
              </span>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                {activeCategoryObj.tools.length}
              </span>
            </div>
            <div className="overflow-y-auto flex-1">
              {renderCategoryMenuContent(activeCategoryObj)}
            </div>
          </div>
        )}
      </div>

      {/* MOBILE BOTTOM COLLAPSIBLE DRAWING BAR */}
      <div className="sm:hidden fixed bottom-2 left-2 right-2 z-40">
        {mobileDrawerOpen && (
          <div className="mb-2 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-md shadow-2xl overflow-hidden max-h-[62vh] flex flex-col">
            <div className="px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Drawing Tools
              </span>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1 text-[var(--text-secondary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex overflow-x-auto gap-1 px-2 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
              {DRAWING_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setMobileCategory(cat.id)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded whitespace-nowrap shrink-0 ${
                    mobileCategory === cat.id
                      ? 'bg-[#2962FF] text-white'
                      : 'text-[var(--text-secondary)] bg-[var(--bg-surface)]'
                  }`}
                >
                  {cat.shortLabel}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto flex-1">
              {renderCategoryMenuContent(
                DRAWING_CATEGORIES.find((c) => c.id === mobileCategory) ?? DRAWING_CATEGORIES[0]
              )}
            </div>
          </div>
        )}

        <div className="h-11 px-2 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-md shadow-lg flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => onSelectTool('cursor')}
            className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1 ${
              activeTool === 'cursor'
                ? 'bg-[#2962FF]/15 text-[#2962FF]'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            <Crosshair className="w-4 h-4" />
            <span>Cursor</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileDrawerOpen((o) => !o)}
            className="px-3 py-1.5 rounded bg-[#2962FF] text-white text-xs font-medium"
          >
            {mobileDrawerOpen ? 'Close Tools' : 'Drawing Tools'}
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!canUndo}
              onClick={onUndo}
              className="p-1.5 text-[var(--text-secondary)] disabled:opacity-30"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToggleObjectManager}
              className="p-1.5 text-[var(--text-secondary)]"
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
