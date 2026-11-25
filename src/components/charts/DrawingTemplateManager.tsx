import React, { useMemo, useState } from 'react';
import {
  BookmarkPlus,
  Check,
  Copy,
  Edit3,
  Star,
  Trash2,
} from 'lucide-react';
import { getDrawingToolDef } from '../../data/drawingToolsCatalog';
import {
  extractTemplateConfigFromDrawing,
  getDefaultConfigForTool,
} from '../../data/drawingTemplatesCatalog';
import {
  ChartDrawing,
  DrawingTemplate,
  DrawingTemplateConfig,
  DrawingTool,
} from '../../types/market';
import { Button, Input, Modal, SegmentedTabs, Select } from '../ui/DesignSystem';

interface DrawingTemplateManagerProps {
  open: boolean;
  onClose: () => void;
  templates: DrawingTemplate[];
  selectedDrawing: ChartDrawing | null;
  activeTool: DrawingTool;
  onCreateTemplate: (payload: {
    name: string;
    tool: Exclude<DrawingTool, 'cursor'>;
    config: DrawingTemplateConfig;
  }) => void;
  onApplyTemplate: (template: DrawingTemplate) => void;
  onRenameTemplate: (id: string, name: string) => void;
  onDuplicateTemplate: (id: string) => void;
  onDeleteTemplate: (id: string) => void;
  onSetDefaultTemplate: (id: string) => void;
}

function TemplatePreview({ template }: { template: DrawingTemplate }) {
  const { config, tool, category } = template;
  const dashArray =
    config.lineStyle === 'dashed'
      ? '5 3'
      : config.lineStyle === 'dotted'
      ? '2 3'
      : undefined;
  const strokeW = Math.min(4, Math.max(1.2, config.lineWidth || 1.5));

  return (
    <div className="w-16 h-10 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 overflow-hidden">
      <svg width="56" height="32" viewBox="0 0 56 32">
        {tool === 'long_position' || tool === 'short_position' ? (
          <>
            <rect
              x="6"
              y="4"
              width="44"
              height="12"
              fill={
                tool === 'long_position'
                  ? config.positionStyle?.profitColor ?? '#089981'
                  : config.positionStyle?.lossColor ?? '#F23645'
              }
              fillOpacity={0.28}
            />
            <rect
              x="6"
              y="16"
              width="44"
              height="12"
              fill={
                tool === 'long_position'
                  ? config.positionStyle?.lossColor ?? '#F23645'
                  : config.positionStyle?.profitColor ?? '#089981'
              }
              fillOpacity={0.28}
            />
            <line
              x1="6"
              y1="16"
              x2="50"
              y2="16"
              stroke={config.positionStyle?.entryColor ?? '#2962FF'}
              strokeWidth="1.5"
            />
          </>
        ) : category === 'fibonacci' ? (
          <>
            {[6, 13, 20, 27].map((y, idx) => (
              <line
                key={y}
                x1="6"
                y1={y}
                x2="50"
                y2={y}
                stroke={config.fibLevels?.[idx]?.color ?? config.color}
                strokeWidth="1.4"
                strokeOpacity={config.opacity}
              />
            ))}
          </>
        ) : category === 'shapes' && (tool === 'rectangle' || tool === 'rotated_rectangle' || tool === 'ellipse' || tool === 'circle') ? (
          tool === 'circle' || tool === 'ellipse' ? (
            <ellipse
              cx="28"
              cy="16"
              rx="17"
              ry={tool === 'circle' ? 11 : 9}
              fill={config.fillColor ?? config.color}
              fillOpacity={config.fillOpacity ?? 0.2}
              stroke={config.color}
              strokeWidth={strokeW}
              strokeDasharray={dashArray}
              strokeOpacity={config.opacity}
            />
          ) : (
            <rect
              x="9"
              y="6"
              width="38"
              height="20"
              fill={config.fillColor ?? config.color}
              fillOpacity={config.fillOpacity ?? 0.2}
              stroke={config.color}
              strokeWidth={strokeW}
              strokeDasharray={dashArray}
              strokeOpacity={config.opacity}
            />
          )
        ) : category === 'annotations' ? (
          <>
            {config.backgroundColor && (
              <rect
                x="8"
                y="6"
                width="40"
                height="20"
                rx="2"
                fill={config.backgroundColor}
                stroke={config.borderColor ?? config.color}
                strokeWidth="1"
              />
            )}
            <text
              x="28"
              y="19"
              textAnchor="middle"
              fill={config.textColor ?? config.color}
              fontSize="11"
              fontWeight="600"
              fontFamily={config.fontFamily || 'Plus Jakarta Sans'}
            >
              Aa
            </text>
          </>
        ) : (
          <line
            x1="7"
            y1={tool === 'horizontal' || tool === 'horizontal_ray' ? 16 : 25}
            x2="49"
            y2={tool === 'horizontal' || tool === 'horizontal_ray' ? 16 : 7}
            stroke={config.color}
            strokeWidth={strokeW}
            strokeDasharray={dashArray}
            strokeOpacity={config.opacity}
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  );
}

export function DrawingTemplateManager({
  open,
  onClose,
  templates,
  selectedDrawing,
  activeTool,
  onCreateTemplate,
  onApplyTemplate,
  onRenameTemplate,
  onDuplicateTemplate,
  onDeleteTemplate,
  onSetDefaultTemplate,
}: DrawingTemplateManagerProps) {
  const contextTool: Exclude<DrawingTool, 'cursor'> =
    selectedDrawing?.tool ?? (activeTool !== 'cursor' ? activeTool : 'trendline');

  const [tab, setTab] = useState<'all' | 'my' | 'default'>('all');
  const [toolFilter, setToolFilter] = useState<string>(contextTool);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftRename, setDraftRename] = useState('');

  // Keep filter aligned when opened for a different tool/drawing
  React.useEffect(() => {
    if (open) {
      setToolFilter(contextTool);
      const def = getDrawingToolDef(contextTool);
      setNewName(
        selectedDrawing
          ? `${selectedDrawing.name} Preset`
          : `${def?.name ?? 'Drawing'} Preset`
      );
      setEditingId(null);
    }
  }, [open, contextTool, selectedDrawing]);

  const contextToolDef = getDrawingToolDef(contextTool);

  const availableToolsInTemplates = useMemo(() => {
    const ids = new Set<Exclude<DrawingTool, 'cursor'>>([contextTool]);
    templates.forEach((t) => ids.add(t.tool));
    return Array.from(ids);
  }, [templates, contextTool]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (tab === 'my' && t.isSystemDefault) return false;
      if (tab === 'default' && !t.isSystemDefault) return false;
      if (toolFilter !== 'all' && t.tool !== toolFilter) return false;
      return true;
    });
  }, [templates, tab, toolFilter]);

  const handleSaveCurrent = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    const config = selectedDrawing
      ? extractTemplateConfigFromDrawing(selectedDrawing)
      : getDefaultConfigForTool(contextTool, templates);
    onCreateTemplate({
      name: trimmed,
      tool: contextTool,
      config,
    });
    setNewName('');
    setTab('my');
    setToolFilter(contextTool);
  };

  const myCount = templates.filter((t) => !t.isSystemDefault).length;
  const sysCount = templates.filter((t) => t.isSystemDefault).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Drawing Templates"
      subtitle={
        selectedDrawing
          ? `Manage and apply reusable presets for ${selectedDrawing.name} (${contextToolDef?.name ?? contextTool})`
          : `Save and apply reusable presets scoped to ${contextToolDef?.name ?? contextTool}`
      }
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 max-h-[75vh] flex flex-col">
        {/* Save Current Settings / Create New Template */}
        <form
          onSubmit={handleSaveCurrent}
          className="p-3 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] space-y-2.5 shrink-0"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Save Current Settings as New Template
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">
              Tool: {contextToolDef?.name ?? contextTool}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder='e.g. "Gold Resistance Line"'
              className="flex-1"
            />
            <Button type="submit" variant="primary" disabled={!newName.trim()}>
              <BookmarkPlus className="w-3.5 h-3.5" />
              Save Template
            </Button>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            {selectedDrawing
              ? 'Captures line colour, fill, typography, transparency, levels, and visibility settings from the selected object.'
              : 'Captures the active style configuration for this drawing tool so future drawings reuse it automatically.'}
          </p>
        </form>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
          <SegmentedTabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'all', label: 'All', count: templates.length },
              { value: 'my', label: 'My Templates', count: myCount },
              { value: 'default', label: 'Default Templates', count: sysCount },
            ]}
          />
          <Select
            aria-label="Filter templates by drawing type"
            value={toolFilter}
            onChange={(e) => setToolFilter(e.target.value)}
            className="h-8 text-xs"
          >
            <option value="all">All Drawing Types</option>
            {availableToolsInTemplates.map((tid) => {
              const def = getDrawingToolDef(tid);
              return (
                <option key={tid} value={tid}>
                  {def?.name ?? tid}
                </option>
              );
            })}
          </Select>
        </div>

        {/* Templates List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredTemplates.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--text-muted)] border border-dashed border-[var(--border-subtle)] rounded">
              No saved templates match this filter yet. Use Save Template above to store your current configuration.
            </div>
          ) : (
            filteredTemplates.map((tpl) => {
              const def = getDrawingToolDef(tpl.tool);
              const isCompatibleWithSelection =
                !selectedDrawing || selectedDrawing.tool === tpl.tool;

              return (
                <div
                  key={tpl.id}
                  className="p-2.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <TemplatePreview template={tpl} />
                    <div className="min-w-0 flex-1">
                      {editingId === tpl.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (draftRename.trim()) {
                              onRenameTemplate(tpl.id, draftRename.trim());
                            }
                            setEditingId(null);
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <Input
                            autoFocus
                            value={draftRename}
                            onChange={(e) => setDraftRename(e.target.value)}
                            className="h-7 text-xs"
                          />
                          <Button type="submit" size="xs" variant="primary">
                            <Check className="w-3 h-3" />
                          </Button>
                        </form>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                            {tpl.name}
                          </span>
                          {tpl.isDefaultForTool && (
                            <span className="text-[10px] font-medium text-[#F0B90B] shrink-0">
                              · Default
                            </span>
                          )}
                        </div>
                      )}
                      <div className="text-[11px] text-[var(--text-secondary)] flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 font-mono tabular-nums">
                        <span className="font-sans text-[var(--text-primary)]">
                          {def?.name ?? tpl.tool}
                        </span>
                        <span className="text-[var(--text-muted)]">·</span>
                        <span>{tpl.isSystemDefault ? 'Built-in' : 'Custom'}</span>
                        <span className="text-[var(--text-muted)]">·</span>
                        <span className="text-[var(--text-muted)]">
                          Created {tpl.createdAt}
                        </span>
                        <span className="text-[var(--text-muted)]">·</span>
                        <span className="text-[var(--text-muted)]">
                          Modified {tpl.updatedAt}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 justify-end">
                    <Button
                      size="xs"
                      variant={isCompatibleWithSelection ? 'primary' : 'secondary'}
                      title={
                        selectedDrawing && !isCompatibleWithSelection
                          ? `Applies as preset for ${def?.name ?? tpl.tool}`
                          : 'Apply template'
                      }
                      onClick={() => {
                        onApplyTemplate(tpl);
                        onClose();
                      }}
                    >
                      Apply
                    </Button>
                    <button
                      type="button"
                      title={
                        tpl.isDefaultForTool
                          ? 'Default template for this tool'
                          : 'Set as Default for this tool'
                      }
                      onClick={() => onSetDefaultTemplate(tpl.id)}
                      className={`p-1.5 rounded transition-colors cursor-pointer ${
                        tpl.isDefaultForTool
                          ? 'text-[#F0B90B] bg-[#F0B90B]/12'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Duplicate Template"
                      onClick={() => onDuplicateTemplate(tpl.id)}
                      className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {!tpl.isSystemDefault && (
                      <>
                        <button
                          type="button"
                          title="Rename Template"
                          onClick={() => {
                            setEditingId(tpl.id);
                            setDraftRename(tpl.name);
                          }}
                          className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete Template"
                          onClick={() => onDeleteTemplate(tpl.id)}
                          className="p-1.5 rounded text-[var(--text-muted)] hover:text-[#F23645] hover:bg-[#F23645]/10 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
