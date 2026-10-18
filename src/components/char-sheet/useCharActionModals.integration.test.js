// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useCharActionModals from './useCharActionModals.js';

// Sub-hook mocks are required: the real modules pull in the combat pipeline /
// runtime-store import graph. Each mock supplies every key the hook destructures
// (honest mocks). merge/clear semantics live in useCharActionModals.modalState.test.js;
// setModalState ref-stability, the pipeline-pause store read, and combat-superiority
// positional args/identity live in useCharActionModals.additional.test.js.
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

// Only 'pipeline-pause' is read by this hook. A stable setter lets the seam tests
// below pin same-instance forwarding of setPendingDamage to both sub-hooks.
const syncedStore = vi.hoisted(() => {
  const setter = vi.fn();
  return {
    setter,
    impl: (_characterKey, _key, defaultValue) => [defaultValue, setter],
  };
});
vi.mock('../../hooks/runtime/useSyncedState.js', () => ({
  useSyncedState: syncedStore.impl,
}));

const useAttackDamageResolution = (await import('./useAttackDamageResolution.js')).default;
const useModalHandlers = (await import('./useModalHandlers.js')).default;

// Fresh fixtures per mount — same-instance refs prove identity delegation.
const makeDamageResolutionResult = () => ({
  resolveAttackDamage: vi.fn(),
  resumeAttackPipeline: vi.fn(),
  proceedWithDamage: vi.fn(),
  handleAttackRiderManeuverUse: vi.fn(),
  handleAttackRiderManeuverSkip: vi.fn(),
  handleAttackRiderOptionSelect: vi.fn(),
});

const makeModalHandlersResult = () => ({
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
});

const makeArgs = () => ({
  playerStats: { name: 'TestCharacter', class: { name: 'Fighter' } },
  campaignName: 'test-campaign',
  mapName: null,
  popupHtml: null,
  setPopupHtml: vi.fn(),
  rollDamage: vi.fn(),
  rollAttack: vi.fn(),
  buildCtx: vi.fn(() => Promise.resolve({})),
  buildCtxSync: vi.fn(() => ({})),
  setTacticalMasterModal: vi.fn(),
});

describe('useCharActionModals — integration', () => {
  let adrResult;
  let mhResult;

  beforeEach(() => {
    // clearAllMocks keeps the inline useSyncedState mock implementation;
    // fresh return fixtures below guarantee fresh refs each mount.
    vi.clearAllMocks();
    adrResult = makeDamageResolutionResult();
    mhResult = makeModalHandlersResult();
    useAttackDamageResolution.mockReturnValue(adrResult);
    useModalHandlers.mockReturnValue(mhResult);
  });

  it('returns exactly the 32 public keys consumers rely on (and never leaks internal args)', () => {
    const { result } = renderHook(() => useCharActionModals(makeArgs()));
    // The exact-key set also pins the absence of internal args
    // (setPopupHtml, rollDamage, rollAttack, setTacticalMasterModal, resumeRef).
    expect(Object.keys(result.current).sort()).toEqual([
      'buildCtx',
      'buildCtxSync',
      'combatSuperiorityModal',
      'handleAttackRiderManeuverSkip',
      'handleAttackRiderManeuverUse',
      'handleAttackRiderOptionSelect',
      'handleCombatSuperiorityConfirm',
      'handleCombatSuperiorityReopenSelection',
      'handleConstellationSelect',
      'handleDamageTypeModifierChoice',
      'handleDamageTypeModifierSkip',
      'handleDivineFuryDamageType',
      'handleDivineFurySkip',
      'handleEnhancedUnarmedChoice',
      'handleEnhancedUnarmedSkip',
      'handleFeatureChoiceConfirm',
      'handleFeatureChoiceSkip',
      'handleFlurryOfBlowsConfirm',
      'handleFlurryOfBlowsSkip',
      'handleGenericDamageTypeChoice',
      'handleGenericDamageTypeSkip',
      'handleMasteryClose',
      'handleOpenHandFromFlurryConfirm',
      'handleOpenHandFromFlurrySkip',
      'handleWeaponMasteryChoice',
      'modalState',
      'pendingDamage',
      'resolveAttackDamage',
      'resumeAttackPipeline',
      'setCombatSuperiorityModal',
      'setModalState',
      'setPendingDamage',
    ]);
  });

  it('re-exposes every pass-through output by same-instance identity', () => {
    const args = makeArgs();
    const { result } = renderHook(() => useCharActionModals(args));

    const expectedIdentity = {
      // caller args handed back untouched
      buildCtx: args.buildCtx,
      buildCtxSync: args.buildCtxSync,
      // useAttackDamageResolution outputs (proceedWithDamage is consumed
      // internally, never re-exposed — pinned via the useModalHandlers args)
      resolveAttackDamage: adrResult.resolveAttackDamage,
      resumeAttackPipeline: adrResult.resumeAttackPipeline,
      handleAttackRiderManeuverUse: adrResult.handleAttackRiderManeuverUse,
      handleAttackRiderManeuverSkip: adrResult.handleAttackRiderManeuverSkip,
      handleAttackRiderOptionSelect: adrResult.handleAttackRiderOptionSelect,
      // synced-store setter (pendingDamage null default pinned in sub-hook args)
      setPendingDamage: syncedStore.setter,
      // every useModalHandlers output
      ...Object.fromEntries(
        Object.keys(mhResult).map((key) => [key, mhResult[key]])
      ),
    };
    for (const [key, ref] of Object.entries(expectedIdentity)) {
      expect(result.current[key], key).toBe(ref);
    }
    // Not restated here (owned by other lanes): combat-superiority quartet
    // identity + positional args (additional.test.js); modalState merge/clear
    // semantics (modalState.test.js).
  });

  describe.each([
    ['when mapName is null', null],
    ['when a map is selected', 'test-map'],
  ])('%s', (_label, mapName) => {
    it('dispatches byte-exact args to useAttackDamageResolution', () => {
      const args = { ...makeArgs(), mapName };
      const { result } = renderHook(() => useCharActionModals(args));

      const [adrArg] = useAttackDamageResolution.mock.calls[0];
      // resumeRef is an internal pipeline ref (useState/useRef-owned); its
      // behavior is pinned by useAttackDamageResolution's own resume tests.
      const { resumeRef, ...rest } = adrArg;
      expect(resumeRef).toBeDefined();
      expect(rest).toEqual({
        playerStats: args.playerStats,
        campaignName: args.campaignName,
        mapName,
        popupHtml: args.popupHtml,
        setPopupHtml: args.setPopupHtml,
        rollDamage: args.rollDamage,
        buildCtx: args.buildCtx,
        buildCtxSync: args.buildCtxSync,
        setModalState: result.current.setModalState,
        modalState: result.current.modalState,
        setPendingDamage: syncedStore.setter,
        setTacticalMasterModal: args.setTacticalMasterModal,
      });
    });
  });

  it('dispatches byte-exact args to useModalHandlers, wiring proceedWithDamage from useAttackDamageResolution', () => {
    const args = makeArgs();
    const { result } = renderHook(() => useCharActionModals(args));

    expect(useModalHandlers).toHaveBeenCalledWith({
      playerStats: args.playerStats,
      campaignName: args.campaignName,
      rollDamage: args.rollDamage,
      proceedWithDamage: adrResult.proceedWithDamage,
      pendingDamage: null,
      setPendingDamage: syncedStore.setter,
      setModalState: result.current.setModalState,
      modalState: result.current.modalState,
      setPopupHtml: args.setPopupHtml,
    });
  });
});
