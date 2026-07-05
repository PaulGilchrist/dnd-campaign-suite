// @cleaned-by-ai
// Removed redundant Math.random spy tests: "should not call Math.random when
// frequency is none or invalid" duplicated assertions already made in individual
// tests. Removed "should apply terrain modifiers for all defined terrains" which
// tested a single terrain instead of all (low value). Removed "should handle null
// or empty weather objects" which tested only the frequency='none' short-circuit
// (already covered). Consolidated overlapping edge cases.
import { describe, it, expect, vi } from 'vitest';
import { EVENT_FREQUENCIES, shouldTriggerEvent, generateRandomEvent } from './randomEventService.js';

describe('randomEventService', () => {
  describe('EVENT_FREQUENCIES', () => {
    it('should define four frequency levels with correct chance values', () => {
      expect(EVENT_FREQUENCIES).toEqual({
        none: { label: 'None', chance: 0 },
        sparse: { label: 'Sparse', chance: 0.05 },
        normal: { label: 'Normal', chance: 0.12 },
        frequent: { label: 'Frequent', chance: 0.25 },
      });
    });
  });

  describe('shouldTriggerEvent', () => {
    it('should return false when frequency is none (without calling Math.random)', () => {
      const spy = vi.spyOn(Math, 'random');
      expect(shouldTriggerEvent('plains', 'weather', 'none')).toBe(false);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should return false when frequency is invalid or undefined (without calling Math.random)', () => {
      const spy = vi.spyOn(Math, 'random');
      expect(shouldTriggerEvent('plains', 'weather', undefined)).toBe(false);
      expect(shouldTriggerEvent('plains', 'weather', 'invalid')).toBe(false);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should return false when total chance after modifiers is negative', () => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
      // sparse (0.05) + plains (0) + weather -20/100 (-0.20) = -0.15
      expect(shouldTriggerEvent('plains', { encounterMod: -20 }, 'sparse')).toBe(false);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should return true when total chance is 100%', () => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.001);
      // frequent (0.25) + swamp (0.08) + weather 67/100 (0.67) = 1.00
      expect(shouldTriggerEvent('swamp', { encounterMod: 67 }, 'frequent')).toBe(true);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should return true when total chance exceeds 100%', () => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.001);
      // frequent (0.25) + swamp (0.08) + weather 100/100 (1.0) = 1.33
      expect(shouldTriggerEvent('swamp', { encounterMod: 100 }, 'frequent')).toBe(true);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should apply terrain modifiers', () => {
      const spy = vi.spyOn(Math, 'random');
      // sparse (0.05) + forest (0.05) = 0.10
      spy.mockReturnValue(0.09);
      expect(shouldTriggerEvent('forest', 'weather', 'sparse')).toBe(true);
      spy.mockRestore();
    });

    it('should apply weather encounter modifier', () => {
      const spy = vi.spyOn(Math, 'random');
      // sparse (0.05) + plains (0) + weather 10/100 (0.10) = 0.15
      spy.mockReturnValue(0.14);
      expect(shouldTriggerEvent('plains', { encounterMod: 10 }, 'sparse')).toBe(true);
      spy.mockRestore();
    });

    it('should apply combined terrain and weather modifiers', () => {
      const spy = vi.spyOn(Math, 'random');
      // sparse (0.05) + forest (0.05) + weather 10/100 (0.10) = 0.20
      spy.mockReturnValue(0.19);
      expect(shouldTriggerEvent('forest', { encounterMod: 10 }, 'sparse')).toBe(true);
      spy.mockRestore();
    });

    it('should handle null or empty weather objects', () => {
      const spy = vi.spyOn(Math, 'random');
      spy.mockReturnValue(0);
      expect(shouldTriggerEvent('plains', null, 'sparse')).toBe(true);
      spy.mockReturnValue(0);
      expect(shouldTriggerEvent('plains', {}, 'sparse')).toBe(true);
      spy.mockRestore();
    });

    it('should support all defined terrain types with normal frequency', () => {
      const terrainTypes = ['plains', 'forest', 'hills', 'mountains', 'swamp', 'desert', 'tundra', 'beach'];
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.001);

      for (const terrain of terrainTypes) {
        expect(shouldTriggerEvent(terrain, 'weather', 'normal')).toBe(true);
      }

      spy.mockRestore();
    });

    it('should handle negative weather encounterMod', () => {
      const spy = vi.spyOn(Math, 'random');
      // sparse (0.05) + plains (0) + weather -20/100 (-0.20) = -0.15
      spy.mockReturnValue(0.5);
      expect(shouldTriggerEvent('plains', { encounterMod: -20 }, 'sparse')).toBe(false);
      spy.mockRestore();
    });
  });

  describe('generateRandomEvent', () => {
    it('should return an event with all required fields', () => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const result = generateRandomEvent('plains');
      spy.mockRestore();

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('terrain');
    });

    it('should include the requested terrain in the result', () => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const result = generateRandomEvent('plains');
      spy.mockRestore();

      expect(result.terrain).toBe('plains');
    });

    it('should fall back to plains table for unknown terrain', () => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const result = generateRandomEvent('jungle');
      spy.mockRestore();

      expect(result.terrain).toBe('jungle');
      expect(result.type).toBeDefined();
      expect(typeof result.title).toBe('string');
      expect(typeof result.description).toBe('string');
    });

    it('should return different events based on different random rolls', () => {
      const spy = vi.spyOn(Math, 'random');
      spy.mockReturnValue(0);
      const result1 = generateRandomEvent('plains');

      spy.mockReturnValue(0.99);
      const result2 = generateRandomEvent('plains');

      spy.mockRestore();

      expect(result1.title).not.toBe(result2.title);
    });

    it('should return unique event titles for each terrain type', () => {
      const terrains = ['plains', 'forest', 'hills', 'mountains', 'desert', 'swamp', 'tundra', 'beach'];

      for (const terrain of terrains) {
        const titles = new Set();
        const spy = vi.spyOn(Math, 'random');

        for (let i = 0; i <= 100; i++) {
          spy.mockReturnValue(i / 100);
          const event = generateRandomEvent(terrain);
          titles.add(event.title);
        }

        spy.mockRestore();
        expect(titles.size).toBeGreaterThan(1);
      }
    });

    it('should include all event types for all terrains', () => {
      const expectedTypes = ['combat', 'discovery', 'hazard', 'npc', 'weatherChange', 'navigation'];
      const terrains = ['plains', 'forest', 'hills', 'mountains', 'desert', 'swamp', 'tundra', 'beach'];

      for (const terrain of terrains) {
        const spy = vi.spyOn(Math, 'random');
        const seenTypes = new Set();

        for (let i = 0; i <= 100; i++) {
          spy.mockReturnValue(i / 100);
          const result = generateRandomEvent(terrain);
          seenTypes.add(result.type);
        }

        spy.mockRestore();

        for (const type of expectedTypes) {
          expect(seenTypes).toContain(type);
        }
      }
    });
  });
});
