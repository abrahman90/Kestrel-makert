import React, { useMemo, useState } from 'react';
import { Activity, CandlestickChart, Search, Star } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { MarketCategory } from '../../types/market';
import { formatPrice } from '../../utils/indicators';
import {
  Input,
  Panel,
  PriceChangeText,
  SegmentedTabs,
  SignalLabel,
  Sparkline,
} from '../ui/DesignSystem';

const CAT_OPTIONS: { value: MarketCategory; label: string }[] = [
  { value: 'All', label: 'All Markets' },
  { value: 'Forex', label: 'Forex' },
  { value: 'Crypto', label: 'Crypto' },
  { value: 'Stocks', label: 'Stocks' },
  { value: 'Indices', label: 'Indices' },
  { value: 'Commodities', label: 'Commodities' },
];

export function MarketsScreen() {
  const {
    instruments,
    globalCategory,
    setGlobalCategory,
    openChart,
    openTechnicalAnalysis,
    watchlists,
    activeWatchlistId,
    addSymbolToWatchlist,
  } = usePlatform();

  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return instruments.filter((inst) => {
      if (globalCategory !== 'All' && inst.category !== globalCategory) return false;
      if (!q) return true;
      return (
        inst.symbol.toLowerCase().includes(q) ||
        inst.name.toLowerCase().includes(q) ||
        inst.sectorOrBase.toLowerCase().includes(q)
      );
    });
  }, [instruments, globalCategory, search]);

  const activeWatchlist = watchlists.find((w) => w.id === activeWatchlistId) ?? watchlists[0];

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
            Global Markets Directory
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Real-time cross-asset quotes, bid/ask spreads, and session availability
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter ticker or name..."
              className="pl-8"
            />
          </div>
          <SegmentedTabs options={CAT_OPTIONS} value={globalCategory} onChange={setGlobalCategory} />
        </div>
      </div>

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[11px] text-[var(--text-secondary)]">
                <th className="text-left font-medium px-4 py-2.5">Symbol</th>
                <th className="text-left font-medium px-3 py-2.5">Category</th>
                <th className="text-right font-medium px-3 py-2.5">Last Price</th>
                <th className="text-right font-medium px-3 py-2.5">24h Chg</th>
                <th className="text-right font-medium px-3 py-2.5">Bid / Ask</th>
                <th className="text-right font-medium px-3 py-2.5">24h High / Low</th>
                <th className="text-right font-medium px-3 py-2.5">Volume</th>
                <th className="text-center font-medium px-3 py-2.5">Trend</th>
                <th className="text-center font-medium px-3 py-2.5">MA Signal</th>
                <th className="text-right font-medium px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filtered.map((inst) => {
                const inWatchlist = activeWatchlist.symbols.includes(inst.symbol);
                return (
                  <tr
                    key={inst.symbol}
                    onClick={() => openChart(inst.symbol)}
                    className="hover:bg-[var(--bg-panel)]/70 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-mono font-semibold text-[var(--text-primary)]">{inst.symbol}</div>
                      <div className="text-[11px] text-[var(--text-secondary)] truncate max-w-[160px]">
                        {inst.name}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">
                      <div>{inst.category}</div>
                      <div className="text-[11px] text-[var(--text-muted)]">{inst.exchange}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                      {formatPrice(inst.price, inst.decimals)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <PriceChangeText value={inst.change} percent={inst.changePercent} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                      {formatPrice(inst.bid, inst.decimals)} / {formatPrice(inst.ask, inst.decimals)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                      {formatPrice(inst.high24h, inst.decimals)} / {formatPrice(inst.low24h, inst.decimals)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                      {inst.volumeLabel}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-center">
                        <Sparkline data={inst.sparkline} positive={inst.changePercent >= 0} width={68} height={22} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <SignalLabel signal={inst.maSignal} />
                    </td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          title="Open Chart"
                          onClick={() => openChart(inst.symbol)}
                          className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[#2962FF] hover:bg-[#2962FF]/10 cursor-pointer"
                        >
                          <CandlestickChart className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Technical Analysis"
                          onClick={() => openTechnicalAnalysis(inst.symbol)}
                          className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[#2962FF] hover:bg-[#2962FF]/10 cursor-pointer"
                        >
                          <Activity className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title={inWatchlist ? 'In active watchlist' : `Add to ${activeWatchlist.name}`}
                          onClick={() => addSymbolToWatchlist(activeWatchlist.id, inst.symbol)}
                          className={`p-1.5 rounded cursor-pointer ${
                            inWatchlist
                              ? 'text-[#F0B90B]'
                              : 'text-[var(--text-secondary)] hover:text-[#F0B90B] hover:bg-[#F0B90B]/10'
                          }`}
                        >
                          <Star className="w-3.5 h-3.5" fill={inWatchlist ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
