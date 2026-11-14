// @maintained-by-ai
//
// improve hoh-picker-skip-semantics (LC 2026-11-14 backlog): the HoH picker's
// `Skip` button did NOT dismiss — it self-healed the monk through the real
// commit lane (`runHeal(monkName)`, focus spend when damaged) while Escape was
// the only close. Pins the honest label set (`Heal self` + a distinct
// zero-spend `Cancel`, NO `Skip`) and that both dismiss lanes (Cancel, Escape)
// close with ZERO confirmHeal / ZERO runtime write / ZERO log row.

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HandOfHealingModal from './HandOfHealingModal.jsx';

// Mock set mirrors HandOfHealingModal.cla159.test.jsx.
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

const monkTarget = { name: 'Disciplined_Monk', type: 'player', currentHp: 171, maxHp: 183 };
const banditTarget = { name: 'Bandit 1', type: 'monster', currentHp: 1, maxHp: 11 };

function makePendingProps(overrides = {}) {
  return {
    healName: 'Hand of Healing',
    monkName: 'Disciplined_Monk',
    campaignName: 'test-campaign',
    pending: true,
    creatureTargets: [monkTarget, banditTarget],
    confirmHeal: vi.fn().mockResolvedValue(null),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('HandOfHealingModal picker — honest labels + zero-spend dismiss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue([]);
  });

  it('picker shows NO `Skip`: self-heal is `Heal self` and a distinct `Cancel` is present', () => {
    render(<HandOfHealingModal {...makePendingProps()} />);

    expect(screen.getByText('Choose target for Hand of Healing')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Heal self' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    // The commit lanes are unchanged: pick + Heal still confirm-heals.
    expect(screen.getByRole('button', { name: 'Heal' })).toBeInTheDocument();
  });

  it('Cancel closes the picker with ZERO focus spend, ZERO heal, ZERO writes/log rows', () => {
    const confirmHeal = vi.fn();
    const onClose = vi.fn();
    render(<HandOfHealingModal {...makePendingProps({ confirmHeal, onClose })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(confirmHeal).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('Escape dismissal still closes zero-spend', () => {
    const confirmHeal = vi.fn();
    const onClose = vi.fn();
    render(<HandOfHealingModal {...makePendingProps({ confirmHeal, onClose })} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(confirmHeal).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  it('Heal self remains a REAL commit lane (routes runHeal(monkName)), not a dismiss', () => {
    const confirmHeal = vi.fn().mockResolvedValue({
      targetName: 'Disciplined_Monk',
      formula: '1d12 + 7',
      rolls: [5],
      bonus: 7,
      actualHeal: 12,
      targetCurrentHp: 171,
      targetMaxHp: 183,
    });
    const onClose = vi.fn();
    render(<HandOfHealingModal {...makePendingProps({ confirmHeal, onClose })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Heal self' }));

    expect(confirmHeal).toHaveBeenCalledWith('Disciplined_Monk');
    expect(onClose).not.toHaveBeenCalled();
  });
});
