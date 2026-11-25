import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BellPlus, CandlestickChart, Search, X } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { AlertCondition, MarketCategory } from '../../types/market';
import { formatPrice } from '../../utils/indicators';
import { Button, Input, Modal, PriceChangeText, Select } from '../ui/DesignSystem';

const SEARCH_CATS: MarketCategory[] = ['All', 'Forex', 'Crypto', 'Stocks', 'Indices', 'Commodities'];

export function GlobalSearchModal() {
  const {
    isSearchModalOpen,
    setIsSearchModalOpen,
    instruments,
    openChart,
    openTechnicalAnalysis,
  } = usePlatform();

  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<MarketCategory>('All');
  const [highlightIndex, setHighlightIndex] = useState(0);

  useEffect(() => {
    if (isSearchModalOpen) {
      setQuery('');
      setHighlightIndex(0);
    }
  }, [isSearchModalOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return instruments.filter((inst) => {
      if (cat !== 'All' && inst.category !== cat) return false;
      if (!q) return true;
      return (
        inst.symbol.toLowerCase().includes(q) ||
        inst.name.toLowerCase().includes(q) ||
        inst.exchange.toLowerCase().includes(q) ||
        inst.sectorOrBase.toLowerCase().includes(q)
      );
    });
  }, [instruments, query, cat]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query, cat]);

  useEffect(() => {
    if (!isSearchModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSearchModalOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(filtered.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter' && filtered[highlightIndex]) {
        e.preventDefault();
        openChart(filtered[highlightIndex].symbol);
        setIsSearchModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSearchModalOpen, filtered, highlightIndex, openChart, setIsSearchModalOpen]);

  if (!isSearchModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 p-4 bg-black/60 backdrop-blur-[1px]"
      onClick={() => setIsSearchModalOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--border-subtle)]">
          <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbol, company, currency pair, or index..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setIsSearchModalOpen(false)}
            aria-label="Close search"
            className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)] overflow-x-auto">
          {SEARCH_CATS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                cat === c
                  ? 'bg-[#2962FF] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border-subtle)]">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--text-secondary)]">
              No matching instruments found for "{query}".
            </div>
          ) : (
            filtered.map((inst, idx) => {
              const highlighted = idx === highlightIndex;
              return (
                <div
                  key={inst.symbol}
                  onMouseEnter={() => setHighlightIndex(idx)}
                  onClick={() => {
                    openChart(inst.symbol);
                    setIsSearchModalOpen(false);
                  }}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                    highlighted ? 'bg-[var(--bg-panel)]' : 'hover:bg-[var(--bg-panel)]/60'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold font-mono text-[var(--text-primary)]">
                        {inst.symbol}
                      </span>
                      <span className="text-xs text-[var(--text-secondary)] truncate">
                        {inst.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5 mt-0.5">
                      <span>{inst.category}</span>
                      <span>·</span>
                      <span>{inst.exchange}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0 mr-2">
                    <div className="text-xs font-mono tabular-nums font-medium text-[var(--text-primary)]">
                      {formatPrice(inst.price, inst.decimals)}
                    </div>
                    <div className="text-[11px]">
                      <PriceChangeText value={inst.change} percent={inst.changePercent} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      title="Open Chart"
                      onClick={() => {
                        openChart(inst.symbol);
                        setIsSearchModalOpen(false);
                      }}
                      className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[#2962FF] hover:bg-[#2962FF]/10 cursor-pointer"
                    >
                      <CandlestickChart className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Technical Analysis"
                      onClick={() => {
                        openTechnicalAnalysis(inst.symbol);
                        setIsSearchModalOpen(false);
                      }}
                      className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[#2962FF] hover:bg-[#2962FF]/10 cursor-pointer"
                    >
                      <Activity className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-canvas)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <span>Use ↑ ↓ arrows to navigate · Enter to open chart</span>
          <span>{filtered.length} instruments</span>
        </div>
      </div>
    </div>
  );
}

export function CreateAlertModal() {
  const { alertModalSymbol, closeCreateAlertModal, instruments, createAlert } = usePlatform();
  const [symbol, setSymbol] = useState(alertModalSymbol ?? 'NVDA');
  const [condition, setCondition] = useState<AlertCondition>('Crossing Up');
  const [targetPrice, setTargetPrice] = useState('');
  const [expiresAt, setExpiresAt] = useState('2026-12-31 23:59');
  const [note, setNote] = useState('');
  const [methods, setMethods] = useState<('In-App' | 'Email' | 'Webhook')[]>(['In-App', 'Email']);

  const selectedInst = instruments.find((i) => i.symbol === symbol) ?? instruments[0];

  useEffect(() => {
    if (alertModalSymbol) {
      setSymbol(alertModalSymbol);
      const inst = instruments.find((i) => i.symbol === alertModalSymbol);
      if (inst) {
        const factor = Math.pow(10, inst.decimals);
        const suggested = Math.round(inst.price * 1.005 * factor) / factor;
        setTargetPrice(String(suggested));
      }
      setNote('');
    }
  }, [alertModalSymbol, instruments]);

  const toggleMethod = (m: 'In-App' | 'Email' | 'Webhook') => {
    setMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = parseFloat(targetPrice);
    if (!Number.isFinite(numeric) || numeric <= 0) return;
    createAlert({
      symbol,
      condition,
      targetPrice: numeric,
      notificationMethod: methods.length > 0 ? methods : ['In-App'],
      expiresAt,
      note: note.trim() || undefined,
    });
    closeCreateAlertModal();
  };

  return (
    <Modal
      open={alertModalSymbol !== null}
      onClose={closeCreateAlertModal}
      title="Create Price Alert"
      subtitle="Configure automated price threshold monitoring"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Instrument
            </label>
            <Select
              value={symbol}
              onChange={(e) => {
                const nextSym = e.target.value;
                setSymbol(nextSym);
                const inst = instruments.find((i) => i.symbol === nextSym);
                if (inst) setTargetPrice(String(inst.price));
              }}
              className="w-full"
            >
              {instruments.map((i) => (
                <option key={i.symbol} value={i.symbol}>
                  {i.symbol} — {i.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Current Price
            </label>
            <div className="h-8 px-2.5 flex items-center justify-between bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded text-xs font-mono tabular-nums text-[var(--text-primary)]">
              <span>{formatPrice(selectedInst.price, selectedInst.decimals)}</span>
              <PriceChangeText value={selectedInst.change} percent={selectedInst.changePercent} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Condition
            </label>
            <Select
              value={condition}
              onChange={(e) => setCondition(e.target.value as AlertCondition)}
              className="w-full"
            >
              <option value="Crossing">Crossing</option>
              <option value="Crossing Up">Crossing Up</option>
              <option value="Crossing Down">Crossing Down</option>
              <option value="Greater Than">Greater Than</option>
              <option value="Less Than">Less Than</option>
            </Select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Target Price
            </label>
            <Input
              type="number"
              step="any"
              required
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className="font-mono tabular-nums"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1.5">
            Notification Channels
          </label>
          <div className="flex items-center gap-2">
            {(['In-App', 'Email', 'Webhook'] as const).map((m) => {
              const active = methods.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMethod(m)}
                  className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#2962FF]/15 text-[#2962FF] border-[#2962FF]/40'
                      : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Expiration
            </label>
            <Input value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="font-mono" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Note (Optional)
            </label>
            <Input
              placeholder="e.g. Breakout above resistance"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <Button type="button" variant="ghost" onClick={closeCreateAlertModal}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            <BellPlus className="w-3.5 h-3.5" />
            Create Alert
          </Button>
        </div>
      </form>
    </Modal>
  );
}
