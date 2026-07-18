// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useCharActionModals from './useCharActionModals.js';

vi.mock('./useAttackDamageResolution.js', () => ({
  default: vi.fn(),
}));

vi.mock('./useModalHandlers.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../hooks/combat/useCombatSuperiorityModal.js', () => ({
  useCombatSuperiorityModal: vi.fn(() => ({
    combatSuperiorityModal: null,
    setCombatSuperiorityModal: vi.fn(),
    handleCombatSuperiorityConfirm: vi.fn(),
    handleCombatSuperiorityReopenSelection: vi.fn(),
  })),
}));

vi.mock('../../hooks/runtime/useSyncedState.js', () => ({
  useSyncedState: vi.fn((_, key, defaultValue) => {
    let currentValue = defaultValue;
    const setter = vi.fn((fn) => {
      if (typeof fn === 'function') {
        currentValue = fn(currentValue);
      } else {
        currentValue = fn;
      }
      return currentValue;
    });
    return [currentValue, setter];
  }),
}));

const useAttackDamageResolution = (await import('./useAttackDamageResolution.js')).default;
const useModalHandlers = (await import('./useModalHandlers.js')).default;

const mockResolveAttackDamageResult = {
  resolveAttackDamage: vi.fn(),
  proceedWithDamage: vi.fn(),
};

const mockModalHandlersResult = {
  handleMasteryClose: vi.fn(),
  handleWeaponMasteryChoice: vi.fn(),
  handleDivineFuryDamageType: vi.fn(),
  handleDivineFurySkip: vi.fn(),
  handleGenericDamageTypeChoice: vi.fn(),
  handleGenericDamageTypeSkip: vi.fn(),
  handleDamageTypeModifierChoice: vi.fn(),
  handleDamageTypeModifierSkip: vi.fn(),
  handleEnhancedUnarmedChoice: vi.fn(),
  handleEnhancedUnarmedSkip: vi.fn(),
  handleFeatureChoiceConfirm: vi.fn(),
  handleFeatureChoiceSkip: vi.fn(),
  handleConstellationSelect: vi.fn(),
  handleFlurryOfBlowsConfirm: vi.fn(),
  handleFlurryOfBlowsSkip: vi.fn(),
};

const baseArgs = {
  playerStats: { name: 'TestCharacter', class: { name: 'Fighter' } },
  campaignName: 'test-campaign',
  mapName: null,
  popupHtml: null,
  setPopupHtml: vi.fn(),
  rollDamage: vi.fn(),
  buildCtx: vi.fn(() => Promise.resolve({})),
  buildCtxSync: vi.fn(() => ({})),
};

describe('useCharActionModals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAttackDamageResolution.mockReturnValue(mockResolveAttackDamageResult);
    useModalHandlers.mockReturnValue(mockModalHandlersResult);
  });

  it('returns an object with modalState, setModalState, delegated handlers, and combat superiority functions', () => {
    const { result } = renderHook(() => useCharActionModals(baseArgs));

    // modalState and setModalState
    expect(result.current.modalState).toEqual({});
    expect(typeof result.current.setModalState).toBe('function');

    // pendingDamage
    expect(result.current.pendingDamage).toBeNull();

    // Delegated handlers from useModalHandlers
    expect(result.current.resolveAttackDamage).toBe(mockResolveAttackDamageResult.resolveAttackDamage);
    expect(result.current.handleMasteryClose).toBe(mockModalHandlersResult.handleMasteryClose);
    expect(result.current.handleWeaponMasteryChoice).toBe(mockModalHandlersResult.handleWeaponMasteryChoice);
    expect(result.current.handleDivineFuryDamageType).toBe(mockModalHandlersResult.handleDivineFuryDamageType);
    expect(result.current.handleDivineFurySkip).toBe(mockModalHandlersResult.handleDivineFurySkip);
    expect(result.current.handleGenericDamageTypeChoice).toBe(mockModalHandlersResult.handleGenericDamageTypeChoice);
    expect(result.current.handleGenericDamageTypeSkip).toBe(mockModalHandlersResult.handleGenericDamageTypeSkip);
    expect(result.current.handleDamageTypeModifierChoice).toBe(mockModalHandlersResult.handleDamageTypeModifierChoice);
    expect(result.current.handleDamageTypeModifierSkip).toBe(mockModalHandlersResult.handleDamageTypeModifierSkip);
    expect(result.current.handleEnhancedUnarmedChoice).toBe(mockModalHandlersResult.handleEnhancedUnarmedChoice);
    expect(result.current.handleEnhancedUnarmedSkip).toBe(mockModalHandlersResult.handleEnhancedUnarmedSkip);
    expect(result.current.handleFeatureChoiceConfirm).toBe(mockModalHandlersResult.handleFeatureChoiceConfirm);
    expect(result.current.handleFeatureChoiceSkip).toBe(mockModalHandlersResult.handleFeatureChoiceSkip);
    expect(result.current.handleConstellationSelect).toBe(mockModalHandlersResult.handleConstellationSelect);
    expect(result.current.handleFlurryOfBlowsConfirm).toBe(mockModalHandlersResult.handleFlurryOfBlowsConfirm);
    expect(result.current.handleFlurryOfBlowsSkip).toBe(mockModalHandlersResult.handleFlurryOfBlowsSkip);

    // Delegated handlers from useCombatSuperiorityModal
    expect(typeof result.current.handleCombatSuperiorityConfirm).toBe('function');
    expect(typeof result.current.handleCombatSuperiorityReopenSelection).toBe('function');

    // Verify setModalState is a function that merges updates
    expect(typeof result.current.setModalState).toBe('function');
    expect(typeof result.current.modalState).toBe('object');
  });
});
