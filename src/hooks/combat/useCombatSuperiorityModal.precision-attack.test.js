// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest';
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

vi.mock('../../services/encounters/combatData.js', () => ({
  loadCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../config/ui-config.js', () => ({
  SHOW_DICE_ROLL_DELAY: 2000,
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  executeManeuver: vi.fn(),
  onCombatSuperioritySelected: vi.fn(),
}));

import { executeManeuver } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';
import { setRuntimeValue, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { loadCombatSummary, setCombatSummaryCache } from '../../services/encounters/combatData.js';
import { rollExpression } from '../../services/dice/diceRoller.js';

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

const defaultDiceResult = { total: 10, rolls: [4, 3], modifier: 3 };

describe('useCombatSuperiorityModal - handleCombatSuperityConfirm (attack_roll_bonus / Precision Attack)', () => {
  const mockPlayerStats = { name: 'Thorin', level: 5 };
  const mockCampaignName = 'test-campaign';

  beforeEach(() => {
    vi.clearAllMocks();
    rollExpression.mockReturnValue(defaultDiceResult);
  });

  describe('successful attack hit scenarios', () => {
    it('should update lastAttackRoll with added dieValue to bonus and total, and mark as hit when newTotal >= targetAc', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 15, bonus: 5, targetAc: 16, isCrit: false });
      const lastAttack = createLastAttack();
      const dieValue = 4;

      getRuntimeValue.mockReturnValue(lastAttackRoll);
      loadCombatSummary.mockResolvedValue({ lastAttack });
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const rollDamage = vi.fn();
      const showPopup = vi.fn();

      const { result } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, vi.fn(), rollDamage, showPopup)
      );

      act(() => {
        result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
      });

      await act(async () => {
        await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
      });

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

      expect(rollDamage).toHaveBeenCalledTimes(1);
      expect(rollDamage).toHaveBeenCalledWith(
        'Longsword',
        '2d6+3',
        10,
        [4, 3],
        3,
        expect.objectContaining({
          damageType: 'Slashing',
          targetName: 'Orc',
          attackerName: 'Thorin',
        })
      );
    });

    it('should mark attack as natural 20 crit when d20 is 20 regardless of dieValue', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 20, bonus: 5, targetAc: 16, isCrit: false });
      const lastAttack = createLastAttack();
      const dieValue = 3;

      getRuntimeValue.mockReturnValue(lastAttackRoll);
      loadCombatSummary.mockResolvedValue({ lastAttack });
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const { result } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, vi.fn(), vi.fn(), vi.fn())
      );

      act(() => {
        result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
      });

      await act(async () => {
        await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
      });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Thorin',
        'lastAttackRoll',
        expect.objectContaining({
          isCrit: true,
          total: 28,
        }),
        mockCampaignName
      );
    });

    it('should roll damage when attack transitions from miss to hit via precision attack', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 15, bonus: 2, targetAc: 16, isCrit: false });
      const lastAttack = createLastAttack();
      const dieValue = 4;

      getRuntimeValue.mockReturnValue(lastAttackRoll);
      loadCombatSummary.mockResolvedValue({ lastAttack });
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const rollDamage = vi.fn();

      const { result } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, vi.fn(), rollDamage, vi.fn())
      );

      act(() => {
        result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
      });

      await act(async () => {
        await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
      });

      expect(rollDamage).toHaveBeenCalledTimes(1);
    });

    it('should set pendingCombatSuperiorityPrompt to null after rolling damage', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 15, bonus: 2, targetAc: 16, isCrit: false });
      const lastAttack = createLastAttack();

      getRuntimeValue.mockReturnValue(lastAttackRoll);
      loadCombatSummary.mockResolvedValue({ lastAttack });
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue: 4 });

      const { result } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, vi.fn(), vi.fn(), vi.fn())
      );

      act(() => {
        result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
      });

      await act(async () => {
        await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
      });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Thorin',
        'pendingCombatSuperiorityPrompt',
        null,
        mockCampaignName
      );
    });
  });

  describe('miss scenarios', () => {
    it('should show still misses popup when attack still misses after adding dieValue', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 8, bonus: 2, targetAc: 18, isCrit: false });
      const lastAttack = createLastAttack();
      const dieValue = 3;

      getRuntimeValue.mockReturnValue(lastAttackRoll);
      loadCombatSummary.mockResolvedValue({ lastAttack });
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const showPopup = vi.fn();

      const { result } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, vi.fn(), null, showPopup)
      );

      act(() => {
        result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
      });

      await act(async () => {
        await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
      });

      expect(showPopup).toHaveBeenCalledWith(expect.objectContaining({
        type: 'automation_info',
        name: 'Precision Attack',
        description: expect.stringContaining('still misses'),
      }));
    });

    it('should mark attack as not hit when newTotal < targetAc', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 8, bonus: 2, targetAc: 18, isCrit: false });
      const lastAttack = createLastAttack();
      const dieValue = 3;

      getRuntimeValue.mockReturnValue(lastAttackRoll);
      loadCombatSummary.mockResolvedValue({ lastAttack });
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const { result } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, vi.fn(), null, vi.fn())
      );

      act(() => {
        result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
      });

      await act(async () => {
        await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
      });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Thorin',
        'lastAttackRoll',
        expect.objectContaining({
          hit: false,
          total: 13,
        }),
        mockCampaignName
      );
    });
  });

  describe('boundary and edge cases', () => {
    it('should mark as hit when newTotal exactly equals targetAc', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 15, bonus: 1, targetAc: 20, isCrit: false });
      const lastAttack = createLastAttack();
      const dieValue = 4;

      getRuntimeValue.mockReturnValue(lastAttackRoll);
      loadCombatSummary.mockResolvedValue({ lastAttack });
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const rollDamage = vi.fn();

      const { result } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, vi.fn(), rollDamage, vi.fn())
      );

      act(() => {
        result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
      });

      await act(async () => {
        await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
      });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Thorin',
        'lastAttackRoll',
        expect.objectContaining({
          hit: true,
          total: 20,
        }),
        mockCampaignName
      );

      expect(rollDamage).toHaveBeenCalledTimes(1);
    });

    it('should handle lastAttackRoll with undefined bonus by defaulting to 0', async () => {
      const lastAttackRoll = { d20: 15, bonus: undefined, targetAc: 16, isCrit: false };
      const lastAttack = createLastAttack();
      const dieValue = 4;

      getRuntimeValue.mockReturnValue(lastAttackRoll);
      loadCombatSummary.mockResolvedValue({ lastAttack });
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const { result } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, vi.fn(), vi.fn(), vi.fn())
      );

      act(() => {
        result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
      });

      await act(async () => {
        await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
      });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'Thorin',
        'lastAttackRoll',
        expect.objectContaining({
          bonus: 4,
          total: 19,
        }),
        mockCampaignName
      );
    });

    it('should skip precision attack logic when lastAttackRoll.d20 is null', async () => {
      const lastAttackRoll = { d20: null, bonus: 5, targetAc: 16 };
      const lastAttack = { damageFormula: '2d6+3' };

      getRuntimeValue.mockReturnValue(lastAttackRoll);
      loadCombatSummary.mockResolvedValue({ lastAttack });

      executeManeuver.mockResolvedValue({
        effect: 'attack_roll_bonus',
        dieValue: 4,
        logEntries: [{ type: 'ability_use', characterName: 'Thorin', abilityName: 'Precision Attack', description: 'Test' }],
      });

      const { result } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, vi.fn(), vi.fn())
      );

      act(() => {
        result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
      });

      await act(async () => {
        await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
      });

      expect(addEntry).toHaveBeenCalled();
    });

    it('should skip precision attack logic when lastAttackRoll.targetAc is null', async () => {
      const lastAttackRoll = { d20: 15, bonus: 5, targetAc: null };
      const lastAttack = { damageFormula: '2d6+3' };

      getRuntimeValue.mockReturnValue(lastAttackRoll);
      loadCombatSummary.mockResolvedValue({ lastAttack });

      executeManeuver.mockResolvedValue({
        effect: 'attack_roll_bonus',
        dieValue: 4,
      });

      const { result } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, vi.fn(), vi.fn())
      );

      act(() => {
        result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
      });

      await act(async () => {
        await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
      });

      const lastAttackRollCalls = setRuntimeValue.mock.calls.filter(
        call => call[0] === 'Thorin' && call[1] === 'lastAttackRoll'
      );
      expect(lastAttackRollCalls).toHaveLength(0);
    });

    it('should skip precision attack logic when lastAttack has no damageFormula', async () => {
      const lastAttackRoll = { d20: 15, bonus: 5, targetAc: 16 };
      const lastAttack = { damageFormula: null };

      getRuntimeValue.mockReturnValue(lastAttackRoll);
      loadCombatSummary.mockResolvedValue({ lastAttack });

      executeManeuver.mockResolvedValue({
        effect: 'attack_roll_bonus',
        dieValue: 4,
      });

      const { result } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, vi.fn(), vi.fn())
      );

      act(() => {
        result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
      });

      await act(async () => {
        await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
      });

      const lastAttackRollCalls = setRuntimeValue.mock.calls.filter(
        call => call[0] === 'Thorin' && call[1] === 'lastAttackRoll'
      );
      expect(lastAttackRollCalls).toHaveLength(0);
    });
  });

  describe('combat summary cache and logging', () => {
    it('should update combat summary cache with new total, hit, and isCrit when attack hits', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 15, bonus: 5, targetAc: 16, isCrit: false });
      const lastAttack = createLastAttack();
      const dieValue = 4;

      getRuntimeValue.mockReturnValue(lastAttackRoll);
      loadCombatSummary.mockResolvedValue({ lastAttack });
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const { result } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, vi.fn(), vi.fn(), vi.fn())
      );

      act(() => {
        result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
      });

      await act(async () => {
        await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
      });

      expect(setCombatSummaryCache).toHaveBeenCalled();
      const cachedCs = setCombatSummaryCache.mock.calls[0][0];
      expect(cachedCs.lastAttack).toEqual(
        expect.objectContaining({
          total: 24,
          hit: true,
          isCrit: false,
        })
      );
    });

    it('should log ability_use entry with correct description format on precision attack', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 8, bonus: 2, targetAc: 18, isCrit: false });
      const lastAttack = createLastAttack();
      const dieValue = 3;

      getRuntimeValue.mockReturnValue(lastAttackRoll);
      loadCombatSummary.mockResolvedValue({ lastAttack });
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const { result } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, vi.fn(), null, vi.fn())
      );

      act(() => {
        result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
      });

      await act(async () => {
        await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
      });

      expect(addEntry).toHaveBeenCalledWith(
        mockCampaignName,
        expect.objectContaining({
          type: 'ability_use',
          abilityName: 'Precision Attack',
          description: expect.stringContaining('Precision Attack: Added 3'),
        })
      );
    });

    it('should include characterName in log entry', async () => {
      const playerStats = { name: 'Grimjaw', level: 7 };
      const campaignName = 'mythic-raids';
      const lastAttackRoll = createLastAttackRoll({ d20: 15, bonus: 5, targetAc: 16, isCrit: false });
      const lastAttack = createLastAttack();

      getRuntimeValue.mockReturnValue(lastAttackRoll);
      loadCombatSummary.mockResolvedValue({ lastAttack });
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue: 4 });

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

  describe('popup description format', () => {
    it('should show popup with correct description format when attack hits', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 15, bonus: 2, targetAc: 16, isCrit: false });
      const lastAttack = createLastAttack();
      const dieValue = 4;

      getRuntimeValue.mockReturnValue(lastAttackRoll);
      loadCombatSummary.mockResolvedValue({ lastAttack });
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const showPopup = vi.fn();

      const { result } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, vi.fn(), null, showPopup)
      );

      act(() => {
        result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
      });

      await act(async () => {
        await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
      });

      expect(showPopup).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'automation_info',
          name: 'Precision Attack',
          description: 'Precision Attack: Added 4 to the attack roll (15 + 2 + 4 = 21). The attack now hits!',
        })
      );
    });

    it('should show popup with correct description format when attack still misses', async () => {
      const lastAttackRoll = createLastAttackRoll({ d20: 8, bonus: 2, targetAc: 18, isCrit: false });
      const lastAttack = createLastAttack();
      const dieValue = 3;

      getRuntimeValue.mockReturnValue(lastAttackRoll);
      loadCombatSummary.mockResolvedValue({ lastAttack });
      executeManeuver.mockResolvedValue({ effect: 'attack_roll_bonus', dieValue });

      const showPopup = vi.fn();

      const { result } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, vi.fn(), null, showPopup)
      );

      act(() => {
        result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
      });

      await act(async () => {
        await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
      });

      expect(showPopup).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'automation_info',
          name: 'Precision Attack',
          description: 'Precision Attack: Added 3 to the attack roll (8 + 2 + 3 = 13). The attack still misses.',
        })
      );
    });
  });
});
