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

describe('useCharActionModals — modalState behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetPendingDamage();
    useAttackDamageResolution.mockReturnValue(mockResolveAttackDamageResult);
    useModalHandlers.mockReturnValue(mockModalHandlersResult);
  });

  describe('setModalState initial state', () => {
    it('starts with empty modalState object', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.modalState).toEqual({});
    });

    it('setModalState is a function', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(typeof result.current.setModalState).toBe('function');
    });
  });

  describe('setModalState merge behavior', () => {
    it('merges a plain object into modalState', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setModalState({ divineFuryChoice: { type: 'Radiant' } });
      });
      expect(result.current.modalState).toEqual({ divineFuryChoice: { type: 'Radiant' } });
    });

    it('merges multiple updates cumulatively', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setModalState({ a: 1 });
      });
      act(() => {
        result.current.setModalState({ b: 2 });
      });
      expect(result.current.modalState).toEqual({ a: 1, b: 2 });
    });

    it('replaces a key when merging a second update', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setModalState({ key: 'first' });
      });
      act(() => {
        result.current.setModalState({ key: 'second' });
      });
      expect(result.current.modalState).toEqual({ key: 'second' });
    });

    it('can set multiple keys at once', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setModalState({
          divineFuryChoice: { type: 'Radiant' },
          damageTypeChoice: { types: ['Fire', 'Cold'] },
        });
      });
      expect(result.current.modalState).toEqual({
        divineFuryChoice: { type: 'Radiant' },
        damageTypeChoice: { types: ['Fire', 'Cold'] },
      });
    });

    it('partially clears by setting a key to null', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setModalState({ a: 1, b: 2 });
      });
      act(() => {
        result.current.setModalState({ a: null });
      });
      expect(result.current.modalState).toEqual({ a: null, b: 2 });
    });
  });

  describe('setModalState clearing behavior', () => {
    it('clears all state when called with null', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setModalState({ key: 'value' });
      });
      act(() => {
        result.current.setModalState(null);
      });
      expect(result.current.modalState).toEqual({});
    });

    it('clears all state when called with undefined', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setModalState({ key: 'value' });
      });
      act(() => {
        result.current.setModalState(undefined);
      });
      expect(result.current.modalState).toEqual({});
    });

    it('clears all state when called with false', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setModalState({ key: 'value' });
      });
      act(() => {
        result.current.setModalState(false);
      });
      expect(result.current.modalState).toEqual({});
    });

    it('clears all state when called with 0', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setModalState({ key: 'value' });
      });
      act(() => {
        result.current.setModalState(0);
      });
      expect(result.current.modalState).toEqual({});
    });

    it('clears all state when called with empty string', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setModalState({ key: 'value' });
      });
      act(() => {
        result.current.setModalState('');
      });
      expect(result.current.modalState).toEqual({});
    });

    it('preserves existing state when called with empty object', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setModalState({ key: 'value' });
      });
      act(() => {
        result.current.setModalState({});
      });
      expect(result.current.modalState).toEqual({ key: 'value' });
    });
  });

  describe('setModalState function updater rejection', () => {
    it('ignores function updaters - they are spread as no-ops', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      act(() => {
        result.current.setModalState({ key: 'value' });
      });
      act(() => {
        result.current.setModalState(() => ({ updated: true }));
      });
      expect(result.current.modalState).toEqual({ key: 'value' });
    });
  });
});
