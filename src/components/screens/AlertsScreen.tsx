import React, { useMemo, useState } from 'react';
import { BellPlus, CandlestickChart, RotateCcw, Trash2 } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { AlertStatus } from '../../types/market';
import { formatPrice } from '../../utils/indicators';
import { Button, EmptyState, Panel, SegmentedTabs } from '../ui/DesignSystem';

type AlertTab = 'All' | AlertStatus;

export function AlertsScreen() {
  const {
    alerts,
    instruments,
    openCreateAlertModal,
    deleteAlert,
    reactivateAlert,
    openChart,
  } = usePlatform();

  const [tab, setTab] = useState<AlertTab>('All');

  const counts = useMemo(
    () => ({
      All: alerts.length,
      Active: alerts.filter((a) => a.status === 'Active').length,
      Triggered: alerts.filter((a) => a.status === 'Triggered').length,
      Expired: alerts.filter((a) => a.status === 'Expired').length,
    }),
    [alerts]
  );

  const filtered = useMemo(
    () => (tab === 'All' ? alerts : alerts.filter((a) => a.status === tab)),
    [alerts, tab]
  );

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
            Price Alerts & Triggers
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Monitor threshold breakouts, re-arm expired alerts, and inspect execution history
          </p>
        </div>

        <Button variant="primary" onClick={() => openCreateAlertModal()}>
          <BellPlus className="w-3.5 h-3.5" />
          Create Alert
        </Button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Panel className="p-3.5">
          <div className="text-[11px] text-[var(--text-secondary)]">Active Monitors</div>
          <div className="text-lg font-mono tabular-nums font-bold text-[#2962FF] mt-1">
            {counts.Active}
          </div>
        </Panel>
        <Panel className="p-3.5">
          <div className="text-[11px] text-[var(--text-secondary)]">Triggered Today</div>
          <div className="text-lg font-mono tabular-nums font-bold text-[#089981] mt-1">
            {counts.Triggered}
          </div>
        </Panel>
        <Panel className="p-3.5">
          <div className="text-[11px] text-[var(--text-secondary)]">Expired Alerts</div>
          <div className="text-lg font-mono tabular-nums font-bold text-[var(--text-secondary)] mt-1">
            {counts.Expired}
          </div>
        </Panel>
        <Panel className="p-3.5">
          <div className="text-[11px] text-[var(--text-secondary)]">Total Alert History</div>
          <div className="text-lg font-mono tabular-nums font-bold text-[var(--text-primary)] mt-1">
            {counts.All}
          </div>
        </Panel>
      </div>

      <div className="flex items-center justify-between">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'All', label: 'All History', count: counts.All },
            { value: 'Active', label: 'Active', count: counts.Active },
            { value: 'Triggered', label: 'Triggered', count: counts.Triggered },
            { value: 'Expired', label: 'Expired', count: counts.Expired },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={`No ${tab.toLowerCase()} alerts`}
          description="Create a new price alert to receive real-time in-app, email, or webhook notifications when levels trigger."
          action={
            <Button variant="primary" onClick={() => openCreateAlertModal()}>
              <BellPlus className="w-3.5 h-3.5" />
              Create First Alert
            </Button>
          }
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[11px] text-[var(--text-secondary)]">
                  <th className="text-left font-medium px-4 py-2.5">Instrument</th>
                  <th className="text-left font-medium px-3 py-2.5">Condition</th>
                  <th className="text-right font-medium px-3 py-2.5">Target Price</th>
                  <th className="text-right font-medium px-3 py-2.5">Current Spot</th>
                  <th className="text-right font-medium px-3 py-2.5">Distance</th>
                  <th className="text-left font-medium px-3 py-2.5">Delivery</th>
                  <th className="text-left font-medium px-3 py-2.5">Status</th>
                  <th className="text-left font-medium px-3 py-2.5">Timestamp / Expiry</th>
                  <th className="text-right font-medium px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filtered.map((al) => {
                  const inst = instruments.find((i) => i.symbol === al.symbol);
                  const curPrice = inst?.price ?? al.currentPriceAtCreate;
                  const decimals = inst?.decimals ?? 2;
                  const distPct = ((al.targetPrice - curPrice) / (curPrice || 1)) * 100;

                  return (
                    <tr key={al.id} className="hover:bg-[var(--bg-panel)]/60 transition-colors">
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => openChart(al.symbol)}
                          className="font-mono font-semibold text-[var(--text-primary)] hover:text-[#2962FF] cursor-pointer"
                        >
                          {al.symbol}
                        </button>
                        {al.note && (
                          <div className="text-[11px] text-[var(--text-secondary)] truncate max-w-[180px]">
                            {al.note}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text-primary)]">{al.condition}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-[var(--text-primary)]">
                        {formatPrice(al.targetPrice, decimals)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                        {formatPrice(curPrice, decimals)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right font-mono tabular-nums ${
                          distPct >= 0 ? 'text-[#089981]' : 'text-[#F23645]'
                        }`}
                      >
                        {distPct >= 0 ? '+' : ''}
                        {distPct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2.5 text-[var(--text-secondary)]">
                        {al.notificationMethod.join(', ')}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-[11px] font-semibold ${
                            al.status === 'Active'
                              ? 'text-[#2962FF]'
                              : al.status === 'Triggered'
                              ? 'text-[#089981]'
                              : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {al.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--text-secondary)]">
                        <div>
                          {al.status === 'Triggered' && al.triggeredAt
                            ? `Hit: ${al.triggeredAt}`
                            : `Set: ${al.createdAt}`}
                        </div>
                        <div className="text-[var(--text-muted)]">Exp: {al.expiresAt}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            title="Open Chart"
                            onClick={() => openChart(al.symbol)}
                            className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[#2962FF] hover:bg-[#2962FF]/10 cursor-pointer"
                          >
                            <CandlestickChart className="w-3.5 h-3.5" />
                          </button>
                          {al.status !== 'Active' && (
                            <button
                              type="button"
                              title="Re-arm Alert"
                              onClick={() => reactivateAlert(al.id)}
                              className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[#089981] hover:bg-[#089981]/10 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Delete Alert"
                            onClick={() => deleteAlert(al.id)}
                            className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[#F23645] hover:bg-[#F23645]/10 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
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
