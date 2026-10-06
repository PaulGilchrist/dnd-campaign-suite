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

describe('CLA-159 HandOfHealingModal target picker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the picker stage first — no result shown before target picked', () => {
    render(<HandOfHealingModal {...makePendingProps()} />);

    expect(screen.getByText('Choose target for Hand of Healing')).toBeInTheDocument();
    expect(screen.getByText('Bandit 1')).toBeInTheDocument();
    expect(screen.queryByText(/HP restored/)).not.toBeInTheDocument();
  });

  it('confirms heal on the selected target and renders honest result with target name + formula', async () => {
    const confirmHeal = vi.fn().mockResolvedValue(healResultPayload);
    render(<HandOfHealingModal {...makePendingProps({ confirmHeal })} />);

    fireEvent.click(screen.getByText('Bandit 1'));
    fireEvent.click(screen.getByText('Heal'));

    await waitFor(() => {
      expect(confirmHeal).toHaveBeenCalledWith('Bandit 1');
    });
    await waitFor(() => {
      expect(screen.getByText(/Bandit 1 \(11 \/ 11 HP\)/)).toBeInTheDocument();
      expect(screen.getByText('1d12 + 7:')).toBeInTheDocument();
      expect(screen.getByText(/HP restored/)).toBeInTheDocument();
    });
  });

  it('skip self-selects the monk (self-heal remains selectable)', async () => {
    const confirmHeal = vi.fn().mockResolvedValue({ ...healResultPayload, targetName: 'Disciplined_Monk' });
    render(<HandOfHealingModal {...makePendingProps({ confirmHeal })} />);

    fireEvent.click(screen.getByText('Skip'));

    await waitFor(() => {
      expect(confirmHeal).toHaveBeenCalledWith('Disciplined_Monk');
    });
  });

  it('shows an honest error instead of a fake result when confirm returns nothing', async () => {
    const confirmHeal = vi.fn().mockResolvedValue(null);
    render(<HandOfHealingModal {...makePendingProps({ confirmHeal })} />);

    fireEvent.click(screen.getByText('Disciplined_Monk'));
    fireEvent.click(screen.getByText('Heal'));

    await waitFor(() => {
      expect(screen.getByText(/Healing failed to resolve/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/HP restored/)).not.toBeInTheDocument();
  });

  it('non-pending lane renders the result directly (armed/self direct heal)', () => {
    render(<HandOfHealingModal
      healName="Hand of Healing"
      monkName="Disciplined_Monk"
      campaignName="test-campaign"
      targetName="Bandit 1"
      formula="1d12 + 7"
      rolls={[5]}
      bonus={7}
      healAmount={12}
      targetCurrentHp={11}
      targetMaxHp={11}
      onClose={vi.fn()}
    />);

    expect(screen.getByText(/Bandit 1 \(11 \/ 11 HP\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Choose target/)).not.toBeInTheDocument();
  });
});
