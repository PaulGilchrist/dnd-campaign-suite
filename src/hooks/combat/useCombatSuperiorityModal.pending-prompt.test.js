// @improved-by-ai
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

const ATTACK_PROMPT = {
  rollType: 'attack',
  attackContext: { d20: 10, targetAc: 15 },
};

const SKILL_CHECK_PROMPT = {
  rollType: 'skill_check',
  skillContext: { skillName: 'Stealth' },
};

const COMBAT_SUPERIORITY_RESULT = {
  type: 'modal',
  modalName: 'combatSuperiority',
  payload: { action: { name: 'Combat Superiority' }, knownManeuvers: ['Rally'] },
};

describe('useCombatSuperiorityModal - Pending prompt polling', () => {
  const mockPlayerStats = { name: 'Thorin', level: 5 };
  const mockCampaignName = 'test-campaign';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    getRuntimeValue.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderWithPendingPrompt(pendingPrompt) {
    if (pendingPrompt != null) {
      getRuntimeValue.mockImplementation((key, prop, campaign) => {
        if (key === mockPlayerStats.name && prop === 'pendingCombatSuperiorityPrompt' && campaign === mockCampaignName) {
          return pendingPrompt;
        }
        return null;
      });
    } else {
      getRuntimeValue.mockReturnValue(null);
    }
  }

  function advancePendingHandler() {
    // Interval fires every 500ms, then setTimeout for SHOW_DICE_ROLL_DELAY (2000ms)
    // Total: 500 + 2000 = 2500ms for first execution
    return act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
  }

  it('should not call executeHandler when no pending prompt exists', () => {
    renderWithPendingPrompt(null);

    renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName)
    );

    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('should not call executeHandler when pending prompt has neither attackContext nor skillContext', () => {
    renderWithPendingPrompt({ rollType: 'attack', attackContext: null, skillContext: null });

    renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName)
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('should not call executeHandler when pending prompt rollType is unknown', () => {
    renderWithPendingPrompt({ rollType: 'spell', attackContext: { d20: 10 } });

    renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName)
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(executeHandler).not.toHaveBeenCalled();
  });

  it('should not call executeHandler when modal is already showing', () => {
    renderWithPendingPrompt(ATTACK_PROMPT);

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(executeHandler).not.toHaveBeenCalled();
    expect(result.current.combatSuperiorityModal).toEqual({ action: { name: 'Test' } });
  });

  it('should call executeHandler with combat_superiority_attack_rider for attack rollType', async () => {
    renderWithPendingPrompt(ATTACK_PROMPT);
    executeHandler.mockResolvedValue(COMBAT_SUPERIORITY_RESULT);

    renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName)
    );

    await advancePendingHandler();

    expect(executeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        automation: { type: 'combat_superiority_attack_rider' },
        name: 'Combat Superiority',
      }),
      mockPlayerStats,
      mockCampaignName,
      null
    );
  });

  it('should call executeHandler with combat_superiority_prompt_skill_check for skill_check rollType', async () => {
    renderWithPendingPrompt(SKILL_CHECK_PROMPT);
    executeHandler.mockResolvedValue(COMBAT_SUPERIORITY_RESULT);

    renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName)
    );

    await advancePendingHandler();

    expect(executeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        automation: { type: 'combat_superiority_prompt_skill_check' },
        name: 'Combat Superiority',
      }),
      mockPlayerStats,
      mockCampaignName,
      null
    );
  });

  it('should set combatSuperiorityModal and clear pending prompt when executeHandler returns combatSuperiority modal', async () => {
    const modalPayload = {
      action: { name: 'Combat Superiority' },
      knownManeuvers: ['Rally', 'Disarming Attack'],
    };
    renderWithPendingPrompt(ATTACK_PROMPT);
    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'combatSuperiority',
      payload: modalPayload,
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName)
    );

    expect(result.current.combatSuperiorityModal).toBeNull();

    await advancePendingHandler();

    expect(result.current.combatSuperiorityModal).toEqual(modalPayload);
    expect(setRuntimeValue).toHaveBeenCalledWith(
      mockPlayerStats.name,
      'pendingCombatSuperiorityPrompt',
      null,
      mockCampaignName
    );
  });

  it('should clear pending prompt and log error when executeHandler rejects', async () => {
    const error = new Error('Handler failed');
    renderWithPendingPrompt(ATTACK_PROMPT);
    executeHandler.mockRejectedValue(error);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName)
    );

    await advancePendingHandler();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[useCombatSuperiorityModal] Error checking pending prompt:',
      error
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      mockPlayerStats.name,
      'pendingCombatSuperiorityPrompt',
      null,
      mockCampaignName
    );

    consoleErrorSpy.mockRestore();
  });

  it('should invoke executeHandler only once per pending prompt (deduplication)', async () => {
    renderWithPendingPrompt(ATTACK_PROMPT);
    executeHandler.mockResolvedValue(COMBAT_SUPERIORITY_RESULT);

    renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName)
    );

    await advancePendingHandler();

    expect(executeHandler).toHaveBeenCalledTimes(1);
  });

  it('should not update modal state if non-combatSuperiority modal is returned', async () => {
    renderWithPendingPrompt(ATTACK_PROMPT);
    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'otherModal',
      payload: { action: { name: 'Other' } },
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName)
    );

    await advancePendingHandler();

    expect(result.current.combatSuperiorityModal).toBeNull();
    expect(setRuntimeValue).not.toHaveBeenCalledWith(
      mockPlayerStats.name,
      'pendingCombatSuperiorityPrompt',
      null,
      mockCampaignName
    );
  });
});
