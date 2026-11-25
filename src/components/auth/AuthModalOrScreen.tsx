import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, Mail, ShieldCheck, UserPlus, X } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { Button, Input } from '../ui/DesignSystem';

export function AuthModalOrScreen() {
  const {
    isAuthenticated,
    authModalOpen,
    authView,
    openAuthModal,
    closeAuthModal,
    completeAuth,
    settings,
  } = usePlatform();

  const [email, setEmail] = useState(settings.email);
  const [password, setPassword] = useState('••••••••••••');
  const [fullName, setFullName] = useState(settings.fullName);
  const [focusArea, setFocusArea] = useState('Multi-Asset Macro & FX');
  const [verifyCode, setVerifyCode] = useState('482910');
  const [newPassword, setNewPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  if (!authModalOpen && isAuthenticated) return null;

  const switchView = (next: typeof authView, notice: string | null = null) => {
    setStatusNotice(notice);
    openAuthModal(next);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#0B0E11]/92 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect width="24" height="24" rx="4" fill="#2962FF" />
              <path
                d="M6 16.5L10.2 11.5L13.5 13.8L18 7.5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M15 7.5H18V10.5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div>
              <div className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
                KESTREL
              </div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                Institutional Market Analysis Terminal
              </div>
            </div>
          </div>

          {isAuthenticated && (
            <button
              type="button"
              onClick={closeAuthModal}
              aria-label="Return to workspace"
              className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {statusNotice && (
            <div className="flex items-start gap-2 p-2.5 rounded bg-[#089981]/12 border border-[#089981]/30 text-xs text-[#089981]">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{statusNotice}</span>
            </div>
          )}

          {/* LOGIN VIEW */}
          {authView === 'login' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                completeAuth({ email });
              }}
              className="space-y-3.5"
            >
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Sign In to Desk</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Access your synchronized watchlists, drawing templates, and simulated desk
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  Work Email
                </label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => switchView('forgot')}
                    className="text-[11px] text-[#2962FF] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="accent-[#2962FF]"
                />
                <span>Keep terminal session active on this workstation</span>
              </label>

              <Button type="submit" variant="primary" size="md" className="w-full">
                Sign In to KESTREL
              </Button>

              <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>New analyst workspace?</span>
                <button
                  type="button"
                  onClick={() => switchView('register')}
                  className="text-[#2962FF] font-medium hover:underline cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            </form>
          )}

          {/* REGISTER VIEW */}
          {authView === 'register' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                switchView('verify', `Verification code dispatched to ${email}`);
              }}
              className="space-y-3"
            >
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-[#2962FF]" />
                  Create Analyst Account
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Provision a personalized multi-market charting and trading profile
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  Full Name
                </label>
                <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  Email Address
                </label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  Password
                </label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  Primary Desk Focus
                </label>
                <Input value={focusArea} onChange={(e) => setFocusArea(e.target.value)} />
              </div>

              <Button type="submit" variant="primary" size="md" className="w-full">
                Continue to Email Verification
              </Button>

              <button
                type="button"
                onClick={() => switchView('login')}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] pt-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD VIEW */}
          {authView === 'forgot' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                switchView('reset', `Recovery token sent to ${email}`);
              }}
              className="space-y-3.5"
            >
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-[#2962FF]" />
                  Recover Terminal Access
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Enter your account email to receive a simulated one-time reset token.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  Registered Email
                </label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <Button type="submit" variant="primary" size="md" className="w-full">
                Send Recovery Code
              </Button>

              <button
                type="button"
                onClick={() => switchView('login')}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </button>
            </form>
          )}

          {/* RESET PASSWORD VIEW */}
          {authView === 'reset' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setPassword(newPassword || '••••••••••••');
                switchView('login', 'Password updated. Sign in with your new credentials.');
              }}
              className="space-y-3.5"
            >
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-[#2962FF]" />
                  Set New Password
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Enter the 6-digit recovery code and choose a new password.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  Recovery Code
                </label>
                <Input required value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  New Password
                </label>
                <Input
                  type="password"
                  required
                  placeholder="Minimum 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <Button type="submit" variant="primary" size="md" className="w-full">
                Update Password
              </Button>
            </form>
          )}

          {/* EMAIL VERIFICATION VIEW */}
          {authView === 'verify' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                completeAuth({ fullName, email });
              }}
              className="space-y-3.5"
            >
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#089981]" />
                  Verify Email Address
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Confirm the 6-digit demo verification code for <span className="font-mono text-[var(--text-primary)]">{email}</span>.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                  Verification Code
                </label>
                <Input
                  className="font-mono tracking-widest text-center text-sm"
                  required
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                />
              </div>

              <Button type="submit" variant="positive" size="md" className="w-full">
                Verify & Enter KESTREL
              </Button>

              <button
                type="button"
                onClick={() => switchView('login')}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
