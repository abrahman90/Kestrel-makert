import React, { useState } from 'react';
import { Check, Link2, ShieldCheck, Unlink } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { Timeframe, UserSettingsState } from '../../types/market';
import { Button, Input, Panel, SegmentedTabs, Select } from '../ui/DesignSystem';

type SettingsTab = 'profile' | 'preferences' | 'security' | 'notifications' | 'connections';

export function SettingsScreen() {
  const { theme, setTheme, settings, updateSettings, toggleConnectedAccount } = usePlatform();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [fullName, setFullName] = useState(settings.fullName);
  const [email, setEmail] = useState(settings.email);
  const [roleTitle, setRoleTitle] = useState(settings.roleTitle);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({ fullName, email, roleTitle });
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1200px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
            Account & Platform Settings
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Manage personal profile, workspace appearance, security controls, and external data feeds
          </p>
        </div>

        <SegmentedTabs
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'profile', label: 'Profile' },
            { value: 'preferences', label: 'Appearance & Locale' },
            { value: 'security', label: 'Security' },
            { value: 'notifications', label: 'Notifications' },
            { value: 'connections', label: 'Connected Accounts' },
          ]}
        />
      </div>

      {/* Personal Information */}
      {activeTab === 'profile' && (
        <Panel className="p-5 space-y-5">
          <div className="flex items-center gap-4 pb-4 border-b border-[var(--border-subtle)]">
            {!avatarFailed ? (
              <img
                src="/src/assets/images/avatar_analyst_user_1795600914271.jpg"
                alt={settings.fullName}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-14 h-14 rounded-md object-cover border border-[var(--border-subtle)]"
              />
            ) : (
              <div className="w-14 h-14 rounded-md bg-[#2962FF]/20 text-[#2962FF] font-bold flex items-center justify-center">
                SD
              </div>
            )}
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">{settings.fullName}</h2>
              <p className="text-xs text-[var(--text-secondary)]">{settings.roleTitle}</p>
              <p className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">{settings.email}</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  Full Name
                </label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  Role / Desk Title
                </label>
                <Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                Primary Email Address
              </label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <Button type="submit" variant="primary">
              <Check className="w-3.5 h-3.5" />
              Save Profile Changes
            </Button>
          </form>
        </Panel>
      )}

      {/* Account Preferences, Appearance & Language */}
      {activeTab === 'preferences' && (
        <Panel className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-2">
                Appearance & Theme
              </h3>
              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1.5">
                  Interface Color Theme
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['dark', 'light'] as const).map((mode) => {
                    const active = theme === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setTheme(mode)}
                        className={`p-3 rounded border text-left transition-colors cursor-pointer ${
                          active
                            ? 'border-[#2962FF] bg-[#2962FF]/10'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-panel)]'
                        }`}
                      >
                        <div className="text-xs font-semibold text-[var(--text-primary)] capitalize">
                          {mode} Theme
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                          {mode === 'dark' ? 'Deep navy institutional workspace' : 'High-contrast daylight workspace'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                  Display Language
                </label>
                <Select
                  value={settings.language}
                  onChange={(e) =>
                    updateSettings({ language: e.target.value as UserSettingsState['language'] })
                  }
                  className="w-full"
                >
                  <option value="English (US)">English (US)</option>
                  <option value="English (UK)">English (UK)</option>
                  <option value="Deutsch">Deutsch</option>
                  <option value="Français">Français</option>
                  <option value="日本語">日本語</option>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-2">
                Market & Chart Preferences
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                    Reporting Currency
                  </label>
                  <Select
                    value={settings.baseCurrency}
                    onChange={(e) =>
                      updateSettings({
                        baseCurrency: e.target.value as UserSettingsState['baseCurrency'],
                      })
                    }
                    className="w-full"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                    Default Chart Interval
                  </label>
                  <Select
                    value={settings.defaultTimeframe}
                    onChange={(e) =>
                      updateSettings({ defaultTimeframe: e.target.value as Timeframe })
                    }
                    className="w-full"
                  >
                    <option value="5m">5 Minutes</option>
                    <option value="15m">15 Minutes</option>
                    <option value="1h">1 Hour</option>
                    <option value="4h">4 Hours</option>
                    <option value="1D">1 Day</option>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
                  Market Timezone
                </label>
                <Select
                  value={settings.timezone}
                  onChange={(e) => updateSettings({ timezone: e.target.value })}
                  className="w-full"
                >
                  <option value="America/New_York (EST)">America/New_York (EST)</option>
                  <option value="Europe/London (GMT)">Europe/London (GMT)</option>
                  <option value="Europe/Frankfurt (CET)">Europe/Frankfurt (CET)</option>
                  <option value="Asia/Tokyo (JST)">Asia/Tokyo (JST)</option>
                </Select>
              </div>

              <label className="flex items-center justify-between p-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] cursor-pointer">
                <div>
                  <div className="text-xs font-medium text-[var(--text-primary)]">
                    Simulated Real-Time Tick Stream
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Stream live quote updates across charts and watchlists
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.liveTickSimulation}
                  onChange={() =>
                    updateSettings({ liveTickSimulation: !settings.liveTickSimulation })
                  }
                  className="w-4 h-4 accent-[#2962FF] cursor-pointer"
                />
              </label>
            </div>
          </div>
        </Panel>
      )}

      {/* Security Settings */}
      {activeTab === 'security' && (
        <Panel className="p-5 space-y-4 max-w-2xl">
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2.5">
            <ShieldCheck className="w-4 h-4 text-[#089981]" />
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">
              Authentication & Session Security
            </h3>
          </div>

          <label className="flex items-center justify-between p-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] cursor-pointer">
            <div>
              <div className="text-xs font-medium text-[var(--text-primary)]">
                Two-Factor Authentication (TOTP / Hardware Key)
              </div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                Require authenticator verification on unrecognized workstations
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.twoFactorEnabled}
              onChange={() =>
                updateSettings({ twoFactorEnabled: !settings.twoFactorEnabled })
              }
              className="w-4 h-4 accent-[#2962FF] cursor-pointer"
            />
          </label>

          <div className="max-w-xs">
            <label className="block text-[11px] text-[var(--text-secondary)] mb-1">
              Inactivity Session Timeout
            </label>
            <Select
              value={String(settings.sessionTimeoutMins)}
              onChange={(e) =>
                updateSettings({ sessionTimeoutMins: Number(e.target.value) })
              }
              className="w-full"
            >
              <option value="15">15 Minutes</option>
              <option value="30">30 Minutes</option>
              <option value="60">60 Minutes</option>
              <option value="240">4 Hours</option>
            </Select>
          </div>
        </Panel>
      )}

      {/* Notification Settings */}
      {activeTab === 'notifications' && (
        <Panel className="p-5 space-y-3 max-w-2xl">
          <h3 className="text-xs font-semibold text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-2">
            Alert & Macro Event Delivery
          </h3>
          {[
            {
              key: 'notifyInApp' as const,
              title: 'In-App Toast & Notification Center',
              desc: 'Display immediate banners when price alerts trigger',
            },
            {
              key: 'notifyEmail' as const,
              title: 'Email Dispatch',
              desc: `Forward triggered price alerts to ${settings.email}`,
            },
            {
              key: 'notifyEconomicHigh' as const,
              title: 'High-Impact Economic Calendar Reminders',
              desc: 'Notify 15 minutes prior to tier-1 macro releases (CPI, FOMC, NFP)',
            },
            {
              key: 'notifySound' as const,
              title: 'Audio Chime on Trigger',
              desc: 'Play subtle chime when an active price level crosses',
            },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between p-3 rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] cursor-pointer"
            >
              <div>
                <div className="text-xs font-medium text-[var(--text-primary)]">{item.title}</div>
                <div className="text-[11px] text-[var(--text-secondary)]">{item.desc}</div>
              </div>
              <input
                type="checkbox"
                checked={settings[item.key]}
                onChange={() => updateSettings({ [item.key]: !settings[item.key] })}
                className="w-4 h-4 accent-[#2962FF] cursor-pointer"
              />
            </label>
          ))}
        </Panel>
      )}

      {/* Connected Accounts */}
      {activeTab === 'connections' && (
        <Panel className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-panel)]">
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">
              Connected Brokerage & Read-Only Data Feeds
            </h3>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {settings.connectedAccounts.map((acc) => {
              const connected = acc.status === 'Connected';
              return (
                <div
                  key={acc.id}
                  className="p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">
                        {acc.provider}
                      </span>
                      <span
                        className={`text-[11px] font-medium ${
                          connected ? 'text-[#089981]' : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {acc.status}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-[var(--text-secondary)] mt-0.5">
                      {acc.accountLabel} · Last synced {acc.lastSync}
                    </div>
                  </div>
                  <Button
                    variant={connected ? 'secondary' : 'primary'}
                    onClick={() => toggleConnectedAccount(acc.id)}
                  >
                    {connected ? (
                      <>
                        <Unlink className="w-3.5 h-3.5" />
                        Disconnect
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5" />
                        Connect Feed
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}
