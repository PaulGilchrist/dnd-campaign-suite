// @maintained-by-ai
// Fixture-contract tests for createBaseProps (shared by ~24 CharActionModals test files).
// Only the non-tautological contracts are covered here:
//  1. The prop shape the component consumes — every prop must exist as the right type
//     (props are spread into the component; a missing/non-function prop crashes consumer tests).
//  2. setModalState's closure wiring — plain-object updates mutate the *same* modalState
//     object this factory call returned (production setModalState only ever receives plain
//     objects, per useCharActionModals.js, so updater-function semantics are not tested).
// Per-property override merging and per-call vi.fn identity are omitted — they restate
// `...overrides` / vi.fn() language guarantees. Override behavior itself is exercised
// implicitly by every consumer test that passes custom modalState/handlers through this factory.
// Component rendering: CharActionModals.rendering.test.jsx; handlers: CharActionModals.handlers.test.jsx.

import { describe, it, expect } from 'vitest';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

describe('createBaseProps fixture contract', () => {
  it('provides the full prop shape consumers spread into CharActionModals, with fresh isolated state per call', () => {
    const props = createBaseProps();
    const { setModalState, modalState, ...values } = props;

    expect(values).toEqual({
      playerStats: { name: 'Test Character' },
      campaignName: 'test-campaign',
      characters: [],
      pendingDamage: null,
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
    expect(typeof setModalState).toBe('function');

    // Fresh state objects per call so consumer tests cannot leak into each other.
    const second = createBaseProps();
    expect(second.modalState).not.toBe(modalState);
    expect(second.setModalState).not.toBe(setModalState);
  });

  it('setModalState({ patch }) mutates the modalState object returned by the same call', () => {
    const props = createBaseProps();
    const shared = props.modalState;

    props.setModalState({ cleaveModal: { id: 1 } });
    props.setModalState({ cleaveModal: null, shieldBashModal: { id: 2 } });

    // Same reference so consumer tests that hold props.modalState observe updates.
    expect(props.modalState).toBe(shared);
    expect(shared).toEqual({ cleaveModal: null, shieldBashModal: { id: 2 } });

    // Isolated from other factory calls.
    expect(createBaseProps().modalState).toEqual({});
  });
});
