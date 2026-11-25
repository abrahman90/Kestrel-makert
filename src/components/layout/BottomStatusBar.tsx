import React, { useEffect, useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { CHART_TIMEZONE_OPTIONS, formatLiveClockInTimezone } from '../../utils/timezone';

export function BottomStatusBar() {
  const { chartTimezone, setChartTimezone, instruments, selectedSymbol, settings } = usePlatform();
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const activeInst = instruments.find((i) => i.symbol === selectedSymbol) ?? instruments[0];
  const clock = formatLiveClockInTimezone(now, chartTimezone, activeInst?.exchange);
  const tzLabel =
    CHART_TIMEZONE_OPTIONS.find((t) => t.id === chartTimezone)?.city ?? chartTimezone;

  return (
    <footer className="h-6 shrink-0 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] px-3 flex items-center justify-between gap-4 text-[11px] text-[var(--text-secondary)] select-none z-20">
      <div className="flex items-center gap-3 min-w-0">
        <span className="inline-flex items-center gap-1.5 text-[var(--text-primary)] font-medium whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-[#089981]" />
          Connected
        </span>
        <span className="hidden sm:inline text-[var(--border-strong)]">·</span>
        <span className="hidden sm:inline truncate">
          Market Data: {settings.liveTickSimulation ? 'Real-Time Demo Feed' : 'Snapshot'}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
        <div className="flex items-center gap-1.5">
          <select
            aria-label="Global display timezone"
            value={chartTimezone}
            onChange={(e) => setChartTimezone(e.target.value)}
            className="bg-transparent text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none cursor-pointer"
          >
            {CHART_TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.id} value={tz.id} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                {tz.displayLabel}
              </option>
            ))}
          </select>
          <span className="text-[var(--text-primary)]">
            {clock.timeText} ({clock.offsetLabel} · {tzLabel})
          </span>
        </div>
        <span className="hidden md:inline text-[var(--border-strong)]">·</span>
        <span className="hidden md:inline text-[var(--text-muted)]">KESTREL v1.0</span>
      </div>
    </footer>
  );
}
