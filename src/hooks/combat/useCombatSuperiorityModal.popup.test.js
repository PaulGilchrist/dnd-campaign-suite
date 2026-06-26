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

import { executeManeuver } from '../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js';

describe('useCombatSuperiorityModal - showPopup callback', () => {
  const mockPlayerStats = { name: 'Thorin', level: 5 };
  const mockCampaignName = 'test-campaign';
  const mockRollAttack = vi.fn();
  const mockRollDamage = vi.fn();
  const mockOnPopupHtml = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call onPopupHtml with a string payload when showPopup is triggered', async () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    const stringPayload = '<b>Raw HTML</b><br/>No formatting.';
    executeManeuver.mockResolvedValue({
      type: 'popup',
      payload: stringPayload,
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Test');
    });

    expect(mockOnPopupHtml).toHaveBeenCalledWith(stringPayload);
  });

  it('should call onPopupHtml with formatted HTML when showPopup is triggered with an object payload', async () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    const popupPayload = { name: 'Gouging Attack', description: 'Target takes extra damage.' };
    executeManeuver.mockResolvedValue({
      type: 'popup',
      payload: popupPayload,
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Gouging Attack' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Gouging Attack');
    });

    expect(mockOnPopupHtml).toHaveBeenCalledWith(
      '<b><i class="fa-solid fa-bolt"></i> Gouging Attack</b><br/>Target takes extra damage.<br/><span class="dice-roll-hint">click to dismiss</span>'
    );
  });

  it('should not call onPopupHtml when it is undefined', async () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, undefined)
    );

    executeManeuver.mockResolvedValue({
      type: 'popup',
      payload: { name: 'Test', description: 'Should not error.' },
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Test');
    });

    expect(mockOnPopupHtml).not.toHaveBeenCalled();
  });

  it('should not call onPopupHtml when it is null', async () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, null)
    );

    executeManeuver.mockResolvedValue({
      type: 'popup',
      payload: { name: 'Test', description: 'Should not error.' },
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Test');
    });

    expect(mockOnPopupHtml).not.toHaveBeenCalled();
  });

  it('should format popup HTML with fallback name when payload has no name', async () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    executeManeuver.mockResolvedValue({
      type: 'popup',
      payload: { description: 'No name provided.' },
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Test');
    });

    expect(mockOnPopupHtml).toHaveBeenCalledWith(
      '<b><i class="fa-solid fa-bolt"></i> Combat Superiority</b><br/>No name provided.<br/><span class="dice-roll-hint">click to dismiss</span>'
    );
  });

  it('should format popup HTML with fallback description when payload has no description', async () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    executeManeuver.mockResolvedValue({
      type: 'popup',
      payload: { name: 'Test Maneuver' },
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Test');
    });

    expect(mockOnPopupHtml).toHaveBeenCalledWith(
      '<b><i class="fa-solid fa-bolt"></i> Test Maneuver</b><br/><br/><span class="dice-roll-hint">click to dismiss</span>'
    );
  });

  it('should format popup HTML with fallback name when payload name is empty string', async () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    executeManeuver.mockResolvedValue({
      type: 'popup',
      payload: { name: '', description: 'Empty name.' },
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Test');
    });

    expect(mockOnPopupHtml).toHaveBeenCalledWith(
      '<b><i class="fa-solid fa-bolt"></i> Combat Superiority</b><br/>Empty name.<br/><span class="dice-roll-hint">click to dismiss</span>'
    );
  });

  it('should format popup HTML with empty description line when payload description is empty string', async () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    executeManeuver.mockResolvedValue({
      type: 'popup',
      payload: { name: 'Test', description: '' },
    });

    act(() => {
      result.current.setCombatSuperiorityModal({ action: { name: 'Test' } });
    });

    await act(async () => {
      await result.current.handleCombatSuperiorityConfirm([], 'Test');
    });

    expect(mockOnPopupHtml).toHaveBeenCalledWith(
      '<b><i class="fa-solid fa-bolt"></i> Test</b><br/><br/><span class="dice-roll-hint">click to dismiss</span>'
    );
  });
});
