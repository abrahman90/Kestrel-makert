import React, { useMemo, useState } from 'react';
import { CandlestickChart, Newspaper, Search } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { MarketCategory } from '../../types/market';
import { EmptyState, Input, Panel, SegmentedTabs } from '../ui/DesignSystem';

type NewsCat = 'All' | Exclude<MarketCategory, 'All'>;

export function NewsScreen() {
  const { news, openChart, instruments } = usePlatform();
  const [category, setCategory] = useState<NewsCat>('All');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(news[0]?.id ?? '');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return news.filter((item) => {
      if (category !== 'All' && item.category !== category) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.relatedSymbols.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [news, category, query]);

  const activeArticle =
    filtered.find((a) => a.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
            Market News & Research Wire
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Real-time macro dispatches, central bank commentary, and equity sector intelligence
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-60">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-2.5" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search headlines or tickers..."
              className="pl-8"
            />
          </div>
          <SegmentedTabs
            value={category}
            onChange={setCategory}
            options={[
              { value: 'All', label: 'All News' },
              { value: 'Forex', label: 'Forex' },
              { value: 'Crypto', label: 'Crypto' },
              { value: 'Stocks', label: 'Stocks' },
              { value: 'Commodities', label: 'Commodities' },
            ]}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No matching articles"
          description="Try clearing your search term or selecting a broader market category."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Feed Column */}
          <Panel className="lg:col-span-5 divide-y divide-[var(--border-subtle)] overflow-hidden">
            {filtered.map((item) => {
              const selected = activeArticle?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full p-4 text-left transition-colors cursor-pointer ${
                    selected ? 'bg-[#2962FF]/10' : 'hover:bg-[var(--bg-panel)]/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[var(--text-secondary)]">{item.category}</span>
                      <span>·</span>
                      <span>{item.publishedAt}</span>
                      <span>·</span>
                      <span>{item.readTime}</span>
                    </div>
                    <span
                      className={`font-medium ${
                        item.sentiment === 'Bullish'
                          ? 'text-[#089981]'
                          : item.sentiment === 'Bearish'
                          ? 'text-[#F23645]'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {item.sentiment}
                    </span>
                  </div>
                  <h3 className="text-xs font-semibold text-[var(--text-primary)] mt-1.5 leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-1 line-clamp-2 leading-relaxed">
                    {item.summary}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[11px] font-mono text-[#2962FF]">
                    {item.relatedSymbols.map((sym) => (
                      <span key={sym}>{sym}</span>
                    ))}
                  </div>
                </button>
              );
            })}
          </Panel>

          {/* Detail Reader Pane */}
          {activeArticle && (
            <Panel className="lg:col-span-7 overflow-hidden">
              {activeArticle.imageUrl && !failedImages[activeArticle.id] ? (
                <div className="w-full aspect-video bg-[var(--bg-canvas)] overflow-hidden border-b border-[var(--border-subtle)]">
                  <img
                    src={activeArticle.imageUrl}
                    alt={activeArticle.title}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [activeArticle.id]: true }))
                    }
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-full h-36 bg-[var(--bg-panel)] border-b border-[var(--border-subtle)] flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
                  <Newspaper className="w-5 h-5" />
                  <span>{activeArticle.source}</span>
                </div>
              )}

              <div className="p-5 lg:p-6 space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="font-semibold text-[#2962FF]">{activeArticle.category}</span>
                  <span>·</span>
                  <span>{activeArticle.source}</span>
                  <span>·</span>
                  <span>{activeArticle.author}</span>
                  <span>·</span>
                  <span>{activeArticle.publishedAt}</span>
                </div>

                <h2 className="text-lg font-bold text-[var(--text-primary)] leading-snug">
                  {activeArticle.title}
                </h2>

                <p className="text-sm text-[var(--text-primary)]/90 font-medium leading-relaxed border-b border-[var(--border-subtle)] pb-4">
                  {activeArticle.summary}
                </p>

                <div className="space-y-3 text-[13px] text-[var(--text-secondary)] leading-relaxed">
                  {activeArticle.content.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>

                <div className="pt-4 border-t border-[var(--border-subtle)]">
                  <div className="text-[11px] font-medium text-[var(--text-muted)] mb-2">
                    Referenced Instruments (Click to open chart)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeArticle.relatedSymbols.map((sym) => {
                      const inst = instruments.find((i) => i.symbol === sym);
                      return (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => openChart(sym)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] hover:border-[#2962FF] text-xs cursor-pointer transition-colors"
                        >
                          <CandlestickChart className="w-3.5 h-3.5 text-[#2962FF]" />
                          <span className="font-mono font-semibold text-[var(--text-primary)]">{sym}</span>
                          {inst && (
                            <span
                              className={`font-mono tabular-nums ${
                                inst.changePercent >= 0 ? 'text-[#089981]' : 'text-[#F23645]'
                              }`}
                            >
                              {inst.changePercent >= 0 ? '+' : ''}
                              {inst.changePercent.toFixed(2)}%
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
