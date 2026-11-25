import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CandlestickChart,
  CheckCircle2,
  Clock,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  computePositionNotionalUsd,
  computePositionUnrealizedPnl,
  usePlatform,
} from '../../context/PlatformContext';
import { OrderSide, OrderType } from '../../types/market';
import { formatPrice } from '../../utils/indicators';
import { Button, Input, Panel, SectionHeader, SegmentedTabs, Select } from '../ui/DesignSystem';

type LedgerTab = 'positions' | 'orders' | 'history';

const LEVERAGES = [1, 2, 5, 10, 20];

export function TradingScreen() {
  const {
    instruments,
    selectedSymbol,
    setSelectedSymbol,
    openChart,
    openPositions,
    workingOrders,
    tradeHistory,
    accountSummary,
    placeOrder,
    closePosition,
    cancelOrder,
  } = usePlatform();

  const activeInst = useMemo(
    () => instruments.find((i) => i.symbol === selectedSymbol) ?? instruments[0],
    [instruments, selectedSymbol]
  );

  const [side, setSide] = useState<OrderSide>('Buy');
  const [orderType, setOrderType] = useState<OrderType>('Market');
  const [quantity, setQuantity] = useState<string>(
    activeInst.category === 'Forex' ? '50000' : activeInst.category === 'Crypto' ? '0.5' : '25'
  );
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [leverage, setLeverage] = useState<number>(
    activeInst.category === 'Forex' ? 20 : activeInst.category === 'Crypto' ? 3 : 5
  );
  const [note, setNote] = useState<string>('');
  const [ledgerTab, setLedgerTab] = useState<LedgerTab>('positions');

  const instMap = useMemo(() => new Map(instruments.map((i) => [i.symbol, i])), [instruments]);

  const handleSymbolChange = (sym: string) => {
    setSelectedSymbol(sym);
    const nextInst = instruments.find((i) => i.symbol === sym);
    if (nextInst) {
      setQuantity(
        nextInst.category === 'Forex' ? '50000' : nextInst.category === 'Crypto' ? '0.5' : '25'
      );
      setLeverage(nextInst.category === 'Forex' ? 20 : nextInst.category === 'Crypto' ? 3 : 5);
      setLimitPrice('');
      setStopLoss('');
      setTakeProfit('');
    }
  };

  const parsedQty = Math.max(0, Number(quantity) || 0);
  const referencePrice =
    orderType === 'Market'
      ? side === 'Buy'
        ? activeInst.ask
        : activeInst.bid
      : Number(limitPrice) || activeInst.price;

  const estimatedNotional = useMemo(() => {
    if (activeInst.symbol.endsWith('/JPY')) return parsedQty;
    return parsedQty * referencePrice;
  }, [activeInst.symbol, parsedQty, referencePrice]);

  const estimatedMargin = estimatedNotional / Math.max(1, leverage);
  const estimatedFee = Math.max(1.2, estimatedNotional * 0.0003);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedQty <= 0) return;
    placeOrder({
      symbol: activeInst.symbol,
      side,
      type: orderType,
      quantity: parsedQty,
      limitOrStopPrice: orderType === 'Market' ? undefined : Number(limitPrice) || activeInst.price,
      stopLoss: stopLoss ? Number(stopLoss) : undefined,
      takeProfit: takeProfit ? Number(takeProfit) : undefined,
      leverage,
      note: note.trim() || undefined,
    });
    setNote('');
  };

  const applyQuickRisk = (mode: '1:2' | '1:3') => {
    const px = referencePrice;
    const riskDist = px * (activeInst.category === 'Forex' ? 0.0035 : 0.015);
    const rewardMult = mode === '1:2' ? 2 : 3;
    if (side === 'Buy') {
      setStopLoss((px - riskDist).toFixed(activeInst.decimals));
      setTakeProfit((px + riskDist * rewardMult).toFixed(activeInst.decimals));
    } else {
      setStopLoss((px + riskDist).toFixed(activeInst.decimals));
      setTakeProfit((px - riskDist * rewardMult).toFixed(activeInst.decimals));
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
            Execution & Trading Desk
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Simulated multi-asset order routing, live margin telemetry, and active position management
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => openChart(activeInst.symbol)}>
            <CandlestickChart className="w-3.5 h-3.5" />
            Open {activeInst.symbol} Chart
          </Button>
        </div>
      </div>

      {/* Account Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Panel className="p-3">
          <div className="text-[11px] text-[var(--text-secondary)]">Account Balance</div>
          <div className="text-base font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
            ${accountSummary.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[11px] text-[var(--text-secondary)]">Net Equity</div>
          <div className="text-base font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
            ${accountSummary.equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[11px] text-[var(--text-secondary)]">Unrealized P&L</div>
          <div
            className={`text-base font-bold font-mono tabular-nums mt-1 ${
              accountSummary.unrealizedPnl >= 0 ? 'text-[#089981]' : 'text-[#F23645]'
            }`}
          >
            {accountSummary.unrealizedPnl >= 0 ? '+' : '-'}$
            {Math.abs(accountSummary.unrealizedPnl).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[11px] text-[var(--text-secondary)]">Used Margin</div>
          <div className="text-base font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
            ${accountSummary.usedMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[11px] text-[var(--text-secondary)]">Free Margin</div>
          <div className="text-base font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
            ${accountSummary.freeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </Panel>
        <Panel className="p-3">
          <div className="text-[11px] text-[var(--text-secondary)]">Margin Level</div>
          <div
            className={`text-base font-bold font-mono tabular-nums mt-1 ${
              accountSummary.marginLevelPct >= 250
                ? 'text-[#089981]'
                : accountSummary.marginLevelPct >= 120
                ? 'text-[#F0B90B]'
                : 'text-[#F23645]'
            }`}
          >
            {accountSummary.usedMargin > 0 ? `${accountSummary.marginLevelPct.toFixed(1)}%` : '∞'}
          </div>
        </Panel>
      </div>

      {/* Main Workspace: Order Ticket + Positions/Orders/History Ledger */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Left: Order Ticket */}
        <Panel className="xl:col-span-4 p-4 space-y-4">
          <SectionHeader
            title="Order Ticket"
            subtitle="Direct simulated market, limit & stop execution"
          />

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Instrument
              </label>
              <Select
                value={activeInst.symbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                className="w-full"
              >
                {instruments.map((inst) => (
                  <option key={inst.symbol} value={inst.symbol}>
                    {inst.symbol} — {inst.name} ({inst.category})
                  </option>
                ))}
              </Select>
            </div>

            {/* Live Bid / Ask Bar */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSide('Sell')}
                className={`p-2.5 rounded border text-left transition-colors cursor-pointer ${
                  side === 'Sell'
                    ? 'bg-[#F23645]/15 border-[#F23645] text-[#F23645]'
                    : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span>SELL / SHORT</span>
                  <ArrowDownRight className="w-3.5 h-3.5" />
                </div>
                <div className="text-sm font-mono tabular-nums font-bold text-[var(--text-primary)] mt-1">
                  {formatPrice(activeInst.bid, activeInst.decimals)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSide('Buy')}
                className={`p-2.5 rounded border text-left transition-colors cursor-pointer ${
                  side === 'Buy'
                    ? 'bg-[#089981]/15 border-[#089981] text-[#089981]'
                    : 'bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span>BUY / LONG</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
                <div className="text-sm font-mono tabular-nums font-bold text-[var(--text-primary)] mt-1">
                  {formatPrice(activeInst.ask, activeInst.decimals)}
                </div>
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono px-0.5">
              <span>Spread: {activeInst.spread}</span>
              <span>24h: {activeInst.changePercent >= 0 ? '+' : ''}{activeInst.changePercent.toFixed(2)}%</span>
            </div>

            {/* Order Type */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Order Type
              </label>
              <SegmentedTabs
                className="w-full grid grid-cols-3"
                value={orderType}
                onChange={setOrderType}
                options={[
                  { value: 'Market', label: 'Market' },
                  { value: 'Limit', label: 'Limit' },
                  { value: 'Stop', label: 'Stop' },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  Quantity / Units
                </label>
                <Input
                  type="number"
                  step="any"
                  min="0.0001"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  Leverage
                </label>
                <Select
                  value={String(leverage)}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                  className="w-full"
                >
                  {LEVERAGES.map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}x Margin
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {orderType !== 'Market' && (
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  {orderType} Trigger Price
                </label>
                <Input
                  type="number"
                  step="any"
                  required
                  placeholder={formatPrice(activeInst.price, activeInst.decimals)}
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                />
              </div>
            )}

            {/* SL / TP Brackets */}
            <div className="pt-1 border-t border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  Risk Brackets (Optional)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => applyQuickRisk('1:2')}
                    className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg-panel)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-secondary)] cursor-pointer"
                  >
                    Auto 1:2
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickRisk('1:3')}
                    className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg-panel)] hover:bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded text-[var(--text-secondary)] cursor-pointer"
                  >
                    Auto 1:3
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] text-[#F23645] mb-1">Stop Loss</label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Optional"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#089981] mb-1">Take Profit</label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Optional"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Execution Note
              </label>
              <Input
                placeholder="e.g. London session breakout setup"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            {/* Cost Preview */}
            <div className="p-2.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Estimated Notional</span>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  ${estimatedNotional.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Required Margin ({leverage}x)</span>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  ${estimatedMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Est. Commission</span>
                <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                  ${estimatedFee.toFixed(2)}
                </span>
              </div>
            </div>

            <Button
              type="submit"
              variant={side === 'Buy' ? 'positive' : 'danger'}
              size="md"
              className="w-full"
            >
              {orderType === 'Market'
                ? `${side === 'Buy' ? 'Execute Buy' : 'Execute Sell'} ${activeInst.symbol}`
                : `Place ${side} ${orderType} Order`}
            </Button>
          </form>
        </Panel>

        {/* Right: Active Positions, Working Orders, Trade History */}
        <Panel className="xl:col-span-8 overflow-hidden">
          <div className="p-3.5 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
            <SegmentedTabs
              value={ledgerTab}
              onChange={setLedgerTab}
              options={[
                { value: 'positions', label: 'Open Positions', count: openPositions.length },
                { value: 'orders', label: 'Working Orders', count: workingOrders.length },
                { value: 'history', label: 'Execution History', count: tradeHistory.length },
              ]}
            />
            <span className="text-[11px] font-mono text-[var(--text-muted)]">
              Simulated Margin Account · Instant Fill
            </span>
          </div>

          {ledgerTab === 'positions' && (
            <div className="overflow-x-auto">
              {openPositions.length === 0 ? (
                <div className="p-10 text-center text-xs text-[var(--text-secondary)]">
                  No open positions. Use the Order Ticket to execute a simulated position.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[11px] text-[var(--text-secondary)]">
                      <th className="text-left font-medium px-4 py-2.5">Symbol</th>
                      <th className="text-left font-medium px-3 py-2.5">Side</th>
                      <th className="text-right font-medium px-3 py-2.5">Qty</th>
                      <th className="text-right font-medium px-3 py-2.5">Entry</th>
                      <th className="text-right font-medium px-3 py-2.5">Mark</th>
                      <th className="text-right font-medium px-3 py-2.5">SL / TP</th>
                      <th className="text-right font-medium px-3 py-2.5">Margin</th>
                      <th className="text-right font-medium px-3 py-2.5">Unrealized P&L</th>
                      <th className="text-right font-medium px-4 py-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {openPositions.map((pos) => {
                      const inst = instMap.get(pos.symbol);
                      const decimals = inst?.decimals ?? 2;
                      const mark = inst ? (pos.side === 'Buy' ? inst.bid : inst.ask) : pos.entryPrice;
                      const pnl = computePositionUnrealizedPnl(pos, mark);
                      const margin = computePositionNotionalUsd(pos, mark) / Math.max(1, pos.leverage);
                      return (
                        <tr key={pos.id} className="hover:bg-[var(--bg-panel)]/60">
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => openChart(pos.symbol)}
                              className="font-mono font-semibold text-[var(--text-primary)] hover:text-[#2962FF] cursor-pointer"
                            >
                              {pos.symbol}
                            </button>
                            <div className="text-[10px] text-[var(--text-muted)]">
                              {pos.leverage}x · {pos.openedAt}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`text-[11px] font-semibold ${
                                pos.side === 'Buy' ? 'text-[#089981]' : 'text-[#F23645]'
                              }`}
                            >
                              {pos.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                            {pos.quantity.toLocaleString('en-US')}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                            {formatPrice(pos.entryPrice, decimals)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                            {formatPrice(mark, decimals)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[11px] text-[var(--text-secondary)]">
                            <div>SL: {pos.stopLoss ? formatPrice(pos.stopLoss, decimals) : '—'}</div>
                            <div>TP: {pos.takeProfit ? formatPrice(pos.takeProfit, decimals) : '—'}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                            ${margin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right font-mono tabular-nums font-semibold ${
                              pnl >= 0 ? 'text-[#089981]' : 'text-[#F23645]'
                            }`}
                          >
                            {pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => closePosition(pos.id)}
                            >
                              <X className="w-3 h-3" />
                              Close
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {ledgerTab === 'orders' && (
            <div className="overflow-x-auto">
              {workingOrders.length === 0 ? (
                <div className="p-10 text-center text-xs text-[var(--text-secondary)]">
                  No pending Limit or Stop orders.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[11px] text-[var(--text-secondary)]">
                      <th className="text-left font-medium px-4 py-2.5">Symbol</th>
                      <th className="text-left font-medium px-3 py-2.5">Side / Type</th>
                      <th className="text-right font-medium px-3 py-2.5">Qty</th>
                      <th className="text-right font-medium px-3 py-2.5">Trigger Price</th>
                      <th className="text-right font-medium px-3 py-2.5">SL / TP</th>
                      <th className="text-left font-medium px-3 py-2.5">Placed</th>
                      <th className="text-right font-medium px-4 py-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {workingOrders.map((ord) => {
                      const decimals = instMap.get(ord.symbol)?.decimals ?? 2;
                      return (
                        <tr key={ord.id} className="hover:bg-[var(--bg-panel)]/60">
                          <td className="px-4 py-2.5 font-mono font-semibold text-[var(--text-primary)]">
                            {ord.symbol}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`font-semibold ${
                                ord.side === 'Buy' ? 'text-[#089981]' : 'text-[#F23645]'
                              }`}
                            >
                              {ord.side} {ord.type}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                            {ord.quantity.toLocaleString('en-US')}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                            {formatPrice(ord.limitOrStopPrice, decimals)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[11px] text-[var(--text-secondary)]">
                            {ord.stopLoss ? formatPrice(ord.stopLoss, decimals) : '—'} /{' '}
                            {ord.takeProfit ? formatPrice(ord.takeProfit, decimals) : '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--text-muted)]">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {ord.createdAt}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => cancelOrder(ord.id)}
                            >
                              <Trash2 className="w-3 h-3 text-[#F23645]" />
                              Cancel
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {ledgerTab === 'history' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[11px] text-[var(--text-secondary)]">
                    <th className="text-left font-medium px-4 py-2.5">Timestamp</th>
                    <th className="text-left font-medium px-3 py-2.5">Symbol</th>
                    <th className="text-left font-medium px-3 py-2.5">Side / Type</th>
                    <th className="text-right font-medium px-3 py-2.5">Qty</th>
                    <th className="text-right font-medium px-3 py-2.5">Fill Price</th>
                    <th className="text-right font-medium px-3 py-2.5">Fee</th>
                    <th className="text-right font-medium px-3 py-2.5">Realized P&L</th>
                    <th className="text-right font-medium px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {tradeHistory.map((trd) => {
                    const decimals = instMap.get(trd.symbol)?.decimals ?? 2;
                    return (
                      <tr key={trd.id} className="hover:bg-[var(--bg-panel)]/60">
                        <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--text-secondary)]">
                          {trd.executedAt}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-semibold text-[var(--text-primary)]">
                          {trd.symbol}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`font-semibold ${
                              trd.side === 'Buy' ? 'text-[#089981]' : 'text-[#F23645]'
                            }`}
                          >
                            {trd.side} {trd.type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                          {trd.quantity.toLocaleString('en-US')}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                          {formatPrice(trd.fillPrice, decimals)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-muted)]">
                          ${trd.feeUsd.toFixed(2)}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right font-mono tabular-nums font-semibold ${
                            trd.realizedPnl === undefined
                              ? 'text-[var(--text-muted)]'
                              : trd.realizedPnl >= 0
                              ? 'text-[#089981]'
                              : 'text-[#F23645]'
                          }`}
                        >
                          {trd.realizedPnl === undefined
                            ? '—'
                            : `${trd.realizedPnl >= 0 ? '+' : '-'}$${Math.abs(trd.realizedPnl).toFixed(2)}`}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#089981]">
                            <CheckCircle2 className="w-3 h-3" />
                            {trd.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
