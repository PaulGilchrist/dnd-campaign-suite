import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EVENT_FREQUENCIES, shouldTriggerEvent, generateRandomEvent } from './randomEventService.js';

describe('randomEventService', () => {
  let randomSpy;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  describe('EVENT_FREQUENCIES', () => {
    it('should define four frequency levels with correct labels and chance values', () => {
      expect(EVENT_FREQUENCIES).toStrictEqual({
        none: { label: 'None', chance: 0 },
        sparse: { label: 'Sparse', chance: 0.05 },
        normal: { label: 'Normal', chance: 0.12 },
        frequent: { label: 'Frequent', chance: 0.25 },
      });
    });
  });

  describe('shouldTriggerEvent', () => {
    it('should return false when frequency is none', () => {
      expect(shouldTriggerEvent('plains', 'weather', 'none')).toBe(false);
      expect(randomSpy).not.toHaveBeenCalled();
    });

    it('should return false when frequency is invalid or undefined', () => {
      expect(shouldTriggerEvent('plains', 'weather', undefined)).toBe(false);
      expect(shouldTriggerEvent('plains', 'weather', 'invalid')).toBe(false);
      expect(randomSpy).not.toHaveBeenCalled();
    });

    it('should return false when total chance after modifiers is negative', () => {
      // sparse 0.05 + plains 0 + weather -0.20 = -0.15
      randomSpy.mockReturnValue(0.5);
      expect(shouldTriggerEvent('plains', { encounterMod: -20 }, 'sparse')).toBe(false);
      expect(randomSpy).toHaveBeenCalledTimes(1);
    });

    it('should return true when total chance reaches 100%', () => {
      // frequent 0.25 + swamp 0.08 + weather 0.67 ≈ 1.0
      randomSpy.mockReturnValue(0.001);
      expect(shouldTriggerEvent('swamp', { encounterMod: 67 }, 'frequent')).toBe(true);
      expect(randomSpy).toHaveBeenCalledTimes(1);
    });

    it('should apply terrain modifiers', () => {
      randomSpy.mockReturnValue(0.09);
      // Only passes with forest's +0.05: sparse alone (0.05) would fail this roll
      expect(shouldTriggerEvent('forest', 'weather', 'sparse')).toBe(true);
      expect(randomSpy).toHaveBeenCalledTimes(1);
    });

    it('should apply weather encounter modifier', () => {
      randomSpy.mockReturnValue(0.14);
      // Only passes with weather +0.10: sparse + plains (0.05) would fail this roll
      expect(shouldTriggerEvent('plains', { encounterMod: 10 }, 'sparse')).toBe(true);
      expect(randomSpy).toHaveBeenCalledTimes(1);
    });

    it('should apply combined terrain and weather modifiers', () => {
      randomSpy.mockReturnValue(0.19);
      // Only passes with full sum 0.05 + 0.05 + 0.10 = 0.20
      expect(shouldTriggerEvent('forest', { encounterMod: 10 }, 'sparse')).toBe(true);
      expect(randomSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle null or empty weather objects', () => {
      randomSpy.mockReturnValue(0.04);
      expect(shouldTriggerEvent('plains', null, 'sparse')).toBe(true);
      expect(shouldTriggerEvent('plains', {}, 'sparse')).toBe(true);
    });

    it('should fail closed when encounterMod is non-numeric (NaN poisons the comparison)', () => {
      randomSpy.mockReturnValue(0.04);
      // 'abc' is truthy so it survives `|| 0`, then 'abc'/100 = NaN and
      // `Math.random() < NaN` is false — a numeric 0 modifier must stay true
      expect(shouldTriggerEvent('plains', { encounterMod: 'abc' }, 'sparse')).toBe(false);
      expect(shouldTriggerEvent('plains', { encounterMod: 0 }, 'sparse')).toBe(true);
    });

    it('should apply each terrain modifier tier distinctly at normal frequency', () => {
      // Roll 0.125 discriminates the modifier tiers: plains/beach (0.12) fail,
      // hills (0.14), desert/tundra (0.15), forest/mountains (0.17), swamp (0.20) pass
      randomSpy.mockReturnValue(0.125);
      expect(shouldTriggerEvent('plains', 'weather', 'normal')).toBe(false);
      expect(shouldTriggerEvent('beach', 'weather', 'normal')).toBe(false);
      expect(shouldTriggerEvent('hills', 'weather', 'normal')).toBe(true);
      expect(shouldTriggerEvent('desert', 'weather', 'normal')).toBe(true);
      expect(shouldTriggerEvent('tundra', 'weather', 'normal')).toBe(true);
      expect(shouldTriggerEvent('forest', 'weather', 'normal')).toBe(true);
      expect(shouldTriggerEvent('mountains', 'weather', 'normal')).toBe(true);
      expect(shouldTriggerEvent('swamp', 'weather', 'normal')).toBe(true);
    });

    it('should handle boundary random values correctly', () => {
      randomSpy.mockReturnValue(0.05);
      expect(shouldTriggerEvent('plains', 'weather', 'sparse')).toBe(false);

      randomSpy.mockReturnValue(0.049);
      expect(shouldTriggerEvent('plains', 'weather', 'sparse')).toBe(true);
    });
  });

  describe('generateRandomEvent', () => {
    it('should return the plains table opener with full shape at roll 0', () => {
      randomSpy.mockReturnValue(0);
      const result = generateRandomEvent('plains');

      // Note: the { ...picked } spread leaks the internal table weight to consumers
      expect(result).toEqual({
        type: 'combat',
        title: 'Wolves on the Hunt',
        description: expect.any(String),
        terrain: 'plains',
        weight: 20,
      });
      expect(result.description.length).toBeGreaterThan(0);
      // The weighted pick consumes exactly one roll per generation
      expect(randomSpy).toHaveBeenCalledTimes(1);
    });

    it('should return the plains table closer at high rolls', () => {
      randomSpy.mockReturnValue(0.99);
      const result = generateRandomEvent('plains');

      // Different rolls from roll 0 must land on a different entry
      expect(result.type).toBe('navigation');
      expect(result.title).toBe('Lost Bearings');
      expect(result.terrain).toBe('plains');
    });

    it('should fall back to the plains table for unknown or undefined terrain', () => {
      randomSpy.mockReturnValue(0);
      const jungleResult = generateRandomEvent('jungle');
      // Same opener as plains proves the fallback table
      expect(jungleResult.terrain).toBe('jungle');
      expect(jungleResult.type).toBe('combat');
      expect(jungleResult.title).toBe('Wolves on the Hunt');

      randomSpy.mockReturnValue(1);
      const undefinedResult = generateRandomEvent(undefined);
      expect(undefinedResult.terrain).toBeUndefined();
      expect(undefinedResult.title).toBe('Lost Bearings');
    });

    it('should resolve first and last table entries for every terrain deterministically', () => {
      const terrainEndpins = {
        plains: ['Wolves on the Hunt', 'Lost Bearings'],
        forest: ['Ambush from the Brush', 'Twisted Trails'],
        hills: ['Hill Giant', 'Ridge Confusion'],
        mountains: ['Peryton Attack', 'False Pass'],
        desert: ['Sand Wyrm', 'Dune Shifts'],
        swamp: ['Lizardfolk Ambush', 'Twisted Waterways'],
        tundra: ['Winter Wolf Pack', 'Whiteout'],
        beach: ['Coastal Predators', 'Tide Cut-off'],
      };

      for (const [terrain, [firstTitle, lastTitle]] of Object.entries(terrainEndpins)) {
        randomSpy.mockReturnValue(0);
        const first = generateRandomEvent(terrain);
        expect(first.title).toBe(firstTitle);
        expect(first.terrain).toBe(terrain);
        expect(typeof first.description).toBe('string');
        expect(first.description.length).toBeGreaterThan(0);

        // roll = 1 lands exactly on the final entry (loop returns on roll <= 0)
        randomSpy.mockReturnValue(1);
        const last = generateRandomEvent(terrain);
        expect(last.title).toBe(lastTitle);
        expect(last.terrain).toBe(terrain);

        // A mid roll must still produce a valid narrative entry
        randomSpy.mockReturnValue(0.5);
        const mid = generateRandomEvent(terrain);
        expect(typeof mid.title).toBe('string');
        expect(mid.title.length).toBeGreaterThan(0);
        expect(typeof mid.type).toBe('string');
      }
    });
  });
});
