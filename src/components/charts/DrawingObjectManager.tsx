import React, { useMemo, useState } from 'react';
import {
  Crosshair,
  Edit3,
  Eye,
  EyeOff,
  FolderOpen,
  Layers,
  Lock,
  Search,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import { getDrawingToolDef } from '../../data/drawingToolsCatalog';
import { ChartDrawing } from '../../types/market';
import { Input, Select } from '../ui/DesignSystem';

interface DrawingObjectManagerProps {
  drawings: ChartDrawing[];
  selectedId: string | null;
  onSelectDrawing: (id: string) => void;
  onLocateDrawing: (drawing: ChartDrawing) => void;
  onUpdateDrawing: (id: string, patch: Partial<ChartDrawing>) => void;
  onBatchUpdateDrawings?: (ids: string[], patch: Partial<ChartDrawing>) => void;
  onDeleteDrawing: (id: string) => void;
  onClose?: () => void;
}

export function DrawingObjectManager({
  drawings,
  selectedId,
  onSelectDrawing,
  onLocateDrawing,
  onUpdateDrawing,
  onBatchUpdateDrawings,
  onDeleteDrawing,
  onClose,
}: DrawingObjectManagerProps) {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('All');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const groups = useMemo(
    () => ['All', ...Array.from(new Set(drawings.map((d) => d.groupName || 'Default')))],
    [drawings]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drawings.filter((d) => {
      if (groupFilter !== 'All' && d.groupName !== groupFilter) return false;
      if (!q) return true;
      const def = getDrawingToolDef(d.tool);
      return (
        d.name.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        (def?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [drawings, search, groupFilter]);

  // Group filtered items by groupName for tree view
  const groupedTree = useMemo(() => {
    const map = new Map<string, ChartDrawing[]>();
    filtered.forEach((d) => {
      const g = d.groupName || 'Default';
      const arr = map.get(g) ?? [];
      arr.push(d);
      map.set(g, arr);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-surface)]">
      <div className="px-3 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#2962FF]" />
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Object Tree ({drawings.length})
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Object Manager"
            className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter & Group Selector */}
      <div className="p-2.5 border-b border-[var(--border-subtle)] space-y-2 shrink-0">
        <div className="relative">
          <Search className="w-3 h-3 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter objects..."
            className="pl-7 h-7 text-[11px]"
          />
        </div>
        <Select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="w-full h-7 text-[11px]"
        >
          {groups.map((g) => (
            <option key={g} value={g}>
              Group: {g}
            </option>
          ))}
        </Select>
      </div>

      {/* Object List Grouped */}
      <div className="flex-1 overflow-y-auto">
        {groupedTree.length === 0 ? (
          <div className="p-6 text-center text-[11px] text-[var(--text-muted)]">
            No drawing objects on this chart yet. Select any tool from the left toolbar to annotate.
          </div>
        ) : (
          groupedTree.map(([groupName, items]) => {
            const allVisible = items.every((i) => i.visible);
            const allLocked = items.every((i) => i.locked);
            return (
              <div key={groupName} className="border-b border-[var(--border-subtle)]/70">
                {/* Group Header */}
                <div className="px-3 py-1.5 bg-[var(--bg-canvas)]/70 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 font-medium text-[var(--text-secondary)] truncate">
                    <FolderOpen className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                    <span className="truncate">{groupName}</span>
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">
                      ({items.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      title={allVisible ? 'Hide Group' : 'Show Group'}
                      onClick={() => {
                        const ids = items.map((it) => it.id);
                        if (onBatchUpdateDrawings) {
                          onBatchUpdateDrawings(ids, { visible: !allVisible });
                        } else {
                          items.forEach((it) => onUpdateDrawing(it.id, { visible: !allVisible }));
                        }
                      }}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      {allVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      title={allLocked ? 'Unlock Group' : 'Lock Group'}
                      onClick={() => {
                        const ids = items.map((it) => it.id);
                        if (onBatchUpdateDrawings) {
                          onBatchUpdateDrawings(ids, { locked: !allLocked });
                        } else {
                          items.forEach((it) => onUpdateDrawing(it.id, { locked: !allLocked }));
                        }
                      }}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      {allLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* Items in Group */}
                <div className="divide-y divide-[var(--border-subtle)]/40">
                  {items.map((item) => {
                    const def = getDrawingToolDef(item.tool);
                    const Icon = def?.icon ?? Crosshair;
                    const selected = item.id === selectedId;

                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          onSelectDrawing(item.id);
                          onLocateDrawing(item);
                        }}
                        className={`px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                          selected ? 'bg-[#2962FF]/12' : 'hover:bg-[var(--bg-panel)]/70'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className="w-1.5 h-5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color, opacity: item.visible ? 1 : 0.3 }}
                          />
                          <Icon className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
                          <div className="min-w-0 flex-1">
                            {editingId === item.id ? (
                              <form
                                onClick={(e) => e.stopPropagation()}
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  if (draftName.trim()) {
                                    onUpdateDrawing(item.id, { name: draftName.trim() });
                                  }
                                  setEditingId(null);
                                }}
                              >
                                <input
                                  autoFocus
                                  value={draftName}
                                  onChange={(e) => setDraftName(e.target.value)}
                                  onBlur={() => {
                                    if (draftName.trim()) {
                                      onUpdateDrawing(item.id, { name: draftName.trim() });
                                    }
                                    setEditingId(null);
                                  }}
                                  className="w-full px-1 py-0.5 text-xs bg-[var(--bg-canvas)] text-[var(--text-primary)] border border-[#2962FF] rounded focus:outline-none"
                                />
                              </form>
                            ) : (
                              <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                                {item.name}
                              </div>
                            )}
                            <div className="text-[10px] text-[var(--text-muted)] capitalize flex items-center gap-1.5">
                              <span>{item.category}</span>
                              <span>·</span>
                              <select
                                aria-label="Change drawing group"
                                value={item.groupName}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  onUpdateDrawing(item.id, { groupName: e.target.value })
                                }
                                className="bg-transparent text-[10px] text-[var(--text-secondary)] focus:outline-none cursor-pointer"
                              >
                                <option value="Default" className="bg-[var(--bg-surface)]">Default</option>
                                <option value="Macro Levels" className="bg-[var(--bg-surface)]">Macro Levels</option>
                                <option value="Fibonacci & Gann" className="bg-[var(--bg-surface)]">Fibonacci & Gann</option>
                                <option value="Volume Zones" className="bg-[var(--bg-surface)]">Volume Zones</option>
                                <option value="Trade Setups" className="bg-[var(--bg-surface)]">Trade Setups</option>
                                <option value="Annotations" className="bg-[var(--bg-surface)]">Annotations</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-0.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            title="Rename"
                            onClick={() => {
                              setEditingId(item.id);
                              setDraftName(item.name);
                            }}
                            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            title={item.visible ? 'Hide' : 'Show'}
                            onClick={() => onUpdateDrawing(item.id, { visible: !item.visible })}
                            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            {item.visible ? (
                              <Eye className="w-3 h-3" />
                            ) : (
                              <EyeOff className="w-3 h-3 text-[#F0B90B]" />
                            )}
                          </button>
                          <button
                            type="button"
                            title={item.locked ? 'Unlock' : 'Lock'}
                            onClick={() => onUpdateDrawing(item.id, { locked: !item.locked })}
                            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            {item.locked ? (
                              <Lock className="w-3 h-3 text-[#F0B90B]" />
                            ) : (
                              <Unlock className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            onClick={() => onDeleteDrawing(item.id)}
                            className="p-1 rounded text-[var(--text-muted)] hover:text-[#F23645] cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
