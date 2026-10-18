// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useCharActionModals from './useCharActionModals.js';

// Sub-hook mocks are required: the hook destructures their full return shapes
// and the real modules pull in the combat pipeline / runtime store import graph.
// Each mock supplies every key the hook destructures (mock honesty).
vi.mock('./useAttackDamageResolution.js', () => ({
  default: vi.fn(),
}));

vi.mock('./useModalHandlers.js', () => ({
  default: vi.fn(() => ({
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
  })),
}));

vi.mock('../../hooks/combat/useCombatSuperiorityModal.js', () => ({
  useCombatSuperiorityModal: vi.fn(() => ({
    combatSuperiorityModal: null,
    setCombatSuperiorityModal: vi.fn(),
    handleCombatSuperiorityConfirm: vi.fn(),
    handleCombatSuperiorityReopenSelection: vi.fn(),
  })),
}));

// The hook reads 'pipeline-pause' from the synced store; the mock supplies
// [value, setter] per call — no persistence needed (no round-trip tests here;
// merge/clear semantics live in useCharActionModals.modalState.test.js).
vi.mock('../../hooks/runtime/useSyncedState.js', () => ({
  useSyncedState: vi.fn((characterKey, key, defaultValue) => {
    let value = defaultValue;
    const setter = vi.fn((fn) => {
      value = typeof fn === 'function' ? fn(value) : fn;
    });
    return [value, setter];
  }),
}));

const useAttackDamageResolution = (await import('./useAttackDamageResolution.js')).default;
const { useCombatSuperiorityModal } = await import('../../hooks/combat/useCombatSuperiorityModal.js');
const { useSyncedState } = await import('../../hooks/runtime/useSyncedState.js');

// Fresh result fixtures per mount — same-instance refs prove identity delegation.
const makeDamageResolutionResult = () => ({
  resolveAttackDamage: vi.fn(),
  resumeAttackPipeline: vi.fn(),
  proceedWithDamage: vi.fn(),
  handleAttackRiderManeuverUse: vi.fn(),
  handleAttackRiderManeuverSkip: vi.fn(),
  handleAttackRiderOptionSelect: vi.fn(),
});

const makeSuperiorityResult = () => ({
  combatSuperiorityModal: { type: 'superiority', options: ['Savage Attacker'] },
  setCombatSuperiorityModal: vi.fn(),
  handleCombatSuperiorityConfirm: vi.fn(),
  handleCombatSuperiorityReopenSelection: vi.fn(),
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

describe('useCharActionModals — seam invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAttackDamageResolution.mockReturnValue(makeDamageResolutionResult());
  });

  it('keeps setModalState a stable reference across re-renders and hands the same ref to useAttackDamageResolution each render', () => {
    const args = makeArgs();
    const { result, rerender } = renderHook(() => useCharActionModals(args));
    const firstRef = result.current.setModalState;
    const firstSubHookArg = useAttackDamageResolution.mock.calls[0][0];

    rerender();

    expect(useAttackDamageResolution).toHaveBeenCalledTimes(2);
    expect(result.current.setModalState).toBe(firstRef);
    // Why stability matters: sub-hooks receive setModalState each render —
    // per-render churn here would re-trigger their subscriptions.
    expect(useAttackDamageResolution.mock.calls[1][0].setModalState).toBe(firstRef);
    expect(useAttackDamageResolution.mock.calls[1][0].modalState).toBe(firstSubHookArg.modalState);
  });

  it('reads pipeline-pause from the synced store with exact server-first args', () => {
    renderHook(() => useCharActionModals(makeArgs()));
    expect(useSyncedState).toHaveBeenCalledWith('campaign', 'pipeline-pause', null, 'test-campaign');
  });

  it('dispatches positional args to useCombatSuperiorityModal and re-exposes all four outputs by same-instance identity', () => {
    const superiority = makeSuperiorityResult();
    useCombatSuperiorityModal.mockReturnValue(superiority);
    const args = makeArgs();

    const { result } = renderHook(() => useCharActionModals(args));

    expect(useCombatSuperiorityModal).toHaveBeenCalledWith(
      args.playerStats, args.campaignName, args.rollAttack, args.rollDamage, args.setPopupHtml,
    );
    expect(result.current.combatSuperiorityModal).toBe(superiority.combatSuperiorityModal);
    expect(result.current.setCombatSuperiorityModal).toBe(superiority.setCombatSuperiorityModal);
    expect(result.current.handleCombatSuperiorityConfirm).toBe(superiority.handleCombatSuperiorityConfirm);
    expect(result.current.handleCombatSuperiorityReopenSelection).toBe(superiority.handleCombatSuperiorityReopenSelection);
  });
});
