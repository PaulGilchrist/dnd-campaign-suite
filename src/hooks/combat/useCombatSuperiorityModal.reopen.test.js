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

describe('useCombatSuperiorityModal - handleCombatSuperiorityReopenSelection', () => {
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

  describe('early return conditions', () => {
    it('should return early without calling executeHandler when modal is null', async () => {
      const result = renderHookWithModal(null);

      await act(async () => {
        await result.current.handleCombatSuperiorityReopenSelection();
      });

      expect(executeHandler).not.toHaveBeenCalled();
      expect(result.current.combatSuperiorityModal).toBeNull();
    });

    it('should return early without calling executeHandler when modal exists but action is missing', async () => {
      const result = renderHookWithModal({ knownManeuvers: ['Rally'] });

      await act(async () => {
        await result.current.handleCombatSuperiorityReopenSelection();
      });

      expect(executeHandler).not.toHaveBeenCalled();
      expect(result.current.combatSuperiorityModal).toEqual({ knownManeuvers: ['Rally'] });
    });
  });

  describe('successful reopen flow', () => {
    it('should call executeHandler with forceSelectionMode:true merged into existing automation fields', async () => {
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

    it('should create new objects for the reopened action without mutating the original', async () => {
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
      expect(calledAction.automation).toEqual({
        type: 'combat_superiority',
        forceSelectionMode: true,
      });
    });
  });

  describe('non-matching result handling', () => {
    const existingPayload = { action: { name: 'Combat Superiority', automation: { type: 'combat_superiority' } }, knownManeuvers: ['Rally'] };

    it('should not update modal when executeHandler returns a different modal type', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'someOtherModal',
        payload: { action: existingPayload.action },
      });

      const result = renderHookWithModal(existingPayload);

      await act(async () => {
        await result.current.handleCombatSuperiorityReopenSelection();
      });

      expect(result.current.combatSuperiorityModal).toBe(existingPayload);
    });

    it('should not update modal when executeHandler returns non-modal result', async () => {
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
      executeHandler.mockResolvedValue(null);

      const result = renderHookWithModal(existingPayload);

      await act(async () => {
        await result.current.handleCombatSuperiorityReopenSelection();
      });

      expect(result.current.combatSuperiorityModal).toBe(existingPayload);
    });

    it('should not update modal when executeHandler returns undefined', async () => {
      executeHandler.mockResolvedValue(undefined);

      const result = renderHookWithModal(existingPayload);

      await act(async () => {
        await result.current.handleCombatSuperiorityReopenSelection();
      });

      expect(result.current.combatSuperiorityModal).toBe(existingPayload);
    });
  });

  describe('error handling', () => {
    it('should propagate error when executeHandler rejects', async () => {
      const existingPayload = { action: { name: 'Combat Superiority', automation: { type: 'combat_superiority' } }, knownManeuvers: ['Rally'] };

      executeHandler.mockRejectedValue(new Error('Network error'));

      const result = renderHookWithModal(existingPayload);

      await expect(
        act(async () => {
          await result.current.handleCombatSuperiorityReopenSelection();
        })
      ).rejects.toThrow('Network error');

      expect(result.current.combatSuperiorityModal).toBe(existingPayload);
    });
  });
});
