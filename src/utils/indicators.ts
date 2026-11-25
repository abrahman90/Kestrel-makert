import { Candle } from '../types/market';

export function calculateSMA(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return result;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) {
      sum -= values[i - period];
    }
    if (i >= period - 1) {
      result[i] = sum / period;
    }
  }
  return result;
}

export function calculateEMA(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return result;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let ema = sum / period;
  result[period - 1] = ema;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

export function calculateBollingerBands(
  values: number[],
  period = 20,
  mult = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = calculateSMA(values, period);
  const upper: (number | null)[] = new Array(values.length).fill(null);
  const lower: (number | null)[] = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    const mean = middle[i];
    if (mean === null) continue;
    let sqSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = values[j] - mean;
      sqSum += diff * diff;
    }
    const std = Math.sqrt(sqSum / period);
    upper[i] = mean + mult * std;
    lower[i] = mean - mult * std;
  }
  return { upper, middle, lower };
}

export function calculateRSI(values: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return result;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum += Math.abs(diff);
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

export function calculateMACD(
  values: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const fastEma = calculateEMA(values, fastPeriod);
  const slowEma = calculateEMA(values, slowPeriod);
  const macd: (number | null)[] = values.map((_, i) =>
    fastEma[i] !== null && slowEma[i] !== null ? (fastEma[i] as number) - (slowEma[i] as number) : null
  );

  const validMacdStart = macd.findIndex((v) => v !== null);
  const signal: (number | null)[] = new Array(values.length).fill(null);
  const histogram: (number | null)[] = new Array(values.length).fill(null);

  if (validMacdStart !== -1) {
    const validSlice = macd.slice(validMacdStart) as number[];
    const signalSlice = calculateEMA(validSlice, signalPeriod);
    for (let i = 0; i < signalSlice.length; i++) {
      const targetIdx = validMacdStart + i;
      signal[targetIdx] = signalSlice[i];
      if (macd[targetIdx] !== null && signal[targetIdx] !== null) {
        histogram[targetIdx] = (macd[targetIdx] as number) - (signal[targetIdx] as number);
      }
    }
  }

  return { macd, signal, histogram };
}

export function calculateATR(candles: Candle[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length <= period) return result;

  const trs: number[] = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prevClose = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
  });

  let sum = 0;
  for (let i = 1; i <= period; i++) sum += trs[i];
  let atr = sum / period;
  result[period] = atr;

  for (let i = period + 1; i < candles.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    result[i] = atr;
  }
  return result;
}

export function calculateHeikinAshi(candles: Candle[]): Candle[] {
  const ha: Candle[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const close = (c.open + c.high + c.low + c.close) / 4;
    const open = i === 0 ? (c.open + c.close) / 2 : (ha[i - 1].open + ha[i - 1].close) / 2;
    const high = Math.max(c.high, open, close);
    const low = Math.min(c.low, open, close);
    ha.push({ time: c.time, open, high, low, close, volume: c.volume });
  }
  return ha;
}

export interface DetectedPattern {
  name: string;
  bias: 'Bullish' | 'Bearish' | 'Neutral';
  barOffset: string;
  reliability: 'High' | 'Medium';
  description: string;
}

export function detectCandlestickPatterns(candles: Candle[]): DetectedPattern[] {
  if (candles.length < 5) return [];
  const patterns: DetectedPattern[] = [];
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3];

  const body = Math.abs(last.close - last.open);
  const range = Math.max(last.high - last.low, 1e-9);
  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;

  if (body / range < 0.14) {
    patterns.push({
      name: 'Doji Indecision',
      bias: 'Neutral',
      barOffset: 'Current Bar',
      reliability: 'Medium',
      description: 'Open and close converged near midpoint, signaling short-term equilibrium between buyers and sellers.',
    });
  }

  if (lowerWick > body * 2.1 && upperWick < body * 0.6 && last.close > last.open) {
    patterns.push({
      name: 'Bullish Hammer',
      bias: 'Bullish',
      barOffset: 'Current Bar',
      reliability: 'High',
      description: 'Extended lower rejection shadow indicates strong demand absorption at session lows.',
    });
  }

  if (
    prev.close < prev.open &&
    last.close > last.open &&
    last.open <= prev.close &&
    last.close >= prev.open
  ) {
    patterns.push({
      name: 'Bullish Engulfing',
      bias: 'Bullish',
      barOffset: 'Last 2 Bars',
      reliability: 'High',
      description: 'Current bullish candle body completely engulfs prior bearish candle range, suggesting upside continuation.',
    });
  } else if (
    prev.close > prev.open &&
    last.close < last.open &&
    last.open >= prev.close &&
    last.close <= prev.open
  ) {
    patterns.push({
      name: 'Bearish Engulfing',
      bias: 'Bearish',
      barOffset: 'Last 2 Bars',
      reliability: 'High',
      description: 'Current bearish candle body engulfs prior session gains, pointing to renewed supply pressure.',
    });
  }

  if (
    prev2.close > prev2.open &&
    prev.close > prev.open &&
    last.close > last.open &&
    last.close > prev.close &&
    prev.close > prev2.close
  ) {
    patterns.push({
      name: 'Three Advancing Soldiers',
      bias: 'Bullish',
      barOffset: 'Last 3 Bars',
      reliability: 'High',
      description: 'Three consecutive higher closes with steady candle bodies confirm sustained institutional buying.',
    });
  }

  if (patterns.length === 0) {
    const trendUp = last.close >= prev2.close;
    patterns.push({
      name: trendUp ? 'Higher-Low Continuation' : 'Lower-High Consolidation',
      bias: trendUp ? 'Bullish' : 'Bearish',
      barOffset: 'Last 3 Bars',
      reliability: 'Medium',
      description: trendUp
        ? 'Price structure maintains constructive higher lows above short-term equilibrium.'
        : 'Price remains capped beneath recent swing highs with controlled volatility.',
    });
  }

  return patterns;
}

export function formatPrice(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1000 && decimals <= 2) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return value.toFixed(decimals);
}
