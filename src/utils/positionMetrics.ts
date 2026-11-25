import { Instrument, PositionDrawingData, Timeframe } from '../types/market';

export const ALL_TIMEFRAME_OPTIONS: { id: Timeframe; label: string; shortLabel: string }[] = [
  { id: '1m', label: '1 minute', shortLabel: '1m' },
  { id: '5m', label: '5 minutes', shortLabel: '5m' },
  { id: '15m', label: '15 minutes', shortLabel: '15m' },
  { id: '30m', label: '30 minutes', shortLabel: '30m' },
  { id: '1h', label: '1 hour', shortLabel: '1h' },
  { id: '4h', label: '4 hours', shortLabel: '4h' },
  { id: '1D', label: 'Daily', shortLabel: '1D' },
  { id: '1W', label: 'Weekly', shortLabel: '1W' },
  { id: '1M', label: 'Monthly', shortLabel: '1M' },
];

export interface InstrumentTickMeta {
  pipSize: number;
  pointSize: number;
  defaultPositionSize: number;
  pipLabel: string;
}

export function getInstrumentTickMeta(instrument: Instrument): InstrumentTickMeta {
  const sym = instrument.symbol.toUpperCase();
  const tick = Math.pow(10, -instrument.decimals);

  if (instrument.category === 'Forex') {
    if (sym.includes('JPY')) {
      return {
        pipSize: 0.01,
        pointSize: 0.001,
        defaultPositionSize: 10000,
        pipLabel: 'Pips',
      };
    }
    return {
      pipSize: 0.0001,
      pointSize: 0.00001,
      defaultPositionSize: 10000,
      pipLabel: 'Pips',
    };
  }

  if (instrument.category === 'Commodities') {
    if (sym.includes('XAU')) {
      return {
        pipSize: 0.1,
        pointSize: 0.01,
        defaultPositionSize: 10,
        pipLabel: 'Pips',
      };
    }
    if (sym.includes('XAG')) {
      return {
        pipSize: 0.01,
        pointSize: 0.001,
        defaultPositionSize: 100,
        pipLabel: 'Pips',
      };
    }
    return {
      pipSize: tick,
      pointSize: tick,
      defaultPositionSize: 100,
      pipLabel: 'Ticks',
    };
  }

  if (instrument.category === 'Indices') {
    return {
      pipSize: 1,
      pointSize: tick,
      defaultPositionSize: 10,
      pipLabel: 'Pts',
    };
  }

  if (instrument.category === 'Crypto') {
    if (instrument.price >= 1000) {
      return {
        pipSize: 1,
        pointSize: tick,
        defaultPositionSize: 1,
        pipLabel: 'Pips',
      };
    }
    if (instrument.price >= 10) {
      return {
        pipSize: 0.1,
        pointSize: tick,
        defaultPositionSize: 10,
        pipLabel: 'Pips',
      };
    }
    return {
      pipSize: Math.max(tick, 0.001),
      pointSize: tick,
      defaultPositionSize: 1000,
      pipLabel: 'Pips',
    };
  }

  // Stocks
  return {
    pipSize: 0.01,
    pointSize: tick,
    defaultPositionSize: 100,
    pipLabel: 'Pips',
  };
}

export interface PositionMetrics {
  isLong: boolean;
  riskDistance: number;
  rewardDistance: number;
  rrRatio: number;
  riskPips: number;
  rewardPips: number;
  riskPoints: number;
  rewardPoints: number;
  profitPct: number;
  lossPct: number;
  riskAmount: number;
  rewardAmount: number;
  isValid: boolean;
  validationMessage: string | null;
  pipLabel: string;
}

export function validatePositionLevels(
  isLong: boolean,
  entryPrice: number,
  takeProfit: number,
  stopLoss: number
): { isValid: boolean; validationMessage: string | null } {
  if (!Number.isFinite(entryPrice) || !Number.isFinite(takeProfit) || !Number.isFinite(stopLoss)) {
    return { isValid: false, validationMessage: 'All price fields must be valid numbers.' };
  }
  if (entryPrice <= 0 || takeProfit <= 0 || stopLoss <= 0) {
    return { isValid: false, validationMessage: 'Prices must be greater than zero.' };
  }
  if (isLong) {
    if (!(stopLoss < entryPrice && entryPrice < takeProfit)) {
      return {
        isValid: false,
        validationMessage: 'Invalid Long Position: Stop Loss must be below Entry Price, and Take Profit must be above Entry Price (SL < Entry < TP).',
      };
    }
  } else {
    if (!(takeProfit < entryPrice && entryPrice < stopLoss)) {
      return {
        isValid: false,
        validationMessage: 'Invalid Short Position: Take Profit must be below Entry Price, and Stop Loss must be above Entry Price (TP < Entry < SL).',
      };
    }
  }
  return { isValid: true, validationMessage: null };
}

export function computePositionMetrics(
  isLong: boolean,
  pos: PositionDrawingData,
  instrument: Instrument
): PositionMetrics {
  const meta = getInstrumentTickMeta(instrument);
  const riskDistance = Math.abs(pos.entryPrice - pos.stopLoss);
  const rewardDistance = Math.abs(pos.takeProfit - pos.entryPrice);
  const rrRatio = riskDistance > 0 ? rewardDistance / riskDistance : 0;

  const riskPips = riskDistance / meta.pipSize;
  const rewardPips = rewardDistance / meta.pipSize;
  const riskPoints = riskDistance / meta.pointSize;
  const rewardPoints = rewardDistance / meta.pointSize;

  const baseEntry = pos.entryPrice || 1;
  const profitPct = (rewardDistance / baseEntry) * 100;
  const lossPct = (riskDistance / baseEntry) * 100;

  const size = Math.max(0, pos.positionSize || 0);
  const riskAmount = riskDistance * size;
  const rewardAmount = rewardDistance * size;

  const validation = validatePositionLevels(isLong, pos.entryPrice, pos.takeProfit, pos.stopLoss);

  return {
    isLong,
    riskDistance,
    rewardDistance,
    rrRatio,
    riskPips,
    rewardPips,
    riskPoints,
    rewardPoints,
    profitPct,
    lossPct,
    riskAmount,
    rewardAmount,
    isValid: validation.isValid,
    validationMessage: validation.validationMessage,
    pipLabel: meta.pipLabel,
  };
}

export function formatMetricNumber(val: number): string {
  if (!Number.isFinite(val)) return '0';
  if (val >= 1000) return val.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (val >= 10) return val.toFixed(1);
  return val.toFixed(2);
}
