import React, { useMemo, useState } from 'react';
import { CandlestickChart, RotateCcw, Sliders } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { generateCandlesForInstrument } from '../../data/mockMarketData';
import { Timeframe } from '../../types/market';
import {
  calculateATR,
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
  detectCandlestickPatterns,
  formatPrice,
} from '../../utils/indicators';
import {
  Button,
  Input,
  Panel,
  PriceChangeText,
  SegmentedTabs,
  Select,
  SignalLabel,
} from '../ui/DesignSystem';

const TF_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1D', label: '1D' },
  { value: '1W', label: '1W' },
];

export function TechnicalAnalysisScreen() {
  const { instruments, selectedSymbol, setSelectedSymbol, timeframe, setTimeframe, openChart } =
    usePlatform();

  const instrument = useMemo(
    () => instruments.find((i) => i.symbol === selectedSymbol) ?? instruments[0],
    [instruments, selectedSymbol]
  );

  // Configurable Indicator Parameters
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [emaFast, setEmaFast] = useState(20);
  const [emaSlow, setEmaSlow] = useState(50);
  const [smaPeriod, setSmaPeriod] = useState(100);
  const [bbPeriod, setBbPeriod] = useState(20);
  const [bbMult, setBbMult] = useState(2);
  const [atrPeriod, setAtrPeriod] = useState(14);
  const [macdFast, setMacdFast] = useState(12);
  const [macdSlow, setMacdSlow] = useState(26);
  const [macdSignal, setMacdSignal] = useState(9);

  const resetParams = () => {
    setRsiPeriod(14);
    setEmaFast(20);
    setEmaSlow(50);
    setSmaPeriod(100);
    setBbPeriod(20);
    setBbMult(2);
    setAtrPeriod(14);
    setMacdFast(12);
    setMacdSlow(26);
    setMacdSignal(9);
  };

  const candles = useMemo(
    () => generateCandlesForInstrument(instrument, timeframe, 180),
    [instrument, timeframe]
  );

  const analysis = useMemo(() => {
    const closes = candles.map((c) => c.close);
    const lastPrice = closes[closes.length - 1];

    const rsiArr = calculateRSI(closes, Math.max(2, rsiPeriod));
    const rsi = rsiArr[rsiArr.length - 1] ?? 50;

    const emaFastArr = calculateEMA(closes, Math.max(2, emaFast));
    const emaSlowArr = calculateEMA(closes, Math.max(3, emaSlow));
    const smaArr = calculateSMA(closes, Math.max(5, smaPeriod));

    const emaFastVal = emaFastArr[emaFastArr.length - 1] ?? lastPrice;
    const emaSlowVal = emaSlowArr[emaSlowArr.length - 1] ?? lastPrice;
    const smaVal = smaArr[smaArr.length - 1] ?? lastPrice;

    const bb = calculateBollingerBands(closes, Math.max(5, bbPeriod), Math.max(0.5, bbMult));
    const bbUpper = bb.upper[bb.upper.length - 1] ?? lastPrice;
    const bbMiddle = bb.middle[bb.middle.length - 1] ?? lastPrice;
    const bbLower = bb.lower[bb.lower.length - 1] ?? lastPrice;
    const bbWidthPct = ((bbUpper - bbLower) / (bbMiddle || 1)) * 100;

    const macdObj = calculateMACD(
      closes,
      Math.max(2, macdFast),
      Math.max(4, macdSlow),
      Math.max(2, macdSignal)
    );
    const macdLine = macdObj.macd[macdObj.macd.length - 1] ?? 0;
    const macdSig = macdObj.signal[macdObj.signal.length - 1] ?? 0;
    const macdHist = macdObj.histogram[macdObj.histogram.length - 1] ?? 0;

    const atrArr = calculateATR(candles, Math.max(2, atrPeriod));
    const atr = atrArr[atrArr.length - 1] ?? 0;
    const atrPct = (atr / (lastPrice || 1)) * 100;

    // Swing High & Low for Fibonacci over last 60 bars
    const recent = candles.slice(-60);
    const swingHigh = Math.max(...recent.map((c) => c.high));
    const swingLow = Math.min(...recent.map((c) => c.low));
    const fibDiff = swingHigh - swingLow;
    const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map((ratio) => ({
      ratio,
      label: `${(ratio * 100).toFixed(1)}%`,
      price: swingHigh - fibDiff * ratio,
    }));

    const patterns = detectCandlestickPatterns(candles);

    // Aggregate Consensus
    let buyVotes = 0;
    let sellVotes = 0;
    if (lastPrice > emaFastVal) buyVotes++;
    else sellVotes++;
    if (lastPrice > emaSlowVal) buyVotes++;
    else sellVotes++;
    if (lastPrice > smaVal) buyVotes++;
    else sellVotes++;
    if (emaFastVal > emaSlowVal) buyVotes++;
    else sellVotes++;
    if (macdLine > macdSig) buyVotes++;
    else sellVotes++;
    if (rsi > 55 && rsi < 75) buyVotes++;
    else if (rsi < 45 && rsi > 25) sellVotes++;

    const net = buyVotes - sellVotes;
    const consensus: 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell' =
      net >= 4 ? 'Strong Buy' : net >= 1 ? 'Buy' : net <= -4 ? 'Strong Sell' : net <= -1 ? 'Sell' : 'Neutral';

    return {
      lastPrice,
      rsi,
      emaFastVal,
      emaSlowVal,
      smaVal,
      bbUpper,
      bbMiddle,
      bbLower,
      bbWidthPct,
      macdLine,
      macdSig,
      macdHist,
      atr,
      atrPct,
      swingHigh,
      swingLow,
      fibLevels,
      patterns,
      buyVotes,
      sellVotes,
      consensus,
    };
  }, [candles, rsiPeriod, emaFast, emaSlow, smaPeriod, bbPeriod, bbMult, atrPeriod, macdFast, macdSlow, macdSignal]);

  const rsiLabel =
    analysis.rsi >= 70
      ? 'Overbought — elevated upside exhaustion risk'
      : analysis.rsi <= 30
      ? 'Oversold — potential mean-reversion bounce zone'
      : analysis.rsi >= 55
      ? 'Bullish momentum — buyers retain control'
      : analysis.rsi <= 45
      ? 'Bearish momentum — sellers hold edge'
      : 'Neutral equilibrium — balanced momentum';

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1600px] mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
            Technical Analysis Desk
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Multi-indicator oscillator matrix, moving average structure, Fibonacci levels, and candlestick patterns
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={instrument.symbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            aria-label="Select instrument for technical analysis"
          >
            {instruments.map((i) => (
              <option key={i.symbol} value={i.symbol}>
                {i.symbol} — {i.name}
              </option>
            ))}
          </Select>

          <SegmentedTabs options={TF_OPTIONS} value={timeframe} onChange={setTimeframe} />

          <Button variant="primary" onClick={() => openChart(instrument.symbol)}>
            <CandlestickChart className="w-3.5 h-3.5" />
            Open Chart
          </Button>
        </div>
      </div>

      {/* Instrument Consensus Strip */}
      <Panel className="p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold font-mono text-[var(--text-primary)]">
                {instrument.symbol}
              </span>
              <span className="text-xs text-[var(--text-secondary)]">{instrument.name}</span>
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              {instrument.exchange} · Timeframe: {timeframe}
            </div>
          </div>
          <div className="pl-4 border-l border-[var(--border-subtle)]">
            <div className="text-base font-mono tabular-nums font-bold text-[var(--text-primary)]">
              {formatPrice(instrument.price, instrument.decimals)}
            </div>
            <div className="text-xs">
              <PriceChangeText
                value={instrument.change}
                percent={instrument.changePercent}
                decimals={instrument.decimals}
                showPriceDelta
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <div className="text-right">
            <div className="text-[11px] text-[var(--text-muted)]">Indicator Consensus</div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="text-xs font-mono text-[var(--text-secondary)]">
                {analysis.buyVotes} Buy / {analysis.sellVotes} Sell
              </span>
              <SignalLabel signal={analysis.consensus} />
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-[var(--text-muted)]">Short / Medium Trend</div>
            <div className="text-xs font-semibold text-[var(--text-primary)] mt-0.5">
              {analysis.emaFastVal >= analysis.emaSlowVal ? 'Bullish Alignment' : 'Bearish Alignment'}
            </div>
          </div>
        </div>
      </Panel>

      {/* Main Grid: Indicator Breakdown + Configuration Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Left 2 Columns: Oscillators, Moving Averages, Volatility & Fibonacci */}
        <div className="xl:col-span-2 space-y-4">
          {/* Core Oscillators & Volatility Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* RSI */}
            <Panel className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  RSI ({rsiPeriod})
                </span>
                <span className="font-mono tabular-nums text-sm font-bold text-[var(--text-primary)]">
                  {analysis.rsi.toFixed(2)}
                </span>
              </div>
              <div className="h-2 bg-[var(--bg-canvas)] rounded-full overflow-hidden relative">
                <div
                  className={`h-full rounded-full ${
                    analysis.rsi >= 70
                      ? 'bg-[#F23645]'
                      : analysis.rsi <= 30
                      ? 'bg-[#089981]'
                      : 'bg-[#2962FF]'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(2, analysis.rsi))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)]">
                <span>0 (Oversold &lt;30)</span>
                <span>50</span>
                <span>100 (Overbought &gt;70)</span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{rsiLabel}</p>
            </Panel>

            {/* MACD */}
            <Panel className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  MACD ({macdFast}, {macdSlow}, {macdSignal})
                </span>
                <SignalLabel signal={analysis.macdLine >= analysis.macdSig ? 'Buy' : 'Sell'} />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 text-xs font-mono tabular-nums">
                <div className="p-2 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                  <span className="text-[10px] font-sans text-[var(--text-muted)] block">MACD Line</span>
                  <span className="text-[var(--text-primary)] font-semibold">
                    {analysis.macdLine.toFixed(instrument.decimals)}
                  </span>
                </div>
                <div className="p-2 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                  <span className="text-[10px] font-sans text-[var(--text-muted)] block">Signal</span>
                  <span className="text-[var(--text-primary)] font-semibold">
                    {analysis.macdSig.toFixed(instrument.decimals)}
                  </span>
                </div>
                <div className="p-2 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                  <span className="text-[10px] font-sans text-[var(--text-muted)] block">Histogram</span>
                  <span
                    className={`font-semibold ${
                      analysis.macdHist >= 0 ? 'text-[#089981]' : 'text-[#F23645]'
                    }`}
                  >
                    {analysis.macdHist >= 0 ? '+' : ''}
                    {analysis.macdHist.toFixed(instrument.decimals)}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                {analysis.macdLine >= analysis.macdSig
                  ? 'MACD line trades above signal baseline, confirming positive directional momentum.'
                  : 'MACD line remains below signal trigger, reflecting waning upside impulse.'}
              </p>
            </Panel>

            {/* Bollinger Bands */}
            <Panel className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Bollinger Bands ({bbPeriod}, {bbMult}σ)
                </span>
                <span className="text-[11px] font-mono text-[var(--text-secondary)]">
                  Width: {analysis.bbWidthPct.toFixed(2)}%
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
                <div className="p-2 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                  <span className="text-[10px] font-sans text-[var(--text-muted)] block">Upper</span>
                  <span className="text-[var(--text-primary)]">{formatPrice(analysis.bbUpper, instrument.decimals)}</span>
                </div>
                <div className="p-2 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                  <span className="text-[10px] font-sans text-[var(--text-muted)] block">Middle</span>
                  <span className="text-[var(--text-primary)]">{formatPrice(analysis.bbMiddle, instrument.decimals)}</span>
                </div>
                <div className="p-2 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
                  <span className="text-[10px] font-sans text-[var(--text-muted)] block">Lower</span>
                  <span className="text-[var(--text-primary)]">{formatPrice(analysis.bbLower, instrument.decimals)}</span>
                </div>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                {analysis.lastPrice > analysis.bbUpper
                  ? 'Price is extending above the upper volatility envelope.'
                  : analysis.lastPrice < analysis.bbLower
                  ? 'Price is testing below the lower volatility band.'
                  : 'Price action remains contained within normal 2-sigma volatility bands.'}
              </p>
            </Panel>

            {/* ATR Volatility */}
            <Panel className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  Average True Range — ATR ({atrPeriod})
                </span>
                <span className="font-mono tabular-nums text-xs font-semibold text-[#F0B90B]">
                  {analysis.atrPct.toFixed(2)}% of price
                </span>
              </div>
              <div className="p-2.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] flex items-center justify-between">
                <span className="text-xs text-[var(--text-secondary)]">Expected Bar Range</span>
                <span className="font-mono tabular-nums text-sm font-bold text-[var(--text-primary)]">
                  ±{formatPrice(analysis.atr, instrument.decimals)}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Useful for calibrating stop-loss buffers (1.5x ATR ={' '}
                <span className="font-mono text-[var(--text-primary)]">
                  {formatPrice(analysis.atr * 1.5, instrument.decimals)}
                </span>
                ) without getting stopped out by normal bar noise.
              </p>
            </Panel>
          </div>

          {/* Moving Averages Table */}
          <Panel className="overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                Moving Averages & Trend Structure
              </h3>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)]">
                  <th className="text-left font-medium px-4 py-2">Indicator</th>
                  <th className="text-right font-medium px-3 py-2">Value</th>
                  <th className="text-right font-medium px-3 py-2">Distance from Spot</th>
                  <th className="text-right font-medium px-4 py-2">Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {[
                  { name: `EMA (${emaFast})`, val: analysis.emaFastVal },
                  { name: `EMA (${emaSlow})`, val: analysis.emaSlowVal },
                  { name: `SMA (${smaPeriod})`, val: analysis.smaVal },
                ].map((row) => {
                  const diffPct = ((analysis.lastPrice - row.val) / (row.val || 1)) * 100;
                  const bullish = analysis.lastPrice >= row.val;
                  return (
                    <tr key={row.name}>
                      <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">{row.name}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                        {formatPrice(row.val, instrument.decimals)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                          bullish ? 'text-[#089981]' : 'text-[#F23645]'
                        }`}
                      >
                        {diffPct >= 0 ? '+' : ''}
                        {diffPct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <SignalLabel signal={bullish ? 'Buy' : 'Sell'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>

          {/* Candlestick Pattern Recognition */}
          <Panel className="overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                Candlestick Pattern Recognition ({timeframe})
              </h3>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {analysis.patterns.map((pat) => (
                <div key={pat.name} className="p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">{pat.name}</span>
                      <span className="text-[11px] text-[var(--text-muted)]">· {pat.barOffset}</span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                      {pat.description}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-semibold ${
                        pat.bias === 'Bullish'
                          ? 'text-[#089981]'
                          : pat.bias === 'Bearish'
                          ? 'text-[#F23645]'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {pat.bias}
                    </span>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {pat.reliability} Confidence
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Right Column: Indicator Configuration Panel & Fibonacci Levels */}
        <div className="space-y-4">
          <Panel className="p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
              <div className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-[#2962FF]" />
                <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                  Indicator Parameters
                </h3>
              </div>
              <button
                type="button"
                onClick={resetParams}
                className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Defaults
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">RSI Period</label>
                <Input
                  type="number"
                  min={2}
                  max={50}
                  value={rsiPeriod}
                  onChange={(e) => setRsiPeriod(Number(e.target.value) || 14)}
                  className="font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">ATR Period</label>
                <Input
                  type="number"
                  min={2}
                  max={50}
                  value={atrPeriod}
                  onChange={(e) => setAtrPeriod(Number(e.target.value) || 14)}
                  className="font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">EMA Fast</label>
                <Input
                  type="number"
                  min={2}
                  max={100}
                  value={emaFast}
                  onChange={(e) => setEmaFast(Number(e.target.value) || 20)}
                  className="font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">EMA Slow</label>
                <Input
                  type="number"
                  min={5}
                  max={150}
                  value={emaSlow}
                  onChange={(e) => setEmaSlow(Number(e.target.value) || 50)}
                  className="font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">SMA Long</label>
                <Input
                  type="number"
                  min={10}
                  max={170}
                  value={smaPeriod}
                  onChange={(e) => setSmaPeriod(Number(e.target.value) || 100)}
                  className="font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">BB Period / σ</label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    min={5}
                    max={60}
                    value={bbPeriod}
                    onChange={(e) => setBbPeriod(Number(e.target.value) || 20)}
                    className="font-mono"
                  />
                  <Input
                    type="number"
                    step="0.5"
                    min={1}
                    max={4}
                    value={bbMult}
                    onChange={(e) => setBbMult(Number(e.target.value) || 2)}
                    className="font-mono w-16"
                  />
                </div>
              </div>
            </div>

            <div className="pt-1 border-t border-[var(--border-subtle)]">
              <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                MACD Fast / Slow / Signal
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <Input
                  type="number"
                  value={macdFast}
                  onChange={(e) => setMacdFast(Number(e.target.value) || 12)}
                  className="font-mono"
                />
                <Input
                  type="number"
                  value={macdSlow}
                  onChange={(e) => setMacdSlow(Number(e.target.value) || 26)}
                  className="font-mono"
                />
                <Input
                  type="number"
                  value={macdSignal}
                  onChange={(e) => setMacdSignal(Number(e.target.value) || 9)}
                  className="font-mono"
                />
              </div>
            </div>
          </Panel>

          {/* Fibonacci Retracement Levels */}
          <Panel className="overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] flex items-center justify-between">
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                Fibonacci Retracement (60-Bar Swing)
              </h3>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">{timeframe}</span>
            </div>
            <div className="p-3 text-[11px] text-[var(--text-secondary)] flex justify-between border-b border-[var(--border-subtle)] font-mono tabular-nums">
              <span>Low: {formatPrice(analysis.swingLow, instrument.decimals)}</span>
              <span>High: {formatPrice(analysis.swingHigh, instrument.decimals)}</span>
            </div>
            <div className="divide-y divide-[var(--border-subtle)]">
              {analysis.fibLevels.map((lvl) => {
                const isGolden = lvl.ratio === 0.618 || lvl.ratio === 0.5;
                return (
                  <div
                    key={lvl.label}
                    className={`px-4 py-2 flex items-center justify-between text-xs ${
                      isGolden ? 'bg-[#F0B90B]/6' : ''
                    }`}
                  >
                    <span
                      className={`font-mono ${
                        isGolden ? 'text-[#F0B90B] font-semibold' : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {lvl.label}
                    </span>
                    <span className="font-mono tabular-nums font-medium text-[var(--text-primary)]">
                      {formatPrice(lvl.price, instrument.decimals)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
