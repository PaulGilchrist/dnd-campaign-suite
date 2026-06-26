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

describe('useCombatSuperiorityModal - Initialization', () => {
  const mockPlayerStats = { name: 'Thorin', level: 5 };
  const mockCampaignName = 'test-campaign';
  const mockRollAttack = vi.fn();
  const mockRollDamage = vi.fn();
  const mockOnPopupHtml = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null modal, setters, and handlers on mount', () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    expect(result.current.combatSuperiorityModal).toBeNull();
    expect(typeof result.current.setCombatSuperiorityModal).toBe('function');
    expect(typeof result.current.handleCombatSuperiorityConfirm).toBe('function');
    expect(typeof result.current.handleCombatSuperiorityReopenSelection).toBe('function');
  });

  it('should initialize with null modal state when no onPopupHtml callback is provided', () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    expect(result.current.combatSuperiorityModal).toBeNull();
  });

  it('should initialize without error when onPopupHtml is undefined', () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, undefined)
    );

    expect(result.current.combatSuperiorityModal).toBeNull();
    expect(typeof result.current.handleCombatSuperiorityConfirm).toBe('function');
  });

  it('should initialize without error when onPopupHtml is null', () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, null)
    );

    expect(result.current.combatSuperiorityModal).toBeNull();
    expect(typeof result.current.handleCombatSuperiorityConfirm).toBe('function');
  });

  it('should allow setCombatSuperiorityModal to update modal state', () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    const modalPayload = { action: { name: 'Test Maneuver' }, knownManeuvers: ['Rally'] };

    act(() => {
      result.current.setCombatSuperiorityModal(modalPayload);
    });

    expect(result.current.combatSuperiorityModal).toEqual(modalPayload);
  });

  it('should allow setCombatSuperiorityModal to clear modal state', () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    const modalPayload = { action: { name: 'Test Maneuver' } };

    act(() => {
      result.current.setCombatSuperiorityModal(modalPayload);
    });

    expect(result.current.combatSuperiorityModal).toEqual(modalPayload);

    act(() => {
      result.current.setCombatSuperiorityModal(null);
    });

    expect(result.current.combatSuperiorityModal).toBeNull();
  });
});
