// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

const monkTarget = { name: 'Disciplined_Monk', type: 'player', currentHp: 183, maxHp: 183 };
const banditTarget = { name: 'Bandit 1', type: 'monster', currentHp: 1, maxHp: 11 };

const healResultPayload = {
  targetName: 'Bandit 1',
  formula: '1d12 + 7',
  rolls: [5],
  bonus: 7,
  healAmount: 12,
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
  });

  it('shows the target picker with every candidate and no result before a heal is confirmed', () => {
    render(<HandOfHealingModal {...makePendingProps()} />);

    expect(screen.getByText('Choose target for Hand of Healing')).toBeInTheDocument();
    expect(screen.getByText('Bandit 1')).toBeInTheDocument();
    expect(screen.getByText('Disciplined_Monk')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Heal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(screen.queryByText(/HP restored/)).not.toBeInTheDocument();
  });

  it('heals the picked target and swaps the picker for an honest result matching the payload', async () => {
    const confirmHeal = vi.fn().mockResolvedValue(healResultPayload);
    render(<HandOfHealingModal {...makePendingProps({ confirmHeal })} />);

    fireEvent.click(screen.getByText('Bandit 1'));
    fireEvent.click(screen.getByRole('button', { name: 'Heal' }));

    await waitFor(() => {
      expect(confirmHeal).toHaveBeenCalledWith('Bandit 1');
    });
    await waitFor(() => {
      expect(screen.getByText(/Bandit 1 \(11 \/ 11 HP\)/)).toBeInTheDocument();
      expect(screen.getByText('1d12 + 7:')).toBeInTheDocument();
      expect(screen.getByText(/HP restored/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Choose target/)).not.toBeInTheDocument();
  });

  it('Skip self-heals the monk instead of requiring a target pick', async () => {
    const confirmHeal = vi.fn().mockResolvedValue({ ...healResultPayload, targetName: 'Disciplined_Monk' });
    render(<HandOfHealingModal {...makePendingProps({ confirmHeal })} />);

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    await waitFor(() => {
      expect(confirmHeal).toHaveBeenCalledWith('Disciplined_Monk');
      expect(screen.getByText(/Disciplined_Monk \(11 \/ 11 HP\)/)).toBeInTheDocument();
    });
  });

  it.each([
    ['resolves null', () => vi.fn().mockResolvedValue(null)],
    ['rejects', () => vi.fn().mockRejectedValue(new Error('network down'))],
  ])('shows an honest error and never a fake result when confirmHeal %s', async (_label, makeFailingConfirm) => {
    const confirmHeal = makeFailingConfirm();
    render(<HandOfHealingModal {...makePendingProps({ confirmHeal })} />);

    fireEvent.click(screen.getByText('Disciplined_Monk'));
    fireEvent.click(screen.getByRole('button', { name: 'Heal' }));

    await waitFor(() => {
      expect(screen.getByText(/Healing failed to resolve/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/HP restored/)).not.toBeInTheDocument();
  });
});
