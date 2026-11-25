import React, { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { MarketCategory } from '../../types/market';
import { Button, Panel, SectionHeader, SegmentedTabs } from '../ui/DesignSystem';

type ReportRange = '7D' | '30D' | '90D' | 'YTD';

const MONTHLY_RETURNS = [
  { month: 'Jun', pct: 3.1, pnl: 6820 },
  { month: 'Jul', pct: 4.4, pnl: 10120 },
  { month: 'Aug', pct: -1.6, pnl: -3840 },
  { month: 'Sep', pct: 2.8, pnl: 6590 },
  { month: 'Oct', pct: 5.2, pnl: 12610 },
  { month: 'Nov', pct: 3.7, pnl: 9430 },
];

export function ReportsScreen() {
  const { tradeHistory, openPositions, instruments, accountSummary, pushToast } = usePlatform();
  const [range, setRange] = useState<ReportRange>('90D');
  const [categoryFilter, setCategoryFilter] = useState<MarketCategory>('All');

  const instMap = useMemo(() => new Map(instruments.map((i) => [i.symbol, i])), [instruments]);

  const analytics = useMemo(() => {
    const closedTrades = tradeHistory.filter((t) => {
      if (t.realizedPnl === undefined) return false;
      if (categoryFilter === 'All') return true;
      return instMap.get(t.symbol)?.category === categoryFilter;
    });

    const wins = closedTrades.filter((t) => (t.realizedPnl ?? 0) > 0);
    const losses = closedTrades.filter((t) => (t.realizedPnl ?? 0) < 0);
    const grossProfit = wins.reduce((s, t) => s + (t.realizedPnl ?? 0), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.realizedPnl ?? 0), 0));
    const netRealized = grossProfit - grossLoss;
    const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 3.5 : 0;
    const totalFees = tradeHistory.reduce((s, t) => s + t.feeUsd, 0);
    const expectancy = closedTrades.length > 0 ? netRealized / closedTrades.length : 0;

    // Symbol attribution
    const bySymbol = new Map<
      string,
      { symbol: string; category: string; trades: number; wins: number; netPnl: number; fees: number }
    >();

    tradeHistory.forEach((t) => {
      const cat = instMap.get(t.symbol)?.category ?? 'Other';
      if (categoryFilter !== 'All' && cat !== categoryFilter) return;
      const cur = bySymbol.get(t.symbol) ?? {
        symbol: t.symbol,
        category: cat,
        trades: 0,
        wins: 0,
        netPnl: 0,
        fees: 0,
      };
      cur.trades += 1;
      cur.fees += t.feeUsd;
      if (t.realizedPnl !== undefined) {
        cur.netPnl += t.realizedPnl;
        if (t.realizedPnl > 0) cur.wins += 1;
      }
      bySymbol.set(t.symbol, cur);
    });

    const attributionRows = Array.from(bySymbol.values()).sort((a, b) => b.netPnl - a.netPnl);

    return {
      closedCount: closedTrades.length,
      winsCount: wins.length,
      lossesCount: losses.length,
      netRealized,
      winRate,
      profitFactor,
      totalFees,
      expectancy,
      attributionRows,
    };
  }, [tradeHistory, categoryFilter, instMap]);

  const equitySeries = useMemo(() => {
    const base = [212400, 216800, 214900, 221300, 228900, 226100, 234500, 241200, 246800, accountSummary.equity];
    if (range === '7D') return base.slice(-4);
    if (range === '30D') return base.slice(-6);
    return base;
  }, [accountSummary.equity, range]);

  const equityPath = useMemo(() => {
    const w = 520;
    const h = 150;
    const pad = 12;
    const min = Math.min(...equitySeries) * 0.992;
    const max = Math.max(...equitySeries) * 1.006;
    const span = max - min || 1;
    const coords = equitySeries.map((val, idx) => {
      const x = pad + (idx / Math.max(1, equitySeries.length - 1)) * (w - pad * 2);
      const y = h - pad - ((val - min) / span) * (h - pad * 2);
      return { x, y, val };
    });
    const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
    const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${h - pad} L ${coords[0].x.toFixed(1)} ${h - pad} Z`;
    return { w, h, line, area, coords };
  }, [equitySeries]);

  const triggerDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    pushToast({ title: 'Report Exported', description: filename, variant: 'success' });
  };

  const handleExportCsv = () => {
    const header = 'ID,Timestamp,Symbol,Side,Type,Quantity,FillPrice,FeeUSD,RealizedPnlUSD,Status';
    const rows = tradeHistory.map(
      (t) =>
        `${t.id},"${t.executedAt}",${t.symbol},${t.side},${t.type},${t.quantity},${t.fillPrice},${t.feeUsd},${t.realizedPnl ?? ''},${t.status}`
    );
    triggerDownload(`kestrel-performance-${range.toLowerCase()}.csv`, [header, ...rows].join('\n'), 'text/csv');
  };

  const handleExportJson = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      range,
      accountSummary,
      metrics: {
        netRealizedPnl: analytics.netRealized,
        winRatePct: Number(analytics.winRate.toFixed(2)),
        profitFactor: Number(analytics.profitFactor.toFixed(2)),
        expectancyUsd: Number(analytics.expectancy.toFixed(2)),
      },
      openPositions,
      tradeHistory,
    };
    triggerDownload(
      `kestrel-report-${range.toLowerCase()}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1640px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
            Performance & Analytical Reports
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Portfolio attribution, execution statistics, drawdown metrics, and exportable statements
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedTabs
            value={range}
            onChange={setRange}
            options={[
              { value: '7D', label: '7D' },
              { value: '30D', label: '30D' },
              { value: '90D', label: '90D' },
              { value: 'YTD', label: 'YTD' },
            ]}
          />
          <Button variant="secondary" onClick={handleExportCsv}>
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export CSV
          </Button>
          <Button variant="primary" onClick={handleExportJson}>
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { value: 'All', label: 'All Asset Classes' },
            { value: 'Forex', label: 'Forex' },
            { value: 'Crypto', label: 'Crypto' },
            { value: 'Stocks', label: 'Stocks' },
            { value: 'Indices', label: 'Indices' },
            { value: 'Commodities', label: 'Commodities' },
          ]}
        />
        <span className="text-[11px] font-mono text-[var(--text-muted)]">
          Closed Trades Analyzed: {analytics.closedCount} · Total Fees: ${analytics.totalFees.toFixed(2)}
        </span>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Panel className="p-3.5">
          <div className="text-[11px] text-[var(--text-secondary)]">Net Realized P&L</div>
          <div
            className={`text-lg font-bold font-mono tabular-nums mt-1 ${
              analytics.netRealized >= 0 ? 'text-[#089981]' : 'text-[#F23645]'
            }`}
          >
            {analytics.netRealized >= 0 ? '+' : '-'}${Math.abs(analytics.netRealized).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </Panel>
        <Panel className="p-3.5">
          <div className="text-[11px] text-[var(--text-secondary)]">Win Rate</div>
          <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
            {analytics.winRate.toFixed(1)}%
          </div>
          <div className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
            {analytics.winsCount}W / {analytics.lossesCount}L
          </div>
        </Panel>
        <Panel className="p-3.5">
          <div className="text-[11px] text-[var(--text-secondary)]">Profit Factor</div>
          <div className="text-lg font-bold font-mono tabular-nums text-[#089981] mt-1">
            {analytics.profitFactor.toFixed(2)}
          </div>
        </Panel>
        <Panel className="p-3.5">
          <div className="text-[11px] text-[var(--text-secondary)]">Expectancy / Trade</div>
          <div
            className={`text-lg font-bold font-mono tabular-nums mt-1 ${
              analytics.expectancy >= 0 ? 'text-[#089981]' : 'text-[#F23645]'
            }`}
          >
            {analytics.expectancy >= 0 ? '+' : '-'}${Math.abs(analytics.expectancy).toFixed(2)}
          </div>
        </Panel>
        <Panel className="p-3.5">
          <div className="text-[11px] text-[var(--text-secondary)]">Max Drawdown</div>
          <div className="text-lg font-bold font-mono tabular-nums text-[#F0B90B] mt-1">
            -3.42%
          </div>
        </Panel>
        <Panel className="p-3.5">
          <div className="text-[11px] text-[var(--text-secondary)]">Sharpe Ratio (Est.)</div>
          <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
            1.84
          </div>
        </Panel>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Panel className="lg:col-span-7 p-4 space-y-3">
          <SectionHeader
            title={`Equity Curve (${range})`}
            subtitle="Simulated account equity progression net of realized fees"
          />
          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${equityPath.w} ${equityPath.h}`}
              className="w-full h-44"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="kestrelEqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2962FF" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#2962FF" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d={equityPath.area} fill="url(#kestrelEqGrad)" />
              <path d={equityPath.line} fill="none" stroke="#2962FF" strokeWidth="2.2" />
              {equityPath.coords.map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r="3" fill="#2962FF" />
              ))}
            </svg>
          </div>
        </Panel>

        <Panel className="lg:col-span-5 p-4 space-y-3">
          <SectionHeader
            title="Monthly Return Attribution"
            subtitle="Net percentage return & USD P&L by month"
          />
          <div className="space-y-2.5 pt-1">
            {MONTHLY_RETURNS.map((m) => {
              const positive = m.pct >= 0;
              const barPct = Math.min(100, Math.abs(m.pct) * 14);
              return (
                <div key={m.month} className="grid grid-cols-12 items-center gap-2 text-xs">
                  <span className="col-span-2 font-mono text-[var(--text-secondary)]">{m.month}</span>
                  <div className="col-span-6 h-2.5 bg-[var(--bg-canvas)] rounded-sm overflow-hidden">
                    <div
                      className={`h-full ${positive ? 'bg-[#089981]' : 'bg-[#F23645]'}`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  <span
                    className={`col-span-2 text-right font-mono tabular-nums font-medium ${
                      positive ? 'text-[#089981]' : 'text-[#F23645]'
                    }`}
                  >
                    {positive ? '+' : ''}
                    {m.pct.toFixed(1)}%
                  </span>
                  <span className="col-span-2 text-right font-mono tabular-nums text-[var(--text-muted)] text-[11px]">
                    {m.pnl >= 0 ? '+' : '-'}${Math.abs(m.pnl).toLocaleString('en-US')}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* Attribution Table */}
      <Panel className="overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#2962FF]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Instrument Performance Breakdown
            </h2>
          </div>
          <span className="text-[11px] font-mono text-[var(--text-muted)]">
            {analytics.attributionRows.length} Instruments
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[11px] text-[var(--text-secondary)]">
                <th className="text-left font-medium px-4 py-2.5">Instrument</th>
                <th className="text-left font-medium px-3 py-2.5">Asset Class</th>
                <th className="text-right font-medium px-3 py-2.5">Executions</th>
                <th className="text-right font-medium px-3 py-2.5">Winning Exits</th>
                <th className="text-right font-medium px-3 py-2.5">Total Fees</th>
                <th className="text-right font-medium px-4 py-2.5">Realized P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {analytics.attributionRows.map((row) => (
                <tr key={row.symbol} className="hover:bg-[var(--bg-panel)]/60">
                  <td className="px-4 py-2.5 font-mono font-semibold text-[var(--text-primary)]">
                    {row.symbol}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--text-secondary)]">{row.category}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                    {row.trades}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                    {row.wins}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-muted)]">
                    ${row.fees.toFixed(2)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono tabular-nums font-semibold ${
                      row.netPnl >= 0 ? 'text-[#089981]' : 'text-[#F23645]'
                    }`}
                  >
                    {row.netPnl >= 0 ? '+' : '-'}${Math.abs(row.netPnl).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
