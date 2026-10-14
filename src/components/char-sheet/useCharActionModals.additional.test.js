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

vi.mock('../../hooks/runtime/useSyncedState.js', () => {
  const sharedState = { pipelinePause: null };
  const pipelinePauseSetter = vi.fn((fn) => {
    if (typeof fn === 'function') {
      sharedState.pipelinePause = fn(sharedState.pipelinePause);
    } else {
      sharedState.pipelinePause = fn;
    }
  });

  return {
    useSyncedState: vi.fn((characterKey, key, defaultValue) => {
      if (key === 'pipeline-pause') {
        return [sharedState.pipelinePause, pipelinePauseSetter];
      }
      let value = defaultValue;
      const setter = vi.fn((fn) => {
        if (typeof fn === 'function') {
          value = fn(value);
        } else {
          value = fn;
        }
      });
      return [value, setter];
    }),
    __resetPendingDamage: () => {
      sharedState.pipelinePause = null;
      pipelinePauseSetter.mockClear();
    },
  };
});

const useAttackDamageResolution = (await import('./useAttackDamageResolution.js')).default;
const useModalHandlers = (await import('./useModalHandlers.js')).default;
const { useCombatSuperiorityModal } = await import('../../hooks/combat/useCombatSuperiorityModal.js');
const { __resetPendingDamage } = await import('../../hooks/runtime/useSyncedState.js');

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

describe('useCharActionModals — callback stability & edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetPendingDamage();
    useAttackDamageResolution.mockReturnValue(mockResolveAttackDamageResult);
    useModalHandlers.mockReturnValue(mockModalHandlersResult);
  });

  describe('setModalState callback stability', () => {
    it('setModalState is a stable reference across renders when args do not change', () => {
      const { result, rerender } = renderHook(() => useCharActionModals(baseArgs));
      const firstRef = result.current.setModalState;
      rerender();
      expect(result.current.setModalState).toBe(firstRef);
    });
  });

  describe('setPendingDamage behavior', () => {
    it('setPendingDamage is callable without error', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(() => act(() => result.current.setPendingDamage({ data: 'value' }))).not.toThrow();
    });
  });

  describe('setCombatSuperiorityModal behavior', () => {
    it('setCombatSuperiorityModal is callable without error', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(() => act(() => result.current.setCombatSuperiorityModal({ type: 'test' }))).not.toThrow();
    });
  });

  describe('combatSuperiorityModal propagation from sub-hook', () => {
    it('returns non-null combatSuperiorityModal when sub-hook provides it', () => {
      const mockSuperiorityModal = { type: 'superiority', options: ['Savage Attacker'] };
      useCombatSuperiorityModal.mockReturnValue({
        combatSuperiorityModal: mockSuperiorityModal,
        setCombatSuperiorityModal: vi.fn(),
        handleCombatSuperiorityConfirm: vi.fn(),
        handleCombatSuperiorityReopenSelection: vi.fn(),
      });
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.combatSuperiorityModal).toEqual(mockSuperiorityModal);
    });
  });

  describe('unexposed args passthrough', () => {
    it('does NOT expose setPopupHtml in return object', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.setPopupHtml).toBeUndefined();
    });

    it('does NOT expose rollDamage in return object', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.rollDamage).toBeUndefined();
    });

    it('does NOT expose rollAttack in return object', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.rollAttack).toBeUndefined();
    });

    it('does NOT expose _setModalState internal state setter', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current._setModalState).toBeUndefined();
    });
  });

  describe('independent hook instances', () => {
    it('two separate hooks have independent modalState', () => {
      const { result: r1 } = renderHook(() => useCharActionModals(baseArgs));
      const { result: r2 } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        r1.current.setModalState({ hook: 1 });
      });
      expect(r1.current.modalState).toEqual({ hook: 1 });
      expect(r2.current.modalState).toEqual({});
    });
  });
});
