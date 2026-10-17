// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HealingIllusionModal from './HealingIllusionModal.jsx';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/automation/common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as healingRoll from '../../../../services/automation/common/healingRoll.js';

const mockPlayerStats = { name: 'Paladin1', level: 5, hitPoints: 40 };
const campaignName = 'test-campaign';
const mockOnClose = vi.fn();

function makeProps(overrides) {
  return {
    action: { name: 'Healing Illusion' },
    playerStats: mockPlayerStats,
    campaignName,
    onClose: mockOnClose,
    ...(overrides || {}),
  };
}

function mockHp(getCurrent, getMax) {
  useRuntimeState.getRuntimeValue.mockImplementation((name, key) => {
    if (key === 'currentHitPoints') return getCurrent(name);
    if (key === 'hitPoints') return getMax ? getMax(name) : null;
    return null;
  });
}

describe('HealingIllusionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
  });

  it.each([
    { level: 5, hp: '5 HP' },
    { level: 10, hp: '10 HP' },
    { level: 0, hp: '1 HP' },
  ])('offers $level HP of healing for cleric level $level', ({ level, hp }) => {
    render(<HealingIllusionModal {...makeProps({ playerStats: { ...mockPlayerStats, level } })} />);
    expect(screen.getByText('Healing Illusion')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Choose a target within 5 feet to regain ${hp}`))).toBeInTheDocument();
  });

  it('selects self by default and toggles between self and custom target', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    const selfRadio = screen.getByRole('radio', { name: /Paladin1 \(self\)/ });
    const customRadio = screen.getByRole('radio', { name: /Other/ });
    const customInput = screen.getByPlaceholderText('creature name');

    expect(selfRadio).toBeChecked();
    expect(customRadio).not.toBeChecked();
    expect(customInput).toBeDisabled();

    fireEvent.click(customRadio);
    expect(customRadio).toBeChecked();
    expect(customInput).not.toBeDisabled();

    fireEvent.change(customInput, { target: { value: 'Orc Warrior' } });
    expect(customInput).toHaveValue('Orc Warrior');

    fireEvent.click(selfRadio);
    expect(selfRadio).toBeChecked();
    expect(customRadio).not.toBeChecked();
  });

  it('calls onClose when the Skip button is clicked', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('heals self, logs the result, broadcasts the update, and closes via Done', async () => {
    const onSummaryUpdated = vi.fn();
    window.addEventListener('combat-summary-updated', onSummaryUpdated);
    mockHp(() => 20);

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(screen.getByText('Healing Illusion restored 5 HP to Paladin1 (Cleric level 5)')).toBeInTheDocument();
    });
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      mockPlayerStats.name, 'currentHitPoints', 25, campaignName
    );
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
      targetName: mockPlayerStats.name,
      sourceName: 'Healing Illusion',
      actualHeal: 5,
      newHp: 25,
      maxHp: 40,
    });
    expect(onSummaryUpdated).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Heal/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    window.removeEventListener('combat-summary-updated', onSummaryUpdated);
  });

  it.each([
    { currentHp: 38, newHp: 40, actualHeal: 2 },
    { currentHp: 40, newHp: 40, actualHeal: 0 },
  ])('caps self healing at playerStats max HP ($currentHp HP → $newHp HP)', async ({ currentHp, newHp, actualHeal }) => {
    mockHp(() => currentHp);

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(screen.getByText(
        `Healing Illusion restored ${actualHeal} HP to Paladin1 (Cleric level 5)`
      )).toBeInTheDocument();
    });
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      mockPlayerStats.name, 'currentHitPoints', newHp, campaignName
    );
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
      targetName: mockPlayerStats.name,
      sourceName: 'Healing Illusion',
      actualHeal,
      newHp,
      maxHp: mockPlayerStats.hitPoints,
    });
  });

  it.each([
    { currentHp: 10, newHp: 15, actualHeal: 5 },
    { currentHp: 28, newHp: 30, actualHeal: 2 },
  ])('heals a custom target and caps at its runtime max HP ($currentHp HP → $newHp HP)', async ({ currentHp, newHp, actualHeal }) => {
    mockHp(() => currentHp, () => 30);

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('radio', { name: /Other/ }));
    fireEvent.change(screen.getByPlaceholderText('creature name'), { target: { value: 'Orc Warrior' } });
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(screen.getByText(
        `Healing Illusion restored ${actualHeal} HP to Orc Warrior (Cleric level 5)`
      )).toBeInTheDocument();
    });
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Orc Warrior', 'currentHitPoints', newHp, campaignName
    );
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
      targetName: 'Orc Warrior',
      sourceName: 'Healing Illusion',
      actualHeal,
      newHp,
      maxHp: 30,
    });
  });

  it('does not heal or close when the custom target name is empty', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('radio', { name: /Other/ }));
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Heal/ })).toBeInTheDocument();
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
