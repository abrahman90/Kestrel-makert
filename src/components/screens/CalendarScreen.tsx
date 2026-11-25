import React, { useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { ImpactLevel } from '../../types/market';
import { EmptyState, Panel, SegmentedTabs, Select } from '../ui/DesignSystem';

type ImpactFilter = 'All' | ImpactLevel;

function ImpactBars({ level }: { level: ImpactLevel }) {
  const activeBars = level === 'High' ? 3 : level === 'Medium' ? 2 : 1;
  const activeColor =
    level === 'High' ? 'bg-[#F23645]' : level === 'Medium' ? 'bg-[#F0B90B]' : 'text-[var(--text-secondary)] bg-[#787B86]';

  return (
    <div className="inline-flex items-center gap-2">
      <div className="flex items-end gap-0.5 h-3.5" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={`w-1 rounded-[1px] ${
              bar <= activeBars ? activeColor : 'bg-[var(--border-strong)]/40'
            }`}
            style={{ height: `${bar * 4 + 2}px` }}
          />
        ))}
      </div>
      <span
        className={`text-[11px] font-medium ${
          level === 'High'
            ? 'text-[#F23645]'
            : level === 'Medium'
            ? 'text-[#F0B90B]'
            : 'text-[var(--text-secondary)]'
        }`}
      >
        {level}
      </span>
    </div>
  );
}

export function CalendarScreen() {
  const { economicEvents } = usePlatform();
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('All');
  const [currencyFilter, setCurrencyFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const currencies = useMemo(
    () => ['All', ...Array.from(new Set(economicEvents.map((e) => e.currency)))],
    [economicEvents]
  );

  const dates = useMemo(
    () => ['All', ...Array.from(new Set(economicEvents.map((e) => e.date)))],
    [economicEvents]
  );

  const filtered = useMemo(() => {
    return economicEvents.filter((ev) => {
      if (impactFilter !== 'All' && ev.impact !== impactFilter) return false;
      if (currencyFilter !== 'All' && ev.currency !== currencyFilter) return false;
      if (dateFilter !== 'All' && ev.date !== dateFilter) return false;
      return true;
    });
  }, [economicEvents, impactFilter, currencyFilter, dateFilter]);

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
            Economic Calendar
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Scheduled macroeconomic indicators, central bank releases, and consensus forecasts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedTabs
            value={impactFilter}
            onChange={setImpactFilter}
            options={[
              { value: 'All', label: 'All Impact' },
              { value: 'High', label: 'High' },
              { value: 'Medium', label: 'Medium' },
              { value: 'Low', label: 'Low' },
            ]}
          />
          <Select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)}>
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c === 'All' ? 'All Currencies' : c}
              </option>
            ))}
          </Select>
          <Select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            {dates.map((d) => (
              <option key={d} value={d}>
                {d === 'All' ? 'All Dates' : d}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No scheduled releases match filters"
          description="Select a different currency, date, or impact threshold to view upcoming macroeconomic events."
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[11px] text-[var(--text-secondary)]">
                  <th className="text-left font-medium px-4 py-2.5">Date & Time</th>
                  <th className="text-left font-medium px-3 py-2.5">Country / CCY</th>
                  <th className="text-left font-medium px-3 py-2.5">Impact</th>
                  <th className="text-left font-medium px-3 py-2.5">Economic Event</th>
                  <th className="text-right font-medium px-3 py-2.5">Actual</th>
                  <th className="text-right font-medium px-3 py-2.5">Forecast</th>
                  <th className="text-right font-medium px-4 py-2.5">Previous</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filtered.map((ev) => {
                  const isExpanded = expandedId === ev.id;
                  const actualColor =
                    ev.surprise === 'positive'
                      ? 'text-[#089981] font-semibold'
                      : ev.surprise === 'negative'
                      ? 'text-[#F23645] font-semibold'
                      : 'text-[var(--text-primary)] font-medium';

                  return (
                    <React.Fragment key={ev.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                        className="hover:bg-[var(--bg-panel)]/70 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-2.5 font-mono tabular-nums whitespace-nowrap">
                          <div className="text-[var(--text-primary)] flex items-center gap-1.5">
                            <CalendarIcon className="w-3 h-3 text-[var(--text-muted)]" />
                            <span>{ev.date}</span>
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] pl-4.5">{ev.time}</div>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="font-mono font-semibold text-[var(--text-primary)]">
                            {ev.currency}
                          </span>
                          <span className="ml-2 text-[var(--text-secondary)]">{ev.country}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <ImpactBars level={ev.impact} />
                        </td>
                        <td className="px-3 py-2.5 font-medium text-[var(--text-primary)]">
                          <div className="flex items-center gap-1.5">
                            <span>{ev.event}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                            )}
                          </div>
                        </td>
                        <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${actualColor}`}>
                          {ev.actual}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                          {ev.forecast}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[var(--text-muted)]">
                          {ev.previous}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-[var(--bg-canvas)]/70">
                          <td colSpan={7} className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                            {ev.description}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
