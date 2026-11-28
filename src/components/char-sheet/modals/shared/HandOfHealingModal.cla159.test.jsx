// @maintained-by-ai 2026-11-27
//
// CLA-159 lane: the pending target-picker SURFACE of HandOfHealingModal.
// Owns: every candidate listed with zero silence before a commit; the
// pick→Heal single-spend swap that renders the confirmHeal payload exactly
// (double-commit = double focus spend, the Hand-of-Maktub-class defect); and
// the terminal error stage (resolves-null / rejects) with honest copy, never a
// fake result, zero writes/log rows, and a working Done dismiss.
// Adjacent faces owned elsewhere (not restated here): honest `Heal self` /
// `Cancel` / no-`Skip` labels AND the self-heal commit lane + zero-spend
// dismiss (picker-dismiss), pre-spend refusal note (refusal-note), dialog
// role/aria tier (dialog-semantics), live-HP echo rows (live-hp-echo /
// live-cs-hp-echo), actualHeal clamp honesty (restored-hp-honesty), and the
// result-stage rendering + Physician's Touch math (main test.jsx).
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HandOfHealingModal from './HandOfHealingModal.jsx';

// Mock set mirrors HandOfHealingModal.test.jsx; resolveLiveTargetHp and
// SecondaryTargetModal stay REAL (the empty combat-summary board makes
// reanchorTargetsToLiveBoard a no-op, so snapshot rows render untouched).
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => []),
  setRuntimeValue: vi.fn(),
  useRuntimeValue: vi.fn(() => null), // display-echo subscription seam (return value unused by the heal modals)
}));

vi.mock('../../../../services/ui/utils.js', () => ({
  default: { getName: (n) => (n || '').trim() },
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../../services/ui/logService.js';

const monkTarget = { name: 'Disciplined_Monk', type: 'player', currentHp: 183, maxHp: 183 };
const banditTarget = { name: 'Bandit 1', type: 'monster', currentHp: 1, maxHp: 11 };

// Matches the real healingHandler.performMonkHeal return shape (clamped
// actualHeal rides the audit-honesty law pinned by restored-hp-honesty).
const healResultPayload = {
  targetName: 'Bandit 1',
  formula: '1d12 + 7',
  rolls: [5],
  bonus: 7,
  healAmount: 12,
  actualHeal: 12,
  targetCurrentHp: 11,
  targetMaxHp: 11,
};

function makePendingProps(overrides = {}) {
  return {
    healName: 'Hand of Healing',
    monkName: 'Disciplined_Monk',
    campaignName: 'test-campaign',
    pending: true,
    creatureTargets: [monkTarget, banditTarget],
    confirmHeal: vi.fn().mockResolvedValue(healResultPayload),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('CLA-159 HandOfHealingModal pending target picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-baseline the overridable read stub (clearAllMocks keeps the factory
    // impl, but every override surface is pinned fresh here regardless).
    useRuntimeState.getRuntimeValue.mockReturnValue([]);
  });

  it('lists every candidate with a live commit button and zero silence + no result before a heal', () => {
    const confirmHeal = vi.fn();
    render(<HandOfHealingModal {...makePendingProps({ confirmHeal })} />);

    expect(screen.getByText('Choose target for Hand of Healing')).toBeInTheDocument();
    expect(screen.getByText('Bandit 1')).toBeInTheDocument();
    expect(screen.getByText('Disciplined_Monk')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Heal' })).toBeInTheDocument();
    // Zero-silence contract pre-commit: nothing fires, nothing writes.
    expect(confirmHeal).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    // No premature outcome surfaces (result, error, or refusal).
    expect(screen.queryByText(/HP restored/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Healing failed to resolve/)).not.toBeInTheDocument();
    // The label honesty set (`Heal self`, distinct `Cancel`, no `Skip`) is
    // pinned WITH its zero-spend dismiss behavior by picker-dismiss.test.jsx.
  });

  it('pick + Heal commits once with the picked name and swaps the picker for the result rendered exactly from the payload', async () => {
    const confirmHeal = vi.fn().mockResolvedValue(healResultPayload);
    const onClose = vi.fn();
    render(<HandOfHealingModal {...makePendingProps({ confirmHeal, onClose })} />);

    fireEvent.click(screen.getByText('Bandit 1'));
    fireEvent.click(screen.getByRole('button', { name: 'Heal' }));

    // Synchronous single commit with the picked name — a second call would
    // double-spend Focus and double-heal past the payload.
    expect(confirmHeal).toHaveBeenCalledTimes(1);
    expect(confirmHeal).toHaveBeenCalledWith('Bandit 1');

    // Exact payload landing: HP pair in the heading, full arithmetic line
    // (formula, rolls, bonus, clamped actualHeal) byte-identical.
    expect(await screen.findByText('Healing—Bandit 1 (11 / 11 HP)')).toBeInTheDocument();
    expect(document.querySelector('.healing-roll-details').textContent)
      .toBe('1d12 + 7: 5 + 7 = 12 HP restored');
    expect(screen.queryByText('Choose target for Hand of Healing')).not.toBeInTheDocument();
    expect(screen.queryByText(/Healing failed to resolve/)).not.toBeInTheDocument();
    // The modal commits ONLY via confirmHeal — no direct writes or log rows.
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    ['resolves null', () => vi.fn().mockResolvedValue(null)],
    ['rejects', () => vi.fn().mockRejectedValue(new Error('network down'))],
  ])('shows the honest error stage and never a fake result when confirmHeal %s', async (_label, makeFailingConfirm) => {
    const confirmHeal = makeFailingConfirm();
    const onClose = vi.fn();
    render(<HandOfHealingModal {...makePendingProps({ confirmHeal, onClose })} />);

    fireEvent.click(screen.getByText('Disciplined_Monk'));
    fireEvent.click(screen.getByRole('button', { name: 'Heal' }));

    expect(await screen.findByText(/Healing failed to resolve/)).toBeInTheDocument();
    // Never a fake result and no strand on the picker.
    expect(screen.queryByText(/HP restored/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose target/)).not.toBeInTheDocument();
    // A failed heal spends nothing: zero runtime writes, zero log rows.
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    // The error stage is not a dead end: Done dismisses exactly once.
    fireEvent.click(screen.getByRole('button', { name: /Done/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
