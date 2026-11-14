// @maintained-by-ai
//
// HoH pre-spend-at-full-HP improve — picker refusal-note face. The commit-time
// capacity gate (healingHandler.performMonkHeal) turns a full-HP confirm into
// { refusal } with ZERO Focus spent; HandOfHealingModal keeps the picker OPEN
// and renders the note inline (.healing-restriction-note — the same global copy
// style d595cff2c shipped for the Healing-Light noHealCapacity gate). The
// damaged leg afterwards must still mount the honest result modal (the refusal
// is not a dead end).

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HandOfHealingModal from './HandOfHealingModal.jsx';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
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

const fullTarget = { name: 'Fighting_Rogue', type: 'player', currentHp: 143, maxHp: 143 };
const woundedTarget = { name: 'Bandit 1', type: 'monster', currentHp: 1, maxHp: 11 };

const healResultPayload = {
  targetName: 'Bandit 1',
  formula: '1d12 + 7',
  rolls: [5],
  bonus: 7,
  healAmount: 12,
  actualHeal: 10,
  targetCurrentHp: 11,
  targetMaxHp: 11,
};

function makePendingProps(confirmHeal) {
  return {
    healName: 'Hand of Healing',
    monkName: 'Disciplined_Monk',
    campaignName: 'test-campaign',
    pending: true,
    creatureTargets: [fullTarget, woundedTarget],
    confirmHeal,
    onClose: vi.fn(),
  };
}

describe('HandOfHealingModal picker refusal note (REFUSE PRE-SPEND)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the zero-spend refusal inline and keeps the picker open — no result modal', async () => {
    const confirmHeal = vi.fn().mockResolvedValue({ refusal: 'Fighting_Rogue is already at full HP. No focus spent.' });
    render(<HandOfHealingModal {...makePendingProps(confirmHeal)} />);

    fireEvent.click(screen.getByText('Fighting_Rogue'));
    fireEvent.click(screen.getByRole('button', { name: 'Heal' }));

    const note = await screen.findByText('Fighting_Rogue is already at full HP. No focus spent.');
    expect(note).toHaveClass('healing-restriction-note');
    expect(screen.getByText('Choose target for Hand of Healing')).toBeInTheDocument();
    expect(screen.queryByText(/HP restored/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Healing failed to resolve/)).not.toBeInTheDocument();
  });

  it('a refusal does not dead-end the picker: a later damaged-target confirm still mounts the honest result', async () => {
    const confirmHeal = vi.fn()
      .mockResolvedValueOnce({ refusal: 'Fighting_Rogue is already at full HP. No focus spent.' })
      .mockResolvedValueOnce(healResultPayload);
    render(<HandOfHealingModal {...makePendingProps(confirmHeal)} />);

    fireEvent.click(screen.getByText('Fighting_Rogue'));
    fireEvent.click(screen.getByRole('button', { name: 'Heal' }));
    await screen.findByText('Fighting_Rogue is already at full HP. No focus spent.');

    fireEvent.click(screen.getByText('Bandit 1'));
    fireEvent.click(screen.getByRole('button', { name: 'Heal' }));

    await waitFor(() => {
      expect(screen.getByText(/Bandit 1 \(11 \/ 11 HP\)/)).toBeInTheDocument();
      expect(screen.getByText('10', { exact: true })).toBeInTheDocument();
      expect(screen.getByText(/HP restored/)).toBeInTheDocument();
    });
    expect(screen.queryByText('Fighting_Rogue is already at full HP. No focus spent.')).not.toBeInTheDocument();
  });

  it('Heal self on a full-HP monk routes the self refusal to the same inline note', async () => {
    const confirmHeal = vi.fn().mockResolvedValue({ refusal: 'Disciplined_Monk is already at full HP. No focus spent.' });
    render(<HandOfHealingModal {...makePendingProps(confirmHeal)} />);

    fireEvent.click(screen.getByRole('button', { name: 'Heal self' }));

    expect(await screen.findByText('Disciplined_Monk is already at full HP. No focus spent.')).toBeInTheDocument();
    expect(confirmHeal).toHaveBeenCalledWith('Disciplined_Monk');
    expect(screen.queryByText(/HP restored/)).not.toBeInTheDocument();
  });
});
