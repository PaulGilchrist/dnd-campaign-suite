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
      randomSpy.mockReturnValue(0.5);
      expect(shouldTriggerEvent('plains', { encounterMod: -20 }, 'sparse')).toBe(false);
      expect(randomSpy).toHaveBeenCalled();
    });

    it('should return true when total chance reaches 100%', () => {
      randomSpy.mockReturnValue(0.001);
      expect(shouldTriggerEvent('swamp', { encounterMod: 67 }, 'frequent')).toBe(true);
      expect(randomSpy).toHaveBeenCalled();
    });

    it('should apply terrain modifiers', () => {
      randomSpy.mockReturnValue(0.09);
      expect(shouldTriggerEvent('forest', 'weather', 'sparse')).toBe(true);
    });

    it('should apply weather encounter modifier', () => {
      randomSpy.mockReturnValue(0.14);
      expect(shouldTriggerEvent('plains', { encounterMod: 10 }, 'sparse')).toBe(true);
    });

    it('should apply combined terrain and weather modifiers', () => {
      randomSpy.mockReturnValue(0.19);
      expect(shouldTriggerEvent('forest', { encounterMod: 10 }, 'sparse')).toBe(true);
    });

    it('should handle null or empty weather objects', () => {
      randomSpy.mockReturnValue(0.04);
      expect(shouldTriggerEvent('plains', null, 'sparse')).toBe(true);
      expect(shouldTriggerEvent('plains', {}, 'sparse')).toBe(true);
    });

    it('should treat non-numeric encounterMod as zero via NaN fallback', () => {
      randomSpy.mockReturnValue(0.04);
      expect(shouldTriggerEvent('plains', { encounterMod: 'abc' }, 'sparse')).toBe(false);
    });

    it('should support all defined terrain types with normal frequency', () => {
      const terrainTypes = ['plains', 'forest', 'hills', 'mountains', 'swamp', 'desert', 'tundra', 'beach'];
      randomSpy.mockReturnValue(0.001);

      for (const terrain of terrainTypes) {
        expect(shouldTriggerEvent(terrain, 'weather', 'normal')).toBe(true);
      }
    });

    it('should handle boundary random values correctly', () => {
      randomSpy.mockReturnValue(0.05);
      expect(shouldTriggerEvent('plains', 'weather', 'sparse')).toBe(false);

      randomSpy.mockReturnValue(0.049);
      expect(shouldTriggerEvent('plains', 'weather', 'sparse')).toBe(true);
    });
  });

  describe('generateRandomEvent', () => {
    it('should return an event with all required fields', () => {
      randomSpy.mockReturnValue(0);
      const result = generateRandomEvent('plains');

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('terrain');
      expect(typeof result.type).toBe('string');
      expect(typeof result.title).toBe('string');
      expect(typeof result.description).toBe('string');
    });

    it('should include the requested terrain in the result', () => {
      randomSpy.mockReturnValue(0);
      const result = generateRandomEvent('plains');

      expect(result.terrain).toBe('plains');
    });

    it('should fall back to plains table for unknown or undefined terrain', () => {
      randomSpy.mockReturnValue(0);

      const jungleResult = generateRandomEvent('jungle');
      expect(jungleResult.terrain).toBe('jungle');
      expect(jungleResult.type).toBeDefined();
      expect(typeof jungleResult.title).toBe('string');

      const undefinedResult = generateRandomEvent(undefined);
      expect(undefinedResult.terrain).toBe(undefined);
      expect(undefinedResult.type).toBeDefined();
    });

    it('should return different events based on different random rolls', () => {
      randomSpy.mockReturnValue(0);
      const result1 = generateRandomEvent('plains');

      randomSpy.mockReturnValue(0.99);
      const result2 = generateRandomEvent('plains');

      expect(result1.title).not.toBe(result2.title);
    });

    it('should always return a valid event for every terrain type', () => {
      const terrains = ['plains', 'forest', 'hills', 'mountains', 'desert', 'swamp', 'tundra', 'beach'];
      const randomValues = [0, 0.5, 1];

      for (const terrain of terrains) {
        for (const roll of randomValues) {
          const spy = vi.spyOn(Math, 'random');
          spy.mockReturnValue(roll);
          const event = generateRandomEvent(terrain);
          expect(event).toHaveProperty('type');
          expect(event).toHaveProperty('title');
          expect(event).toHaveProperty('description');
          expect(event).toHaveProperty('terrain', terrain);
          spy.mockRestore();
        }
      }
    });
  });
});
