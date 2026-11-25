import React from 'react';
import { ArrowUpRight, Calendar, Newspaper, TrendingDown, TrendingUp } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { formatPrice } from '../../utils/indicators';
import { Button, Panel, PriceChangeText, SectionHeader, SignalLabel, Sparkline } from '../ui/DesignSystem';

export function OverviewScreen() {
  const {
    instruments,
    globalCategory,
    news,
    economicEvents,
    alerts,
    openChart,
    setActiveScreen,
  } = usePlatform();

  const indices = instruments.filter((i) => i.category === 'Indices');
  const forex = instruments.filter((i) => i.category === 'Forex');
  const crypto = instruments.filter((i) => i.category === 'Crypto');
  const commodities = instruments.filter((i) => i.category === 'Commodities');

  const scoped =
    globalCategory === 'All'
      ? instruments
      : instruments.filter((i) => i.category === globalCategory);

  const gainers = [...scoped].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
  const losers = [...scoped].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);
  const trending = [...scoped].sort((a, b) => b.volume24h - a.volume24h).slice(0, 6);

  const advancers = scoped.filter((i) => i.changePercent >= 0).length;
  const decliners = scoped.length - advancers;

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* Page Header & Breadth Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
            Market Overview
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Multi-asset cross-market pulse · {globalCategory === 'All' ? 'All Global Markets' : globalCategory}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setActiveScreen('screener')}>
            Open Screener
          </Button>
          <Button variant="primary" onClick={() => openChart('SPX')}>
            Launch Chart Workspace
          </Button>
        </div>
      </div>

      {/* Total Market Overview KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Panel className="p-3.5">
          <div className="text-[11px] text-[var(--text-secondary)]">Market Breadth ({globalCategory})</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-base font-mono tabular-nums font-bold text-[var(--text-primary)]">
              {advancers} Up / {decliners} Down
            </span>
            <span className="text-xs font-mono text-[#089981]">
              {Math.round((advancers / Math.max(1, scoped.length)) * 100)}% Bullish
            </span>
          </div>
        </Panel>
        <Panel className="p-3.5">
          <div className="text-[11px] text-[var(--text-secondary)]">US 10Y / DXY Macro</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-base font-mono tabular-nums font-bold text-[var(--text-primary)]">
              4.26% · 106.42
            </span>
            <span className="text-xs font-mono text-[#F23645]">-0.31%</span>
          </div>
        </Panel>
        <Panel className="p-3.5">
          <div className="text-[11px] text-[var(--text-secondary)]">Crypto Total Market Cap</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-base font-mono tabular-nums font-bold text-[var(--text-primary)]">
              $3.18T
            </span>
            <span className="text-xs font-mono text-[#089981]">+2.94%</span>
          </div>
        </Panel>
        <Panel className="p-3.5">
          <div className="text-[11px] text-[var(--text-secondary)]">VIX Volatility Index</div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <span className="text-base font-mono tabular-nums font-bold text-[var(--text-primary)]">
              14.62
            </span>
            <span className="text-xs font-mono text-[var(--text-secondary)]">Low Regime</span>
          </div>
        </Panel>
      </div>

      {/* Major Market Indices Strip */}
      <div>
        <SectionHeader
          title="Major Market Indices"
          actions={
            <button
              type="button"
              onClick={() => setActiveScreen('markets')}
              className="text-xs font-medium text-[#2962FF] hover:underline cursor-pointer"
            >
              View All Markets →
            </button>
          }
          className="mb-2.5"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {indices.map((idx) => (
            <Panel
              key={idx.symbol}
              className="p-3.5 hover:border-[var(--border-strong)] transition-colors cursor-pointer"
            >
              <button
                type="button"
                onClick={() => openChart(idx.symbol)}
                className="w-full text-left cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold font-mono text-[var(--text-primary)]">
                      {idx.symbol}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] truncate">
                      {idx.name}
                    </div>
                  </div>
                  <Sparkline data={idx.sparkline} positive={idx.changePercent >= 0} width={64} height={24} />
                </div>
                <div className="mt-2.5 flex items-baseline justify-between">
                  <span className="text-sm font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                    {formatPrice(idx.price, idx.decimals)}
                  </span>
                  <span className="text-xs">
                    <PriceChangeText value={idx.change} percent={idx.changePercent} />
                  </span>
                </div>
              </button>
            </Panel>
          ))}
        </div>
      </div>

      {/* Asset Class Summaries: Forex, Crypto, Commodities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { title: 'Forex Market Summary', items: forex.slice(0, 4) },
          { title: 'Cryptocurrency Summary', items: crypto.slice(0, 4) },
          { title: 'Commodities Summary', items: commodities.slice(0, 4) },
        ].map((group) => (
          <Panel key={group.title} className="overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-panel)]">
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">{group.title}</h3>
              <button
                type="button"
                onClick={() => setActiveScreen('markets')}
                className="text-[11px] text-[#2962FF] hover:underline cursor-pointer"
              >
                More
              </button>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {group.items.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  onClick={() => openChart(item.symbol)}
                  className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-[var(--bg-panel)]/70 transition-colors cursor-pointer text-left"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-semibold text-[var(--text-primary)]">
                      {item.symbol}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] truncate max-w-[140px]">
                      {item.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Sparkline data={item.sparkline} positive={item.changePercent >= 0} width={54} height={20} />
                    <div className="text-right min-w-[76px]">
                      <div className="text-xs font-mono tabular-nums font-medium text-[var(--text-primary)]">
                        {formatPrice(item.price, item.decimals)}
                      </div>
                      <div className="text-[11px]">
                        <PriceChangeText value={item.change} percent={item.changePercent} />
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        ))}
      </div>

      {/* Top Gainers & Top Losers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel className="overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] flex items-center gap-2 bg-[var(--bg-panel)]">
            <TrendingUp className="w-3.5 h-3.5 text-[#089981]" />
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">Top Market Gainers</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
                  <th className="text-left font-medium px-4 py-2">Instrument</th>
                  <th className="text-right font-medium px-3 py-2">Last</th>
                  <th className="text-right font-medium px-3 py-2">Change</th>
                  <th className="text-right font-medium px-4 py-2">Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {gainers.map((g) => (
                  <tr
                    key={g.symbol}
                    onClick={() => openChart(g.symbol)}
                    className="hover:bg-[var(--bg-panel)]/70 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2">
                      <span className="font-mono font-semibold text-[var(--text-primary)]">{g.symbol}</span>
                      <span className="ml-2 text-[11px] text-[var(--text-secondary)]">{g.category}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-primary)]">
                      {formatPrice(g.price, g.decimals)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <PriceChangeText value={g.change} percent={g.changePercent} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <SignalLabel signal={g.maSignal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] flex items-center gap-2 bg-[var(--bg-panel)]">
            <TrendingDown className="w-3.5 h-3.5 text-[#F23645]" />
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">Top Market Losers</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
                  <th className="text-left font-medium px-4 py-2">Instrument</th>
                  <th className="text-right font-medium px-3 py-2">Last</th>
                  <th className="text-right font-medium px-3 py-2">Change</th>
                  <th className="text-right font-medium px-4 py-2">Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {losers.map((l) => (
                  <tr
                    key={l.symbol}
                    onClick={() => openChart(l.symbol)}
                    className="hover:bg-[var(--bg-panel)]/70 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-2">
                      <span className="font-mono font-semibold text-[var(--text-primary)]">{l.symbol}</span>
                      <span className="ml-2 text-[11px] text-[var(--text-secondary)]">{l.category}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-[var(--text-primary)]">
                      {formatPrice(l.price, l.decimals)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <PriceChangeText value={l.change} percent={l.changePercent} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <SignalLabel signal={l.maSignal} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* Trending Instruments + Market News + Economic Calendar Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Trending & Recent Activity */}
        <Panel className="overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">
              Trending by Volume & Activity
            </h3>
            <span className="text-[11px] text-[var(--text-muted)]">24h Turnover</span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)] flex-1">
            {trending.map((t) => (
              <button
                key={t.symbol}
                type="button"
                onClick={() => openChart(t.symbol)}
                className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-[var(--bg-panel)]/70 transition-colors cursor-pointer text-left"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-[var(--text-primary)]">{t.symbol}</span>
                    <span className="text-[11px] text-[var(--text-muted)]">{t.volumeLabel}</span>
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">{t.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono tabular-nums text-[var(--text-primary)]">
                    {formatPrice(t.price, t.decimals)}
                  </div>
                  <div className="text-[11px]">
                    <PriceChangeText value={t.change} percent={t.changePercent} />
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-canvas)]/50 text-[11px] text-[var(--text-secondary)] flex items-center justify-between">
            <span>Recent Alert Trigger</span>
            <span className="font-mono text-[var(--text-primary)]">
              {alerts.find((a) => a.status === 'Triggered')?.symbol ?? 'XAU/USD'} @{' '}
              {alerts.find((a) => a.status === 'Triggered')?.targetPrice ?? '2630'}
            </span>
          </div>
        </Panel>

        {/* Market News Preview */}
        <Panel className="overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Newspaper className="w-3.5 h-3.5 text-[#2962FF]" />
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">Market News</h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveScreen('news')}
              className="text-[11px] text-[#2962FF] hover:underline cursor-pointer"
            >
              All Stories →
            </button>
          </div>
          <div className="divide-y divide-[var(--border-subtle)] flex-1">
            {news.slice(0, 4).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setActiveScreen('news')}
                className="w-full px-4 py-3 text-left hover:bg-[var(--bg-panel)]/70 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                  <span className="font-medium text-[var(--text-secondary)]">{n.category}</span>
                  <span>·</span>
                  <span>{n.publishedAt}</span>
                  <span>·</span>
                  <span>{n.source}</span>
                </div>
                <p className="text-xs font-semibold text-[var(--text-primary)] mt-1 line-clamp-2 leading-snug">
                  {n.title}
                </p>
              </button>
            ))}
          </div>
        </Panel>

        {/* Economic Calendar Preview */}
        <Panel className="overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#F0B90B]" />
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">Economic Calendar</h3>
            </div>
            <button
              type="button"
              onClick={() => setActiveScreen('calendar')}
              className="text-[11px] text-[#2962FF] hover:underline cursor-pointer"
            >
              Full Calendar →
            </button>
          </div>
          <div className="divide-y divide-[var(--border-subtle)] flex-1">
            {economicEvents.slice(0, 5).map((ev) => (
              <div
                key={ev.id}
                onClick={() => setActiveScreen('calendar')}
                className="px-4 py-2.5 hover:bg-[var(--bg-panel)]/70 transition-colors cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-mono font-semibold text-[var(--text-primary)]">{ev.currency}</span>
                    <span className="text-[var(--text-muted)] font-mono">{ev.time}</span>
                    <span
                      className={`text-[10px] font-medium ${
                        ev.impact === 'High'
                          ? 'text-[#F23645]'
                          : ev.impact === 'Medium'
                          ? 'text-[#F0B90B]'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {ev.impact} Impact
                    </span>
                  </div>
                  <p className="text-xs font-medium text-[var(--text-primary)] truncate mt-0.5">
                    {ev.event}
                  </p>
                </div>
                <div className="text-right font-mono tabular-nums text-[11px] shrink-0">
                  <div className="text-[var(--text-primary)]">
                    Act: {ev.actual}
                  </div>
                  <div className="text-[var(--text-muted)]">
                    Fcst: {ev.forecast}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-canvas)]/50">
            <button
              type="button"
              onClick={() => setActiveScreen('calendar')}
              className="w-full flex items-center justify-center gap-1 text-xs font-medium text-[#2962FF] hover:underline cursor-pointer"
            >
              <span>Inspect Macro Releases</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
