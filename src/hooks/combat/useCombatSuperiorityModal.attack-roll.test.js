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

import { executeManeuver, onCombatSuperioritySelected } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';

const createAttackRollResult = (overrides = {}) => {
  const base = {
    type: 'attack_roll',
    payload: {
      attack: {
        name: 'Riposte',
        hitBonus: 7,
        damageFormula: '1d8+3',
        damageType: 'Slashing',
      },
      targetName: 'Orc',
    },
    context: {
      superiorityDieValue: 4,
      baseDamageFormula: '1d8+3',
    },
    popup: { name: 'Riposte', description: 'Reply with an attack.' },
  };
  return {
    ...base,
    ...overrides,
    ...(overrides.context ? { context: { ...base.context, ...overrides.context } } : {}),
    ...(overrides.payload ? { payload: { ...base.payload, ...overrides.payload } } : {}),
  };
};

describe('useCombatSuperiorityModal - attack_roll path', () => {
  const mockPlayerStats = { name: 'Thorin', level: 5 };
  const mockCampaignName = 'test-campaign';
  const mockRollAttack = vi.fn();
  const mockRollDamage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('single-use maneuver path (executeManeuver)', () => {
    it('should call rollAttack with correct hit bonus (hitBonus + superiorityDieValue)', async () => {
      const result = createAttackRollResult({
        context: { superiorityDieValue: 4 },
      });
      executeManeuver.mockResolvedValue(result);

      const { result: hookResult } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
      );

      act(() => {
        hookResult.current.setCombatSuperiorityModal({ action: { name: 'Riposte' } });
      });

      await act(async () => {
        await hookResult.current.handleCombatSuperiorityConfirm([], 'Riposte');
      });

      expect(mockRollAttack).toHaveBeenCalledWith(
        'Riposte',
        11,
        expect.any(Object)
      );
    });

    it('should pass all expected rollAttack arguments including targetName, damageType, and superiorityDieValue', async () => {
      const result = createAttackRollResult({
        payload: {
          attack: {
            name: 'Parry',
            hitBonus: 5,
            damageFormula: '1d6+2',
            damageType: 'Bludgeoning',
          },
          targetName: 'Goblin',
        },
        context: { superiorityDieValue: 3, baseDamageFormula: '1d6+2' },
        popup: { name: 'Parry', description: 'Reply with an attack.' },
      });
      executeManeuver.mockResolvedValue(result);

      const { result: hookResult } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
      );

      act(() => {
        hookResult.current.setCombatSuperiorityModal({ action: { name: 'Parry' } });
      });

      await act(async () => {
        await hookResult.current.handleCombatSuperiorityConfirm([], 'Parry');
      });

      expect(mockRollAttack).toHaveBeenCalledWith(
        'Parry',
        8,
        expect.objectContaining({
          targetName: 'Goblin',
          forcedMode: undefined,
          isOpportunityAttack: true,
          autoDamageFormula: '1d6+2 + 3 [Superiority]',
          autoDamageName: 'Parry (Riposte)',
          damageType: 'Bludgeoning',
          autoDamageRollResult: null,
          superiorityDieValue: 3,
          ripostePopup: { name: 'Parry', description: 'Reply with an attack.' },
        })
      );
    });

    it('should combine superiorityDieValue into autoDamageFormula when both are present', async () => {
      const result = createAttackRollResult({
        context: { superiorityDieValue: 5, baseDamageFormula: '2d4+2' },
      });
      executeManeuver.mockResolvedValue(result);

      const { result: hookResult } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
      );

      act(() => {
        hookResult.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
      });

      await act(async () => {
        await hookResult.current.handleCombatSuperiorityConfirm([], 'Test');
      });

      expect(mockRollAttack).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          autoDamageFormula: '2d4+2 + 5 [Superiority]',
        })
      );
    });

    it('should omit superiority suffix from autoDamageFormula when superiorityDieValue is zero', async () => {
      const result = createAttackRollResult({
        context: { superiorityDieValue: 0, baseDamageFormula: '1d4+1' },
      });
      executeManeuver.mockResolvedValue(result);

      const { result: hookResult } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
      );

      act(() => {
        hookResult.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
      });

      await act(async () => {
        await hookResult.current.handleCombatSuperiorityConfirm([], 'Test');
      });

      expect(mockRollAttack).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          autoDamageFormula: '1d4+1',
        })
      );
    });

    it('should set autoDamageFormula to null when no baseDamageFormula and no attack.damageFormula', async () => {
      const result = createAttackRollResult({
        payload: {
          attack: {
            name: 'Test',
            hitBonus: 5,
            damageType: 'Slashing',
          },
          targetName: 'Zombie',
        },
        context: { superiorityDieValue: 3, baseDamageFormula: undefined },
      });
      executeManeuver.mockResolvedValue(result);

      const { result: hookResult } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
      );

      act(() => {
        hookResult.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
      });

      await act(async () => {
        await hookResult.current.handleCombatSuperiorityConfirm([], 'Test');
      });

      expect(mockRollAttack).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          autoDamageFormula: null,
        })
      );
    });

    it('should default superiorityDieValue to 0 when context is null', async () => {
      const result = createAttackRollResult({
        context: null,
      });
      executeManeuver.mockResolvedValue(result);

      const { result: hookResult } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
      );

      act(() => {
        hookResult.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
      });

      await act(async () => {
        await hookResult.current.handleCombatSuperiorityConfirm([], 'Test');
      });

      expect(mockRollAttack).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          superiorityDieValue: 0,
        })
      );
    });

    it('should default damageType to Slashing when not provided on attack', async () => {
      const result = createAttackRollResult({
        payload: {
          attack: {
            name: 'Test',
            hitBonus: 5,
          },
          targetName: 'Zombie',
        },
      });
      executeManeuver.mockResolvedValue(result);

      const { result: hookResult } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
      );

      act(() => {
        hookResult.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
      });

      await act(async () => {
        await hookResult.current.handleCombatSuperiorityConfirm([], 'Test');
      });

      expect(mockRollAttack).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          damageType: 'Slashing',
        })
      );
    });

    it('should set autoDamageName to attack name with (Riposte) suffix', async () => {
      const result = createAttackRollResult({
        payload: {
          attack: { name: 'Gouging Attack', hitBonus: 6, damageFormula: '1d4+1', damageType: 'Piercing' },
          targetName: 'Troll',
        },
      });
      executeManeuver.mockResolvedValue(result);

      const { result: hookResult } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
      );

      act(() => {
        hookResult.current.setCombatSuperiorityModal({ action: { name: 'Gouging Attack' } });
      });

      await act(async () => {
        await hookResult.current.handleCombatSuperiorityConfirm([], 'Gouging Attack');
      });

      expect(mockRollAttack).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          autoDamageName: 'Gouging Attack (Riposte)',
        })
      );
    });

    it('should skip rollAttack when rollAttack callback is null', async () => {
      const result = createAttackRollResult();
      executeManeuver.mockResolvedValue(result);

      const { result: hookResult } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, null, mockRollDamage)
      );

      act(() => {
        hookResult.current.setCombatSuperiorityModal({ action: { name: 'Riposte' } });
      });

      await act(async () => {
        await hookResult.current.handleCombatSuperiorityConfirm([], 'Riposte');
      });

      expect(mockRollAttack).not.toHaveBeenCalled();
    });

    it('should clear the modal after handling attack_roll', async () => {
      const result = createAttackRollResult();
      executeManeuver.mockResolvedValue(result);

      const { result: hookResult } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
      );

      act(() => {
        hookResult.current.setCombatSuperiorityModal({ action: { name: 'Riposte' } });
      });

      expect(hookResult.current.combatSuperiorityModal).not.toBeNull();

      await act(async () => {
        await hookResult.current.handleCombatSuperiorityConfirm([], 'Riposte');
      });

      expect(hookResult.current.combatSuperiorityModal).toBeNull();
    });

    it('should add logEntries from executeManeuver result', async () => {
      const { addEntry } = await import('../../services/ui/logService.js');
      executeManeuver.mockResolvedValue({
        type: 'attack_roll',
        payload: {
          attack: {
            name: 'Riposte',
            hitBonus: 7,
            damageFormula: '1d8+3',
            damageType: 'Slashing',
          },
          targetName: 'Orc',
        },
        context: { superiorityDieValue: 4, baseDamageFormula: '1d8+3' },
        logEntries: [
          { type: 'ability_use', characterName: 'Thorin', abilityName: 'Riposte', description: 'Riposte used.' },
        ],
      });

      const { result: hookResult } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
      );

      act(() => {
        hookResult.current.setCombatSuperiorityModal({ action: { name: 'Riposte' } });
      });

      await act(async () => {
        await hookResult.current.handleCombatSuperiorityConfirm([], 'Riposte');
      });

      expect(addEntry).toHaveBeenCalledWith(
        mockCampaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'Thorin',
          abilityName: 'Riposte',
        })
      );
    });

    it('should pass ripostePopup from result.popup when provided', async () => {
      const result = createAttackRollResult({
        popup: { name: 'Riposte', description: 'Reply with an attack after hitting.' },
      });
      executeManeuver.mockResolvedValue(result);

      const { result: hookResult } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
      );

      act(() => {
        hookResult.current.setCombatSuperiorityModal({ action: { name: 'Riposte' } });
      });

      await act(async () => {
        await hookResult.current.handleCombatSuperiorityConfirm([], 'Riposte');
      });

      expect(mockRollAttack).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        expect.objectContaining({
          ripostePopup: { name: 'Riposte', description: 'Reply with an attack after hitting.' },
        })
      );
    });
  });

  describe('multi-maneuver path (onCombatSuperioritySelected)', () => {
    it('should call rollAttack with correct values from onCombatSuperioritySelected result', async () => {
      const result = createAttackRollResult({
        payload: {
          attack: {
            name: 'Parry',
            hitBonus: 5,
            damageFormula: '1d6+2',
            damageType: 'Bludgeoning',
          },
          targetName: 'Goblin',
        },
        context: { superiorityDieValue: 3, baseDamageFormula: '1d6+2' },
        popup: undefined,
      });
      onCombatSuperioritySelected.mockResolvedValue(result);

      const { result: hookResult } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
      );

      act(() => {
        hookResult.current.setCombatSuperiorityModal({ action: { name: 'Parry' } });
      });

      await act(async () => {
        await hookResult.current.handleCombatSuperiorityConfirm(['Parry']);
      });

      expect(mockRollAttack).toHaveBeenCalledWith(
        'Parry',
        8,
        expect.objectContaining({
          targetName: 'Goblin',
          forcedMode: undefined,
          isOpportunityAttack: true,
          autoDamageFormula: '1d6+2 + 3 [Superiority]',
          autoDamageName: 'Parry (Riposte)',
          damageType: 'Bludgeoning',
          autoDamageRollResult: null,
          superiorityDieValue: 3,
        })
      );
    });

    it('should skip rollAttack when rollAttack callback is null in multi-maneuver path', async () => {
      const result = createAttackRollResult();
      onCombatSuperioritySelected.mockResolvedValue(result);

      const { result: hookResult } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, null, mockRollDamage)
      );

      act(() => {
        hookResult.current.setCombatSuperiorityModal({ action: { name: 'Riposte' } });
      });

      await act(async () => {
        await hookResult.current.handleCombatSuperiorityConfirm(['Riposte']);
      });

      expect(mockRollAttack).not.toHaveBeenCalled();
    });

    it('should add logEntries from onCombatSuperioritySelected result', async () => {
      const { addEntry } = await import('../../services/ui/logService.js');
      onCombatSuperioritySelected.mockResolvedValue({
        type: 'attack_roll',
        payload: {
          attack: {
            name: 'Riposte',
            hitBonus: 7,
            damageFormula: '1d8+3',
            damageType: 'Slashing',
          },
          targetName: 'Orc',
        },
        context: { superiorityDieValue: 4, baseDamageFormula: '1d8+3' },
        logEntries: [
          { type: 'ability_use', characterName: 'Thorin', abilityName: 'Selection', description: 'Maneuver selected.' },
        ],
      });

      const { result: hookResult } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
      );

      act(() => {
        hookResult.current.setCombatSuperiorityModal({ action: { name: 'Select' } });
      });

      await act(async () => {
        await hookResult.current.handleCombatSuperiorityConfirm(['Select']);
      });

      expect(addEntry).toHaveBeenCalledWith(
        mockCampaignName,
        expect.objectContaining({
          type: 'ability_use',
          characterName: 'Thorin',
          abilityName: 'Selection',
        })
      );
    });

    it('should clear the modal after handling attack_roll in multi-maneuver path', async () => {
      const result = createAttackRollResult();
      onCombatSuperioritySelected.mockResolvedValue(result);

      const { result: hookResult } = renderHook(
        () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
      );

      act(() => {
        hookResult.current.setCombatSuperiorityModal({ action: { name: 'Select' } });
      });

      expect(hookResult.current.combatSuperiorityModal).not.toBeNull();

      await act(async () => {
        await hookResult.current.handleCombatSuperiorityConfirm(['Select']);
      });

      expect(hookResult.current.combatSuperiorityModal).toBeNull();
    });
  });
});
