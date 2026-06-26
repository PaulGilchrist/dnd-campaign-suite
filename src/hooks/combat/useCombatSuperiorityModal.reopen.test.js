// @improved-by-ai
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderHookWithModal = (modalState = null) => {
    const { result } = renderHook(() =>
      useCombatSuperiorityModal(mockPlayerStats, mockCampaignName)
    );
    if (modalState !== null) {
      act(() => {
        result.current.setCombatSuperiorityModal(modalState);
      });
    }
    return result;
  };

  it('should return early without calling executeHandler when modal is null', async () => {
    const result = renderHookWithModal(null);

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('should return early without calling executeHandler when modal.action is null', async () => {
    const result = renderHookWithModal({ action: null });

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('should return early without calling executeHandler when modal has no action property', async () => {
    const result = renderHookWithModal({ knownManeuvers: ['Rally'] });

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('should call executeHandler with action that has forceSelectionMode:true and preserve existing automation fields', async () => {
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
      payload: { action: originalAction, knownManeuvers: ['Rally'] },
    });

    const result = renderHookWithModal({ action: originalAction });

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    expect(executeHandler).toHaveBeenCalledTimes(1);
    const [calledAction] = executeHandler.mock.calls[0];
    expect(calledAction.name).toBe('Combat Superiority');
    expect(calledAction.automation).toEqual({
      type: 'combat_superiority',
      dieExpression: 'superiority_die',
      saveDc: 15,
      saveType: 'DEX',
      forceSelectionMode: true,
    });
    expect(executeHandler).toHaveBeenCalledWith(
      expect.any(Object),
      mockPlayerStats,
      mockCampaignName,
      null
    );
  });

  it('should set combatSuperiorityModal when executeHandler returns matching modal', async () => {
    const originalAction = { name: 'Combat Superiority', automation: { type: 'combat_superiority' } };
    const newPayload = {
      action: originalAction,
      knownManeuvers: ['Rally', 'Disarming Attack'],
      selectionMode: true,
    };

    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'combatSuperiority',
      payload: newPayload,
    });

    const result = renderHookWithModal({ action: originalAction });

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    expect(result.current.combatSuperiorityModal).toEqual(newPayload);
  });

  it('should not update modal when executeHandler returns a different modal type', async () => {
    const originalAction = { name: 'Combat Superiority', automation: { type: 'combat_superiority' } };
    const existingPayload = { action: originalAction, knownManeuvers: ['Rally'] };

    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'someOtherModal',
      payload: { action: originalAction },
    });

    const result = renderHookWithModal(existingPayload);

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    expect(result.current.combatSuperiorityModal).toBe(existingPayload);
  });

  it('should not update modal when executeHandler returns non-modal result', async () => {
    const originalAction = { name: 'Combat Superiority', automation: { type: 'combat_superiority' } };
    const existingPayload = { action: originalAction, knownManeuvers: ['Rally'] };

    executeHandler.mockResolvedValue({
      type: 'attack_roll',
      payload: { attack: {}, targetName: 'goblin' },
    });

    const result = renderHookWithModal(existingPayload);

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    expect(result.current.combatSuperiorityModal).toBe(existingPayload);
  });

  it('should not update modal when executeHandler returns null', async () => {
    const originalAction = { name: 'Combat Superiority', automation: { type: 'combat_superiority' } };
    const existingPayload = { action: originalAction, knownManeuvers: ['Rally'] };

    executeHandler.mockResolvedValue(null);

    const result = renderHookWithModal(existingPayload);

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    expect(result.current.combatSuperiorityModal).toBe(existingPayload);
  });

  it('should not update modal when executeHandler returns undefined', async () => {
    const originalAction = { name: 'Combat Superiority', automation: { type: 'combat_superiority' } };
    const existingPayload = { action: originalAction, knownManeuvers: ['Rally'] };

    executeHandler.mockResolvedValue(undefined);

    const result = renderHookWithModal(existingPayload);

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    expect(result.current.combatSuperiorityModal).toBe(existingPayload);
  });

  it('should set modal to undefined when executeHandler returns matching modal with no payload', async () => {
    const originalAction = { name: 'Combat Superiority', automation: { type: 'combat_superiority' } };
    const existingPayload = { action: originalAction, knownManeuvers: ['Rally'] };

    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'combatSuperiority',
    });

    const result = renderHookWithModal(existingPayload);

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    expect(result.current.combatSuperiorityModal).toBeUndefined();
  });

  it('should create a new object for the reopened action without mutating the original', async () => {
    const originalAction = {
      name: 'Combat Superiority',
      automation: { type: 'combat_superiority' },
    };

    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'combatSuperiority',
      payload: { action: originalAction },
    });

    const result = renderHookWithModal({ action: originalAction });

    await act(async () => {
      await result.current.handleCombatSuperiorityReopenSelection();
    });

    const [calledAction] = executeHandler.mock.calls[0];
    expect(calledAction).not.toBe(originalAction);
    expect(calledAction.automation).not.toBe(originalAction.automation);
  });
});
