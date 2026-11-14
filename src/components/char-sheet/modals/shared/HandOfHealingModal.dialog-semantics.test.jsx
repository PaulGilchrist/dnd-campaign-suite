// @maintained-by-ai
// Dialog-semantics pin for HandOfHealingModal (backlog 2026-11-10 HD follow-on):
// all three top-level stages (picker / result / error) borrow .short-rest-modal
// for a NON-rest flow, so each shell now carries the ShortRestModal tier
// (bc409413d): role="dialog" + aria-modal="true" + aria-labelledby → its visible
// heading. Mutually-exclusive stages share ids safely (never co-mount). Button
// behavior is pinned unchanged (Skip/pick → confirmHeal, Done → onClose).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HandOfHealingModal from './HandOfHealingModal.jsx';

// Mock set mirrors HandOfHealingModal.cla159.test.jsx exactly.
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

function makeResolvedProps(overrides = {}) {
  return makePendingProps({
    pending: false,
    targetName: 'Bandit 1',
    targetCurrentHp: 11,
    targetMaxHp: 11,
    formula: '1d12 + 7',
    rolls: [5],
    bonus: 7,
    healAmount: 12,
    actualHeal: 12,
    confirmHeal: undefined,
    ...overrides,
  });
}

// Exactly one dialog root exists, it IS the borrowed .short-rest-modal shell,
// and its accessible name resolves via aria-labelledby → visible heading.
function expectDialogTier(nameMatcher) {
  const dialogs = document.querySelectorAll('[role="dialog"]');
  expect(dialogs).toHaveLength(1);
  const shell = dialogs[0];
  expect(shell.classList.contains('short-rest-modal')).toBe(true);
  expect(shell.getAttribute('aria-modal')).toBe('true');
  const labelledBy = shell.getAttribute('aria-labelledby');
  expect(labelledBy).toBeTruthy();
  const heading = document.getElementById(labelledBy);
  expect(heading).not.toBeNull();
  expect(shell.contains(heading)).toBe(true);
  expect(screen.getByRole('dialog', { name: nameMatcher })).toBe(shell);
  return shell;
}

describe('HandOfHealingModal dialog semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue([]);
  });

  it('picker stage: shell is the live [role="dialog"] labelled by the picker title', () => {
    render(<HandOfHealingModal {...makePendingProps()} />);
    const shell = expectDialogTier(/Choose target for Hand of Healing/);
    const heading = document.getElementById(shell.getAttribute('aria-labelledby'));
    expect(heading.classList.contains('sp-header')).toBe(true);
  });

  it('result stage: shell is the live [role="dialog"] labelled by the heal-name <h3>', () => {
    render(<HandOfHealingModal {...makeResolvedProps()} />);
    const shell = expectDialogTier(/Hand of Healing/);
    const heading = document.getElementById(shell.getAttribute('aria-labelledby'));
    expect(heading.tagName).toBe('H3');
  });

  it('error stage: failed confirmHeal still renders a [role="dialog"] with the heal-name heading', async () => {
    render(<HandOfHealingModal {...makePendingProps({ confirmHeal: vi.fn().mockResolvedValue(null) })} />);
    expectDialogTier(/Choose target for Hand of Healing/);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await waitFor(() => {
      const shell = expectDialogTier(/Hand of Healing/);
      const heading = document.getElementById(shell.getAttribute('aria-labelledby'));
      expect(heading.tagName).toBe('H3');
    });
  });

  it('button behavior is unchanged by the semantics migration', async () => {
    const confirmHeal = vi.fn().mockResolvedValue(healResultPayload);
    const onClose = vi.fn();
    render(<HandOfHealingModal {...makePendingProps({ confirmHeal, onClose })} />);

    // Picker: pick + confirm heals, swaps to the result dialog.
    fireEvent.click(screen.getByText('Bandit 1'));
    fireEvent.click(screen.getByRole('button', { name: 'Heal' }));
    await waitFor(() => {
      expect(confirmHeal).toHaveBeenCalledWith('Bandit 1');
      expectDialogTier(/Hand of Healing/);
    });

    // Result: Done → onClose, zero direct writes / log rows from this component.
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });
});
