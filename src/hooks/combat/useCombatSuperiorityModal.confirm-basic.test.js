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
import { addEntry } from '../../services/ui/logService.js';
import { executeManeuver, onCombatSuperioritySelected } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';

describe('useCombatSuperiorityModal - handleCombatSuperiorityConfirm (no modal)', () => {
  const mockPlayerStats = { name: 'Thorin', level: 5 };
  const mockCampaignName = 'test-campaign';
  const mockRollAttack = vi.fn();
  const mockRollDamage = vi.fn();

  it('should return early without error when combatSuperiorityModal is null', async () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm(['Test Maneuver']);
    });

    expect(executeHandler).not.toHaveBeenCalled();
    expect(executeManeuver).not.toHaveBeenCalled();
    expect(onCombatSuperioritySelected).not.toHaveBeenCalled();
  });

  it('should clear the modal when confirm is called with a modal set', async () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
    });

    executeManeuver.mockResolvedValue({});

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm(['Test Maneuver']);
    });

    expect(result.current.combatSuperiorityModal).toBeNull();
  });
});

describe('useCombatSuperiorityModal - handleCombatSuperiorityConfirm (single-use maneuver)', () => {
  const mockPlayerStats = { name: 'Thorin', level: 5 };
  const mockCampaignName = 'test-campaign';
  const mockRollAttack = vi.fn();
  const mockRollDamage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call executeManeuver when singleUseManeuverName is provided', async () => {
    const maneuverResult = {
      type: 'popup',
      payload: { name: 'Precision Strike', description: 'Added damage to attack.' },
    };
    executeManeuver.mockResolvedValue(maneuverResult);

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Precision Strike' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Precision Strike');
    });

    expect(executeManeuver).toHaveBeenCalledWith(
      { name: 'Precision Strike' },
      mockPlayerStats,
      mockCampaignName,
      'Precision Strike'
    );
  });

  it('should call onCombatSuperioritySelected when no singleUseManeuverName', async () => {
    const selectionResult = {
      type: 'popup',
      payload: { name: 'Maneuver Selection', description: 'Maneuvers selected.' },
    };
    onCombatSuperioritySelected.mockResolvedValue(selectionResult);

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Select Maneuvers' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm(['Rally', 'Disarming Attack']);
    });

    expect(onCombatSuperioritySelected).toHaveBeenCalledWith(
      { name: 'Select Maneuvers' },
      mockPlayerStats,
      mockCampaignName,
      ['Rally', 'Disarming Attack'],
      undefined
    );
  });

  it('should add log entries from executeManeuver result', async () => {
    executeManeuver.mockResolvedValue({
      logEntries: [
        { type: 'ability_use', characterName: 'Thorin', abilityName: 'Rally', description: 'Rally used.' },
      ],
      type: 'popup',
      payload: { name: 'Rally', description: 'Rally used.' },
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Rally' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Rally');
    });

    expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
      type: 'ability_use',
      characterName: 'Thorin',
      abilityName: 'Rally',
      description: 'Rally used.',
    });
  });

  it('should add log entries from onCombatSuperioritySelected result', async () => {
    onCombatSuperioritySelected.mockResolvedValue({
      logEntries: [
        { type: 'ability_use', characterName: 'Thorin', abilityName: 'Selection', description: 'Selected.' },
      ],
      type: 'popup',
      payload: { name: 'Selection', description: 'Selected.' },
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Select Maneuvers' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm(['Rally']);
    });

    expect(addEntry).toHaveBeenCalledWith(mockCampaignName, {
      type: 'ability_use',
      characterName: 'Thorin',
      abilityName: 'Selection',
      description: 'Selected.',
    });
  });

  it('should show popup when executeManeuver returns type popup with string payload', async () => {
    const showPopupMock = vi.fn();
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, showPopupMock)
    );

    executeManeuver.mockResolvedValue({
      type: 'popup',
      payload: '<b>Test</b><br/>Description.',
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Test');
    });

    expect(showPopupMock).toHaveBeenCalledWith('<b>Test</b><br/>Description.');
  });

  it('should show popup when executeManeuver returns type popup with object payload', async () => {
    const showPopupMock = vi.fn();
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, showPopupMock)
    );

    executeManeuver.mockResolvedValue({
      type: 'popup',
      payload: { name: 'Disarming Attack', description: 'Target drops an item.' },
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Disarming Attack' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Disarming Attack');
    });

    expect(showPopupMock).toHaveBeenCalledWith(
      '<b><i class="fa-solid fa-bolt"></i> Disarming Attack</b><br/>Target drops an item.<br/><span class="dice-roll-hint">click to dismiss</span>'
    );
  });

  it('should show popup when onCombatSuperioritySelected returns type popup', async () => {
    const showPopupMock = vi.fn();
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, showPopupMock)
    );

    onCombatSuperioritySelected.mockResolvedValue({
      type: 'popup',
      payload: { name: 'Maneuver Selection', description: 'Maneuvers selected.' },
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Select Maneuvers' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm(['Rally']);
    });

    expect(showPopupMock).toHaveBeenCalledWith(
      '<b><i class="fa-solid fa-bolt"></i> Maneuver Selection</b><br/>Maneuvers selected.<br/><span class="dice-roll-hint">click to dismiss</span>'
    );
  });

  it('should show popup when onCombatSuperioritySelected returns popup field', async () => {
    const showPopupMock = vi.fn();
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, showPopupMock)
    );

    onCombatSuperioritySelected.mockResolvedValue({
      popup: { name: 'Selection', description: 'Done.' },
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Select Maneuvers' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm(['Rally']);
    });

    expect(showPopupMock).toHaveBeenCalledWith(
      '<b><i class="fa-solid fa-bolt"></i> Selection</b><br/>Done.<br/><span class="dice-roll-hint">click to dismiss</span>'
    );
  });
});
