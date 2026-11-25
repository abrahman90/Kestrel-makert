import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BellPlus, CandlestickChart, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { formatPrice } from '../../utils/indicators';
import {
  Button,
  EmptyState,
  Input,
  Modal,
  Panel,
  PriceChangeText,
  Select,
  Sparkline,
} from '../ui/DesignSystem';

export function WatchlistScreen() {
  const {
    watchlists,
    activeWatchlistId,
    setActiveWatchlistId,
    createWatchlist,
    renameWatchlist,
    deleteWatchlist,
    addSymbolToWatchlist,
    removeSymbolFromWatchlist,
    reorderWatchlistSymbol,
    instruments,
    openChart,
    openCreateAlertModal,
  } = usePlatform();

  const [newListModalOpen, setNewListModalOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [symbolToAdd, setSymbolToAdd] = useState(instruments[0].symbol);

  const activeWatchlist =
    watchlists.find((w) => w.id === activeWatchlistId) ?? watchlists[0];

  const watchlistInstruments = useMemo(() => {
    return activeWatchlist.symbols
      .map((sym) => instruments.find((i) => i.symbol === sym))
      .filter((i): i is NonNullable<typeof i> => Boolean(i));
  }, [activeWatchlist, instruments]);

  const availableToAdd = useMemo(
    () => instruments.filter((i) => !activeWatchlist.symbols.includes(i.symbol)),
    [instruments, activeWatchlist]
  );

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
            Personalized Watchlists
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Organize multi-market instruments across custom thematic desks
          </p>
        </div>

        <Button variant="primary" onClick={() => setNewListModalOpen(true)}>
          <FolderPlus className="w-3.5 h-3.5" />
          New Watchlist
        </Button>
      </div>

      {/* Watchlist Tabs + Add Symbol Control */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {watchlists.map((wl) => {
            const active = wl.id === activeWatchlist.id;
            return (
              <div
                key={wl.id}
                className={`inline-flex items-center rounded border transition-colors ${
                  active
                    ? 'bg-[#2962FF]/12 border-[#2962FF]/40 text-[#2962FF]'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveWatchlistId(wl.id)}
                  className="px-3 py-1.5 text-xs font-medium cursor-pointer"
                >
                  {wl.name}
                  <span className="ml-1.5 font-mono text-[11px] opacity-75">
                    ({wl.symbols.length})
                  </span>
                </button>
                {active && (
                  <button
                    type="button"
                    onClick={() => {
                      setRenameValue(wl.name);
                      setRenameModalOpen(true);
                    }}
                    title="Rename watchlist"
                    className="pr-1.5 py-1.5 opacity-60 hover:opacity-100 hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
                {watchlists.length > 1 && (
                  <button
                    type="button"
                    onClick={() => deleteWatchlist(wl.id)}
                    title="Delete watchlist"
                    className="pr-2 py-1.5 opacity-60 hover:opacity-100 hover:text-[#F23645] cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {availableToAdd.length > 0 && (
          <div className="flex items-center gap-2">
            <Select
              value={
                availableToAdd.some((i) => i.symbol === symbolToAdd)
                  ? symbolToAdd
                  : availableToAdd[0].symbol
              }
              onChange={(e) => setSymbolToAdd(e.target.value)}
            >
              {availableToAdd.map((i) => (
                <option key={i.symbol} value={i.symbol}>
                  {i.symbol} — {i.name}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              onClick={() => {
                const target = availableToAdd.some((i) => i.symbol === symbolToAdd)
                  ? symbolToAdd
                  : availableToAdd[0].symbol;
                addSymbolToWatchlist(activeWatchlist.id, target);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Symbol
            </Button>
          </div>
        )}
      </div>

      {/* Watchlist Table */}
      {watchlistInstruments.length === 0 ? (
        <EmptyState
          title={`"${activeWatchlist.name}" is empty`}
          description="Add Forex pairs, equities, indices, commodities, or digital assets using the symbol selector above."
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[11px] text-[var(--text-secondary)]">
                  <th className="text-left font-medium px-4 py-2.5">Instrument</th>
                  <th className="text-right font-medium px-3 py-2.5">Price</th>
                  <th className="text-right font-medium px-3 py-2.5">% Change</th>
                  <th className="text-right font-medium px-3 py-2.5">Daily High</th>
                  <th className="text-right font-medium px-3 py-2.5">Daily Low</th>
                  <th className="text-right font-medium px-3 py-2.5">Volume</th>
                  <th className="text-center font-medium px-3 py-2.5">7D Mini Chart</th>
                  <th className="text-center font-medium px-3 py-2.5">Market Status</th>
                  <th className="text-right font-medium px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {watchlistInstruments.map((inst, idx) => (
                  <tr
                    key={inst.symbol}
                    onClick={() => openChart(inst.symbol)}
                    className="hover:bg-[var(--bg-panel)]/70 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-mono font-semibold text-[var(--text-primary)]">{inst.symbol}</div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        {inst.name} · {inst.category}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                      {formatPrice(inst.price, inst.decimals)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <PriceChangeText
                        value={inst.change}
                        percent={inst.changePercent}
                        decimals={inst.decimals}
                        showPriceDelta
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                      {formatPrice(inst.high24h, inst.decimals)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                      {formatPrice(inst.low24h, inst.decimals)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                      {inst.volumeLabel}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-center">
                        <Sparkline data={inst.sparkline} positive={inst.changePercent >= 0} width={84} height={24} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`text-[11px] font-medium ${
                          inst.status === 'Open' || inst.status === '24/7'
                            ? 'text-[#089981]'
                            : inst.status === 'Extended'
                            ? 'text-[#F0B90B]'
                            : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {inst.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-0.5">
                        <button
                          type="button"
                          title="Move Up"
                          disabled={idx === 0}
                          onClick={() => reorderWatchlistSymbol(activeWatchlist.id, inst.symbol, 'up')}
                          className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Move Down"
                          disabled={idx === watchlistInstruments.length - 1}
                          onClick={() => reorderWatchlistSymbol(activeWatchlist.id, inst.symbol, 'down')}
                          className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Open Chart"
                          onClick={() => openChart(inst.symbol)}
                          className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[#2962FF] hover:bg-[#2962FF]/10 cursor-pointer"
                        >
                          <CandlestickChart className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Create Alert"
                          onClick={() => openCreateAlertModal(inst.symbol)}
                          className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[#2962FF] hover:bg-[#2962FF]/10 cursor-pointer"
                        >
                          <BellPlus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Remove from watchlist"
                          onClick={() => removeSymbolFromWatchlist(activeWatchlist.id, inst.symbol)}
                          className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[#F23645] hover:bg-[#F23645]/10 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Create Watchlist Modal */}
      <Modal
        open={newListModalOpen}
        onClose={() => setNewListModalOpen(false)}
        title="Create New Watchlist"
        subtitle="Organize instruments into a dedicated workspace list"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newListName.trim()) return;
            createWatchlist(newListName);
            setNewListName('');
            setNewListModalOpen(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Watchlist Name
            </label>
            <Input
              autoFocus
              required
              placeholder="e.g. G10 FX & Rates"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setNewListModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create List
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rename Watchlist Modal */}
      <Modal
        open={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        title="Rename Watchlist"
        subtitle={`Update title for "${activeWatchlist.name}"`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!renameValue.trim()) return;
            renameWatchlist(activeWatchlist.id, renameValue);
            setRenameModalOpen(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
              Watchlist Name
            </label>
            <Input
              autoFocus
              required
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRenameModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Name
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
