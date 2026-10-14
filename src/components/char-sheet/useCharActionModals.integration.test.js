import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
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
  handleAttackRiderManeuverUse: vi.fn(),
  handleAttackRiderManeuverSkip: vi.fn(),
  handleAttackRiderOptionSelect: vi.fn(),
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
  handleOpenHandFromFlurryConfirm: vi.fn(),
  handleOpenHandFromFlurrySkip: vi.fn(),
};

const baseArgs = {
  playerStats: { name: 'TestCharacter', class: { name: 'Fighter' } },
  campaignName: 'test-campaign',
  mapName: null,
  popupHtml: null,
  setPopupHtml: vi.fn(),
  rollDamage: vi.fn(),
  rollAttack: vi.fn(),
  buildCtx: vi.fn(() => Promise.resolve({})),
  buildCtxSync: vi.fn(() => ({})),
};

describe('useCharActionModals — integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAttackDamageResolution.mockReturnValue(mockResolveAttackDamageResult);
    useModalHandlers.mockReturnValue(mockModalHandlersResult);
  });

  describe('return object shape', () => {
    it('returns exactly 31 properties with the expected keys', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      const expectedKeys = [
        'modalState',
        'setModalState',
        'pendingDamage',
        'setPendingDamage',
        'buildCtx',
        'buildCtxSync',
        'combatSuperiorityModal',
        'setCombatSuperiorityModal',
        'handleCombatSuperiorityConfirm',
        'handleCombatSuperiorityReopenSelection',
        'resolveAttackDamage',
        'handleAttackRiderManeuverUse',
        'handleAttackRiderManeuverSkip',
        'handleAttackRiderOptionSelect',
        'handleMasteryClose',
        'handleWeaponMasteryChoice',
        'handleDivineFuryDamageType',
        'handleDivineFurySkip',
        'handleGenericDamageTypeChoice',
        'handleGenericDamageTypeSkip',
        'handleDamageTypeModifierChoice',
        'handleDamageTypeModifierSkip',
        'handleEnhancedUnarmedChoice',
        'handleEnhancedUnarmedSkip',
        'handleFeatureChoiceConfirm',
        'handleFeatureChoiceSkip',
        'handleConstellationSelect',
        'handleFlurryOfBlowsConfirm',
        'handleFlurryOfBlowsSkip',
        'handleOpenHandFromFlurryConfirm',
        'handleOpenHandFromFlurrySkip',
        'resumeAttackPipeline',
      ];
      const actualKeys = Object.keys(result.current).sort();
      const sortedExpected = [...expectedKeys].sort();
      expect(actualKeys).toEqual(sortedExpected);
    });
  });

  describe('sub-hook composition', () => {
    it('passes buildCtx and buildCtxSync through from args', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.buildCtx).toBe(baseArgs.buildCtx);
      expect(result.current.buildCtxSync).toBe(baseArgs.buildCtxSync);
    });

    it('passes mapName to useAttackDamageResolution when provided', () => {
      const argsWithMap = { ...baseArgs, mapName: 'test-map' };
      renderHook(() => useCharActionModals(argsWithMap));
      expect(useAttackDamageResolution).toHaveBeenCalledWith(
        expect.objectContaining({ mapName: 'test-map' }),
      );
    });

    it('does not expose internal args (setPopupHtml, rollDamage, rollAttack) in return object', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.setPopupHtml).toBeUndefined();
      expect(result.current.rollDamage).toBeUndefined();
      expect(result.current.rollAttack).toBeUndefined();
    });

    it('delegates resolveAttackDamage from useAttackDamageResolution', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.resolveAttackDamage).toBe(mockResolveAttackDamageResult.resolveAttackDamage);
    });

    it('delegates handleAttackRiderManeuverUse from useAttackDamageResolution', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.handleAttackRiderManeuverUse).toBe(mockResolveAttackDamageResult.handleAttackRiderManeuverUse);
    });

    it('delegates handleAttackRiderManeuverSkip from useAttackDamageResolution', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.handleAttackRiderManeuverSkip).toBe(mockResolveAttackDamageResult.handleAttackRiderManeuverSkip);
    });

    it('delegates handleAttackRiderOptionSelect from useAttackDamageResolution', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.handleAttackRiderOptionSelect).toBe(mockResolveAttackDamageResult.handleAttackRiderOptionSelect);
    });

    it('delegates all modal handlers from useModalHandlers', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.handleMasteryClose).toBe(mockModalHandlersResult.handleMasteryClose);
      expect(result.current.handleWeaponMasteryChoice).toBe(mockModalHandlersResult.handleWeaponMasteryChoice);
      expect(result.current.handleDivineFuryDamageType).toBe(mockModalHandlersResult.handleDivineFuryDamageType);
      expect(result.current.handleGenericDamageTypeChoice).toBe(mockModalHandlersResult.handleGenericDamageTypeChoice);
      expect(result.current.handleFeatureChoiceConfirm).toBe(mockModalHandlersResult.handleFeatureChoiceConfirm);
      expect(result.current.handleFlurryOfBlowsConfirm).toBe(mockModalHandlersResult.handleFlurryOfBlowsConfirm);
      expect(result.current.handleOpenHandFromFlurryConfirm).toBe(mockModalHandlersResult.handleOpenHandFromFlurryConfirm);
    });

    it('delegates combat superiority handlers from useCombatSuperiorityModal', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.handleCombatSuperiorityConfirm).toBe('function');
      expect(typeof result.current.handleCombatSuperiorityReopenSelection).toBe('function');
    });

    it('passes setModalState from useState to useAttackDamageResolution', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(useAttackDamageResolution).toHaveBeenCalledWith(
        expect.objectContaining({ setModalState: result.current.setModalState }),
      );
    });

    it('passes modalState from useState to useAttackDamageResolution', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(useAttackDamageResolution).toHaveBeenCalledWith(
        expect.objectContaining({ modalState: result.current.modalState }),
      );
    });

    it('passes proceedWithDamage from useAttackDamageResolution to useModalHandlers', () => {
      renderHook(() => useCharActionModals(baseArgs));
      expect(useModalHandlers).toHaveBeenCalledWith(
        expect.objectContaining({ proceedWithDamage: mockResolveAttackDamageResult.proceedWithDamage }),
      );
    });
  });

  describe('setModalState behavior in context', () => {
    it('starts as an empty object and setModalState merges updates', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.modalState).toEqual({});
      act(() => {
        result.current.setModalState({ key: 'value' });
      });
      expect(result.current.modalState).toEqual({ key: 'value' });
    });

    it('clears modalState when setModalState receives a falsy value', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setModalState({ key: 'value' });
      });
      act(() => {
        result.current.setModalState(null);
      });
      expect(result.current.modalState).toEqual({});
    });
  });

  describe('pendingDamage from useSyncedState', () => {
    it('defaults to null', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.pendingDamage).toBeNull();
    });

    it('setPendingDamage is callable', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(() => act(() => result.current.setPendingDamage({ data: 'test' }))).not.toThrow();
    });
  });
});
