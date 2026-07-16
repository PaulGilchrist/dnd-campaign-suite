import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

describe('createBaseProps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('default values', () => {
    it('returns an object with playerStats defaulting to { name: "Test Character" }', () => {
      const props = createBaseProps();
      expect(props.playerStats).toEqual({ name: 'Test Character' });
    });

    it('returns campaignName defaulting to "test-campaign"', () => {
      const props = createBaseProps();
      expect(props.campaignName).toBe('test-campaign');
    });

    it('returns characters defaulting to empty array', () => {
      const props = createBaseProps();
      expect(props.characters).toEqual([]);
    });

    it('returns pendingDamage defaulting to null', () => {
      const props = createBaseProps();
      expect(props.pendingDamage).toBeNull();
    });

    it('returns a fresh modalState object each call', () => {
      const props1 = createBaseProps();
      const props2 = createBaseProps();
      expect(props1.modalState).not.toBe(props2.modalState);
    });
  });

  describe('setModalState behavior', () => {
    it('is a vi.fn that spreads plain object into modalState', () => {
      const props = createBaseProps();
      props.setModalState({ foo: 'bar' });
      expect(props.modalState).toEqual({ foo: 'bar' });
    });

    it('is a vi.fn that calls function arg with modalState', () => {
      const props = createBaseProps();
      const updater = vi.fn((state) => ({ ...state, baz: 42 }));
      props.setModalState(updater);
      expect(updater).toHaveBeenCalledWith(props.modalState);
      // The updater returns a new object but setModalState does not apply
      // the return value — it only uses Object.assign for plain objects
      expect(updater).toHaveBeenCalled();
    });

    it('is a vi.fn spy that tracks call count', () => {
      const props = createBaseProps();
      expect(typeof props.setModalState).toBe('function');
      props.setModalState({ a: 1 });
      props.setModalState({ b: 2 });
      expect(props.setModalState).toHaveBeenCalledTimes(2);
    });
  });

  describe('handler callbacks', () => {
    const handlerProps = [
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

    for (const handlerName of handlerProps) {
      it(`${handlerName} is a vi.fn spy`, () => {
        const props = createBaseProps();
        expect(typeof props[handlerName]).toBe('function');
        expect(props[handlerName]).toHaveBeenCalledTimes(0);
      });
    }

    it('each handler is a unique vi.fn instance', () => {
      const props = createBaseProps();
      const handlers = handlerProps.map((h) => props[h]);
      // All handlers should be distinct fn instances
      for (let i = 0; i < handlers.length; i++) {
        for (let j = i + 1; j < handlers.length; j++) {
          expect(handlers[i]).not.toBe(handlers[j]);
        }
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

    it('returns a new object each time (no shared reference)', () => {
      const props1 = createBaseProps();
      const props2 = createBaseProps();
      expect(props1).not.toBe(props2);
      expect(props1.modalState).not.toBe(props2.modalState);
    });

    it('allows adding extra custom props via spread', () => {
      const props = createBaseProps({ extraProp: 'custom' });
      expect(props.extraProp).toBe('custom');
    });
  });

  describe('modalState isolation', () => {
    it('each call gets an independent modalState object', () => {
      const props1 = createBaseProps();
      const props2 = createBaseProps();
      props1.setModalState({ key: 'value1' });
      expect(props2.modalState).not.toHaveProperty('key');
    });

    it('modifying one modalState does not affect another', () => {
      const props1 = createBaseProps();
      const props2 = createBaseProps();
      props1.modalState.existing = true;
      expect(props2.modalState.existing).toBeUndefined();
    });
  });
});
