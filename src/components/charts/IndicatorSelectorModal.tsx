import React, { useMemo, useState } from 'react';
import { RotateCcw, Search, SlidersHorizontal, Star } from 'lucide-react';
import { IndicatorConfig, IndicatorGroup, IndicatorId } from '../../types/market';
import { Button, Modal } from '../ui/DesignSystem';

const GROUPS: ('All' | IndicatorGroup)[] = ['All', 'Trend', 'Momentum', 'Volume', 'Volatility'];

const COLOR_PRESETS = ['#2962FF', '#089981', '#F0B90B', '#AB47BC', '#F23645', '#26A69A', '#E8EDF3'];

export function IndicatorSelectorModal({
  open,
  onClose,
  symbol,
  indicators,
  favoriteIds,
  recentIds,
  onToggleIndicator,
  onToggleFavorite,
  onUpdateIndicator,
  onResetIndicator,
  onEnableStandard,
  onClearAll,
}: {
  open: boolean;
  onClose: () => void;
  symbol: string;
  indicators: IndicatorConfig[];
  favoriteIds: IndicatorId[];
  recentIds: IndicatorId[];
  onToggleIndicator: (id: IndicatorId) => void;
  onToggleFavorite: (id: IndicatorId) => void;
  onUpdateIndicator: (id: IndicatorId, patch: Partial<IndicatorConfig>) => void;
  onResetIndicator: (id: IndicatorId) => void;
  onEnableStandard: () => void;
  onClearAll: () => void;
}) {
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<'All' | IndicatorGroup>('All');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [editingId, setEditingId] = useState<IndicatorId | null>(null);

  const enabledCount = indicators.filter((i) => i.enabled).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return indicators.filter((ind) => {
      if (onlyFavorites && !favoriteIds.includes(ind.id)) return false;
      if (activeGroup !== 'All' && ind.group !== activeGroup) return false;
      if (!q) return true;
      return (
        ind.label.toLowerCase().includes(q) ||
        ind.shortName.toLowerCase().includes(q) ||
        ind.group.toLowerCase().includes(q)
      );
    });
  }, [indicators, query, activeGroup, onlyFavorites, favoriteIds]);

  const recentItems = useMemo(
    () =>
      recentIds
        .map((id) => indicators.find((i) => i.id === id))
        .filter((i): i is IndicatorConfig => Boolean(i))
        .slice(0, 4),
    [recentIds, indicators]
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Technical Indicators & Overlays"
      subtitle={`Configure trend, momentum, volume, and volatility studies on ${symbol}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-3">
        {/* Top Action Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[var(--border-subtle)]">
          <span className="text-[11px] text-[var(--text-secondary)]">
            {enabledCount === 0
              ? 'Clean chart mode — candlesticks only'
              : `${enabledCount} indicator${enabledCount === 1 ? '' : 's'} active on chart`}
          </span>
          <div className="flex items-center gap-1.5">
            <Button size="xs" variant="secondary" onClick={onEnableStandard}>
              Standard Lines
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={onClearAll}
              disabled={enabledCount === 0}
            >
              Remove All (Chart Only)
            </Button>
          </div>
        </div>

        {/* Search & Favorites Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search indicators (EMA, Ichimoku, Stochastic, OBV...)"
              className="h-8 w-full pl-8 pr-3 text-xs bg-[var(--bg-canvas)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border border-[var(--border-subtle)] rounded focus:outline-none focus:border-[#2962FF]"
            />
          </div>
          <button
            type="button"
            onClick={() => setOnlyFavorites((v) => !v)}
            className={`h-8 px-2.5 flex items-center gap-1.5 rounded border text-xs font-medium transition-colors cursor-pointer ${
              onlyFavorites
                ? 'bg-[#F0B90B]/15 text-[#F0B90B] border-[#F0B90B]/40'
                : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-[#F0B90B]' : ''}`} />
            <span>Favorites ({favoriteIds.length})</span>
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setActiveGroup(g)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                activeGroup === g
                  ? 'bg-[#2962FF] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Recently Used Quick Strip */}
        {recentItems.length > 0 && !query && activeGroup === 'All' && !onlyFavorites && (
          <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-2 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mr-1">
              Recent:
            </span>
            {recentItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggleIndicator(item.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors cursor-pointer ${
                  item.enabled
                    ? 'bg-[#2962FF]/15 text-[#2962FF] border-[#2962FF]/40'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {item.shortName}
              </button>
            ))}
          </div>
        )}

        {/* Indicators List */}
        <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
              No indicators match your current filter.
            </div>
          ) : (
            filtered.map((ind) => {
              const isFav = favoriteIds.includes(ind.id);
              const isEditing = editingId === ind.id;
              const paramEntries = Object.entries(ind.params);
              return (
                <div
                  key={ind.id}
                  className={`rounded border transition-colors ${
                    ind.enabled
                      ? 'border-[#2962FF]/45 bg-[#2962FF]/6'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(ind.id)}
                        title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                        className="p-0.5 text-[var(--text-muted)] hover:text-[#F0B90B] cursor-pointer shrink-0"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${
                            isFav ? 'text-[#F0B90B] fill-[#F0B90B]' : ''
                          }`}
                        />
                      </button>
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: ind.color }}
                      />
                      <button
                        type="button"
                        onClick={() => onToggleIndicator(ind.id)}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                          {ind.label}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {ind.group} ·{' '}
                          {ind.category === 'Overlay' ? 'Main Price Chart' : 'Lower Oscillator Pane'}
                        </div>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingId(isEditing ? null : ind.id)}
                        title="Indicator Parameters & Color"
                        className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${
                          isEditing
                            ? 'bg-[#2962FF]/15 text-[#2962FF]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
                        }`}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="checkbox"
                        checked={ind.enabled}
                        onChange={() => onToggleIndicator(ind.id)}
                        className="w-4 h-4 accent-[#2962FF] cursor-pointer"
                      />
                    </div>
                  </div>

                  {isEditing && (
                    <div className="px-3 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]/80 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-3">
                          {paramEntries.map(([key, val]) => (
                            <label key={key} className="flex items-center gap-1.5 text-[11px]">
                              <span className="text-[var(--text-secondary)] capitalize">{key}:</span>
                              <input
                                type="number"
                                step={key === 'mult' ? '0.1' : '1'}
                                min={key === 'mult' ? '0.5' : '2'}
                                max={250}
                                value={val}
                                onChange={(e) => {
                                  const next = parseFloat(e.target.value);
                                  if (!Number.isFinite(next) || next <= 0) return;
                                  onUpdateIndicator(ind.id, {
                                    params: { ...ind.params, [key]: next },
                                  });
                                }}
                                className="w-16 h-6 px-1.5 text-xs font-mono bg-[var(--bg-canvas)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded focus:outline-none focus:border-[#2962FF]"
                              />
                            </label>
                          ))}
                          {paramEntries.length === 0 && (
                            <span className="text-[11px] text-[var(--text-muted)]">
                              Fixed calculation — customize color below
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onResetIndicator(ind.id)}
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-[var(--text-secondary)] mr-1">Color:</span>
                        {COLOR_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => onUpdateIndicator(ind.id, { color: c })}
                            className={`w-4 h-4 rounded-full border cursor-pointer ${
                              ind.color.toUpperCase() === c.toUpperCase()
                                ? 'border-white scale-110'
                                : 'border-transparent opacity-80 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: c }}
                            aria-label={`Color ${c}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
