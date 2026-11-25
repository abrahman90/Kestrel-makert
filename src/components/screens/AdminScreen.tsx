import React, { useMemo, useState } from 'react';
import {
  Activity,
  CandlestickChart,
  Download,
  Lock,
  Radio,
  Search,
  Shield,
  ShieldAlert,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  computePositionNotionalUsd,
  computePositionUnrealizedPnl,
  usePlatform,
} from '../../context/PlatformContext';
import {
  AdminAuditEntry,
  AdminUserRole,
  AdminUserStatus,
  Instrument,
  MarketCategory,
} from '../../types/market';
import { formatPrice } from '../../utils/indicators';
import {
  Button,
  Input,
  Modal,
  Panel,
  SectionHeader,
  SegmentedTabs,
  Select,
} from '../ui/DesignSystem';

type AdminTab = 'accounts' | 'instruments' | 'risk' | 'audit';

export function AdminScreen() {
  const {
    adminUsers,
    adminRiskConfig,
    adminAuditLogs,
    addAdminUser,
    updateAdminUserRole,
    updateAdminUserStatus,
    updateAdminUserLeverage,
    updateAdminRiskConfig,
    instruments,
    updateInstrumentStatus,
    openPositions,
    closePosition,
    appendAdminAuditLog,
    openChart,
    settings,
    updateSettings,
    pushToast,
  } = usePlatform();

  const [tab, setTab] = useState<AdminTab>('accounts');
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'All' | AdminUserStatus>('All');
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<AdminUserRole>('Trader');
  const [newUserTier, setNewUserTier] = useState<'Institutional' | 'Pro' | 'Standard'>('Pro');
  const [newUserEquity, setNewUserEquity] = useState('100000');
  const [newUserLev, setNewUserLev] = useState('10');

  const [instSearch, setInstSearch] = useState('');
  const [instCat, setInstCat] = useState<MarketCategory>('All');

  const [auditCatFilter, setAuditCatFilter] = useState<'All' | AdminAuditEntry['category']>('All');

  const [riskDraft, setRiskDraft] = useState(adminRiskConfig);

  const instMap = useMemo(() => new Map(instruments.map((i) => [i.symbol, i])), [instruments]);

  const summary = useMemo(() => {
    const activeAccounts = adminUsers.filter((u) => u.status === 'Active').length;
    const totalAum = adminUsers.reduce((acc, u) => acc + u.equityUsd, 0);
    const activeFeeds = instruments.filter((i) => i.status !== 'Closed').length;
    const totalGrossNotional = openPositions.reduce((sum, p) => {
      const px = instMap.get(p.symbol)?.price ?? p.entryPrice;
      return sum + computePositionNotionalUsd(p, px);
    }, 0);
    return {
      totalAccounts: adminUsers.length,
      activeAccounts,
      totalAum,
      activeFeeds,
      totalInstruments: instruments.length,
      totalGrossNotional,
    };
  }, [adminUsers, instruments, openPositions, instMap]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return adminUsers.filter((u) => {
      if (userStatusFilter !== 'All' && u.status !== userStatusFilter) return false;
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [adminUsers, userSearch, userStatusFilter]);

  const filteredInstruments = useMemo(() => {
    const q = instSearch.trim().toLowerCase();
    return instruments.filter((i) => {
      if (instCat !== 'All' && i.category !== instCat) return false;
      if (!q) return true;
      return i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q);
    });
  }, [instruments, instSearch, instCat]);

  const filteredAudit = useMemo(() => {
    return adminAuditLogs.filter(
      (a) => auditCatFilter === 'All' || a.category === auditCatFilter
    );
  }, [adminAuditLogs, auditCatFilter]);

  const exportAuditCsv = () => {
    const header = 'ID,Timestamp,Actor,Category,Action,Target,Details';
    const rows = filteredAudit.map(
      (a) =>
        `${a.id},"${a.timestamp}","${a.actor}",${a.category},"${a.action}","${a.target}","${a.details.replace(/"/g, '""')}"`
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kestrel-admin-audit-log.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    pushToast({ title: 'Audit Log Exported', description: 'kestrel-admin-audit-log.csv', variant: 'success' });
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#2962FF]" />
            Platform Administration Console
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Desk account governance, instrument feed controls, global margin limits, and compliance audit trail
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => updateSettings({ liveTickSimulation: !settings.liveTickSimulation })}>
            <Radio className={`w-3.5 h-3.5 ${settings.liveTickSimulation ? 'text-[#089981]' : 'text-[var(--text-muted)]'}`} />
            {settings.liveTickSimulation ? 'Tick Feed: Live' : 'Tick Feed: Paused'}
          </Button>
          <Button variant="primary" onClick={() => setProvisionOpen(true)}>
            <UserPlus className="w-3.5 h-3.5" />
            Provision Account
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Panel className="p-3.5">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span>Managed Accounts</span>
            <Users className="w-3.5 h-3.5 text-[#2962FF]" />
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
            {summary.totalAccounts}
          </div>
          <div className="text-[11px] text-[#089981] font-mono mt-0.5">
            {summary.activeAccounts} Active · {summary.totalAccounts - summary.activeAccounts} Restricted/Pending
          </div>
        </Panel>

        <Panel className="p-3.5">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span>Aggregate Desk Equity</span>
            <Activity className="w-3.5 h-3.5 text-[#089981]" />
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
            ${summary.totalAum.toLocaleString('en-US')}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
            Base Currency: {settings.baseCurrency}
          </div>
        </Panel>

        <Panel className="p-3.5">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span>Open Desk Gross Exposure</span>
            <ShieldAlert className="w-3.5 h-3.5 text-[#F0B90B]" />
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
            ${summary.totalGrossNotional.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
            {openPositions.length} Open Positions Monitored
          </div>
        </Panel>

        <Panel className="p-3.5">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span>Instrument Feeds</span>
            <Radio className="w-3.5 h-3.5 text-[#089981]" />
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-[var(--text-primary)] mt-1">
            {summary.activeFeeds} / {summary.totalInstruments}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
            Stop-Out: {adminRiskConfig.stopOutPct}% · Fee: {adminRiskConfig.commissionBps} bps
          </div>
        </Panel>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'accounts', label: 'Accounts & Roles', count: adminUsers.length },
            { value: 'instruments', label: 'Instruments & Feeds', count: instruments.length },
            { value: 'risk', label: 'Risk & Exposure', count: openPositions.length },
            { value: 'audit', label: 'Audit Trail', count: adminAuditLogs.length },
          ]}
        />
        <span className="text-[11px] font-mono text-[var(--text-muted)]">
          Operator: {settings.fullName} ({settings.email})
        </span>
      </div>

      {/* TAB 1: ACCOUNTS & ROLES */}
      {tab === 'accounts' && (
        <Panel className="overflow-hidden">
          <div className="p-3.5 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search user name, email, role..."
                className="pl-8"
              />
            </div>

            <SegmentedTabs
              value={userStatusFilter}
              onChange={setUserStatusFilter}
              options={[
                { value: 'All', label: 'All' },
                { value: 'Active', label: 'Active' },
                { value: 'Pending KYC', label: 'Pending KYC' },
                { value: 'Suspended', label: 'Suspended' },
              ]}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[11px] text-[var(--text-secondary)]">
                  <th className="text-left font-medium px-4 py-2.5">User / Desk Member</th>
                  <th className="text-left font-medium px-3 py-2.5">Role</th>
                  <th className="text-left font-medium px-3 py-2.5">Tier</th>
                  <th className="text-right font-medium px-3 py-2.5">Equity</th>
                  <th className="text-center font-medium px-3 py-2.5">Max Leverage</th>
                  <th className="text-center font-medium px-3 py-2.5">2FA</th>
                  <th className="text-center font-medium px-3 py-2.5">Status</th>
                  <th className="text-right font-medium px-4 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-[var(--bg-panel)]/60">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-[var(--text-primary)]">{user.fullName}</div>
                      <div className="text-[11px] font-mono text-[var(--text-muted)]">
                        {user.email} · {user.lastActive}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Select
                        aria-label={`Role for ${user.fullName}`}
                        value={user.role}
                        onChange={(e) => updateAdminUserRole(user.id, e.target.value as AdminUserRole)}
                        className="h-7 text-[11px]"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Risk Officer">Risk Officer</option>
                        <option value="Senior Analyst">Senior Analyst</option>
                        <option value="Trader">Trader</option>
                      </Select>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">{user.tier}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                      ${user.equityUsd.toLocaleString('en-US')}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Select
                        aria-label={`Max leverage for ${user.fullName}`}
                        value={String(user.maxLeverage)}
                        onChange={(e) => updateAdminUserLeverage(user.id, Number(e.target.value))}
                        className="h-7 text-[11px] font-mono"
                      >
                        <option value="5">5x</option>
                        <option value="10">10x</option>
                        <option value="20">20x</option>
                        <option value="30">30x</option>
                        <option value="50">50x</option>
                      </Select>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-mono ${
                          user.twoFactorEnabled ? 'text-[#089981]' : 'text-[#F0B90B]'
                        }`}
                      >
                        <Lock className="w-3 h-3" />
                        {user.twoFactorEnabled ? 'Enabled' : 'Unset'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`text-[11px] font-medium ${
                          user.status === 'Active'
                            ? 'text-[#089981]'
                            : user.status === 'Pending KYC'
                            ? 'text-[#F0B90B]'
                            : 'text-[#F23645]'
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {user.status === 'Active' ? (
                        <Button
                          variant="danger"
                          size="xs"
                          onClick={() => updateAdminUserStatus(user.id, 'Suspended')}
                        >
                          Suspend
                        </Button>
                      ) : (
                        <Button
                          variant="positive"
                          size="xs"
                          onClick={() => updateAdminUserStatus(user.id, 'Active')}
                        >
                          Activate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* TAB 2: INSTRUMENTS & FEEDS */}
      {tab === 'instruments' && (
        <Panel className="overflow-hidden">
          <div className="p-3.5 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                value={instSearch}
                onChange={(e) => setInstSearch(e.target.value)}
                placeholder="Filter symbol or name..."
                className="pl-8"
              />
            </div>

            <SegmentedTabs
              value={instCat}
              onChange={setInstCat}
              options={[
                { value: 'All', label: 'All' },
                { value: 'Forex', label: 'Forex' },
                { value: 'Crypto', label: 'Crypto' },
                { value: 'Stocks', label: 'Stocks' },
                { value: 'Indices', label: 'Indices' },
                { value: 'Commodities', label: 'Commodities' },
              ]}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[11px] text-[var(--text-secondary)]">
                  <th className="text-left font-medium px-4 py-2.5">Symbol</th>
                  <th className="text-left font-medium px-3 py-2.5">Exchange / Category</th>
                  <th className="text-right font-medium px-3 py-2.5">Bid / Ask</th>
                  <th className="text-right font-medium px-3 py-2.5">Spread</th>
                  <th className="text-right font-medium px-3 py-2.5">24h Volume</th>
                  <th className="text-center font-medium px-3 py-2.5">Session Status Override</th>
                  <th className="text-right font-medium px-4 py-2.5">Chart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredInstruments.map((inst) => (
                  <tr key={inst.symbol} className="hover:bg-[var(--bg-panel)]/60">
                    <td className="px-4 py-2.5">
                      <div className="font-mono font-semibold text-[var(--text-primary)]">{inst.symbol}</div>
                      <div className="text-[11px] text-[var(--text-secondary)]">{inst.name}</div>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--text-secondary)]">
                      {inst.exchange} · {inst.category}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                      {formatPrice(inst.bid, inst.decimals)} / {formatPrice(inst.ask, inst.decimals)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                      {inst.spread}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                      {inst.volumeLabel}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Select
                        aria-label={`Session status for ${inst.symbol}`}
                        value={inst.status}
                        onChange={(e) =>
                          updateInstrumentStatus(inst.symbol, e.target.value as Instrument['status'])
                        }
                        className="h-7 text-[11px]"
                      >
                        <option value="Open">Open</option>
                        <option value="Extended">Extended</option>
                        <option value="24/7">24/7</option>
                        <option value="Closed">Closed</option>
                      </Select>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="ghost" size="xs" onClick={() => openChart(inst.symbol)}>
                        <CandlestickChart className="w-3.5 h-3.5" />
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* TAB 3: RISK & EXPOSURE CONTROLS */}
      {tab === 'risk' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          <Panel className="xl:col-span-5 p-4 space-y-4">
            <SectionHeader
              title="Global Risk & Margin Policy"
              subtitle="Platform-wide leverage ceilings, liquidation levels & execution fees"
            />

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateAdminRiskConfig(riskDraft);
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                    Max FX Lev (x)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={riskDraft.maxFxLeverage}
                    onChange={(e) =>
                      setRiskDraft((d) => ({ ...d, maxFxLeverage: Number(e.target.value) || 1 }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                    Max Crypto (x)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={riskDraft.maxCryptoLeverage}
                    onChange={(e) =>
                      setRiskDraft((d) => ({ ...d, maxCryptoLeverage: Number(e.target.value) || 1 }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                    Max Equity (x)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={riskDraft.maxEquityLeverage}
                    onChange={(e) =>
                      setRiskDraft((d) => ({ ...d, maxEquityLeverage: Number(e.target.value) || 1 }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                    Margin Call (%)
                  </label>
                  <Input
                    type="number"
                    min="50"
                    max="300"
                    value={riskDraft.marginCallPct}
                    onChange={(e) =>
                      setRiskDraft((d) => ({ ...d, marginCallPct: Number(e.target.value) || 100 }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                    Stop-Out (%)
                  </label>
                  <Input
                    type="number"
                    min="10"
                    max="150"
                    value={riskDraft.stopOutPct}
                    onChange={(e) =>
                      setRiskDraft((d) => ({ ...d, stopOutPct: Number(e.target.value) || 50 }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                    Fee (bps)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="50"
                    value={riskDraft.commissionBps}
                    onChange={(e) =>
                      setRiskDraft((d) => ({ ...d, commissionBps: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)] text-xs">
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-[var(--text-primary)]">Simulated Order Routing Active</span>
                  <input
                    type="checkbox"
                    checked={riskDraft.orderRoutingEnabled}
                    onChange={(e) =>
                      setRiskDraft((d) => ({ ...d, orderRoutingEnabled: e.target.checked }))
                    }
                    className="accent-[#2962FF]"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-[var(--text-primary)]">Scheduled Maintenance Window Notice</span>
                  <input
                    type="checkbox"
                    checked={riskDraft.maintenanceBanner}
                    onChange={(e) =>
                      setRiskDraft((d) => ({ ...d, maintenanceBanner: e.target.checked }))
                    }
                    className="accent-[#2962FF]"
                  />
                </label>
              </div>

              <Button type="submit" variant="primary" className="w-full">
                Save Global Risk Policy
              </Button>
            </form>
          </Panel>

          <Panel className="xl:col-span-7 overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <SectionHeader
                title="Live Open Desk Exposure"
                subtitle="Monitor active positions and intervene on risk breaches"
              />
            </div>

            {openPositions.length === 0 ? (
              <div className="p-10 text-center text-xs text-[var(--text-secondary)]">
                No active open positions on the desk.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[11px] text-[var(--text-secondary)]">
                      <th className="text-left font-medium px-4 py-2.5">Symbol</th>
                      <th className="text-left font-medium px-3 py-2.5">Side</th>
                      <th className="text-right font-medium px-3 py-2.5">Notional</th>
                      <th className="text-right font-medium px-3 py-2.5">Lev</th>
                      <th className="text-right font-medium px-3 py-2.5">Unrealized P&L</th>
                      <th className="text-right font-medium px-4 py-2.5">Risk Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {openPositions.map((pos) => {
                      const inst = instMap.get(pos.symbol);
                      const px = inst ? (pos.side === 'Buy' ? inst.bid : inst.ask) : pos.entryPrice;
                      const pnl = computePositionUnrealizedPnl(pos, px);
                      const notional = computePositionNotionalUsd(pos, px);
                      return (
                        <tr key={pos.id} className="hover:bg-[var(--bg-panel)]/60">
                          <td className="px-4 py-2.5 font-mono font-semibold text-[var(--text-primary)]">
                            {pos.symbol}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`font-semibold ${
                                pos.side === 'Buy' ? 'text-[#089981]' : 'text-[#F23645]'
                              }`}
                            >
                              {pos.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-primary)]">
                            ${notional.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                            {pos.leverage}x
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right font-mono tabular-nums font-semibold ${
                              pnl >= 0 ? 'text-[#089981]' : 'text-[#F23645]'
                            }`}
                          >
                            {pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => {
                                closePosition(pos.id);
                                appendAdminAuditLog({
                                  actor: settings.fullName,
                                  action: 'Admin Force-Close',
                                  target: pos.symbol,
                                  category: 'Risk',
                                  details: `Liquidated ${pos.side} ${pos.quantity} ${pos.symbol} from Risk Desk.`,
                                });
                              }}
                            >
                              <X className="w-3 h-3" />
                              Force Close
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* TAB 4: AUDIT TRAIL */}
      {tab === 'audit' && (
        <Panel className="overflow-hidden">
          <div className="p-3.5 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
            <SegmentedTabs
              value={auditCatFilter}
              onChange={setAuditCatFilter}
              options={[
                { value: 'All', label: 'All Events' },
                { value: 'Access', label: 'Access' },
                { value: 'Risk', label: 'Risk' },
                { value: 'Feed', label: 'Feed' },
                { value: 'System', label: 'System' },
              ]}
            />
            <Button variant="secondary" onClick={exportAuditCsv}>
              <Download className="w-3.5 h-3.5" />
              Export Audit CSV
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-panel)] text-[11px] text-[var(--text-secondary)]">
                  <th className="text-left font-medium px-4 py-2.5">Timestamp</th>
                  <th className="text-left font-medium px-3 py-2.5">Operator</th>
                  <th className="text-left font-medium px-3 py-2.5">Category</th>
                  <th className="text-left font-medium px-3 py-2.5">Action</th>
                  <th className="text-left font-medium px-3 py-2.5">Target</th>
                  <th className="text-left font-medium px-4 py-2.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredAudit.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[var(--bg-panel)]/60">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
                      {entry.timestamp}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-[var(--text-primary)] whitespace-nowrap">
                      {entry.actor}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[11px] font-mono text-[#2962FF]">{entry.category}</span>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-[var(--text-primary)] whitespace-nowrap">
                      {entry.action}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
                      {entry.target}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--text-secondary)]">{entry.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Provision New Account Modal */}
      <Modal
        open={provisionOpen}
        onClose={() => setProvisionOpen(false)}
        title="Provision KESTREL Account"
        subtitle="Create a new trader, analyst, or risk officer workspace seat"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newUserName.trim() || !newUserEmail.trim()) return;
            addAdminUser({
              fullName: newUserName,
              email: newUserEmail,
              role: newUserRole,
              tier: newUserTier,
              equityUsd: Number(newUserEquity) || 50000,
              maxLeverage: Number(newUserLev) || 10,
            });
            setNewUserName('');
            setNewUserEmail('');
            setProvisionOpen(false);
          }}
          className="space-y-3.5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Full Name
              </label>
              <Input
                required
                placeholder="e.g. Nadia Kowalski"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Work Email
              </label>
              <Input
                type="email"
                required
                placeholder="n.kowalski@kestrel-desk.io"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Role
              </label>
              <Select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as AdminUserRole)}
                className="w-full"
              >
                <option value="Trader">Trader</option>
                <option value="Senior Analyst">Senior Analyst</option>
                <option value="Risk Officer">Risk Officer</option>
                <option value="Admin">Admin</option>
              </Select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Account Tier
              </label>
              <Select
                value={newUserTier}
                onChange={(e) =>
                  setNewUserTier(e.target.value as 'Institutional' | 'Pro' | 'Standard')
                }
                className="w-full"
              >
                <option value="Institutional">Institutional</option>
                <option value="Pro">Pro</option>
                <option value="Standard">Standard</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Initial Equity (USD)
              </label>
              <Input
                type="number"
                min="1000"
                step="1000"
                value={newUserEquity}
                onChange={(e) => setNewUserEquity(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Max Leverage Cap
              </label>
              <Select
                value={newUserLev}
                onChange={(e) => setNewUserLev(e.target.value)}
                className="w-full"
              >
                <option value="5">5x</option>
                <option value="10">10x</option>
                <option value="20">20x</option>
                <option value="30">30x</option>
                <option value="50">50x</option>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setProvisionOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Provision Seat
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
