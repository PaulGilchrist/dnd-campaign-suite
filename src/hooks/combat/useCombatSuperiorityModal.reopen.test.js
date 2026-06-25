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

import { executeHandler } from '../../services/automation/index.js';

describe('useCombatSuperiorityModal - handleCombatSuperiorityReopenSelection', () => {
  const mockPlayerStats = { name: 'Thorin', level: 5 };
  const mockCampaignName = 'test-campaign';
  const mockRollAttack = vi.fn();
  const mockRollDamage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return early when combatSuperiorityModal is null', async () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('should return early when combatSuperiorityModal.action is null', async () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: null });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('should call executeHandler with forceSelectionMode action', async () => {
    const originalAction = {
      name: 'Combat Superiority',
      automation: {
        type: 'combat_superiority',
        dieExpression: 'superiority_die',
      },
    };

    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'combatSuperiority',
      payload: {
        action: originalAction,
        knownManeuvers: ['Rally', 'Disarming Attack'],
        selectionMode: true,
      },
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: originalAction });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    expect(executeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        automation: expect.objectContaining({
          forceSelectionMode: true,
        }),
      }),
      mockPlayerStats,
      mockCampaignName,
      null
    );
  });

  it('should preserve existing automation fields and add forceSelectionMode', async () => {
    const originalAction = {
      name: 'Combat Superiority',
      automation: {
        type: 'combat_superiority',
        dieExpression: 'superiority_die',
        saveDc: 15,
        saveType: 'DEX',
      },
    };

    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'combatSuperiority',
      payload: { action: originalAction },
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: originalAction });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    const calledAction = executeHandler.mock.calls[0][0];
    expect(calledAction.automation.type).toBe('combat_superiority');
    expect(calledAction.automation.dieExpression).toBe('superiority_die');
    expect(calledAction.automation.saveDc).toBe(15);
    expect(calledAction.automation.saveType).toBe('DEX');
    expect(calledAction.automation.forceSelectionMode).toBe(true);
  });

  it('should set combatSuperiorityModal when result is modal combatSuperiority', async () => {
    const originalAction = { name: 'Combat Superiority', automation: { type: 'combat_superiority' } };

    const newPayload = {
      action: originalAction,
      knownManeuvers: ['Rally'],
      selectionMode: true,
    };

    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'combatSuperiority',
      payload: newPayload,
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: originalAction });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    expect(result.current.combatSuperiorityModal).toEqual(newPayload);
  });

  it('should not update combatSuperiorityModal when result is not combatSuperiority modal', async () => {
    const originalAction = { name: 'Combat Superiority', automation: { type: 'combat_superiority' } };

    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'someOtherModal',
      payload: { action: originalAction },
    });

    const existingPayload = { action: originalAction, knownManeuvers: ['Rally'] };

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal(existingPayload);
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    // Modal should remain unchanged
    expect(result.current.combatSuperiorityModal).toEqual(existingPayload);
  });

  it('should not update combatSuperiorityModal when result has no type modal', async () => {
    const originalAction = { name: 'Combat Superiority', automation: { type: 'combat_superiority' } };

    executeHandler.mockResolvedValue({
      type: 'popup',
      payload: { name: 'No maneuvers available' },
    });

    const existingPayload = { action: originalAction, knownManeuvers: ['Rally'] };

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal(existingPayload);
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    expect(result.current.combatSuperiorityModal).toEqual(existingPayload);
  });

  it('should not update combatSuperiorityModal when executeHandler returns null', async () => {
    const originalAction = { name: 'Combat Superiority', automation: { type: 'combat_superiority' } };

    executeHandler.mockResolvedValue(null);

    const existingPayload = { action: originalAction, knownManeuvers: ['Rally'] };

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal(existingPayload);
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    expect(result.current.combatSuperiorityModal).toEqual(existingPayload);
  });
});
