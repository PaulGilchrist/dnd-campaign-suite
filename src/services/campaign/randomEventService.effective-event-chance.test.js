// @maintained-by-ai
// Regression pin for bug-event-chance-label-ignores-mods: the TravelPanel readout
// and shouldTriggerEvent must share ONE formula. These rows pin the shared
// effectiveEventChance/eventChanceBreakdown math AND the roll's agreement with
// it (fire just below the effective total, refuse at/above it) so display and
// roll can never silently diverge again.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  shouldTriggerEvent,
  effectiveEventChance,
  eventChanceBreakdown,
} from './randomEventService.js';

const RAIN = { condition: 'rain', label: 'Rain', encounterMod: 10 };
const FOG = { condition: 'fog', label: 'Fog', encounterMod: -10 };

describe('effectiveEventChance (shared display/roll formula)', () => {
  let randomSpy;

  beforeEach(() => {
    randomSpy = vi.spyOn(Math, 'random');
  });

  afterEach(() => {
    randomSpy.mockRestore();
  });

  describe('eventChanceBreakdown', () => {
    it('splits base + terrain + weather contributions for the live repro case', () => {
      // The exact session that reproduced the bug: Normal + plains + rain(+10)
      expect(eventChanceBreakdown('plains', RAIN, 'normal')).toEqual({
        base: 0.12, terrainMod: 0, weatherMod: 0.1, total: expect.closeTo(0.22, 10),
      });
    });

    it('adds the swamp terrain mod on top of the weather mod', () => {
      expect(eventChanceBreakdown('swamp', RAIN, 'normal')).toEqual({
        base: 0.12, terrainMod: 0.08, weatherMod: 0.1, total: expect.closeTo(0.3, 10),
      });
    });

    it('subtracts negative weather mods (fog -10 on plains → 2%)', () => {
      expect(eventChanceBreakdown('plains', FOG, 'normal').total).toBeCloseTo(0.02, 10);
    });

    it('returns an all-zero breakdown for none/invalid frequencies — mods never resurrect a none roll', () => {
      expect(eventChanceBreakdown('swamp', RAIN, 'none')).toEqual({ base: 0, terrainMod: 0, weatherMod: 0, total: 0 });
      expect(eventChanceBreakdown('swamp', RAIN, undefined).total).toBe(0);
      expect(eventChanceBreakdown('swamp', RAIN, 'bogus').total).toBe(0);
    });

    it('treats missing/unknown terrain and weather as unmodded', () => {
      expect(effectiveEventChance('jungle', null, 'normal')).toBe(0.12);
      expect(effectiveEventChance('plains', 'weather-string', 'normal')).toBe(0.12);
    });
  });

  describe('roll agrees with the displayed total', () => {
    it('fires just below and refuses at/above the effective total', () => {
      // Boundary comparisons use the EXACT float the shared formula computes
      // (0.12 + 0.1 sums to 0.22000000000000003, so a hand-written 0.22 is
      // strictly below the threshold and correctly fires).
      const plainsRain = effectiveEventChance('plains', RAIN, 'normal');
      randomSpy.mockReturnValue(plainsRain - 0.0001);
      expect(shouldTriggerEvent('plains', RAIN, 'normal')).toBe(true);
      randomSpy.mockReturnValue(plainsRain);
      expect(shouldTriggerEvent('plains', RAIN, 'normal')).toBe(false);

      const swampRain = effectiveEventChance('swamp', RAIN, 'normal');
      randomSpy.mockReturnValue(swampRain - 0.0001);
      expect(shouldTriggerEvent('swamp', RAIN, 'normal')).toBe(true);
      randomSpy.mockReturnValue(swampRain);
      expect(shouldTriggerEvent('swamp', RAIN, 'normal')).toBe(false);
      // And the displayed rounding of both totals:
      expect(Math.round(plainsRain * 100)).toBe(22);
      expect(Math.round(swampRain * 100)).toBe(30);
    });

    it('matches effectiveEventChance across every terrain × weather × frequency tier', () => {
      const terrains = ['plains', 'forest', 'hills', 'mountains', 'swamp', 'desert', 'tundra', 'beach', 'jungle'];
      const weathers = [null, { encounterMod: 0 }, RAIN, FOG, { encounterMod: 30 }];
      const keys = ['sparse', 'normal', 'frequent'];
      for (const terrain of terrains) {
        for (const weather of weathers) {
          for (const key of keys) {
            const total = effectiveEventChance(terrain, weather, key);
            // Just under the threshold fires; the threshold itself refuses.
            randomSpy.mockReturnValue(Math.max(0, total - 0.0001));
            expect(shouldTriggerEvent(terrain, weather, key)).toBe(total > 0);
            randomSpy.mockReturnValue(total <= 0 ? 0 : total);
            expect(shouldTriggerEvent(terrain, weather, key)).toBe(false);
          }
        }
      }
    });

    it('still refuses to roll at all for none/invalid frequencies', () => {
      randomSpy.mockReturnValue(0);
      expect(shouldTriggerEvent('swamp', RAIN, 'none')).toBe(false);
      expect(shouldTriggerEvent('swamp', RAIN, 'bogus')).toBe(false);
      expect(randomSpy).not.toHaveBeenCalled();
    });

    it('keeps the NaN fail-closed lane (a poisoned total shows the base label, the roll never fires)', () => {
      const total = effectiveEventChance('plains', { encounterMod: 'abc' }, 'sparse');
      expect(Number.isFinite(total)).toBe(false);
      randomSpy.mockReturnValue(0);
      expect(shouldTriggerEvent('plains', { encounterMod: 'abc' }, 'sparse')).toBe(false);
    });
  });
});
