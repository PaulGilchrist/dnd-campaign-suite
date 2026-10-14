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

describe('useCharActionModals — attack rider maneuver handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetPendingDamage();
    useAttackDamageResolution.mockReturnValue(mockResolveAttackDamageResult);
    useModalHandlers.mockReturnValue(mockModalHandlersResult);
  });

  describe('attack rider maneuver handler return values', () => {
    it('returns handleAttackRiderManeuverUse as a function', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.handleAttackRiderManeuverUse).toBeDefined();
      expect(typeof result.current.handleAttackRiderManeuverUse).toBe('function');
    });

    it('returns handleAttackRiderManeuverSkip as a function', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.handleAttackRiderManeuverSkip).toBeDefined();
      expect(typeof result.current.handleAttackRiderManeuverSkip).toBe('function');
    });

    it('returns handleAttackRiderOptionSelect as a function', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.handleAttackRiderOptionSelect).toBeDefined();
      expect(typeof result.current.handleAttackRiderOptionSelect).toBe('function');
    });

    it('passes the handlers from useAttackDamageResolution unchanged', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(result.current.handleAttackRiderManeuverUse).toBe(mockResolveAttackDamageResult.handleAttackRiderManeuverUse);
      expect(result.current.handleAttackRiderManeuverSkip).toBe(mockResolveAttackDamageResult.handleAttackRiderManeuverSkip);
      expect(result.current.handleAttackRiderOptionSelect).toBe(mockResolveAttackDamageResult.handleAttackRiderOptionSelect);
    });

    it('all three handlers are callable without error', () => {
      const { result } = renderHook(() => useCharActionModals(baseArgs));
      expect(() => result.current.handleAttackRiderManeuverUse()).not.toThrow();
      expect(() => result.current.handleAttackRiderManeuverSkip()).not.toThrow();
      expect(() => result.current.handleAttackRiderOptionSelect()).not.toThrow();
    });
  });
});
