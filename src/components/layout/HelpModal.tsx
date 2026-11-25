import React from 'react';
import { Keyboard, Layers, Ruler, ShieldCheck } from 'lucide-react';
import { usePlatform } from '../../context/PlatformContext';
import { Button, Modal } from '../ui/DesignSystem';

const SHORTCUTS = [
  { keys: '⌘K / /', action: 'Open Global Symbol Search' },
  { keys: '?', action: 'Toggle Help & Shortcuts' },
  { keys: 'Alt + T', action: 'Select Trend Line Tool' },
  { keys: 'Alt + H', action: 'Select Horizontal Line Tool' },
  { keys: 'Alt + V', action: 'Select Vertical Line Tool' },
  { keys: 'Alt + C', action: 'Select Cross Line Tool' },
  { keys: 'Ctrl + Z / Y', action: 'Undo / Redo Chart Drawings' },
  { keys: 'Ctrl + C / V', action: 'Copy / Paste Selected Drawing' },
  { keys: 'Delete / Esc', action: 'Delete Selected or Cancel Drawing' },
];

export function HelpModal() {
  const { helpModalOpen, setHelpModalOpen } = usePlatform();

  return (
    <Modal
      open={helpModalOpen}
      onClose={() => setHelpModalOpen(false)}
      title="KESTREL Workspace Guide & Shortcuts"
      subtitle="Keyboard navigation, charting controls, and simulated execution workflow"
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] mb-2">
            <Keyboard className="w-3.5 h-3.5 text-[#2962FF]" />
            <span>Keyboard Shortcuts</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {SHORTCUTS.map((s) => (
              <div
                key={s.keys}
                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-xs"
              >
                <span className="text-[var(--text-secondary)] truncate">{s.action}</span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] shrink-0">
                  {s.keys}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="p-2.5 rounded bg-[var(--bg-panel)] border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
              <Ruler className="w-3.5 h-3.5 text-[#089981]" />
              <span>Position Tools</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Drag Entry, Take Profit, and Stop Loss handles independently on Long & Short projections.
            </p>
          </div>
          <div className="p-2.5 rounded bg-[var(--bg-panel)] border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
              <Layers className="w-3.5 h-3.5 text-[#2962FF]" />
              <span>Clean Chart Mode</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Use Chart Only / Lines On in the chart toolbar to toggle all indicators on or off immediately.
            </p>
          </div>
          <div className="p-2.5 rounded bg-[var(--bg-panel)] border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#F0B90B]" />
              <span>Simulated Desk</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Orders placed from Chart Bottom Panel or Trading Desk update live margin & history locally.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="primary" onClick={() => setHelpModalOpen(false)}>
            Got it
          </Button>
        </div>
      </div>
    </Modal>
  );
}
