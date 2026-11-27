// @maintained-by-ai 2026-11-26
// Fixture-contract tests for createBaseProps (shared test factory, ~25 CharActionModals
// test files). Exactly two contracts are pinned, nothing else:
//  1. Prop shape — every prop consumers spread into <CharActionModals> exists with the
//     right type; one whole-object toEqual catches missing props, wrong types, and
//     stray extra props in a single failure. A missing handler prop crashes all
//     consumer lanes, so this is the fast diagnostic for that.
//  2. setModalState closure wiring — plain-object patches merge via Object.assign into
//     the SAME modalState object this factory call returned, and each call is isolated.
//     Production setModalState (useCharActionModals.js:13-19) only ever receives plain
//     objects and is never called with falsy updates, so the helper's updater-function
//     branch and the hook's clear-on-null branch are dead defensive code and are not
//     pinned here.
// Per-property override merging is exercised implicitly by every consumer test passing
// custom modalState/handlers through this factory. Component rendering:
// CharActionModals.rendering.test.jsx; handlers: CharActionModals.handlers.test.jsx.

import { describe, it, expect } from 'vitest';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

describe('createBaseProps fixture contract', () => {
  it('provides the full prop shape consumers spread into CharActionModals', () => {
    expect(createBaseProps()).toEqual({
      playerStats: { name: 'Test Character' },
      campaignName: 'test-campaign',
      characters: [],
      pendingDamage: null,
      modalState: {},
      setModalState: expect.any(Function),
      handleMasteryClose: expect.any(Function),
      handleWeaponMasteryChoice: expect.any(Function),
      handleWeaponKindMasteryClose: expect.any(Function),
      handleCleaveAttack: expect.any(Function),
      handleCleaveSkip: expect.any(Function),
      handleDivineFuryDamageType: expect.any(Function),
      handleDivineFurySkip: expect.any(Function),
      handleGenericDamageTypeChoice: expect.any(Function),
      handleGenericDamageTypeSkip: expect.any(Function),
      handleDamageTypeModifierChoice: expect.any(Function),
      handleDamageTypeModifierSkip: expect.any(Function),
      handleEnhancedUnarmedChoice: expect.any(Function),
      handleEnhancedUnarmedSkip: expect.any(Function),
      handleFeatureChoiceConfirm: expect.any(Function),
      handleFeatureChoiceSkip: expect.any(Function),
      handleConstellationSelect: expect.any(Function),
      handleCombatSuperiorityConfirm: expect.any(Function),
      handleAttackRiderManeuverUse: expect.any(Function),
      handleAttackRiderManeuverSkip: expect.any(Function),
      handleDivineInterventionCast: expect.any(Function),
      handleDivinationSavantConfirm: expect.any(Function),
      handleIllusionSavantConfirm: expect.any(Function),
    });
  });

  it('setModalState merges patches into the same modalState object, isolated per factory call', () => {
    const props = createBaseProps();
    const shared = props.modalState;

    // Second patch overwrites the first key — the modal-close pattern consumers use.
    props.setModalState({ cleaveModal: { id: 1 } });
    props.setModalState({ cleaveModal: null, shieldBashModal: { id: 2 } });

    // Same reference so consumer tests holding props.modalState observe every update.
    expect(props.modalState).toBe(shared);
    expect(shared).toEqual({ cleaveModal: null, shieldBashModal: { id: 2 } });

    // Fresh calls cannot leak state between consumer tests.
    const second = createBaseProps();
    expect(second.modalState).not.toBe(shared);
    expect(second.modalState).toEqual({});
  });
});
