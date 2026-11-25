import { Timeframe } from '../types/market';

export interface ChartTimezoneOption {
  id: string;
  iana: string;
  utcLabel: string;
  city: string;
  displayLabel: string;
}

export const CHART_TIMEZONE_OPTIONS: ChartTimezoneOption[] = [
  { id: 'Exchange', iana: 'Exchange', utcLabel: 'EXCH', city: 'Exchange', displayLabel: 'Exchange' },
  { id: 'Pacific/Honolulu', iana: 'Pacific/Honolulu', utcLabel: 'UTC-10', city: 'Honolulu', displayLabel: '(UTC-10) Honolulu' },
  { id: 'America/Anchorage', iana: 'America/Anchorage', utcLabel: 'UTC-9', city: 'Anchorage', displayLabel: '(UTC-9) Anchorage' },
  { id: 'America/Los_Angeles', iana: 'America/Los_Angeles', utcLabel: 'UTC-8', city: 'Los Angeles', displayLabel: '(UTC-8) Los Angeles' },
  { id: 'America/Denver', iana: 'America/Denver', utcLabel: 'UTC-7', city: 'Denver', displayLabel: '(UTC-7) Denver' },
  { id: 'America/Phoenix', iana: 'America/Phoenix', utcLabel: 'UTC-7', city: 'Phoenix', displayLabel: '(UTC-7) Phoenix' },
  { id: 'America/Chicago', iana: 'America/Chicago', utcLabel: 'UTC-6', city: 'Chicago', displayLabel: '(UTC-6) Chicago' },
  { id: 'America/Mexico_City', iana: 'America/Mexico_City', utcLabel: 'UTC-6', city: 'Mexico City', displayLabel: '(UTC-6) Mexico City' },
  { id: 'America/New_York', iana: 'America/New_York', utcLabel: 'UTC-5', city: 'New York', displayLabel: '(UTC-5) New York' },
  { id: 'America/Toronto', iana: 'America/Toronto', utcLabel: 'UTC-5', city: 'Toronto', displayLabel: '(UTC-5) Toronto' },
  { id: 'America/Caracas', iana: 'America/Caracas', utcLabel: 'UTC-4', city: 'Caracas', displayLabel: '(UTC-4) Caracas' },
  { id: 'America/Halifax', iana: 'America/Halifax', utcLabel: 'UTC-4', city: 'Halifax', displayLabel: '(UTC-4) Halifax' },
  { id: 'America/Argentina/Buenos_Aires', iana: 'America/Argentina/Buenos_Aires', utcLabel: 'UTC-3', city: 'Buenos Aires', displayLabel: '(UTC-3) Buenos Aires' },
  { id: 'America/Sao_Paulo', iana: 'America/Sao_Paulo', utcLabel: 'UTC-3', city: 'Sao Paulo', displayLabel: '(UTC-3) Sao Paulo' },
  { id: 'UTC', iana: 'UTC', utcLabel: 'UTC', city: 'UTC', displayLabel: '(UTC+0) Coordinated Universal Time' },
  { id: 'Europe/London', iana: 'Europe/London', utcLabel: 'UTC+0', city: 'London', displayLabel: '(UTC+0) London' },
  { id: 'Europe/Berlin', iana: 'Europe/Berlin', utcLabel: 'UTC+1', city: 'Berlin', displayLabel: '(UTC+1) Berlin' },
  { id: 'Europe/Paris', iana: 'Europe/Paris', utcLabel: 'UTC+1', city: 'Paris', displayLabel: '(UTC+1) Paris' },
  { id: 'Africa/Johannesburg', iana: 'Africa/Johannesburg', utcLabel: 'UTC+2', city: 'Johannesburg', displayLabel: '(UTC+2) Johannesburg' },
  { id: 'Europe/Istanbul', iana: 'Europe/Istanbul', utcLabel: 'UTC+3', city: 'Istanbul', displayLabel: '(UTC+3) Istanbul' },
  { id: 'Asia/Riyadh', iana: 'Asia/Riyadh', utcLabel: 'UTC+3', city: 'Riyadh', displayLabel: '(UTC+3) Riyadh' },
  { id: 'Asia/Dubai', iana: 'Asia/Dubai', utcLabel: 'UTC+4', city: 'Dubai', displayLabel: '(UTC+4) Dubai' },
  { id: 'Asia/Kolkata', iana: 'Asia/Kolkata', utcLabel: 'UTC+5:30', city: 'Kolkata', displayLabel: '(UTC+5:30) Kolkata' },
  { id: 'Asia/Bangkok', iana: 'Asia/Bangkok', utcLabel: 'UTC+7', city: 'Bangkok', displayLabel: '(UTC+7) Bangkok' },
  { id: 'Asia/Singapore', iana: 'Asia/Singapore', utcLabel: 'UTC+8', city: 'Singapore', displayLabel: '(UTC+8) Singapore' },
  { id: 'Asia/Hong_Kong', iana: 'Asia/Hong_Kong', utcLabel: 'UTC+8', city: 'Hong Kong', displayLabel: '(UTC+8) Hong Kong' },
  { id: 'Asia/Tokyo', iana: 'Asia/Tokyo', utcLabel: 'UTC+9', city: 'Tokyo', displayLabel: '(UTC+9) Tokyo' },
  { id: 'Australia/Sydney', iana: 'Australia/Sydney', utcLabel: 'UTC+10', city: 'Sydney', displayLabel: '(UTC+10) Sydney' },
  { id: 'Pacific/Auckland', iana: 'Pacific/Auckland', utcLabel: 'UTC+12', city: 'Auckland', displayLabel: '(UTC+12) Auckland' },
];

export function mapLegacyTimezoneToId(rawTz: string): string {
  if (!rawTz) return 'America/New_York';
  if (rawTz.startsWith('America/New_York')) return 'America/New_York';
  if (rawTz.startsWith('Europe/London')) return 'Europe/London';
  if (rawTz.startsWith('Europe/Frankfurt')) return 'Europe/Berlin';
  if (rawTz.startsWith('Asia/Tokyo')) return 'Asia/Tokyo';
  if (CHART_TIMEZONE_OPTIONS.some((t) => t.id === rawTz)) return rawTz;
  return 'America/New_York';
}

export function resolveEffectiveIanaTimezone(
  timezoneId: string,
  exchange?: string
): string {
  if (timezoneId === 'Exchange') {
    const ex = (exchange || '').toUpperCase();
    if (ex.includes('NASDAQ') || ex.includes('NYSE') || ex.includes('CME') || ex.includes('COMEX')) {
      return 'America/New_York';
    }
    if (ex.includes('LSE')) return 'Europe/London';
    if (ex.includes('XETRA') || ex.includes('FWB')) return 'Europe/Berlin';
    if (ex.includes('TSE')) return 'Asia/Tokyo';
    return 'UTC';
  }
  return mapLegacyTimezoneToId(timezoneId);
}

export function getShortUtcLabel(ianaTz: string, date = new Date()): string {
  if (ianaTz === 'UTC') return 'UTC';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTz,
      timeZoneName: 'shortOffset',
    }).formatToParts(date);
    const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value;
    if (tzPart) {
      return tzPart.replace('GMT', 'UTC');
    }
  } catch {
    // fallback below
  }
  const match = CHART_TIMEZONE_OPTIONS.find((t) => t.iana === ianaTz);
  return match ? match.utcLabel : 'UTC';
}

export function formatLiveClockInTimezone(
  date: Date,
  timezoneId: string,
  exchange?: string
): { timeText: string; offsetLabel: string } {
  const iana = resolveEffectiveIanaTimezone(timezoneId, exchange);
  try {
    const timeText = new Intl.DateTimeFormat('en-GB', {
      timeZone: iana,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
    return {
      timeText,
      offsetLabel: getShortUtcLabel(iana, date),
    };
  } catch {
    return {
      timeText: date.toTimeString().slice(0, 8),
      offsetLabel: 'UTC',
    };
  }
}

export function formatChartTimestamp(
  unixSeconds: number,
  timeframe: Timeframe,
  timezoneId: string,
  exchange: string | undefined,
  mode: 'axis' | 'crosshair' | 'badge'
): string {
  const d = new Date(unixSeconds * 1000);
  const iana = resolveEffectiveIanaTimezone(timezoneId, exchange);
  try {
    if (mode === 'axis') {
      if (timeframe === '1M') {
        return new Intl.DateTimeFormat('en-US', {
          timeZone: iana,
          month: 'short',
          year: '2-digit',
        }).format(d);
      }
      if (timeframe === '1D' || timeframe === '1W') {
        return new Intl.DateTimeFormat('en-US', {
          timeZone: iana,
          month: 'short',
          day: 'numeric',
        }).format(d);
      }
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: iana,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    }

    if (mode === 'badge') {
      const dateStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: iana,
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: '2-digit',
      }).format(d);
      if (timeframe === '1D' || timeframe === '1W' || timeframe === '1M') {
        return dateStr;
      }
      const timeStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: iana,
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
      return `${dateStr} ${timeStr}`;
    }

    // crosshair
    if (timeframe === '1D' || timeframe === '1W' || timeframe === '1M') {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: iana,
        month: 'short',
        day: 'numeric',
        year: '2-digit',
      }).format(d);
    }
    const dayStr = new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      month: 'short',
      day: 'numeric',
    }).format(d);
    const timeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: iana,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
    return `${dayStr}, ${timeStr}`;
  } catch {
    return d.toISOString().slice(11, 16);
  }
}
