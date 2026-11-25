import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BookmarkPlus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { MarketCategory, ScreenerPreset } from '../../types/market';
import { formatPrice } from '../../utils/indicators';
import {
  Button,
  EmptyState,
  Input,
  Modal,
  Panel,
  PriceChangeText,
  Select,
  SignalLabel,
} from '../ui/DesignSystem';

type SortKey = 'symbol' | 'price' | 'changePercent' | 'volume24h' | 'rsi14' | 'marketCap';

export function ScreenerScreen() {
  const {
    instruments,
    screenerPresets,
    saveScreenerPreset,
    deleteScreenerPreset,
    openChart,
  } = usePlatform();

  const [category, setCategory] = useState<MarketCategory>('All');
  const [query, setQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minChangePct, setMinChangePct] = useState('');
  const [maxChangePct, setMaxChangePct] = useState('');
  const [minRsi, setMinRsi] = useState('');
  const [maxRsi, setMaxRsi] = useState('');
  const [maFilter, setMaFilter] = useState<ScreenerPreset['maFilter']>('All');

  const [sortKey, setSortKey] = useState<SortKey>('volume24h');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const applyPreset = (p: ScreenerPreset) => {
    setCategory(p.category);
    setMinPrice(p.minPrice);
    setMaxPrice(p.maxPrice);
    setMinChangePct(p.minChangePct);
    setMaxChangePct(p.maxChangePct);
    setMinRsi(p.minRsi);
    setMaxRsi(p.maxRsi);
    setMaFilter(p.maFilter);
  };

  const resetFilters = () => {
    setCategory('All');
    setQuery('');
    setMinPrice('');
    setMaxPrice('');
    setMinChangePct('');
    setMaxChangePct('');
    setMinRsi('');
    setMaxRsi('');
    setMaFilter('All');
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = instruments.filter((inst) => {
      if (category !== 'All' && inst.category !== category) return false;
      if (
        q &&
        !inst.symbol.toLowerCase().includes(q) &&
        !inst.name.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (minPrice !== '' && inst.price < parseFloat(minPrice)) return false;
      if (maxPrice !== '' && inst.price > parseFloat(maxPrice)) return false;
      if (minChangePct !== '' && inst.changePercent < parseFloat(minChangePct)) return false;
      if (maxChangePct !== '' && inst.changePercent > parseFloat(maxChangePct)) return false;
      if (minRsi !== '' && inst.rsi14 < parseFloat(minRsi)) return false;
      if (maxRsi !== '' && inst.rsi14 > parseFloat(maxRsi)) return false;
      if (maFilter !== 'All' && inst.maSignal !== maFilter) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      const av =
        sortKey === 'symbol'
          ? a.symbol
          : sortKey === 'marketCap'
          ? a.marketCap ?? -1
          : a[sortKey];
      const bv =
        sortKey === 'symbol'
          ? b.symbol
          : sortKey === 'marketCap'
          ? b.marketCap ?? -1
          : b[sortKey];

      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
  }, [
    instruments,
    category,
    query,
    minPrice,
    maxPrice,
    minChangePct,
    maxChangePct,
    minRsi,
    maxRsi,
    maFilter,
    sortKey,
    sortDir,
  ]);

  const SortIndicator = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 inline ml-1 text-[#2962FF]" />
    ) : (
      <ArrowDown className="w-3 h-3 inline ml-1 text-[#2962FF]" />
    );
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
            Market Screener
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Multi-factor technical and price momentum scanner across asset classes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={resetFilters}>
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Filters
          </Button>
          <Button variant="primary" onClick={() => setSaveModalOpen(true)}>
            <BookmarkPlus className="w-3.5 h-3.5" />
            Save Configuration
          </Button>
        </div>
      </div>

      {/* Saved Screening Configurations */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-[var(--text-muted)] mr-1">
          Saved Presets:
        </span>
        {screenerPresets.map((p) => (
          <div
            key={p.id}
            className="inline-flex items-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded overflow-hidden"
          >
            <button
              type="button"
              onClick={() => applyPreset(p)}
              className="px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
            >
              {p.name}
            </button>
            <button
              type="button"
              onClick={() => deleteScreenerPreset(p.id)}
              aria-label={`Delete preset ${p.name}`}
              className="px-1.5 py-1 text-[var(--text-muted)] hover:text-[#F23645] border-l border-[var(--border-subtle)] cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Filter Control Bar */}
      <Panel className="p-3.5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <div>
            <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Market</label>
            <Select value={category} onChange={(e) => setCategory(e.target.value as MarketCategory)} className="w-full">
              <option value="All">All Markets</option>
              <option value="Forex">Forex</option>
              <option value="Crypto">Crypto</option>
              <option value="Stocks">Stocks</option>
              <option value="Indices">Indices</option>
              <option value="Commodities">Commodities</option>
            </Select>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Symbol / Name</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="pl-8"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Price Range</label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="font-mono"
              />
              <Input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-secondary)] mb-1">% Change</label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                placeholder="Min %"
                value={minChangePct}
                onChange={(e) => setMinChangePct(e.target.value)}
                className="font-mono"
              />
              <Input
                type="number"
                placeholder="Max %"
                value={maxChangePct}
                onChange={(e) => setMaxChangePct(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-secondary)] mb-1">RSI (14)</label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                placeholder="Min"
                value={minRsi}
                onChange={(e) => setMinRsi(e.target.value)}
                className="font-mono"
              />
              <Input
                type="number"
                placeholder="Max"
                value={maxRsi}
                onChange={(e) => setMaxRsi(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Moving Average</label>
            <Select
              value={maFilter}
              onChange={(e) => setMaFilter(e.target.value as ScreenerPreset['maFilter'])}
              className="w-full"
            >
              <option value="All">Any Rating</option>
              <option value="Strong Buy">Strong Buy</option>
              <option value="Buy">Buy</option>
              <option value="Neutral">Neutral</option>
              <option value="Sell">Sell</option>
              <option value="Strong Sell">Strong Sell</option>
            </Select>
          </div>

          <div className="flex items-end">
            <div className="h-8 w-full px-3 flex items-center justify-between bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded text-xs">
              <span className="text-[var(--text-secondary)]">Matches</span>
              <span className="font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                {filtered.length}
              </span>
            </div>
          </div>
        </div>
      </Panel>

      {/* Screener Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No instruments match these conditions"
          description="Widen your RSI, price, or percentage change thresholds to surface more opportunities."
          action={
            <Button variant="secondary" onClick={resetFilters}>
              Clear All Filters
            </Button>
          }
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[11px] text-[var(--text-secondary)]">
                  <th
                    onClick={() => handleSort('symbol')}
                    className="text-left font-medium px-4 py-2.5 cursor-pointer hover:text-[var(--text-primary)]"
                  >
                    Instrument <SortIndicator col="symbol" />
                  </th>
                  <th className="text-left font-medium px-3 py-2.5">Category</th>
                  <th
                    onClick={() => handleSort('price')}
                    className="text-right font-medium px-3 py-2.5 cursor-pointer hover:text-[var(--text-primary)]"
                  >
                    Price <SortIndicator col="price" />
                  </th>
                  <th
                    onClick={() => handleSort('changePercent')}
                    className="text-right font-medium px-3 py-2.5 cursor-pointer hover:text-[var(--text-primary)]"
                  >
                    % Chg <SortIndicator col="changePercent" />
                  </th>
                  <th
                    onClick={() => handleSort('volume24h')}
                    className="text-right font-medium px-3 py-2.5 cursor-pointer hover:text-[var(--text-primary)]"
                  >
                    Volume <SortIndicator col="volume24h" />
                  </th>
                  <th
                    onClick={() => handleSort('marketCap')}
                    className="text-right font-medium px-3 py-2.5 cursor-pointer hover:text-[var(--text-primary)]"
                  >
                    Market Cap <SortIndicator col="marketCap" />
                  </th>
                  <th
                    onClick={() => handleSort('rsi14')}
                    className="text-right font-medium px-3 py-2.5 cursor-pointer hover:text-[var(--text-primary)]"
                  >
                    RSI (14) <SortIndicator col="rsi14" />
                  </th>
                  <th className="text-right font-medium px-4 py-2.5">MA Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filtered.map((item) => (
                  <tr
                    key={item.symbol}
                    onClick={() => openChart(item.symbol)}
                    className="hover:bg-[var(--bg-panel)]/70 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-mono font-semibold text-[var(--text-primary)]">{item.symbol}</div>
                      <div className="text-[11px] text-[var(--text-secondary)] truncate max-w-[180px]">
                        {item.name}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">
                      {item.category} · <span className="text-[var(--text-muted)]">{item.sectorOrBase}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                      {formatPrice(item.price, item.decimals)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <PriceChangeText value={item.change} percent={item.changePercent} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                      {item.volumeLabel}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                      {item.marketCapLabel ?? '—'}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono tabular-nums font-medium ${
                        item.rsi14 >= 65
                          ? 'text-[#089981]'
                          : item.rsi14 <= 38
                          ? 'text-[#F23645]'
                          : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {item.rsi14.toFixed(1)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <SignalLabel signal={item.maSignal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Save Screener Preset Modal */}
      <Modal
        open={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        title="Save Screener Configuration"
        subtitle="Store current technical & price filters for quick recall"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!presetName.trim()) return;
            saveScreenerPreset({
              name: presetName.trim(),
              category,
              minChangePct,
              maxChangePct,
              minRsi,
              maxRsi,
              maFilter,
              minPrice,
              maxPrice,
            });
            setPresetName('');
            setSaveModalOpen(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Configuration Name
            </label>
            <Input
              autoFocus
              required
              placeholder="e.g. High Momentum Equities"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setSaveModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Preset
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
