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

describe('useCombatSuperiorityModal - handleCombatSuperiorityConfirm (attack_roll type)', () => {
  const mockPlayerStats = { name: 'Thorin', level: 5 };
  const mockCampaignName = 'test-campaign';
  const mockRollAttack = vi.fn();
  const mockRollDamage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call rollAttack when executeManeuver returns type attack_roll', async () => {
    const attackPayload = {
      attack: {
        name: 'Riposte',
        hitBonus: 7,
        damageFormula: '1d8+3',
        damageType: 'Slashing',
      },
      targetName: 'Orc',
    };

    executeManeuver.mockResolvedValue({
      type: 'attack_roll',
      payload: attackPayload,
      context: {
        superiorityDieValue: 4,
        baseDamageFormula: '1d8+3',
      },
      popup: { name: 'Riposte', description: 'Reply with an attack.' },
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Riposte' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Riposte');
    });

    expect(mockRollAttack).toHaveBeenCalledWith(
      'Riposte',
      11, // hitBonus 7 + superiorityDieValue 4
      expect.objectContaining({
        targetName: 'Orc',
        forcedMode: undefined,
        isOpportunityAttack: true,
        autoDamageFormula: '1d8+3 + 4 [Superiority]',
        autoDamageName: 'Riposte (Riposte)',
        damageType: 'Slashing',
        autoDamageRollResult: null,
        superiorityDieValue: 4,
        ripostePopup: { name: 'Riposte', description: 'Reply with an attack.' },
      })
    );
  });

  it('should handle attack_roll when onCombatSuperioritySelected returns type attack_roll', async () => {
    const attackPayload = {
      attack: {
        name: 'Parry',
        hitBonus: 5,
        damageFormula: '1d6+2',
        damageType: 'Bludgeoning',
      },
      targetName: 'Goblin',
    };

    onCombatSuperioritySelected.mockResolvedValue({
      type: 'attack_roll',
      payload: attackPayload,
      context: {
        superiorityDieValue: 3,
        baseDamageFormula: '1d6+2',
      },
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Parry' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm(['Parry']);
    });

    expect(mockRollAttack).toHaveBeenCalledWith(
      'Parry',
      8, // hitBonus 5 + superiorityDieValue 3
      expect.objectContaining({
        targetName: 'Goblin',
        isOpportunityAttack: true,
        autoDamageFormula: '1d6+2 + 3 [Superiority]',
        autoDamageName: 'Parry (Riposte)',
        damageType: 'Bludgeoning',
        superiorityDieValue: 3,
      })
    );
  });

  it('should not call rollAttack when rollAttack callback is null (single-use)', async () => {
    executeManeuver.mockResolvedValue({
      type: 'attack_roll',
      payload: {
        attack: { name: 'Riposte', hitBonus: 7, damageFormula: '1d8+3', damageType: 'Slashing' },
        targetName: 'Orc',
      },
      context: { superiorityDieValue: 4 },
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, null, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Riposte' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Riposte');
    });

    expect(mockRollAttack).not.toHaveBeenCalled();
  });

  it('should not call rollAttack when rollAttack callback is null (multi-maneuver)', async () => {
    onCombatSuperioritySelected.mockResolvedValue({
      type: 'attack_roll',
      payload: {
        attack: { name: 'Parry', hitBonus: 5, damageFormula: '1d6+2', damageType: 'Bludgeoning' },
        targetName: 'Goblin',
      },
      context: { superiorityDieValue: 3 },
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, null, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Parry' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm(['Parry']);
    });

    expect(mockRollAttack).not.toHaveBeenCalled();
  });

  it('should handle attack_roll with zero superiorityDieValue', async () => {
    const attackPayload = {
      attack: { name: 'Test', hitBonus: 5, damageFormula: '1d4+1', damageType: 'Piercing' },
      targetName: 'Skeleton',
    };

    executeManeuver.mockResolvedValue({
      type: 'attack_roll',
      payload: attackPayload,
      context: { superiorityDieValue: 0, baseDamageFormula: '1d4+1' },
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Test');
    });

    expect(mockRollAttack).toHaveBeenCalledWith(
      'Test',
      5,
      expect.objectContaining({
        autoDamageFormula: '1d4+1',
        superiorityDieValue: 0,
      })
    );
  });

  it('should handle attack_roll with no baseDamageFormula', async () => {
    executeManeuver.mockResolvedValue({
      type: 'attack_roll',
      payload: {
        attack: { name: 'Test', hitBonus: 5, damageType: 'Slashing' },
        targetName: 'Zombie',
      },
      context: { superiorityDieValue: 3 },
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Test');
    });

    expect(mockRollAttack).toHaveBeenCalledWith(
      'Test',
      8,
      expect.objectContaining({
        autoDamageFormula: null,
        superiorityDieValue: 3,
      })
    );
  });

  it('should handle attack_roll with no attack.damageFormula', async () => {
    executeManeuver.mockResolvedValue({
      type: 'attack_roll',
      payload: {
        attack: { name: 'Test', hitBonus: 5, damageType: 'Slashing' },
        targetName: 'Zombie',
      },
      context: { superiorityDieValue: 3 },
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Test');
    });

    expect(mockRollAttack).toHaveBeenCalledWith(
      'Test',
      8,
      expect.objectContaining({
        autoDamageFormula: null,
      })
    );
  });

  it('should handle attack_roll with no context superiorityDieValue', async () => {
    executeManeuver.mockResolvedValue({
      type: 'attack_roll',
      payload: {
        attack: { name: 'Test', hitBonus: 5, damageFormula: '1d6+2', damageType: 'Slashing' },
        targetName: 'Zombie',
      },
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Test');
    });

    expect(mockRollAttack).toHaveBeenCalledWith(
      'Test',
      5,
      expect.objectContaining({
        superiorityDieValue: 0,
      })
    );
  });

  it('should default damageType to Slashing when not provided', async () => {
    executeManeuver.mockResolvedValue({
      type: 'attack_roll',
      payload: {
        attack: { name: 'Test', hitBonus: 5 },
        targetName: 'Zombie',
      },
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Test');
    });

    expect(mockRollAttack).toHaveBeenCalledWith(
      'Test',
      5,
      expect.objectContaining({
        damageType: 'Slashing',
      })
    );
  });
});
