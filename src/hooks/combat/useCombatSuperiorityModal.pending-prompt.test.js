import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import { setRuntimeValue, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

describe('useCombatSuperiorityModal - Pending prompt polling (attack)', () => {
  const mockPlayerStats = { name: 'Thorin', level: 5 };
  const mockCampaignName = 'test-campaign';
  const mockRollAttack = vi.fn();
  const mockRollDamage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should poll getRuntimeValue for pendingCombatSuperiorityPrompt', () => {
    getRuntimeValue.mockImplementation((key, prop, campaign) => {
      if (key === 'Thorin' && prop === 'pendingCombatSuperiorityPrompt' && campaign === 'test-campaign') {
        return {
          rollType: 'attack',
          attackContext: { d20: 10, targetAc: 15 },
        };
      }
      return null;
    });

    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'combatSuperiority',
      payload: { action: { name: 'Combat Superiority' }, knownManeuvers: ['Rally'] },
    });

    const { result, unmount } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    expect(result.current.combatSuperiorityModal).toBeNull();

    // Clear intervals to stop the polling
    unmount();
  });

  it('should call executeHandler when pending prompt exists and popup not visible', async () => {
    getRuntimeValue.mockImplementation((key, prop, campaign) => {
      if (key === 'Thorin' && prop === 'pendingCombatSuperiorityPrompt' && campaign === 'test-campaign') {
        return {
          rollType: 'attack',
          attackContext: { d20: 10, targetAc: 15 },
        };
      }
      return null;
    });

    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'combatSuperiority',
      payload: { action: { name: 'Combat Superiority' }, knownManeuvers: ['Rally'] },
    });

    // Mock popupHtmlRef.current as false (no popup visible)
    document.querySelector = vi.fn((selector) => {
      if (selector === '.char-actions') return document.createElement('div');
      return null;
    });

    globalThis.MutationObserver = class {
      observe() {}
      disconnect() {}
      takeRecords() { return []; }
    };

    const { unmount } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    // Wait for the interval to fire (500ms + SHOW_DICE_ROLL_DELAY 2000ms = 2500ms)
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 3000));
    });

    expect(executeHandler).toHaveBeenCalled();

    unmount();
  });

  it('should skip when modal is already showing', () => {
    getRuntimeValue.mockImplementation((key, prop, campaign) => {
      if (key === 'Thorin' && prop === 'pendingCombatSuperiorityPrompt' && campaign === 'test-campaign') {
        return {
          rollType: 'attack',
          attackContext: { d20: 10, targetAc: 15 },
        };
      }
      return null;
    });

    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'combatSuperiority',
      payload: { action: { name: 'Combat Superiority' } },
    });

    const { result, unmount } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    // Set the modal so the polling should skip
    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
    });

    // Wait for a short interval
    act(() => {
      new Promise(resolve => setTimeout(resolve, 100));
    });

    // executeHandler should not have been called because modal is set
    expect(executeHandler).not.toHaveBeenCalled();

    unmount();
  });

  it('should skip when pending prompt is null', () => {
    getRuntimeValue.mockReturnValue(null);

    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'combatSuperiority',
      payload: { action: { name: 'Combat Superiority' } },
    });

    const { unmount } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(executeHandler).not.toHaveBeenCalled();

    unmount();
  });

  it('should skip when pending prompt has no attackContext and no skillContext', () => {
    getRuntimeValue.mockImplementation((key, prop, campaign) => {
      if (key === 'Thorin' && prop === 'pendingCombatSuperiorityPrompt' && campaign === 'test-campaign') {
        return { rollType: 'attack' }; // no attackContext or skillContext
      }
      return null;
    });

    const { unmount } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(executeHandler).not.toHaveBeenCalled();

    unmount();
  });

  it('should skip when pending prompt has unknown rollType', () => {
    getRuntimeValue.mockImplementation((key, prop, campaign) => {
      if (key === 'Thorin' && prop === 'pendingCombatSuperiorityPrompt' && campaign === 'test-campaign') {
        return {
          rollType: 'spell',
          attackContext: { d20: 10, targetAc: 15 },
        };
      }
      return null;
    });

    const { unmount } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      new Promise(resolve => setTimeout(resolve, 100));
    });

    expect(executeHandler).not.toHaveBeenCalled();

    unmount();
  });

  it('should call executeHandler with combat_superiority_attack_rider for attack rollType', async () => {
    getRuntimeValue.mockImplementation((key, prop, campaign) => {
      if (key === 'Thorin' && prop === 'pendingCombatSuperiorityPrompt' && campaign === 'test-campaign') {
        return {
          rollType: 'attack',
          attackContext: { d20: 10, targetAc: 15 },
        };
      }
      return null;
    });

    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'combatSuperiority',
      payload: { action: { name: 'Combat Superiority' } },
    });

    document.querySelector = vi.fn(() => document.createElement('div'));
    globalThis.MutationObserver = class {
      observe() {}
      disconnect() {}
      takeRecords() { return []; }
    };

    const { unmount } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 3000));
    });

    expect(executeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        automation: { type: 'combat_superiority_attack_rider' },
        name: 'Combat Superiority',
      }),
      mockPlayerStats,
      mockCampaignName,
      null
    );

    unmount();
  });

  it('should call executeHandler with combat_superiority_prompt_skill_check for skill_check rollType', async () => {
    getRuntimeValue.mockImplementation((key, prop, campaign) => {
      if (key === 'Thorin' && prop === 'pendingCombatSuperiorityPrompt' && campaign === 'test-campaign') {
        return {
          rollType: 'skill_check',
          skillContext: { skillName: 'Stealth' },
        };
      }
      return null;
    });

    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'combatSuperiority',
      payload: { action: { name: 'Combat Superiority' } },
    });

    document.querySelector = vi.fn(() => document.createElement('div'));
    globalThis.MutationObserver = class {
      observe() {}
      disconnect() {}
      takeRecords() { return []; }
    };

    const { unmount } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 3000));
    });

    expect(executeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        automation: { type: 'combat_superiority_prompt_skill_check' },
        name: 'Combat Superiority',
      }),
      mockPlayerStats,
      mockCampaignName,
      null
    );

    unmount();
  });

  it('should set combatSuperiorityModal when executeHandler returns combatSuperiority modal', async () => {
    getRuntimeValue.mockImplementation((key, prop, campaign) => {
      if (key === 'Thorin' && prop === 'pendingCombatSuperiorityPrompt' && campaign === 'test-campaign') {
        return {
          rollType: 'attack',
          attackContext: { d20: 10, targetAc: 15 },
        };
      }
      return null;
    });

    const modalPayload = {
      action: { name: 'Combat Superiority' },
      knownManeuvers: ['Rally', 'Disarming Attack'],
    };

    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'combatSuperiority',
      payload: modalPayload,
    });

    document.querySelector = vi.fn(() => document.createElement('div'));
    globalThis.MutationObserver = class {
      observe() {}
      disconnect() {}
      takeRecords() { return []; }
    };

    const { result, unmount } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 3000));
    });

    expect(result.current.combatSuperiorityModal).toEqual(modalPayload);

    // Should clear the pending prompt
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Thorin',
      'pendingCombatSuperiorityPrompt',
      null,
      mockCampaignName
    );

    unmount();
  });

  it('should clear pending prompt when executeHandler throws', async () => {
    getRuntimeValue.mockImplementation((key, prop, campaign) => {
      if (key === 'Thorin' && prop === 'pendingCombatSuperiorityPrompt' && campaign === 'test-campaign') {
        return {
          rollType: 'attack',
          attackContext: { d20: 10, targetAc: 15 },
        };
      }
      return null;
    });

    executeHandler.mockRejectedValue(new Error('Handler failed'));

    document.querySelector = vi.fn(() => document.createElement('div'));
    globalThis.MutationObserver = class {
      observe() {}
      disconnect() {}
      takeRecords() { return []; }
    };

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 3000));
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[useCombatSuperiorityModal] Error checking pending prompt:',
      expect.any(Error)
    );

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Thorin',
      'pendingCombatSuperiorityPrompt',
      null,
      mockCampaignName
    );

    consoleErrorSpy.mockRestore();
    unmount();
  });

  it('should not call executeHandler again if handledPending is true', async () => {
    getRuntimeValue.mockImplementation((key, prop, campaign) => {
      if (key === 'Thorin' && prop === 'pendingCombatSuperiorityPrompt' && campaign === 'test-campaign') {
        return {
          rollType: 'attack',
          attackContext: { d20: 10, targetAc: 15 },
        };
      }
      return null;
    });

    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'combatSuperiority',
      payload: { action: { name: 'Combat Superiority' } },
    });

    document.querySelector = vi.fn(() => document.createElement('div'));
    globalThis.MutationObserver = class {
      observe() {}
      disconnect() {}
      takeRecords() { return []; }
    };

    const { unmount } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    // Wait for first interval to fire
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 3000));
    });

    const callCountAfterFirst = executeHandler.mock.calls.length;

    expect(callCountAfterFirst).toBeGreaterThanOrEqual(1);

    unmount();
  });

  it('should wait for popup to disappear before calling executeHandler', async () => {
    getRuntimeValue.mockImplementation((key, prop, campaign) => {
      if (key === 'Thorin' && prop === 'pendingCombatSuperiorityPrompt' && campaign === 'test-campaign') {
        return {
          rollType: 'attack',
          attackContext: { d20: 10, targetAc: 15 },
        };
      }
      return null;
    });

    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'combatSuperiority',
      payload: { action: { name: 'Combat Superiority' } },
    });

    // Simulate popupHtmlRef.current being true initially
    document.querySelector = vi.fn(() => document.createElement('div'));
    globalThis.MutationObserver = class {
      observe() {}
      disconnect() {}
      takeRecords() { return []; }
    };

    // We need to simulate the popup being visible via the MutationObserver callback
    // The MutationObserver sets popupHtmlRef.current based on querySelector
    const charActions = document.createElement('div');
    charActions.className = 'char-actions';
    const popupEl = document.createElement('div');
    popupEl.className = 'superiority-popup';
    charActions.appendChild(popupEl);
    document.body.appendChild(charActions);

    globalThis.MutationObserver = class {
      observe(target, _options) {
        // Simulate mutation that adds a popup
        setTimeout(() => {
          const newPopup = document.createElement('div');
          newPopup.className = 'superiority-popup';
          target.appendChild(newPopup);
        }, 100);
      }
      disconnect() {}
      takeRecords() { return []; }
    };

    const { unmount } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    // Wait for the delay + popup check cycle
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 4000));
    });

    document.body.removeChild(charActions);
    unmount();
  });
});
