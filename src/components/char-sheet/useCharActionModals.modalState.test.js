// @maintained-by-ai
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useCharActionModals from './useCharActionModals.js';

// This lane owns setModalState merge/clear/updater SEMANTICS (source:
// useCharActionModals.js:13-19 — falsy clears to {}, truthy shallow-merges).
// Return shape + sub-hook arg pins live in useCharActionModals.integration.test.js;
// setModalState ref-stability and the pipeline-pause store args are pinned in
// useCharActionModals.additional.test.js — not restated here.

// Sub-hook mocks are required: the real modules pull in the combat pipeline /
// runtime-store import graph. Each mock supplies every key the hook destructures
// (honest mocks), generated fresh per mount.
vi.mock('./useAttackDamageResolution.js', () => ({
  default: vi.fn(() => ({
    resolveAttackDamage: vi.fn(),
    resumeAttackPipeline: vi.fn(),
    proceedWithDamage: vi.fn(),
    handleAttackRiderManeuverUse: vi.fn(),
    handleAttackRiderManeuverSkip: vi.fn(),
    handleAttackRiderOptionSelect: vi.fn(),
  })),
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

// The hook only reads [pendingDamage, setPendingDamage] for 'pipeline-pause';
// no pendingDamage behavior is exercised in this lane (its byte-pin belongs to
// additional.test.js), so the previous shared-state setter state machine here was
// dead mock machinery against the transitive import graph — purged.
vi.mock('../../hooks/runtime/useSyncedState.js', () => ({
  useSyncedState: vi.fn((_characterKey, _key, defaultValue) => [defaultValue, vi.fn()]),
}));

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

const mount = () => renderHook(() => useCharActionModals(makeArgs()));

describe('useCharActionModals — setModalState contract', () => {
  it('starts with an empty modalState object', () => {
    const { result } = mount();
    expect(result.current.modalState).toEqual({});
  });

  it('shallow-merges each update: preserves untouched keys, replaces overwritten keys wholesale (no deep merge), adds new keys, retains explicit nulls, and treats {} as a no-op', () => {
    const { result } = mount();

    act(() => {
      result.current.setModalState({
        constellation: { name: 'Archer' },
        divineFuryChoice: { type: 'Radiant' },
        damageTypeChoice: { types: ['Fire', 'Cold'] },
      });
    });
    act(() => {
      result.current.setModalState({
        divineFuryChoice: { pending: true },
        damageTypeChoice: null,
        featureChoice: { id: 'battle-spirit' },
      });
    });
    // byte-exact: constellation untouched (accumulation), divineFuryChoice fully
    // replaced — 'Radiant' must be gone (a lodash merge would keep it),
    // damageTypeChoice:null kept as a key (consumers truthiness-test it),
    // featureChoice added.
    expect(result.current.modalState).toEqual({
      constellation: { name: 'Archer' },
      divineFuryChoice: { pending: true },
      damageTypeChoice: null,
      featureChoice: { id: 'battle-spirit' },
    });

    // {} is truthy — it merges as a no-op rather than clearing.
    act(() => {
      result.current.setModalState({});
    });
    expect(result.current.modalState).toEqual({
      constellation: { name: 'Archer' },
      divineFuryChoice: { pending: true },
      damageTypeChoice: null,
      featureChoice: { id: 'battle-spirit' },
    });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['false', false],
    ['0', 0],
    ['empty string', ''],
  ])('clears all accumulated state when called with %s', (_label, falsyValue) => {
    const { result } = mount();
    act(() => {
      result.current.setModalState({
        divineFuryChoice: { type: 'Radiant' },
        damageTypeChoice: { types: ['Fire'] },
      });
    });
    act(() => {
      result.current.setModalState(falsyValue);
    });
    expect(result.current.modalState).toEqual({});
  });

  it('does not invoke function updaters (unlike React setState): the spread yields no own enumerable props, so existing keys are preserved untouched', () => {
    const { result } = mount();
    act(() => {
      result.current.setModalState({ divineFuryChoice: { type: 'Radiant' } });
    });

    // Plain function (not vi.fn — mock functions carry enumerable internals that
    // the spread would copy): call-count side effect pins "never invoked" without
    // polluting the merged state.
    let updaterCalls = 0;
    const updater = () => {
      updaterCalls += 1;
      return { updated: true };
    };
    act(() => {
      result.current.setModalState(updater);
    });
    expect(updaterCalls).toBe(0);
    expect(result.current.modalState).toEqual({ divineFuryChoice: { type: 'Radiant' } });
  });
});
