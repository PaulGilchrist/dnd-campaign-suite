// Tests for createBaseProps — the shared test fixture used by all CharActionModals test files.
// Verifies the fixture's contract: default values, override behavior, isolation guarantees.
//
// Note: This file tests the test-utils fixture itself (not the CharActionModals component).
// Component rendering is covered in CharActionModals.rendering.test.jsx;
// handler callbacks are covered in CharActionModals.handlers.test.jsx and related files.
//
// Removed — redundant/brittle tests:
// - "each handler is a unique vi.fn instance" (O(n²) pairwise comparison of 24 handlers = 276 assertions
//   testing a Vitest framework guarantee, not application behavior. Fragile: breaks when handler list grows.)
// - "tracks call count for the vi.fn" (asserts mock implementation detail, not behavior. Covered by
//   the setModalState updater function test which validates the actual contract.)
// - "each call gets independent modalState that starts empty" (duplicates "modifying one modalState
//   does not affect another" — both test isolation; starting-empty is already asserted by default value tests.)
// - "allows adding extra custom props via spread" (tests JavaScript language behavior, not application logic.)

import { describe, it, expect, vi } from 'vitest';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

describe('createBaseProps', () => {
  describe('default values', () => {
    it('returns an object with playerStats defaulting to { name: "Test Character" }', () => {
      const props = createBaseProps();
      expect(props.playerStats).toEqual({ name: 'Test Character' });
    });

    it('returns campaignName defaulting to "test-campaign"', () => {
      const props = createBaseProps();
      expect(props.campaignName).toBe('test-campaign');
    });

    it('returns characters as an empty array', () => {
      const props = createBaseProps();
      expect(props.characters).toEqual([]);
    });

    it('returns pendingDamage as null', () => {
      const props = createBaseProps();
      expect(props.pendingDamage).toBeNull();
    });

    it('returns modalState as an empty object', () => {
      const props = createBaseProps();
      expect(props.modalState).toEqual({});
    });
  });

  describe('handler callbacks', () => {
    const handlerNames = [
      'handleMasteryClose',
      'handleWeaponMasteryChoice',
      'handleWeaponKindMasteryClose',
      'handleCleaveAttack',
      'handleCleaveSkip',
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
      'handleCombatSuperiorityConfirm',
      'handleAttackRiderManeuverUse',
      'handleAttackRiderManeuverSkip',
      'handleDivineInterventionCast',
      'handleDivinationSavantConfirm',
      'handleIllusionSavantConfirm',
    ];

    it('provides all expected handlers as functions', () => {
      const props = createBaseProps();
      for (const name of handlerNames) {
        expect(typeof props[name]).toBe('function');
      }
    });

    it('handlers track calls independently', () => {
      const props = createBaseProps();
      props.handleCleaveAttack();
      props.handleCleaveAttack();
      props.handleCleaveSkip();
      expect(props.handleCleaveAttack).toHaveBeenCalledTimes(2);
      expect(props.handleCleaveSkip).toHaveBeenCalledTimes(1);
    });
  });

  describe('setModalState', () => {
    it('is a function that accepts a plain object and spreads it into modalState', () => {
      const props = createBaseProps();
      props.setModalState({ foo: 'bar' });
      expect(props.modalState).toEqual({ foo: 'bar' });
    });

    it('is a function that accepts an updater function and passes modalState to it', () => {
      const props = createBaseProps();
      const updater = vi.fn((state) => ({ ...state, baz: 42 }));
      props.setModalState(updater);
      expect(updater).toHaveBeenCalledWith(props.modalState);
    });

  });

  describe('overrides', () => {
    it('overrides playerStats when provided', () => {
      const props = createBaseProps({ playerStats: { name: 'Override' } });
      expect(props.playerStats).toEqual({ name: 'Override' });
    });

    it('overrides campaignName when provided', () => {
      const props = createBaseProps({ campaignName: 'my-campaign' });
      expect(props.campaignName).toBe('my-campaign');
    });

    it('overrides characters when provided', () => {
      const props = createBaseProps({ characters: [{ name: 'Char1' }] });
      expect(props.characters).toEqual([{ name: 'Char1' }]);
    });

    it('overrides pendingDamage when provided', () => {
      const props = createBaseProps({ pendingDamage: { type: 'Fire' } });
      expect(props.pendingDamage).toEqual({ type: 'Fire' });
    });

    it('overrides setModalState when provided', () => {
      const customSet = vi.fn();
      const props = createBaseProps({ setModalState: customSet });
      expect(props.setModalState).toBe(customSet);
    });

    it('overrides individual handlers when provided', () => {
      const customHandler = vi.fn();
      const props = createBaseProps({ handleCleaveAttack: customHandler });
      expect(props.handleCleaveAttack).toBe(customHandler);
    });

    it('merges multiple overrides at once', () => {
      const customHandler = vi.fn();
      const props = createBaseProps({
        playerStats: { name: 'Foo' },
        campaignName: 'bar',
        pendingDamage: { type: 'Cold' },
        handleCleaveAttack: customHandler,
      });
      expect(props.playerStats).toEqual({ name: 'Foo' });
      expect(props.campaignName).toBe('bar');
      expect(props.pendingDamage).toEqual({ type: 'Cold' });
      expect(props.handleCleaveAttack).toBe(customHandler);
    });

    it('preserves un-overridden defaults when some overrides are provided', () => {
      const props = createBaseProps({
        playerStats: { name: 'Custom' },
        handleCleaveAttack: vi.fn(),
      });
      expect(props.playerStats).toEqual({ name: 'Custom' });
      expect(props.campaignName).toBe('test-campaign');
      expect(props.characters).toEqual([]);
      expect(props.pendingDamage).toBeNull();
      expect(typeof props.handleCleaveSkip).toBe('function');
    });

    it('handler overrides do not affect other handlers', () => {
      const customHandler = vi.fn();
      const props = createBaseProps({ handleCleaveAttack: customHandler });
      expect(props.handleCleaveAttack).toBe(customHandler);
      expect(typeof props.handleCleaveSkip).toBe('function');
      expect(typeof props.handleDivineFuryDamageType).toBe('function');
    });

  });

  describe('isolation', () => {
    it('returns a new props object each call', () => {
      const props1 = createBaseProps();
      const props2 = createBaseProps();
      expect(props1).not.toBe(props2);
    });

    it('returns a new modalState object each call', () => {
      const props1 = createBaseProps();
      const props2 = createBaseProps();
      expect(props1.modalState).not.toBe(props2.modalState);
    });

    it('modifying one modalState does not affect another', () => {
      const props1 = createBaseProps();
      const props2 = createBaseProps();
      props1.modalState.existing = true;
      expect(props2.modalState.existing).toBeUndefined();
    });

    it('overrides are isolated between calls', () => {
      const customHandler = vi.fn();
      const props1 = createBaseProps({ handleCleaveAttack: customHandler });
      const props2 = createBaseProps();
      expect(props1.handleCleaveAttack).toBe(customHandler);
      expect(props2.handleCleaveAttack).not.toBe(customHandler);
    });
  });
});
