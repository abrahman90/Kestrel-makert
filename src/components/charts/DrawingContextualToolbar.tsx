import React, { useState } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  Lock,
  MoveHorizontal,
  Sliders,
  Trash2,
  Unlock,
} from 'lucide-react';
import { DEFAULT_FIB_LEVELS, getDrawingToolDef } from '../../data/drawingToolsCatalog';
import { ChartDrawing, LineStyle } from '../../types/market';
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

interface DrawingContextualToolbarProps {
  drawing: ChartDrawing;
  onUpdate: (id: string, patch: Partial<ChartDrawing>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  decimals: number;
}

export function DrawingContextualToolbar({
  drawing,
  onUpdate,
  onDuplicate,
  onDelete,
  decimals,
}: DrawingContextualToolbarProps) {
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [colorMenuPos, setColorMenuPos] = useState<{ top: number; left: number }>({
    top: 90,
    left: 160,
  });
  const [moreModalOpen, setMoreModalOpen] = useState(false);

  const toolDef = getDrawingToolDef(drawing.tool);
  const supportsExtend =
    drawing.category === 'lines' ||
    drawing.category === 'channels' ||
    drawing.tool === 'fib_channel';
  const isFibTool = drawing.category === 'fibonacci';
  const isAnnotation = drawing.category === 'annotations';

  const fibLevels = drawing.fibLevels ?? DEFAULT_FIB_LEVELS;

  return (
    <>
      <div className="absolute top-11 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-2 py-1 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-md shadow-xl max-w-[94%] overflow-x-auto">
        {/* Tool Name Badge */}
        <span className="text-[11px] font-medium text-[var(--text-secondary)] px-1.5 whitespace-nowrap border-r border-[var(--border-subtle)] mr-0.5">
          {drawing.name || toolDef?.name}
        </span>

        {/* Color Picker */}
        <div className="relative shrink-0">
          <button
            type="button"
            title="Drawing Color"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setColorMenuPos({
                top: rect.bottom + 6,
                left: Math.min(window.innerWidth - 188, Math.max(8, rect.left)),
              });
              setColorMenuOpen((o) => !o);
            }}
            className="h-7 px-1.5 flex items-center gap-1 rounded hover:bg-[var(--bg-panel)] cursor-pointer"
          >
            <span
              className="w-3.5 h-3.5 rounded-sm border border-white/25"
              style={{ backgroundColor: drawing.color }}
            />
          </button>

          {colorMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setColorMenuOpen(false)}
              />
              <div
                style={{ top: colorMenuPos.top, left: colorMenuPos.left }}
                className="fixed p-2 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-md shadow-xl z-50 w-44"
              >
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {COLOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        onUpdate(drawing.id, { color: c });
                        setColorMenuOpen(false);
                      }}
                      className={`w-6 h-6 rounded-sm border cursor-pointer ${
                        drawing.color === c ? 'border-white scale-105' : 'border-white/15'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] pt-1 border-t border-[var(--border-subtle)]">
                  <span>Custom</span>
                  <input
                    type="color"
                    value={drawing.color}
                    onChange={(e) => onUpdate(drawing.id, { color: e.target.value })}
                    className="w-7 h-5 bg-transparent cursor-pointer"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Line Thickness */}
        <select
          aria-label="Line thickness"
          title="Line Thickness"
          value={drawing.lineWidth}
          onChange={(e) => onUpdate(drawing.id, { lineWidth: Number(e.target.value) })}
          className="h-7 px-1.5 text-[11px] font-mono bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-panel)] rounded focus:outline-none cursor-pointer"
        >
          <option value={1} className="bg-[var(--bg-surface)]">1px</option>
          <option value={2} className="bg-[var(--bg-surface)]">2px</option>
          <option value={3} className="bg-[var(--bg-surface)]">3px</option>
          <option value={4} className="bg-[var(--bg-surface)]">4px</option>
        </select>

        {/* Line Style */}
        <select
          aria-label="Line style"
          title="Line Style"
          value={drawing.lineStyle}
          onChange={(e) => onUpdate(drawing.id, { lineStyle: e.target.value as LineStyle })}
          className="h-7 px-1.5 text-[11px] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-panel)] rounded focus:outline-none cursor-pointer"
        >
          <option value="solid" className="bg-[var(--bg-surface)]">Solid</option>
          <option value="dashed" className="bg-[var(--bg-surface)]">Dashed</option>
          <option value="dotted" className="bg-[var(--bg-surface)]">Dotted</option>
        </select>

        {/* Transparency */}
        <div className="flex items-center gap-1 px-1.5 border-l border-[var(--border-subtle)]" title="Transparency">
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
            className="w-12 accent-[#2962FF] cursor-pointer"
          />
        </div>

        {/* Extend Left / Right */}
        {supportsExtend && (
          <div className="flex items-center gap-0.5 pl-1 border-l border-[var(--border-subtle)]">
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

        <div className="h-4 w-px bg-[var(--border-subtle)] mx-0.5" />

        {/* Visibility */}
        <button
          type="button"
          title={drawing.visible ? 'Hide Drawing' : 'Show Drawing'}
          onClick={() => onUpdate(drawing.id, { visible: !drawing.visible })}
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
        >
          {drawing.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-[#F0B90B]" />}
        </button>

        {/* Lock / Unlock */}
        <button
          type="button"
          title={drawing.locked ? 'Unlock Drawing' : 'Lock Drawing'}
          onClick={() => onUpdate(drawing.id, { locked: !drawing.locked })}
          className={`w-7 h-7 flex items-center justify-center rounded cursor-pointer ${
            drawing.locked
              ? 'text-[#F0B90B] bg-[#F0B90B]/15'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
          }`}
        >
          {drawing.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>

        {/* Duplicate */}
        <button
          type="button"
          title="Duplicate Drawing"
          onClick={() => onDuplicate(drawing.id)}
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>

        {/* Delete */}
        <button
          type="button"
          title="Delete Drawing (Delete)"
          onClick={() => onDelete(drawing.id)}
          className="w-7 h-7 flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[#F23645] hover:bg-[#F23645]/10 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* More Settings */}
        <button
          type="button"
          title="More Settings"
          onClick={() => setMoreModalOpen(true)}
          className="h-7 px-2 flex items-center gap-1 rounded text-[11px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer whitespace-nowrap"
        >
          <Sliders className="w-3 h-3" />
          <span className="hidden md:inline">Settings</span>
        </button>
      </div>

      {/* MORE SETTINGS MODAL */}
      <Modal
        open={moreModalOpen}
        onClose={() => setMoreModalOpen(false)}
        title={`${toolDef?.name ?? 'Drawing'} Settings`}
        subtitle="Customize object properties, coordinates, labels, and tool-specific parameters"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
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

          {/* Annotation Text / Content */}
          {isAnnotation && (
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Annotation Label / Text
              </label>
              <Input
                value={drawing.text ?? ''}
                onChange={(e) => onUpdate(drawing.id, { text: e.target.value })}
                placeholder="Enter text, note, or comment..."
              />
            </div>
          )}

          {/* Table Editor for Table tool */}
          {drawing.tool === 'table' && (
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Table Cells (2x2 CSV rows)
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

          {/* Anchor Coordinates */}
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
                    step={Math.pow(10, -decimals)}
                    value={Number(pt.price.toFixed(decimals))}
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

          {/* Fibonacci Levels Customization */}
          {isFibTool && (
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

          <div className="flex justify-end pt-2 border-t border-[var(--border-subtle)]">
            <Button variant="primary" onClick={() => setMoreModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
