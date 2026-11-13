// @maintained-by-ai
// Regression pin for bug-hand-of-healing-modal-overstates-restored-hp: the
// result modal used to render the pre-clamp roll total (payload.healAmount) as
// "N HP restored" even when its own ability_use audit row said
// "(Already at full HP)". The modal must mirror the audit row's honesty — the
// clamped payload.actualHeal is the only "HP restored" number it may show,
// with the same Already-at-full-HP annotation at zero.
// Mock set mirrors HandOfHealingModal.cla159.test.jsx.
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HandOfHealingModal from './HandOfHealingModal.jsx';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => []),
  setRuntimeValue: vi.fn(),
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

// Exactly the live repro face: 1d12 + 7 + 2 rolled 7 (+9 bonuses) on an
// at-max 112/112 target — roll sum 16, actualHeal 0.
function makeResolvedProps(overrides = {}) {
  return {
    healName: 'Hand of Healing',
    monkName: 'Disciplined_Monk',
    campaignName: 'test-campaign',
    pending: false,
    targetName: 'EvasiveFighter',
    formula: '1d12 + 7 + 2',
    rolls: [7],
    bonus: 9,
    healAmount: 16,
    actualHeal: 0,
    targetCurrentHp: 112,
    targetMaxHp: 112,
    hasPhysiciansTouch: false,
    onClose: vi.fn(),
    ...overrides,
  };
}

function totalText() {
  return document.querySelector('.healing-total').textContent;
}

describe('HandOfHealingModal honest HP-restored copy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows 0 HP restored with the Already-at-full-HP annotation when actualHeal is 0, never the roll sum', () => {
    render(<HandOfHealingModal {...makeResolvedProps()} />);

    expect(totalText()).toContain('0 HP restored');
    expect(totalText()).toContain('Already at full HP');
    expect(document.querySelector('.healing-total strong').textContent).toBe('0');
    // The pre-clamp roll sum (16) must never surface as the restored amount.
    expect(totalText()).not.toContain('16');
  });

  it('shows the clamped amount (not the roll sum) on a partial heal into maximum', () => {
    render(<HandOfHealingModal {...makeResolvedProps({ actualHeal: 6, targetCurrentHp: 112, targetMaxHp: 118 })} />);

    expect(totalText()).toContain('6 HP restored');
    expect(totalText()).not.toContain('16');
    expect(totalText()).not.toContain('Already at full HP');
  });

  it('CONTROL: a heal that lands in full still reports the full amount without the annotation', () => {
    render(<HandOfHealingModal {...makeResolvedProps({ actualHeal: 16, targetCurrentHp: 128, targetMaxHp: 143 })} />);

    expect(totalText()).toContain('16 HP restored');
    expect(totalText()).not.toContain('Already at full HP');
    expect(document.querySelector('.healing-total strong').textContent).toBe('16');
  });
});
