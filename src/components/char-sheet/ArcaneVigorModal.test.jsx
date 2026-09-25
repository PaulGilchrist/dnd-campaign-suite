// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ArcaneVigorModal from './ArcaneVigorModal.jsx';

const getRuntimeValueMock = vi.fn(() => null);
const setRuntimeValueMock = vi.fn();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  useRuntimeValue: vi.fn(() => null),
  listeners: new Map(),
  getRuntimeValue: vi.fn((...args) => getRuntimeValueMock(...args)),
  setRuntimeValue: vi.fn((...args) => setRuntimeValueMock(...args)),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollDice: vi.fn((count, _die) => ({ total: count * 4, rolls: Array(count).fill(4) })),
}));

const getCombatContextMock = vi.fn(() => Promise.resolve(null));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: (...args) => getCombatContextMock(...args),
}));

const applyHealingToTargetMock = vi.fn(() => null);
vi.mock('../../services/rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: (...args) => applyHealingToTargetMock(...args),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

import { addEntry } from '../../services/ui/logService.js';

const mockCampaignName = 'test-campaign';

function createProps(overrides = {}) {
  return {
    hitDieSize: 8,
    spellcastingAbility: 'INT',
    spellcastingAbilityModifier: 3,
    diceCount: 2,
    slotLevel: 2,
    playerName: 'Elyra',
    campaignName: mockCampaignName,
    onClose: vi.fn(),
    onComplete: vi.fn(),
    ...overrides,
  };
}

function renderModal(overrides = {}) {
  const props = createProps(overrides);
  const rendered = render(<ArcaneVigorModal {...props} />);
  return { ...rendered, onClose: props.onClose, onComplete: props.onComplete, props };
}

describe('ArcaneVigorModal', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    getRuntimeValueMock.mockImplementation(() => null);
    getCombatContextMock.mockResolvedValue(null);
    applyHealingToTargetMock.mockReturnValue(null);
  });

  describe('initial render', () => {
    it('displays the modal title and description text', () => {
      renderModal();
      expect(screen.getByText('Arcane Vigor')).toBeInTheDocument();
      expect(screen.getByText(/roll total \+ 3/)).toBeInTheDocument();
    });

    it('displays the ability modifier in the description', () => {
      renderModal({ spellcastingAbilityModifier: -2 });
      expect(screen.getByText(/roll total \+ -2 \(INT modifier\)/)).toBeInTheDocument();
    });

    it('displays all action buttons', () => {
      renderModal();
      expect(screen.getByRole('button', { name: /Roll One/ })).toBeInTheDocument();
      expect(screen.getByText('Apply Healing')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('shows hit dice info with stored value when available', () => {
      getRuntimeValueMock.mockImplementation((_name, key) => {
        if (key === 'shortRestHitDice') return 5;
        return null;
      });
      renderModal({ diceCount: 6 });
      expect(screen.getByText(/5 of 5 remaining/)).toBeInTheDocument();
    });

    it('uses diceCount as fallback display when shortRestHitDice is null', () => {
      renderModal({ diceCount: 4 });
      expect(screen.getByText(/up to 4 dice/)).toBeInTheDocument();
    });

    it('shows zero available hit dice when none remain', () => {
      getRuntimeValueMock.mockImplementation((_name, key) => {
        if (key === 'shortRestHitDice') return 0;
        return null;
      });
      renderModal();
      expect(screen.getByText(/0 of 0 remaining/)).toBeInTheDocument();
    });

    it('disables the roll button when no hit dice remain', () => {
      getRuntimeValueMock.mockImplementation((_name, key) => {
        if (key === 'shortRestHitDice') return 0;
        return null;
      });
      renderModal();
      expect(screen.getByRole('button', { name: /Roll One/ })).toBeDisabled();
    });

    it('disables the apply healing button before any dice are rolled', () => {
      renderModal();
      expect(screen.getByText('Apply Healing')).toBeDisabled();
    });

    it('does not show roll results before rolling', () => {
      renderModal();
      expect(screen.queryByText(/Roll Total:/)).not.toBeInTheDocument();
    });

    it('does not show healing applied message before applying', () => {
      renderModal();
      expect(screen.queryByText(/HP healed/)).not.toBeInTheDocument();
    });
  });

  describe('rolling dice', () => {
    it('displays the die roll result and projected healing after rolling', () => {
      renderModal({ spellcastingAbilityModifier: 3 });
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      expect(screen.getByText('d8 = 4')).toBeInTheDocument();
      expect(screen.getByText(/Roll Total: 4 \+ 3 = 7 HP/)).toBeInTheDocument();
    });

    it('accumulates projected healing across multiple rolls', () => {
      renderModal({ spellcastingAbilityModifier: 3 });
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      expect(screen.getByText(/Roll Total: 8 \+ 3 = 11 HP/)).toBeInTheDocument();
    });

    it('calculates projected healing with negative and zero ability modifiers', () => {
      renderModal({ spellcastingAbilityModifier: -1 });
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      expect(screen.getByText(/Roll Total: 4 \+ -1 = 3 HP/)).toBeInTheDocument();

      cleanup();
      renderModal({ spellcastingAbilityModifier: -4 });
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      expect(screen.getByText(/Roll Total: 4 \+ -4 = 0 HP/)).toBeInTheDocument();
    });

    it('updates the remaining hit dice count after rolling', () => {
      getRuntimeValueMock.mockImplementation((_name, key) => {
        if (key === 'shortRestHitDice') return 3;
        return null;
      });
      renderModal();
      expect(screen.getByText(/3 of 3 remaining/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      expect(screen.getByText(/2 of 3 remaining/)).toBeInTheDocument();
    });

    it('disables the roll button after using all available hit dice', () => {
      getRuntimeValueMock.mockImplementation((_name, key) => {
        if (key === 'shortRestHitDice') return 1;
        return null;
      });
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      expect(screen.getByRole('button', { name: /Roll One/ })).toBeDisabled();
    });

    it('displays the correct die size in the roll button label', () => {
      renderModal({ hitDieSize: 10 });
      expect(screen.getByRole('button', { name: /Roll One \(d10\)/ })).toBeInTheDocument();
    });
  });

  describe('applying healing', () => {
    it('calls onComplete after applying healing', async () => {
      const onComplete = vi.fn();
      renderModal({ onComplete });
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByText('Apply Healing'));
      await waitFor(() => expect(onComplete).toHaveBeenCalled());
    });

    it('displays the actual HP healed from combat context', async () => {
      const combatSummary = {
        creatures: [{ name: 'Elyra', hp: 10, maxHp: 20 }],
      };
      getCombatContextMock.mockResolvedValue(combatSummary);
      applyHealingToTargetMock.mockReturnValue({ actualHeal: 7, newHp: 17, oldHp: 10 });
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByText('Apply Healing'));
      await waitFor(() => expect(screen.getByText(/7 HP healed/)).toBeInTheDocument());
    });

    it('displays 0 HP healed when healing cannot be applied', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByText('Apply Healing'));
      await waitFor(() => expect(screen.getByText(/0 HP healed/)).toBeInTheDocument());

      cleanup();
      const combatSummary = {
        creatures: [{ name: 'OtherPlayer', hp: 10, maxHp: 20 }],
      };
      vi.clearAllMocks();
      getCombatContextMock.mockResolvedValue(combatSummary);
      applyHealingToTargetMock.mockReturnValue(null);
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByText('Apply Healing'));
      await waitFor(() => expect(screen.getByText(/0 HP healed/)).toBeInTheDocument());
    });

    it('disables all buttons after healing is applied', async () => {
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByText('Apply Healing'));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Roll One/ })).toBeDisabled();
        expect(screen.getByText('Apply Healing')).toBeDisabled();
        expect(screen.getByText('Cancel')).toBeDisabled();
      });
    });

    it('displays the consumed dice count in the applied message', async () => {
      getRuntimeValueMock.mockImplementation((_name, key) => {
        if (key === 'shortRestHitDice') return 5;
        return null;
      });
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByText('Apply Healing'));
      await waitFor(() => expect(screen.getByText(/2 hit dice consumed/)).toBeInTheDocument());
    });

    it('does not apply healing when no dice have been rolled', async () => {
      renderModal();
      fireEvent.click(screen.getByText('Apply Healing'));
      await waitFor(() => expect(screen.queryByText(/HP healed/)).not.toBeInTheDocument());
      expect(setRuntimeValueMock).not.toHaveBeenCalled();
    });

    it('applies healing only once even if the button is clicked multiple times', async () => {
      const onComplete = vi.fn();
      renderModal({ onComplete });
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByText('Apply Healing'));
      await waitFor(() => expect(screen.getByText(/HP healed/)).toBeInTheDocument());
      fireEvent.click(screen.getByText('Apply Healing'));
      await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    });
  });

  describe('hit dice consumption', () => {
    it('decrements shortRestHitDice by the number of dice rolled', async () => {
      getRuntimeValueMock.mockImplementation((_name, key) => {
        if (key === 'shortRestHitDice') return 5;
        return null;
      });
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByText('Apply Healing'));
      await waitFor(() => {
        expect(setRuntimeValueMock).toHaveBeenCalledWith('Elyra', 'shortRestHitDice', 3, mockCampaignName);
      });
    });

    it('uses diceCount as fallback when stored hit dice is null', async () => {
      getRuntimeValueMock.mockImplementation(() => null);
      renderModal({ diceCount: 3 });
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByText('Apply Healing'));
      await waitFor(() => {
        expect(setRuntimeValueMock).toHaveBeenCalledWith('Elyra', 'shortRestHitDice', 1, mockCampaignName);
      });
    });

    it('does not decrement below zero', async () => {
      getRuntimeValueMock.mockImplementation((_name, key) => {
        if (key === 'shortRestHitDice') return 1;
        return null;
      });
      renderModal({ diceCount: 5 });
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByText('Apply Healing'));
      await waitFor(() => {
        expect(setRuntimeValueMock).toHaveBeenCalledWith('Elyra', 'shortRestHitDice', 0, mockCampaignName);
      });
    });
  });

  describe('cancellation', () => {
    it('calls onClose without calling onComplete', () => {
      const onClose = vi.fn();
      const onComplete = vi.fn();
      renderModal({ onClose, onComplete });
      fireEvent.click(screen.getByText('Cancel'));
      expect(onClose).toHaveBeenCalled();
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('does not log when cancelled', () => {
      renderModal();
      fireEvent.click(screen.getByText('Cancel'));
      expect(addEntry).not.toHaveBeenCalled();

      cleanup();
      vi.clearAllMocks();
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByText('Cancel'));
      expect(addEntry).not.toHaveBeenCalled();
    });

    it('does not modify hit dice when cancelled after rolling', () => {
      getRuntimeValueMock.mockImplementation((_name, key) => {
        if (key === 'shortRestHitDice') return 5;
        return null;
      });
      renderModal();
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByText('Cancel'));
      expect(setRuntimeValueMock).not.toHaveBeenCalled();
    });

    it('does not close when the overlay background is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      const overlay = document.querySelector('.arcane-vigor-overlay');
      fireEvent.click(overlay);
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByText('Arcane Vigor')).toBeInTheDocument();
    });

    it('does not close when modal content is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });
      fireEvent.click(screen.getByRole('heading', { name: 'Arcane Vigor' }));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('logging', () => {
    it('logs a spell entry with all expected fields', async () => {
      renderModal({ hitDieSize: 10, spellcastingAbilityModifier: 3, slotLevel: 4, playerName: 'TestChar' });
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByText('Apply Healing'));
      await waitFor(() => expect(addEntry).toHaveBeenCalled());
      const spellEntry = addEntry.mock.calls[0][1];
      expect(spellEntry).toMatchObject({
        type: 'spell',
        characterName: 'TestChar',
        targetName: 'TestChar',
        spellName: 'Arcane Vigor',
        spellLevel: 4,
        castingTime: 'Bonus Action',
        diceRolled: 1,
        hitDieSize: 10,
        rollTotal: 4,
        abilityModifier: 3,
        healing: 0,
        hitDiceRemaining: 1,
      });
      expect(typeof spellEntry.timestamp).toBe('number');
    });

    it('logs the correct dice count and remaining hit dice for multiple rolls', async () => {
      getRuntimeValueMock.mockImplementation((_name, key) => {
        if (key === 'shortRestHitDice') return 5;
        return null;
      });
      renderModal({ hitDieSize: 8 });
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByText('Apply Healing'));
      await waitFor(() => {
        const spellEntry = addEntry.mock.calls[0][1];
        expect(spellEntry.diceRolled).toBe(3);
        expect(spellEntry.hitDiceRemaining).toBe(2);
      });
    });

    it('logs an hp_change entry with all expected fields', async () => {
      renderModal({ hitDieSize: 8, spellcastingAbilityModifier: 3, playerName: 'Caster' });
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByText('Apply Healing'));
      await waitFor(() => expect(addEntry).toHaveBeenCalledTimes(2));
      const hpEntry = addEntry.mock.calls[1][1];
      expect(hpEntry).toMatchObject({
        type: 'hp_change',
        targetName: 'Caster',
        delta: 0,
        isHealing: true,
        sourceName: 'Caster',
        note: 'Arcane Vigor',
        formula: '1d8 + 3',
      });
      expect(typeof hpEntry.timestamp).toBe('number');
    });

    it('passes the campaign name to both log entries', async () => {
      renderModal({ campaignName: 'my-campaign' });
      fireEvent.click(screen.getByRole('button', { name: /Roll One/ }));
      fireEvent.click(screen.getByText('Apply Healing'));
      await waitFor(() => {
        expect(addEntry.mock.calls[0][0]).toBe('my-campaign');
        expect(addEntry.mock.calls[1][0]).toBe('my-campaign');
      });
    });
  });
});
