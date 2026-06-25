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

describe('useCombatSuperiorityModal - handleCombatSuperiorityConfirm (attack_roll_bonus / Precision Attack)', () => {
  const mockPlayerStats = { name: 'Thorin', level: 5 };
  const mockCampaignName = 'test-campaign';
  const mockRollAttack = vi.fn();
  const mockRollDamage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    rollExpression.mockReturnValue({ total: 10, rolls: [4, 3], modifier: 3 });
  });

  it('should handle effect attack_roll_bonus when lastAttackRoll has d20 and targetAc and lastAttack has damageFormula', async () => {
    const lastAttackRoll = { d20: 15, bonus: 5, targetAc: 16, isCrit: false };
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'Thorin' && prop === 'lastAttackRoll') return lastAttackRoll;
      return null;
    });

    const cs = {
      lastAttack: {
        damageFormula: '2d6+3',
        damageType: 'Slashing',
        damageName: 'Longsword',
        attackName: 'Longsword',
        targetName: 'Orc',
      },
    };
    loadCombatSummary.mockResolvedValue(cs);

    const showPopupMock = vi.fn();
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, showPopupMock)
    );

    executeManeuver.mockResolvedValue({
      effect: 'attack_roll_bonus',
      dieValue: 4,
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
    });

    // Verify the attack roll was updated
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

    // Verify combat summary cache was updated
    expect(setCombatSummaryCache).toHaveBeenCalled();

    // Verify log entry was added
    expect(addEntry).toHaveBeenCalledWith(mockCampaignName, expect.objectContaining({
      type: 'ability_use',
      abilityName: 'Precision Attack',
    }));

    // When attack hits and rollDamage is provided, rollDamage is called and showPopup is NOT called
    expect(mockRollDamage).toHaveBeenCalledTimes(1);
    expect(mockRollDamage).toHaveBeenCalledWith(
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

  it('should update isCrit when d20 is 20 (natural 20)', async () => {
    const lastAttackRoll = { d20: 20, bonus: 5, targetAc: 16, isCrit: false };
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'Thorin' && prop === 'lastAttackRoll') return lastAttackRoll;
      return null;
    });

    const cs = {
      lastAttack: {
        damageFormula: '2d6+3',
        damageType: 'Slashing',
        damageName: 'Longsword',
        attackName: 'Longsword',
        targetName: 'Orc',
      },
    };
    loadCombatSummary.mockResolvedValue(cs);

    const showPopupMock = vi.fn();
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, showPopupMock)
    );

    executeManeuver.mockResolvedValue({
      effect: 'attack_roll_bonus',
      dieValue: 3,
    });

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
      }),
      mockCampaignName
    );
  });

  it('should keep isCrit true when already a natural 20 and bonus added', async () => {
    const lastAttackRoll = { d20: 20, bonus: 5, targetAc: 16, isCrit: true };
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'Thorin' && prop === 'lastAttackRoll') return lastAttackRoll;
      return null;
    });

    const cs = {
      lastAttack: {
        damageFormula: '2d6+3',
        damageType: 'Slashing',
        damageName: 'Longsword',
        attackName: 'Longsword',
        targetName: 'Orc',
      },
    };
    loadCombatSummary.mockResolvedValue(cs);

    const showPopupMock = vi.fn();
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, showPopupMock)
    );

    executeManeuver.mockResolvedValue({
      effect: 'attack_roll_bonus',
      dieValue: 5,
    });

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
      }),
      mockCampaignName
    );
  });

  it('should show "still misses" message when attack still misses after bonus', async () => {
    const lastAttackRoll = { d20: 8, bonus: 2, targetAc: 18, isCrit: false };
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'Thorin' && prop === 'lastAttackRoll') return lastAttackRoll;
      return null;
    });

    const cs = {
      lastAttack: {
        damageFormula: '2d6+3',
        damageType: 'Slashing',
        damageName: 'Longsword',
        attackName: 'Longsword',
        targetName: 'Orc',
      },
    };
    loadCombatSummary.mockResolvedValue(cs);

    const showPopupMock = vi.fn();
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, showPopupMock)
    );

    executeManeuver.mockResolvedValue({
      effect: 'attack_roll_bonus',
      dieValue: 3,
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
    });

    expect(showPopupMock).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Precision Attack',
      description: expect.stringContaining('still misses'),
    }));
  });

  it('should roll damage and call rollDamage when attack becomes a hit', async () => {
    const lastAttackRoll = { d20: 15, bonus: 2, targetAc: 16, isCrit: false };
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'Thorin' && prop === 'lastAttackRoll') return lastAttackRoll;
      return null;
    });

    const cs = {
      lastAttack: {
        damageFormula: '2d6+3',
        damageType: 'Slashing',
        damageName: 'Longsword',
        attackName: 'Longsword',
        targetName: 'Orc',
      },
    };
    loadCombatSummary.mockResolvedValue(cs);

    const showPopupMock = vi.fn();
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, showPopupMock)
    );

    executeManeuver.mockResolvedValue({
      effect: 'attack_roll_bonus',
      dieValue: 4,
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
    });

    expect(mockRollDamage).toHaveBeenCalledWith(
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

    // Should set pendingCombatSuperiorityPrompt to null
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Thorin',
      'pendingCombatSuperiorityPrompt',
      null,
      mockCampaignName
    );
  });

  it('should not call rollDamage when rollExpression returns null', async () => {
    const lastAttackRoll = { d20: 15, bonus: 2, targetAc: 16, isCrit: false };
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'Thorin' && prop === 'lastAttackRoll') return lastAttackRoll;
      return null;
    });

    const cs = {
      lastAttack: {
        damageFormula: '2d6+3',
        damageType: 'Slashing',
        damageName: 'Longsword',
        attackName: 'Longsword',
        targetName: 'Orc',
      },
    };
    loadCombatSummary.mockResolvedValue(cs);
    rollExpression.mockReturnValue(null);

    const showPopupMock = vi.fn();
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, showPopupMock)
    );

    executeManeuver.mockResolvedValue({
      effect: 'attack_roll_bonus',
      dieValue: 4,
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
    });

    expect(mockRollDamage).not.toHaveBeenCalled();
    // When rollExpression returns null during a hit, it returns early without calling showPopup
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Thorin',
      'pendingCombatSuperiorityPrompt',
      null,
      mockCampaignName
    );
  });

  it('should not call rollDamage when rollDamage callback is null', async () => {
    const lastAttackRoll = { d20: 15, bonus: 2, targetAc: 16, isCrit: false };
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'Thorin' && prop === 'lastAttackRoll') return lastAttackRoll;
      return null;
    });

    const cs = {
      lastAttack: {
        damageFormula: '2d6+3',
        damageType: 'Slashing',
        damageName: 'Longsword',
        attackName: 'Longsword',
        targetName: 'Orc',
      },
    };
    loadCombatSummary.mockResolvedValue(cs);
    rollExpression.mockReturnValue({ total: 10, rolls: [4, 3], modifier: 3 });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, null)
    );

    executeManeuver.mockResolvedValue({
      effect: 'attack_roll_bonus',
      dieValue: 4,
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
    });

    expect(mockRollDamage).not.toHaveBeenCalled();
  });

  it('should skip precision attack logic when lastAttackRoll.d20 is null', async () => {
    const lastAttackRoll = { d20: null, bonus: 5, targetAc: 16 };
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'Thorin' && prop === 'lastAttackRoll') return lastAttackRoll;
      return null;
    });

    const cs = { lastAttack: { damageFormula: '2d6+3' } };
    loadCombatSummary.mockResolvedValue(cs);

    const showPopupMock = vi.fn();
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, showPopupMock)
    );

    executeManeuver.mockResolvedValue({
      effect: 'attack_roll_bonus',
      dieValue: 4,
      logEntries: [{ type: 'ability_use', characterName: 'Thorin', abilityName: 'Precision Attack', description: 'Test' }],
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
    });

    // Should fall through to the type popup handler
    expect(addEntry).toHaveBeenCalled();
  });

  it('should skip precision attack logic when lastAttackRoll.targetAc is null', async () => {
    const lastAttackRoll = { d20: 15, bonus: 5, targetAc: null };
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'Thorin' && prop === 'lastAttackRoll') return lastAttackRoll;
      return null;
    });

    const cs = { lastAttack: { damageFormula: '2d6+3' } };
    loadCombatSummary.mockResolvedValue(cs);

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    executeManeuver.mockResolvedValue({
      effect: 'attack_roll_bonus',
      dieValue: 4,
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
    });

    // Should skip the precision attack block
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Thorin', 'lastAttackRoll', expect.any(Object), mockCampaignName);
  });

  it('should skip precision attack logic when lastAttack has no damageFormula', async () => {
    const lastAttackRoll = { d20: 15, bonus: 5, targetAc: 16 };
    getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'Thorin' && prop === 'lastAttackRoll') return lastAttackRoll;
      return null;
    });

    const cs = { lastAttack: { damageFormula: null } };
    loadCombatSummary.mockResolvedValue(cs);

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    executeManeuver.mockResolvedValue({
      effect: 'attack_roll_bonus',
      dieValue: 4,
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Precision Attack' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Precision Attack');
    });

    // Should skip the precision attack block
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Thorin', 'lastAttackRoll', expect.any(Object), mockCampaignName);
  });
});
