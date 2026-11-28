// @maintained-by-ai 2026-11-27
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
const onSummaryUpdated = vi.fn();

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

async function healCustomTarget(current, max) {
  mockHp(() => current, () => max);
  render(<HealingIllusionModal {...makeProps()} />);
  fireEvent.click(screen.getByRole('radio', { name: /Other/ }));
  fireEvent.change(screen.getByPlaceholderText('creature name'), { target: { value: 'Orc Warrior' } });
  fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
}

describe('HealingIllusionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.getRuntimeValue.mockReturnValue(null);
    useRuntimeState.setRuntimeValue.mockResolvedValue(undefined);
    window.addEventListener('combat-summary-updated', onSummaryUpdated);
  });

  afterEach(() => {
    window.removeEventListener('combat-summary-updated', onSummaryUpdated);
  });

  it.each([
    { level: 10, hp: '10 HP' },
    { level: 0, hp: '1 HP' },
  ])('offers $level HP of healing for cleric level $level, falling back to 1 at level 0', ({ level, hp }) => {
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

  it('does not heal or close when the custom target name is empty', async () => {
    // HP resolves fully: only the empty-name guard can stop the heal.
    mockHp(() => 10, () => 30);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('radio', { name: /Other/ }));
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(onSummaryUpdated).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Heal/ })).toBeInTheDocument();
    expect(mockOnClose).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('heals self, logs the result, broadcasts the update, and closes via Done', async () => {
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
    // Result view replaces the action buttons; Done closes.
    expect(screen.queryByRole('button', { name: /Heal/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the Skip button is clicked', () => {
    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
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

  it('heals a custom target using its runtime max HP and caps at it', async () => {
    await healCustomTarget(28, 30);

    await waitFor(() => {
      expect(screen.getByText(
        'Healing Illusion restored 2 HP to Orc Warrior (Cleric level 5)'
      )).toBeInTheDocument();
    });
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Orc Warrior', 'currentHitPoints', 30, campaignName
    );
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith(campaignName, {
      targetName: 'Orc Warrior',
      sourceName: 'Healing Illusion',
      actualHeal: 2,
      newHp: 30,
      maxHp: 30,
    });
    expect(onSummaryUpdated).toHaveBeenCalledTimes(1);
  });

  it('treats a stored 0 HP target as real damage state, not unset: heals to level amount exactly', async () => {
    await healCustomTarget(0, 30);

    await waitFor(() => {
      expect(screen.getByText(
        'Healing Illusion restored 5 HP to Orc Warrior (Cleric level 5)'
      )).toBeInTheDocument();
    });
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Orc Warrior', 'currentHitPoints', 5, campaignName
    );
  });

  it('refuses to heal a custom target with unset runtime max HP: console.error, no write, no log, stays open', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockHp(() => 10); // hitPoints stays null (unset) for the custom target

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('radio', { name: /Other/ }));
    fireEvent.change(screen.getByPlaceholderText('creature name'), { target: { value: 'Orc Warrior' } });
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          /\[HealingIllusionModal\] Refusing heal for Orc Warrior: unresolved runtime HP values \(currentHitPoints=10, maxHp=null\)\. No write performed\./
        )
      );
    });
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Heal/ })).toBeInTheDocument();
    expect(mockOnClose).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('refuses to heal self when runtime currentHitPoints is unset: console.error, no write', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockHp(() => null); // currentHitPoints unset

    render(<HealingIllusionModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /Heal/ }));

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(
          /\[HealingIllusionModal\] Refusing heal for Paladin1: unresolved runtime HP values \(currentHitPoints=null, maxHp=40\)\. No write performed\./
        )
      );
    });
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Heal/ })).toBeInTheDocument();
    errorSpy.mockRestore();
  });
});
