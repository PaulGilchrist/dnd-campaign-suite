// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCombatSuperiorityModal } from './useCombatSuperiorityModal.js';

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
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

const createMockPlayerStats = (overrides = {}) => ({ name: 'Thorin', level: 5, ...overrides });
const defaultModalPayload = { action: { name: 'Test Maneuver' } };
const mockCampaignName = 'test-campaign';

describe('useCombatSuperiorityModal - handleCombatSuperiorityConfirm (no modal)', () => {
  const mockPlayerStats = createMockPlayerStats();
  const mockRollAttack = vi.fn();
  const mockRollDamage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return early without error when combatSuperiorityModal is null', async () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm(['Test Maneuver']);
    });

    expect(result.current.combatSuperiorityModal).toBeNull();
    expect(executeHandler).not.toHaveBeenCalled();
    expect(executeManeuver).not.toHaveBeenCalled();
    expect(onCombatSuperioritySelected).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('should clear the modal and not call any handlers when confirm is called with a modal set but no maneuver path taken', async () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    act(() => {
      result.current.setCombatSuperiorityModal(defaultModalPayload);
    });

    expect(result.current.combatSuperiorityModal).toEqual(defaultModalPayload);

    executeManeuver.mockResolvedValue({});

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm(['Test Maneuver']);
    });

    expect(result.current.combatSuperiorityModal).toBeNull();
  });
});

describe('useCombatSuperiorityModal - handleCombatSuperiorityConfirm (single-use maneuver)', () => {
  const mockPlayerStats = createMockPlayerStats();
  const mockRollAttack = vi.fn();
  const mockRollDamage = vi.fn();
  const mockOnPopupHtml = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call executeManeuver with correct arguments when singleUseManeuverName is provided', async () => {
    executeManeuver.mockResolvedValue({});

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    act(() => {
      result.current.setCombatSuperiorityModal(defaultModalPayload);
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Precision Strike');
    });

    expect(executeManeuver).toHaveBeenCalledWith(
      { name: 'Test Maneuver' },
      mockPlayerStats,
      mockCampaignName,
      'Precision Strike'
    );
  });

  it('should call onCombatSuperioritySelected when no singleUseManeuverName', async () => {
    onCombatSuperioritySelected.mockResolvedValue({});

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
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

  it('should clear the modal after confirming a single-use maneuver', async () => {
    executeManeuver.mockResolvedValue({});

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    act(() => {
      result.current.setCombatSuperiorityModal(defaultModalPayload);
    });

    expect(result.current.combatSuperiorityModal).toEqual(defaultModalPayload);

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Rally');
    });

    expect(result.current.combatSuperiorityModal).toBeNull();
  });

  it('should clear the modal after confirming a multi-maneuver selection', async () => {
    onCombatSuperioritySelected.mockResolvedValue({});

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Select Maneuvers' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm(['Rally']);
    });

    expect(result.current.combatSuperiorityModal).toBeNull();
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
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    act(() => {
      result.current.setCombatSuperiorityModal(defaultModalPayload);
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
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
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

  it('should not throw when addEntry rejects during executeManeuver result processing', async () => {
    addEntry.mockRejectedValue(new Error('Log write failed'));

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    executeManeuver.mockResolvedValue({
      logEntries: [
        { type: 'ability_use', characterName: 'Thorin', abilityName: 'Rally', description: 'Rally used.' },
      ],
      type: 'popup',
      payload: { name: 'Rally', description: 'Rally used.' },
    });

    act(() => {
      result.current.setCombatSuperiorityModal(defaultModalPayload);
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Rally');
    });

    expect(result.current.combatSuperiorityModal).toBeNull();
  });

  it('should call onPopupHtml with raw string payload when executeManeuver returns type popup with string', async () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    executeManeuver.mockResolvedValue({
      type: 'popup',
      payload: '<b>Test</b><br/>Description.',
    });

    act(() => {
      result.current.setCombatSuperiorityModal(defaultModalPayload);
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Test');
    });

    expect(mockOnPopupHtml).toHaveBeenCalledWith('<b>Test</b><br/>Description.');
  });

  it('should call onPopupHtml with formatted HTML when executeManeuver returns type popup with object payload', async () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
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

    expect(mockOnPopupHtml).toHaveBeenCalledWith(
      '<b><i class="fa-solid fa-bolt"></i> Disarming Attack</b><br/>Target drops an item.<br/><span class="dice-roll-hint">click to dismiss</span>'
    );
  });

  it('should call onPopupHtml with formatted HTML when onCombatSuperioritySelected returns type popup', async () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
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

    expect(mockOnPopupHtml).toHaveBeenCalledWith(
      '<b><i class="fa-solid fa-bolt"></i> Maneuver Selection</b><br/>Maneuvers selected.<br/><span class="dice-roll-hint">click to dismiss</span>'
    );
  });

  it('should dispatch bait-and-switch-modal-show event when executeManeuver returns baitAndSwitchChoice modal', async () => {
    const baitAndSwitchPayload = {
      playerStats: mockPlayerStats,
      campaignName: mockCampaignName,
      dieValue: 6,
      maneuverName: 'Bait and Switch',
      options: [
        { label: 'Myself (Thorin)', value: 'Thorin' },
        { label: 'Ally (Grog)', value: 'Grog' },
      ],
      description: 'Bait and Switch: Rolled d6 for 6.',
    };

    executeManeuver.mockResolvedValue({
      type: 'modal',
      modalName: 'baitAndSwitchChoice',
      payload: baitAndSwitchPayload,
      logEntries: [
        { type: 'ability_use', characterName: 'Thorin', abilityName: 'Bait and Switch', description: 'Bait and Switch used.' },
      ],
    });

    const dispatchedEvents = [];
    const originalDispatchEvent = window.dispatchEvent;
    window.dispatchEvent = vi.fn((event) => {
      dispatchedEvents.push(event);
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, null, null)
    );

    act(() => {
      result.current.setCombatSuperiorityModal(defaultModalPayload);
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Bait and Switch');
    });

    expect(dispatchedEvents.length).toBe(1);
    expect(dispatchedEvents[0].type).toBe('bait-and-switch-modal-show');
    expect(dispatchedEvents[0].detail).toEqual(baitAndSwitchPayload);

    window.dispatchEvent = originalDispatchEvent;
  });

  it('should dispatch commander-strike-modal-show event when executeManeuver returns commanderStrikeChoice modal', async () => {
    const commanderStrikePayload = {
      playerStats: mockPlayerStats,
      campaignName: mockCampaignName,
      options: [{ label: 'Me', value: 'Thorin' }],
    };

    executeManeuver.mockResolvedValue({
      type: 'modal',
      modalName: 'commanderStrikeChoice',
      payload: commanderStrikePayload,
    });

    const dispatchedEvents = [];
    const originalDispatchEvent = window.dispatchEvent;
    window.dispatchEvent = vi.fn((event) => {
      dispatchedEvents.push(event);
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    act(() => {
      result.current.setCombatSuperiorityModal(defaultModalPayload);
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Commander Strike');
    });

    expect(dispatchedEvents.length).toBe(1);
    expect(dispatchedEvents[0].type).toBe('commander-strike-modal-show');
    expect(dispatchedEvents[0].detail).toEqual(commanderStrikePayload);

    window.dispatchEvent = originalDispatchEvent;
  });

  it('should dispatch rally-choice-modal-show event when executeManeuver returns rallyChoice modal', async () => {
    const rallyPayload = {
      playerStats: mockPlayerStats,
      campaignName: mockCampaignName,
      options: [{ label: 'Myself', value: 'Thorin' }],
    };

    executeManeuver.mockResolvedValue({
      type: 'modal',
      modalName: 'rallyChoice',
      payload: rallyPayload,
    });

    const dispatchedEvents = [];
    const originalDispatchEvent = window.dispatchEvent;
    window.dispatchEvent = vi.fn((event) => {
      dispatchedEvents.push(event);
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    act(() => {
      result.current.setCombatSuperiorityModal(defaultModalPayload);
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Rally');
    });

    expect(dispatchedEvents.length).toBe(1);
    expect(dispatchedEvents[0].type).toBe('rally-choice-modal-show');
    expect(dispatchedEvents[0].detail).toEqual(rallyPayload);

    window.dispatchEvent = originalDispatchEvent;
  });

  it('should dispatch rally-choice-modal-show event when onCombatSuperioritySelected returns rallyChoice modal', async () => {
    const rallyPayload = {
      playerStats: mockPlayerStats,
      campaignName: mockCampaignName,
      options: [{ label: 'Myself', value: 'Thorin' }],
    };

    onCombatSuperioritySelected.mockResolvedValue({
      type: 'modal',
      modalName: 'rallyChoice',
      payload: rallyPayload,
    });

    const dispatchedEvents = [];
    const originalDispatchEvent = window.dispatchEvent;
    window.dispatchEvent = vi.fn((event) => {
      dispatchedEvents.push(event);
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Select Maneuvers' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm(['Rally']);
    });

    expect(dispatchedEvents.length).toBe(1);
    expect(dispatchedEvents[0].type).toBe('rally-choice-modal-show');
    expect(dispatchedEvents[0].detail).toEqual(rallyPayload);

    window.dispatchEvent = originalDispatchEvent;
  });

  it('should call rollAttack when executeManeuver returns type attack_roll', async () => {
    executeManeuver.mockResolvedValue({
      type: 'attack_roll',
      payload: {
        attack: { name: 'Riposte', hitBonus: 7, damageFormula: '1d6 + 3', damageType: 'Slashing' },
        targetName: 'Ogre',
      },
      context: { superiorityDieValue: 3, baseDamageFormula: '1d6 + 3' },
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    act(() => {
      result.current.setCombatSuperiorityModal(defaultModalPayload);
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Riposte');
    });

    expect(mockRollAttack).toHaveBeenCalledWith(
      'Riposte',
      10,
      expect.objectContaining({
        targetName: 'Ogre',
        isOpportunityAttack: true,
        autoDamageFormula: '1d6 + 3 + 3 [Superiority]',
        autoDamageName: 'Riposte (Riposte)',
        damageType: 'Slashing',
        superiorityDieValue: 3,
        ripostePopup: undefined,
      })
    );
  });

  it('should call rollAttack without combined formula when superiorityDieValue is zero', async () => {
    executeManeuver.mockResolvedValue({
      type: 'attack_roll',
      payload: {
        attack: { name: 'Counter', hitBonus: 5, damageFormula: '1d4 + 2' },
        targetName: 'Bandit',
      },
      context: { superiorityDieValue: 0, baseDamageFormula: '1d4 + 2' },
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    act(() => {
      result.current.setCombatSuperiorityModal(defaultModalPayload);
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Counter');
    });

    expect(mockRollAttack).toHaveBeenCalledWith(
      'Counter',
      5,
      expect.objectContaining({
        autoDamageFormula: '1d4 + 2',
        superiorityDieValue: 0,
      })
    );
  });

  it('should call onPopupHtml with popup property from onCombatSuperioritySelected', async () => {
    onCombatSuperioritySelected.mockResolvedValue({
      popup: { name: 'Pushing Attack', description: 'Target pushed 10 feet.' },
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Select Maneuvers' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm(['Pushing Attack']);
    });

    expect(mockOnPopupHtml).toHaveBeenCalledWith(
      '<b><i class="fa-solid fa-bolt"></i> Pushing Attack</b><br/>Target pushed 10 feet.<br/><span class="dice-roll-hint">click to dismiss</span>'
    );
  });

  it('should call rollAttack with combined formula when onCombatSuperioritySelected returns type attack_roll', async () => {
    onCombatSuperioritySelected.mockResolvedValue({
      type: 'attack_roll',
      payload: {
        attack: { name: 'Riposte', hitBonus: 6, damageFormula: '1d6 + 3', damageType: 'Slashing' },
        targetName: 'Troll',
      },
      context: { superiorityDieValue: 2, baseDamageFormula: '1d6 + 3' },
    });

    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Select Maneuvers' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm(['Riposte']);
    });

    expect(mockRollAttack).toHaveBeenCalledWith(
      'Riposte',
      8,
      expect.objectContaining({
        targetName: 'Troll',
        isOpportunityAttack: true,
        autoDamageFormula: '1d6 + 3 + 2 [Superiority]',
        superiorityDieValue: 2,
      })
    );
  });
});
