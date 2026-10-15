// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCombatSuperiorityModal } from './useCombatSuperiorityModal.js';
import { executeHandler } from '../../services/automation/index.js';

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

const mockPlayerStats = { name: 'Thorin', level: 5 };
const mockCampaignName = 'test-campaign';

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

const reopenWith = async (result) => {
  const handler = result.current.handleCombatSuperiorityReopenSelection;
  await act(async () => {
    await handler();
  });
};

describe('useCombatSuperiorityModal - handleCombatSuperiorityReopenSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['modal is null', null],
    ['modal exists but action is missing', { knownManeuvers: ['Rally'] }],
  ])('returns early without calling executeHandler when %s', async (_label, modalState) => {
    const result = renderHookWithModal(modalState);

    await reopenWith(result);

    expect(executeHandler).not.toHaveBeenCalled();
    expect(result.current.combatSuperiorityModal).toBe(modalState);
  });

  it('reopens selection by re-dispatching a cloned action with forceSelectionMode merged, then restores the returned payload', async () => {
    const originalAction = {
      name: 'Combat Superiority',
      automation: {
        type: 'combat_superiority',
        dieExpression: 'superiority_die',
        saveDc: 15,
        saveType: 'DEX',
      },
    };
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

    await reopenWith(result);

    expect(executeHandler).toHaveBeenCalledTimes(1);
    const [calledAction, calledStats, calledCampaign, calledTarget] = executeHandler.mock.calls[0];
    expect(calledStats).toBe(mockPlayerStats);
    expect(calledCampaign).toBe(mockCampaignName);
    expect(calledTarget).toBeNull();
    // Reopen builds fresh objects — original action/automation never mutated
    expect(calledAction).not.toBe(originalAction);
    expect(calledAction.automation).not.toBe(originalAction.automation);
    expect(calledAction).toEqual({
      name: 'Combat Superiority',
      automation: {
        type: 'combat_superiority',
        dieExpression: 'superiority_die',
        saveDc: 15,
        saveType: 'DEX',
        forceSelectionMode: true,
      },
    });
    // Matching modal result restores it into state
    expect(result.current.combatSuperiorityModal).toBe(newPayload);
  });

  describe('leaves modal untouched when the result is not a combatSuperiority modal', () => {
    const existingPayload = {
      action: { name: 'Combat Superiority', automation: { type: 'combat_superiority' } },
      knownManeuvers: ['Rally'],
    };

    it.each([
      ['a different modal name', { type: 'modal', modalName: 'someOtherModal' }],
      ['a non-modal result', { type: 'attack_roll', payload: { attack: {}, targetName: 'goblin' } }],
      ['null', null],
    ])('does not update modal when executeHandler returns %s', async (_label, handlerResult) => {
      executeHandler.mockResolvedValue(handlerResult);

      const result = renderHookWithModal(existingPayload);

      await reopenWith(result);

      expect(executeHandler).toHaveBeenCalledTimes(1);
      expect(result.current.combatSuperiorityModal).toBe(existingPayload);
    });
  });

  it('propagates the error when executeHandler rejects', async () => {
    executeHandler.mockRejectedValue(new Error('Network error'));

    const result = renderHookWithModal({
      action: { name: 'Combat Superiority', automation: { type: 'combat_superiority' } },
      knownManeuvers: ['Rally'],
    });

    await expect(
      act(async () => {
        await result.current.handleCombatSuperiorityReopenSelection();
      })
    ).rejects.toThrow('Network error');

    expect(result.current.combatSuperiorityModal).not.toBeNull();
  });
});
