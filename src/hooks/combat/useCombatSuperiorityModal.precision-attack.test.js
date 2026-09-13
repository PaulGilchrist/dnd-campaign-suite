// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCombatSuperiorityModal } from './useCombatSuperiorityModal.js';

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  executeManeuver: vi.fn(),
  onCombatSuperioritySelected: vi.fn(),
}));

import { setRuntimeValue, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { rollExpression } from '../../services/dice/diceRoller.js';
import { executeManeuver } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';

const mockPlayerStats = { name: 'Thorin', level: 5 };
const mockCampaignName = 'test-campaign';

const createLastAttackRoll = (overrides = {}) => ({
  d20: 15,
  bonus: 5,
  targetAc: 16,
  isCrit: false,
  ...overrides,
});

const createLastAttack = (overrides = {}) => ({
  damageFormula: '2d6+3',
  damageType: 'Slashing',
  damageName: 'Longsword',
  attackName: 'Longsword',
  targetName: 'Orc',
  ...overrides,
});

describe('useCombatSuperiorityModal - Precision Attack', () => {
  const defaultDiceResult = { total: 10, rolls: [4, 3], modifier: 3 };

  beforeEach(() => {
    vi.clearAllMocks();
    rollExpression.mockReturnValue(defaultDiceResult);
  });

  const renderWithModal = (overrides = {}) => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(
        overrides.playerStats || mockPlayerStats,
        overrides.campaignName || mockCampaignName,
        overrides.rollAttack || vi.fn(),
        overrides.rollDamage,
        overrides.onPopupHtml
      )
    );
    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
    });
    return result;
  };

  const confirm = async (result) => {
    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
    });
  };

  describe('hit scenarios', () => {
    it('should update lastAttackRoll with dieValue added to bonus and total, and mark as hit', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 15, bonus: 5, targetAc: 16 });
      const lastAttack = createLastAttack();
      const dieValue = 4;

      getRuntimeValue.mockImplementation((ns, key) =>
        ns === 'campaign' && key === 'lastAttack' ? lastAttack : lastAttackRoll
      );
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const rollDamage = vi.fn();
      const result = renderWithModal({ rollDamage });

      await confirm(result);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Thorin',
        'lastAttackRoll',
        expect.objectContaining({
          bonus: 9,
          total: 24,
          hit: true,
          isCrit: false,
        }),
        mockCampaignName
      );
    });

    it('should update campaign lastAttack cache with new total, hit, and isCrit when attack hits', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 15, bonus: 5, targetAc: 16 });
      const lastAttack = createLastAttack();
      const dieValue = 4;

      getRuntimeValue.mockImplementation((ns, key) =>
        ns === 'campaign' && key === 'lastAttack' ? lastAttack : lastAttackRoll
      );
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const result = renderWithModal();

      await confirm(result);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'campaign',
        'lastAttack',
        expect.objectContaining({
          total: 24,
          hit: true,
          isCrit: false,
        }),
        mockCampaignName
      );
    });

    it('should roll damage and clear pending prompt when attack hits and rollDamage is provided', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 15, bonus: 5, targetAc: 16 });
      const lastAttack = createLastAttack();
      const dieValue = 4;

      getRuntimeValue.mockImplementation((ns, key) =>
        ns === 'campaign' && key === 'lastAttack' ? lastAttack : lastAttackRoll
      );
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const rollDamage = vi.fn();
      const result = renderWithModal({ rollDamage });

      await confirm(result);

      expect(rollDamage).toHaveBeenCalledTimes(1);
      expect(rollDamage).toHaveBeenCalledWith(
        { name: 'Longsword', formula: '2d6+3', total: 10, rolls: [4, 3], modifier: 3, context: expect.objectContaining({
          damageType: 'Slashing',
          targetName: 'Orc',
          attackerName: 'Thorin',
        }) }
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Thorin',
        'pendingCombatSuperiorityPrompt',
        null,
        mockCampaignName
      );
    });

    it('should show popup instead of rolling damage when attack hits but rollDamage is null', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 15, bonus: 5, targetAc: 16 });
      const lastAttack = createLastAttack();
      const dieValue = 4;

      getRuntimeValue.mockImplementation((ns, key) =>
        ns === 'campaign' && key === 'lastAttack' ? lastAttack : lastAttackRoll
      );
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const showPopup = vi.fn();
      const result = renderWithModal({ onPopupHtml: showPopup });

      await confirm(result);

      expect(showPopup).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'automation_info',
          name: 'Precision Attack',
          description: 'Precision Attack: Added 4 to the attack roll (15 + 5 + 4 = 24). The attack now hits!',
        })
      );
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Thorin',
        'pendingCombatSuperiorityPrompt',
        null,
        mockCampaignName
      );
    });

    it('should mark as hit when newTotal exactly equals targetAc', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 15, bonus: 1, targetAc: 20 });
      const lastAttack = createLastAttack();
      const dieValue = 4;

      getRuntimeValue.mockImplementation((ns, key) =>
        ns === 'campaign' && key === 'lastAttack' ? lastAttack : lastAttackRoll
      );
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const rollDamage = vi.fn();
      const result = renderWithModal({ rollDamage });

      await confirm(result);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Thorin',
        'lastAttackRoll',
        expect.objectContaining({ hit: true, total: 20 }),
        mockCampaignName
      );
      expect(rollDamage).toHaveBeenCalledTimes(1);
    });

    it('should preserve existing isCrit when already a critical', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 18, bonus: 5, targetAc: 16, isCrit: true });
      const lastAttack = createLastAttack();
      const dieValue = 4;

      getRuntimeValue.mockImplementation((ns, key) =>
        ns === 'campaign' && key === 'lastAttack' ? lastAttack : lastAttackRoll
      );
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const result = renderWithModal();

      await confirm(result);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Thorin',
        'lastAttackRoll',
        expect.objectContaining({ isCrit: true }),
        mockCampaignName
      );
    });
  });

  describe('natural 20 edge cases', () => {
    it('should mark as crit on natural 20 even when original attack would miss', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 20, bonus: 0, targetAc: 20 });
      const lastAttack = createLastAttack();
      const dieValue = 1;

      getRuntimeValue.mockImplementation((ns, key) =>
        ns === 'campaign' && key === 'lastAttack' ? lastAttack : lastAttackRoll
      );
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const rollDamage = vi.fn();
      const result = renderWithModal({ rollDamage });

      await confirm(result);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Thorin',
        'lastAttackRoll',
        expect.objectContaining({ isCrit: true }),
        mockCampaignName
      );
      expect(rollDamage).toHaveBeenCalledTimes(1);
    });

    it('should set total correctly on natural 20 with dieValue added', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 20, bonus: 5, targetAc: 16 });
      const lastAttack = createLastAttack();
      const dieValue = 3;

      getRuntimeValue.mockImplementation((ns, key) =>
        ns === 'campaign' && key === 'lastAttack' ? lastAttack : lastAttackRoll
      );
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const result = renderWithModal();

      await confirm(result);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Thorin',
        'lastAttackRoll',
        expect.objectContaining({ isCrit: true, total: 28 }),
        mockCampaignName
      );
    });
  });

  describe('miss scenarios', () => {
    it('should mark attack as not hit when newTotal < targetAc', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 8, bonus: 2, targetAc: 18 });
      const lastAttack = createLastAttack();
      const dieValue = 3;

      getRuntimeValue.mockImplementation((ns, key) =>
        ns === 'campaign' && key === 'lastAttack' ? lastAttack : lastAttackRoll
      );
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const result = renderWithModal();

      await confirm(result);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Thorin',
        'lastAttackRoll',
        expect.objectContaining({ hit: false, total: 13 }),
        mockCampaignName
      );
    });

    it('should show popup indicating attack still misses', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 8, bonus: 2, targetAc: 18 });
      const lastAttack = createLastAttack();
      const dieValue = 3;

      getRuntimeValue.mockImplementation((ns, key) =>
        ns === 'campaign' && key === 'lastAttack' ? lastAttack : lastAttackRoll
      );
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const showPopup = vi.fn();
      const result = renderWithModal({ onPopupHtml: showPopup });

      await confirm(result);

      expect(showPopup).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'automation_info',
          name: 'Precision Attack',
          description: 'Precision Attack: Added 3 to the attack roll (8 + 2 + 3 = 13). The attack still misses.',
        })
      );
    });

    it('should not roll damage when attack misses', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 8, bonus: 2, targetAc: 18 });
      const lastAttack = createLastAttack();
      const dieValue = 3;

      getRuntimeValue.mockImplementation((ns, key) =>
        ns === 'campaign' && key === 'lastAttack' ? lastAttack : lastAttackRoll
      );
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const rollDamage = vi.fn();
      const result = renderWithModal({ rollDamage });

      await confirm(result);

      expect(rollDamage).not.toHaveBeenCalled();
    });

    it('should not clear pendingCombatSuperiorityPrompt when attack misses', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 8, bonus: 2, targetAc: 18 });
      const lastAttack = createLastAttack();
      const dieValue = 3;

      getRuntimeValue.mockImplementation((ns, key) =>
        ns === 'campaign' && key === 'lastAttack' ? lastAttack : lastAttackRoll
      );
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const result = renderWithModal();

      await confirm(result);

      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Thorin',
        'pendingCombatSuperiorityPrompt',
        null,
        mockCampaignName
      );
    });
  });

  describe('boundary and edge cases', () => {
    it('should handle undefined bonus by defaulting to 0', async () => {
      const lastAttackRoll = { d20: 15, bonus: undefined, targetAc: 16, isCrit: false };
      const lastAttack = createLastAttack();
      const dieValue = 4;

      getRuntimeValue.mockImplementation((ns, key) =>
        ns === 'campaign' && key === 'lastAttack' ? lastAttack : lastAttackRoll
      );
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const result = renderWithModal();

      await confirm(result);

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Thorin',
        'lastAttackRoll',
        expect.objectContaining({ bonus: 4, total: 19 }),
        mockCampaignName
      );
    });

    it('should skip precision attack logic when lastAttackRoll.d20 is null', async () => {
      const lastAttackRoll = { d20: null, bonus: 5, targetAc: 16 };
      const lastAttack = { damageFormula: '2d6+3' };

      getRuntimeValue.mockImplementation((ns, key) =>
        ns === 'campaign' && key === 'lastAttack' ? lastAttack : lastAttackRoll
      );
      executeManeuver.mockResolvedValue({
        effect: 'attack_roll_bonus',
        dieValue: 4,
        logEntries: [{ type: 'ability_use', characterName: 'Thorin', abilityName: 'Precision Attack', description: 'Test' }],
      });

      const result = renderWithModal();

      await confirm(result);

      const lastAttackRollCalls = setRuntimeValue.mock.calls.filter(
        call => call[0] === 'Thorin' && call[1] === 'lastAttackRoll'
      );
      expect(lastAttackRollCalls).toHaveLength(0);
    });

    it('should skip precision attack logic when lastAttackRoll.targetAc is null', async () => {
      const lastAttackRoll = { d20: 15, bonus: 5, targetAc: null };
      const lastAttack = { damageFormula: '2d6+3' };

      getRuntimeValue.mockImplementation((ns, key) =>
        ns === 'campaign' && key === 'lastAttack' ? lastAttack : lastAttackRoll
      );
      executeManeuver.mockResolvedValue({
        effect: 'attack_roll_bonus',
        dieValue: 4,
      });

      const result = renderWithModal();

      await confirm(result);

      const lastAttackRollCalls = setRuntimeValue.mock.calls.filter(
        call => call[0] === 'Thorin' && call[1] === 'lastAttackRoll'
      );
      expect(lastAttackRollCalls).toHaveLength(0);
    });

    it('should skip precision attack logic when lastAttack has no damageFormula', async () => {
      const lastAttackRoll = { d20: 15, bonus: 5, targetAc: 16 };
      const lastAttack = { damageFormula: null };

      getRuntimeValue.mockImplementation((ns, key) =>
        ns === 'campaign' && key === 'lastAttack' ? lastAttack : lastAttackRoll
      );
      executeManeuver.mockResolvedValue({
        effect: 'attack_roll_bonus',
        dieValue: 4,
      });

      const result = renderWithModal();

      await confirm(result);

      const lastAttackRollCalls = setRuntimeValue.mock.calls.filter(
        call => call[0] === 'Thorin' && call[1] === 'lastAttackRoll'
      );
      expect(lastAttackRollCalls).toHaveLength(0);
    });
  });

  describe('logging', () => {
    it('should log ability_use entry with correct description format on precision attack', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 8, bonus: 2, targetAc: 18 });
      const lastAttack = createLastAttack();
      const dieValue = 3;

      getRuntimeValue.mockImplementation((ns, key) =>
        ns === 'campaign' && key === 'lastAttack' ? lastAttack : lastAttackRoll
      );
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const result = renderWithModal();

      await confirm(result);

      expect(addEntry).toHaveBeenCalledWith(
        mockCampaignName,
        expect.objectContaining({
          type: 'ability_use',
          abilityName: 'Precision Attack',
          description: expect.stringContaining('Precision Attack: Added 3'),
        })
      );
    });

    it('should include characterName from playerStats in log entry', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 15, bonus: 5, targetAc: 16 });
      const lastAttack = createLastAttack();
      const dieValue = 4;

      getRuntimeValue.mockImplementation((ns, key) =>
        ns === 'campaign' && key === 'lastAttack' ? lastAttack : lastAttackRoll
      );
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const playerStats = { name: 'Grimjaw', level: 7 };
      const campaignName = 'mythic-raids';

      const { result } = renderHook(
        () => useCombatSuperiorityModal(playerStats, campaignName, vi.fn(), vi.fn(), vi.fn())
      );
      act(() => {
        result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
      });

      await act(async () => {
        await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
      });

      expect(addEntry).toHaveBeenCalledWith(
        campaignName,
        expect.objectContaining({
          characterName: 'Grimjaw',
          abilityName: 'Precision Attack',
        })
      );
    });
  });
});
