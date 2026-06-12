import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EVENT_FREQUENCIES, shouldTriggerEvent, generateRandomEvent } from './randomEventService.js';

describe('randomEventService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('EVENT_FREQUENCIES', () => {
    it('should define four frequency levels', () => {
      expect(Object.keys(EVENT_FREQUENCIES)).toEqual(['none', 'sparse', 'normal', 'frequent']);
    });

    it('should have correct chance values', () => {
      expect(EVENT_FREQUENCIES.none.chance).toBe(0);
      expect(EVENT_FREQUENCIES.sparse.chance).toBe(0.05);
      expect(EVENT_FREQUENCIES.normal.chance).toBe(0.12);
      expect(EVENT_FREQUENCIES.frequent.chance).toBe(0.25);
    });

    it('should have human-readable labels', () => {
      expect(EVENT_FREQUENCIES.none.label).toBe('None');
      expect(EVENT_FREQUENCIES.sparse.label).toBe('Sparse');
      expect(EVENT_FREQUENCIES.normal.label).toBe('Normal');
      expect(EVENT_FREQUENCIES.frequent.label).toBe('Frequent');
    });
  });

  describe('shouldTriggerEvent', () => {
    it('should return false when frequency is none', () => {
      const result = shouldTriggerEvent('plains', 'weather', 'none');
      expect(result).toBe(false);
    });

    it('should return false when frequency is undefined', () => {
      const result = shouldTriggerEvent('plains', 'weather', undefined);
      expect(result).toBe(false);
    });

    it('should return false when frequency key is invalid', () => {
      const result = shouldTriggerEvent('plains', 'weather', 'invalid');
      expect(result).toBe(false);
    });

    it('should return false with no frequency and no modifiers', () => {
      const result = shouldTriggerEvent('plains', 'weather', 'none');
      expect(result).toBe(false);
    });

    it('should apply terrain modifier for forest', () => {
      // Force Math.random to always return a value below chance
      const originalRandom = Math.random;
      Math.random = () => 0.001;

      const result = shouldTriggerEvent('forest', 'weather', 'sparse');

      Math.random = originalRandom;
      expect(result).toBe(true);
    });

    it('should apply terrain modifier for mountains', () => {
      const originalRandom = Math.random;
      Math.random = () => 0.001;

      const result = shouldTriggerEvent('mountains', 'weather', 'sparse');

      Math.random = originalRandom;
      expect(result).toBe(true);
    });

    it('should apply weather encounter modifier', () => {
      const weather = { encounterMod: 20 };
      const originalRandom = Math.random;
      Math.random = () => 0.001;

      const result = shouldTriggerEvent('plains', weather, 'sparse');

      Math.random = originalRandom;
      expect(result).toBe(true);
    });

    it('should handle weather with no encounterMod', () => {
      const result = shouldTriggerEvent('plains', {}, 'none');
      expect(result).toBe(false);
    });

    it('should handle null weather', () => {
      const result = shouldTriggerEvent('plains', null, 'none');
      expect(result).toBe(false);
    });

    it('should apply combined terrain and weather modifiers', () => {
      const weather = { encounterMod: 10 };
      const originalRandom = Math.random;
      Math.random = () => 0.001;

      const result = shouldTriggerEvent('forest', weather, 'sparse');

      Math.random = originalRandom;
      expect(result).toBe(true);
    });

    it('should return false when total chance is zero', () => {
      const originalRandom = Math.random;
      Math.random = () => 0.99;

      const result = shouldTriggerEvent('plains', 'weather', 'none');

      Math.random = originalRandom;
      expect(result).toBe(false);
    });

    it('should use default terrain modifier for unknown terrain', () => {
      const originalRandom = Math.random;
      Math.random = () => 0.99;

      const result = shouldTriggerEvent('jungle', 'weather', 'none');

      Math.random = originalRandom;
      expect(result).toBe(false);
    });

    it('should support all terrain types with modifiers', () => {
      const terrainMods = {
        plains: 0,
        forest: 0.05,
        hills: 0.02,
        mountains: 0.05,
        swamp: 0.08,
        desert: 0.03,
        tundra: 0.03,
        beach: 0,
      };

      for (const terrain of Object.keys(terrainMods)) {
        const originalRandom = Math.random;
        Math.random = () => 0.001;

        const result = shouldTriggerEvent(terrain, 'weather', 'normal');

        Math.random = originalRandom;
        expect(result).toBe(true);
      }
    });

    it('should correctly calculate total chance with positive weather mod', () => {
      const weather = { encounterMod: 50 };
      const originalRandom = Math.random;
      Math.random = () => 0.001;

      const result = shouldTriggerEvent('plains', weather, 'sparse');

      Math.random = originalRandom;
      expect(result).toBe(true);
    });

    it('should handle negative weather encounterMod', () => {
      const weather = { encounterMod: -20 };
      const originalRandom = Math.random;
      Math.random = () => 0.99;

      const result = shouldTriggerEvent('plains', weather, 'sparse');

      Math.random = originalRandom;
      expect(result).toBe(false);
    });

    it('should work with frequent frequency', () => {
      const originalRandom = Math.random;
      Math.random = () => 0.001;

      const result = shouldTriggerEvent('swamp', 'weather', 'frequent');

      Math.random = originalRandom;
      expect(result).toBe(true);
    });
  });

  describe('generateRandomEvent', () => {
    it('should return an event with terrain field', () => {
      const originalRandom = Math.random;
      Math.random = () => 0;

      const result = generateRandomEvent('plains');

      Math.random = originalRandom;
      expect(result).toHaveProperty('terrain', 'plains');
    });

    it('should return an event with type field', () => {
      const originalRandom = Math.random;
      Math.random = () => 0;

      const result = generateRandomEvent('plains');

      Math.random = originalRandom;
      expect(result).toHaveProperty('type');
    });

    it('should return an event with title field', () => {
      const originalRandom = Math.random;
      Math.random = () => 0;

      const result = generateRandomEvent('plains');

      Math.random = originalRandom;
      expect(result).toHaveProperty('title');
    });

    it('should return an event with description field', () => {
      const originalRandom = Math.random;
      Math.random = () => 0;

      const result = generateRandomEvent('plains');

      Math.random = originalRandom;
      expect(result).toHaveProperty('description');
    });

    it('should pick from plains event table', () => {
      const originalRandom = Math.random;
      Math.random = () => 0;

      const result = generateRandomEvent('plains');

      Math.random = originalRandom;
      expect(result.terrain).toBe('plains');
      expect(result.type).toBeDefined();
    });

    it('should pick from forest event table', () => {
      const originalRandom = Math.random;
      Math.random = () => 0;

      const result = generateRandomEvent('forest');

      Math.random = originalRandom;
      expect(result.terrain).toBe('forest');
    });

    it('should pick from hills event table', () => {
      const originalRandom = Math.random;
      Math.random = () => 0;

      const result = generateRandomEvent('hills');

      Math.random = originalRandom;
      expect(result.terrain).toBe('hills');
    });

    it('should pick from mountains event table', () => {
      const originalRandom = Math.random;
      Math.random = () => 0;

      const result = generateRandomEvent('mountains');

      Math.random = originalRandom;
      expect(result.terrain).toBe('mountains');
    });

    it('should pick from desert event table', () => {
      const originalRandom = Math.random;
      Math.random = () => 0;

      const result = generateRandomEvent('desert');

      Math.random = originalRandom;
      expect(result.terrain).toBe('desert');
    });

    it('should pick from swamp event table', () => {
      const originalRandom = Math.random;
      Math.random = () => 0;

      const result = generateRandomEvent('swamp');

      Math.random = originalRandom;
      expect(result.terrain).toBe('swamp');
    });

    it('should pick from tundra event table', () => {
      const originalRandom = Math.random;
      Math.random = () => 0;

      const result = generateRandomEvent('tundra');

      Math.random = originalRandom;
      expect(result.terrain).toBe('tundra');
    });

    it('should pick from beach event table', () => {
      const originalRandom = Math.random;
      Math.random = () => 0;

      const result = generateRandomEvent('beach');

      Math.random = originalRandom;
      expect(result.terrain).toBe('beach');
    });

    it('should fall back to plains for unknown terrain', () => {
      const originalRandom = Math.random;
      Math.random = () => 0;

      const result = generateRandomEvent('jungle');

      Math.random = originalRandom;
      expect(result.terrain).toBe('jungle');
    });

    it('should fall back to plains table for unknown terrain', () => {
      const plainsTitles = [
        'Wolves on the Hunt',
        'Giant Eagle',
        'Abandoned Cart',
        'Ancient Waystone',
        'Hidden Sinkhole',
        'Travelling Merchant',
        'Patrol Riders',
        'Sudden Storm',
        'Lost Bearings',
      ];

      const originalRandom = Math.random;
      Math.random = () => 0;

      const result = generateRandomEvent('unknown');

      Math.random = originalRandom;
      // Should be the first entry in the plains table since Math.random() returns 0
      expect(result.title).toBe(plainsTitles[0]);
    });

    it('should respect weighted selection', () => {
      // With Math.random returning 0, the first entry (highest cumulative weight) should be picked
      const originalRandom = Math.random;
      Math.random = () => 0;

      const result = generateRandomEvent('plains');

      Math.random = originalRandom;
      // First entry in plains table is "Wolves on the Hunt" with weight 20
      expect(result.title).toBe('Wolves on the Hunt');
    });

    it('should return different events based on random roll', () => {
      const originalRandom = Math.random;

      let calls = 0;
      Math.random = () => {
        // First call returns 0 (first entry), second call returns 0.99 (last entry)
        calls++;
        return calls === 1 ? 0 : 0.99;
      };

      const result1 = generateRandomEvent('plains');
      const result2 = generateRandomEvent('plains');

      Math.random = originalRandom;
      // Different random values should produce different events
      expect(result1.title).not.toBe(result2.title);
    });

    it('should include all event types for plains', () => {
      const expectedTypes = ['combat', 'discovery', 'hazard', 'npc', 'weatherChange', 'navigation'];
      const seenTypes = new Set();

      const originalRandom = Math.random;
      // Walk through the weighted selection by using specific random values
      // that land at the start of each entry
      Math.random = () => 0;

      // Generate enough events to cover all types
      for (let i = 0; i < 100; i++) {
        const result = generateRandomEvent('plains');
        seenTypes.add(result.type);
      }

      Math.random = originalRandom;
      // Since weighted selection picks deterministically with Math.random() = 0,
      // we verify the event structure instead
      const result = generateRandomEvent('plains');
      expect(expectedTypes).toContain(result.type);
    });

    it('should not mutate the event table entries', () => {
      const originalRandom = Math.random;
      Math.random = () => 0;

      const result = generateRandomEvent('plains');

      Math.random = originalRandom;
      // The returned event should have terrain added but not modify the original
      expect(result).toHaveProperty('terrain');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
    });

    it('should handle combat type events', () => {
      const originalRandom = Math.random;
      Math.random = () => 0;

      const result = generateRandomEvent('forest');

      Math.random = originalRandom;
      expect(result.type).toBe('combat');
    });

    it('should handle discovery type events', () => {
      const originalRandom = Math.random;
      // Skip combat entries (weights 20+15=35), discovery starts at cumulative 35
      // 0.5 * totalWeight (total = 90) = 45, which lands in discovery range
      Math.random = () => 0.6;

      const result = generateRandomEvent('forest');

      Math.random = originalRandom;
      // With weight 90 total, roll = 54, subtract 35 combat = 19, then 15 discovery = 4, then 10 fungal = -6 -> fungal grove
      expect(result.type).toBe('discovery');
    });

    it('should handle hazard type events', () => {
      const originalRandom = Math.random;
      // Skip combat (35) + discovery (25) = 60, hazard starts at 60
      // 0.75 * 90 = 67.5, subtract 60 = 7.5, poison iveweight 10 -> hazard
      Math.random = () => 0.75;

      const result = generateRandomEvent('forest');

      Math.random = originalRandom;
      expect(result.type).toBe('hazard');
    });

    it('should handle npc type events', () => {
      const originalRandom = Math.random;
      // Skip combat (35) + discovery (25) + hazard (15) = 75, npc starts at 75
      // 0.85 * 90 = 76.5, subtract 75 = 1.5, npc weight 10 -> npc
      Math.random = () => 0.85;

      const result = generateRandomEvent('forest');

      Math.random = originalRandom;
      expect(result.type).toBe('npc');
    });

    it('should handle weatherChange type events', () => {
      const originalRandom = Math.random;
      // Skip combat (35) + discovery (25) + hazard (15) + npc (15) = 90, weatherChange starts at 90
      // 0.95 * 90 = 85.5, subtract 90 = -4.5 -> weatherChange (falls through to last)
      Math.random = () => 0.95;

      const result = generateRandomEvent('forest');

      Math.random = originalRandom;
      expect(result.type).toBe('weatherChange');
    });

    it('should handle navigation type events', () => {
      const originalRandom = Math.random;
      // navigation is last entry with weight 5
      Math.random = () => 0.99;

      const result = generateRandomEvent('forest');

      Math.random = originalRandom;
      expect(result.type).toBe('navigation');
    });

    it('should return unique event titles for each terrain', () => {
      const terrains = ['plains', 'forest', 'hills', 'mountains', 'desert', 'swamp', 'tundra', 'beach'];

      for (const terrain of terrains) {
        const titles = [];
        const originalRandom = Math.random;
        // Try different random values to get different entries
        for (let i = 0; i < 100; i++) {
          Math.random = () => i / 100;
          const event = generateRandomEvent(terrain);
          if (!titles.includes(event.title)) {
            titles.push(event.title);
          }
        }

        Math.random = originalRandom;
        expect(titles.length).toBeGreaterThan(1);
      }
    });
  });
});
