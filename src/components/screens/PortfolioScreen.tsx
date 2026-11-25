import React, { useMemo, useState } from 'react';
import { CandlestickChart, Plus } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { formatPrice } from '../../utils/indicators';
import { Button, Input, Modal, Panel, SegmentedTabs, Select } from '../ui/DesignSystem';

type AccountScope = 'All' | 'Real' | 'Simulated';
type PerfRange = '1M' | '3M' | 'YTD' | '1Y';

const PERFORMANCE_SERIES: Record<PerfRange, { label: string; real: number; sim: number }[]> = {
  '1M': [
    { label: 'Nov 01', real: 132400, sim: 221000 },
    { label: 'Nov 06', real: 135100, sim: 226500 },
    { label: 'Nov 11', real: 134200, sim: 234800 },
    { label: 'Nov 16', real: 138900, sim: 241200 },
    { label: 'Nov 21', real: 141800, sim: 249600 },
    { label: 'Nov 25', real: 146500, sim: 256400 },
  ],
  '3M': [
    { label: 'Sep 01', real: 118500, sim: 188000 },
    { label: 'Sep 18', real: 122900, sim: 194500 },
    { label: 'Oct 05', real: 127400, sim: 205200 },
    { label: 'Oct 22', real: 131800, sim: 219000 },
    { label: 'Nov 08', real: 139200, sim: 238500 },
    { label: 'Nov 25', real: 146500, sim: 256400 },
  ],
  YTD: [
    { label: 'Jan', real: 98000, sim: 150000 },
    { label: 'Mar', real: 109400, sim: 168200 },
    { label: 'May', real: 116800, sim: 184500 },
    { label: 'Jul', real: 124200, sim: 198400 },
    { label: 'Sep', real: 131500, sim: 218000 },
    { label: 'Nov', real: 146500, sim: 256400 },
  ],
  '1Y': [
    { label: 'Nov 25', real: 92000, sim: 140000 },
    { label: 'Feb', real: 104500, sim: 162000 },
    { label: 'May', real: 116800, sim: 184500 },
    { label: 'Aug', real: 128400, sim: 206000 },
    { label: 'Oct', real: 136900, sim: 229500 },
    { label: 'Nov', real: 146500, sim: 256400 },
  ],
};

export function PortfolioScreen() {
  const { holdings, transactions, instruments, openChart, addPortfolioTransaction } = usePlatform();
  const [scope, setScope] = useState<AccountScope>('All');
  const [perfRange, setPerfRange] = useState<PerfRange>('3M');
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txAccount, setTxAccount] = useState<'Simulated' | 'Real'>('Simulated');
  const [txSymbol, setTxSymbol] = useState('NVDA');
  const [txSide, setTxSide] = useState<'Buy' | 'Sell'>('Buy');
  const [txQty, setTxQty] = useState('10');

  const enrichedHoldings = useMemo(() => {
    return holdings
      .filter((h) => scope === 'All' || h.accountType === scope)
      .map((h) => {
        const inst = instruments.find((i) => i.symbol === h.symbol);
        const currentPrice = inst?.price ?? h.avgEntryPrice;
        const marketValue = h.quantity * currentPrice;
        const costBasis = h.quantity * h.avgEntryPrice;
        const pnl = marketValue - costBasis;
        const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
        return {
          ...h,
          name: inst?.name ?? h.symbol,
          category: inst?.category ?? 'Stocks',
          decimals: inst?.decimals ?? 2,
          currentPrice,
          marketValue,
          costBasis,
          pnl,
          pnlPct,
        };
      })
      .sort((a, b) => b.marketValue - a.marketValue);
  }, [holdings, instruments, scope]);

  const summary = useMemo(() => {
    let realVal = 0;
    let simVal = 0;
    let totalCost = 0;
    let totalVal = 0;

    holdings.forEach((h) => {
      const inst = instruments.find((i) => i.symbol === h.symbol);
      const val = h.quantity * (inst?.price ?? h.avgEntryPrice);
      const cost = h.quantity * h.avgEntryPrice;
      if (h.accountType === 'Real') realVal += val;
      else simVal += val;
      if (scope === 'All' || h.accountType === scope) {
        totalVal += val;
        totalCost += cost;
      }
    });

    const totalPnl = totalVal - totalCost;
    const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

    return { realVal, simVal, totalVal, totalCost, totalPnl, totalPnlPct };
  }, [holdings, instruments, scope]);

  const categoryDistribution = useMemo(() => {
    const map = new Map<string, number>();
    enrichedHoldings.forEach((h) => {
      map.set(h.category, (map.get(h.category) ?? 0) + h.marketValue);
    });
    const total = summary.totalVal || 1;
    const colors: Record<string, string> = {
      Stocks: '#2962FF',
      Crypto: '#F0B90B',
      Indices: '#089981',
      Commodities: '#AB47BC',
      Forex: '#26A69A',
    };
    return Array.from(map.entries())
      .map(([cat, value]) => ({
        category: cat,
        value,
        pct: (value / total) * 100,
        color: colors[cat] ?? '#787B86',
      }))
      .sort((a, b) => b.value - a.value);
  }, [enrichedHoldings, summary.totalVal]);

  const filteredTx = useMemo(
    () => transactions.filter((t) => scope === 'All' || t.accountType === scope),
    [transactions, scope]
  );

  // SVG Performance Chart Calculations
  const chartData = PERFORMANCE_SERIES[perfRange];
  const chartPoints = useMemo(() => {
    const values = chartData.map((d) =>
      scope === 'Real' ? d.real : scope === 'Simulated' ? d.sim : d.real + d.sim
    );
    const min = Math.min(...values) * 0.96;
    const max = Math.max(...values) * 1.02;
    const w = 640;
    const h = 190;
    const padX = 16;
    const padY = 16;
    const coords = values.map((v, idx) => {
      const x = padX + (idx / Math.max(1, values.length - 1)) * (w - padX * 2);
      const y = h - padY - ((v - min) / (max - min || 1)) * (h - padY * 2);
      return { x, y, value: v, label: chartData[idx].label };
    });
    const linePath = coords.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
    const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${h - padY} L ${coords[0].x} ${h - padY} Z`;
    return { coords, linePath, areaPath, w, h, min, max };
  }, [chartData, scope]);

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
            Portfolio Analytics
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Segregated valuation tracking for Real brokerage accounts and Simulated research portfolios
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedTabs
            value={scope}
            onChange={setScope}
            options={[
              { value: 'All', label: 'Combined View' },
              { value: 'Real', label: 'Real Holdings' },
              { value: 'Simulated', label: 'Simulated Paper' },
            ]}
          />
          <Button variant="primary" onClick={() => setTxModalOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            Record Entry
          </Button>
        </div>
      </div>

      {/* Portfolio Summary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Panel className="p-4">
          <div className="text-[11px] text-[var(--text-secondary)]">
            Total Account Value ({scope === 'All' ? 'Combined' : scope})
          </div>
          <div className="text-xl font-mono tabular-nums font-bold text-[var(--text-primary)] mt-1">
            ${summary.totalVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Cost Basis: ${summary.totalCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="text-[11px] text-[var(--text-secondary)]">Unrealized Profit & Loss</div>
          <div
            className={`text-xl font-mono tabular-nums font-bold mt-1 ${
              summary.totalPnl >= 0 ? 'text-[#089981]' : 'text-[#F23645]'
            }`}
          >
            {summary.totalPnl >= 0 ? '+' : '-'}$
            {Math.abs(summary.totalPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div
            className={`text-xs font-mono tabular-nums mt-1 ${
              summary.totalPnlPct >= 0 ? 'text-[#089981]' : 'text-[#F23645]'
            }`}
          >
            {summary.totalPnlPct >= 0 ? '+' : ''}
            {summary.totalPnlPct.toFixed(2)}% return on cost
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="text-[11px] text-[var(--text-secondary)]">Real Brokerage Allocation</div>
          <div className="text-xl font-mono tabular-nums font-bold text-[#089981] mt-1">
            ${summary.realVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Verified Custody · IBKR & Coinbase Prime
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="text-[11px] text-[var(--text-secondary)]">Simulated Paper Capital</div>
          <div className="text-xl font-mono tabular-nums font-bold text-[#2962FF] mt-1">
            ${summary.simVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Paper Research Sandbox · Non-cash
          </div>
        </Panel>
      </div>

      {/* Performance Curve + Asset Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Panel className="lg:col-span-8 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                Equity Performance Curve ({scope})
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Net portfolio valuation progression over selected lookback
              </p>
            </div>
            <SegmentedTabs
              value={perfRange}
              onChange={setPerfRange}
              options={[
                { value: '1M', label: '1M' },
                { value: '3M', label: '3M' },
                { value: 'YTD', label: 'YTD' },
                { value: '1Y', label: '1Y' },
              ]}
            />
          </div>

          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${chartPoints.w} ${chartPoints.h}`}
              className="w-full h-48 overflow-visible"
            >
              <defs>
                <linearGradient id="portGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2962FF" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#2962FF" stopOpacity="0.01" />
                </linearGradient>
              </defs>
              <path d={chartPoints.areaPath} fill="url(#portGrad)" />
              <path d={chartPoints.linePath} fill="none" stroke="#2962FF" strokeWidth="2.2" />
              {chartPoints.coords.map((pt) => (
                <g key={pt.label}>
                  <circle cx={pt.x} cy={pt.y} r="3.5" fill="#2962FF" />
                  <text
                    x={pt.x}
                    y={chartPoints.h - 2}
                    textAnchor="middle"
                    className="fill-[var(--text-muted)] text-[10px] font-mono"
                  >
                    {pt.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </Panel>

        <Panel className="lg:col-span-4 p-4 space-y-3">
          <div>
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">Asset Distribution</h3>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Weighting by market class
            </p>
          </div>

          <div className="h-2.5 w-full rounded-sm overflow-hidden flex bg-[var(--bg-canvas)]">
            {categoryDistribution.map((c) => (
              <div
                key={c.category}
                style={{ width: `${c.pct}%`, backgroundColor: c.color }}
                title={`${c.category}: ${c.pct.toFixed(1)}%`}
              />
            ))}
          </div>

          <div className="space-y-2.5 pt-2">
            {categoryDistribution.map((c) => (
              <div key={c.category} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                    style={{ backgroundColor: c.color }}
                  />
                  <span className="font-medium text-[var(--text-primary)]">{c.category}</span>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <span className="text-[var(--text-primary)] font-medium">
                    ${c.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[var(--text-muted)] ml-2">{c.pct.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Holdings Table */}
      <Panel className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[var(--text-primary)]">
            Open Positions ({enrichedHoldings.length})
          </h3>
          <span className="text-[11px] text-[var(--text-secondary)]">
            Real and Simulated positions are explicitly labeled
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)]">
                <th className="text-left font-medium px-4 py-2.5">Instrument</th>
                <th className="text-left font-medium px-3 py-2.5">Account Type</th>
                <th className="text-right font-medium px-3 py-2.5">Quantity</th>
                <th className="text-right font-medium px-3 py-2.5">Avg Entry</th>
                <th className="text-right font-medium px-3 py-2.5">Current Price</th>
                <th className="text-right font-medium px-3 py-2.5">Market Value</th>
                <th className="text-right font-medium px-3 py-2.5">Unrealized P&L</th>
                <th className="text-right font-medium px-4 py-2.5">Weight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {enrichedHoldings.map((h) => {
                const weight = (h.marketValue / (summary.totalVal || 1)) * 100;
                return (
                  <tr
                    key={h.id}
                    onClick={() => openChart(h.symbol)}
                    className="hover:bg-[var(--bg-panel)]/70 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <CandlestickChart className="w-3.5 h-3.5 text-[#2962FF]" />
                        <span className="font-mono font-semibold text-[var(--text-primary)]">{h.symbol}</span>
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">{h.name}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded-sm border ${
                          h.accountType === 'Real'
                            ? 'text-[#089981] bg-[#089981]/10 border-[#089981]/25'
                            : 'text-[#2962FF] bg-[#2962FF]/10 border-[#2962FF]/25'
                        }`}
                      >
                        {h.accountType === 'Real' ? 'Real Holding' : 'Simulated Paper'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                      {h.quantity.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                      {formatPrice(h.avgEntryPrice, h.decimals)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                      {formatPrice(h.currentPrice, h.decimals)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                      ${h.marketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono tabular-nums font-medium ${
                        h.pnl >= 0 ? 'text-[#089981]' : 'text-[#F23645]'
                      }`}
                    >
                      {h.pnl >= 0 ? '+' : '-'}$
                      {Math.abs(h.pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                      ({h.pnlPct >= 0 ? '+' : ''}
                      {h.pnlPct.toFixed(2)}%)
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                      {weight.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Transaction History */}
      <Panel className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
          <h3 className="text-xs font-semibold text-[var(--text-primary)]">Transaction History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)]">
                <th className="text-left font-medium px-4 py-2.5">Timestamp</th>
                <th className="text-left font-medium px-3 py-2.5">Account</th>
                <th className="text-left font-medium px-3 py-2.5">Instrument</th>
                <th className="text-left font-medium px-3 py-2.5">Type</th>
                <th className="text-right font-medium px-3 py-2.5">Quantity</th>
                <th className="text-right font-medium px-3 py-2.5">Execution Price</th>
                <th className="text-right font-medium px-3 py-2.5">Total USD</th>
                <th className="text-right font-medium px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filteredTx.map((tx) => (
                <tr key={tx.id}>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--text-secondary)]">
                    {tx.timestamp}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`text-[11px] font-medium ${
                        tx.accountType === 'Real' ? 'text-[#089981]' : 'text-[#2962FF]'
                      }`}
                    >
                      {tx.accountType}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono font-semibold text-[var(--text-primary)]">
                    {tx.symbol}
                  </td>
                  <td
                    className={`px-3 py-2.5 font-medium ${
                      tx.side === 'Buy' || tx.side === 'Dividend'
                        ? 'text-[#089981]'
                        : 'text-[#F23645]'
                    }`}
                  >
                    {tx.side}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                    {tx.quantity}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                    ${tx.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums font-medium text-[var(--text-primary)]">
                    ${tx.totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[var(--text-secondary)]">{tx.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Log Simulated or Real Position Entry Modal */}
      <Modal
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        title="Record Portfolio Entry"
        subtitle="Log a simulated paper allocation or external real ledger transaction"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const inst = instruments.find((i) => i.symbol === txSymbol);
            const qty = parseFloat(txQty);
            if (!inst || !Number.isFinite(qty) || qty <= 0) return;
            addPortfolioTransaction({
              accountType: txAccount,
              symbol: txSymbol,
              side: txSide,
              quantity: qty,
              price: inst.price,
            });
            setTxModalOpen(false);
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Account Classification
              </label>
              <Select
                value={txAccount}
                onChange={(e) => setTxAccount(e.target.value as 'Simulated' | 'Real')}
                className="w-full"
              >
                <option value="Simulated">Simulated Paper Portfolio</option>
                <option value="Real">Real Brokerage Ledger</option>
              </Select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Side
              </label>
              <Select
                value={txSide}
                onChange={(e) => setTxSide(e.target.value as 'Buy' | 'Sell')}
                className="w-full"
              >
                <option value="Buy">Buy / Add</option>
                <option value="Sell">Sell / Reduce</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Instrument
              </label>
              <Select
                value={txSymbol}
                onChange={(e) => setTxSymbol(e.target.value)}
                className="w-full"
              >
                {instruments.map((i) => (
                  <option key={i.symbol} value={i.symbol}>
                    {i.symbol} — {formatPrice(i.price, i.decimals)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Quantity
              </label>
              <Input
                type="number"
                step="any"
                min="0.0001"
                required
                value={txQty}
                onChange={(e) => setTxQty(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
            <Button type="button" variant="ghost" onClick={() => setTxModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Record {txAccount} Entry
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
