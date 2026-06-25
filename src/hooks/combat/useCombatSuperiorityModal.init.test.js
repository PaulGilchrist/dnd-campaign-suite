import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCombatSuperiorityModal } from './useCombatSuperiorityModal.js';

// Mock all external dependencies
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

  it('should return the expected interface', () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, mockOnPopupHtml)
    );

    expect(result.current).toHaveProperty('combatSuperiorityModal', null);
    expect(result.current).toHaveProperty('setCombatSuperiorityModal');
    expect(result.current).toHaveProperty('handleCombatSuperiorityConfirm');
    expect(result.current).toHaveProperty('handleCombatSuperiorityReopenSelection');
    expect(typeof result.current.setCombatSuperiorityModal).toBe('function');
    expect(typeof result.current.handleCombatSuperiorityConfirm).toBe('function');
    expect(typeof result.current.handleCombatSuperiorityReopenSelection).toBe('function');
  });

  it('should initialize with null modal state', () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage)
    );

    expect(result.current.combatSuperiorityModal).toBeNull();
  });

  it('should work without onPopupHtml callback', () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, undefined)
    );

    expect(result.current).toHaveProperty('combatSuperiorityModal');
  });

  it('should work with null onPopupHtml', () => {
    const { result } = renderHook(
      () => useCombatSuperiorityModal(mockPlayerStats, mockCampaignName, mockRollAttack, mockRollDamage, null)
    );

    expect(result.current).toHaveProperty('combatSuperiorityModal');
  });
});
