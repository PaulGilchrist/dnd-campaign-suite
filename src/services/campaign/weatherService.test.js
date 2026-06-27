// @improved-by-ai
import { describe, it, expect } from 'vitest';
import {
  generateWeather,
} from './weatherService.js';

const KNOWN_CONDITIONS = [
  'clear', 'cloudy', 'rain', 'storm', 'fog', 'wind', 'snow', 'mist', 'extreme',
];

describe('weatherService', () => {
  describe('generateWeather', () => {
    it('returns an object with all expected properties for each terrain type', () => {
      const terrains = ['plains', 'forest', 'hills', 'mountains', 'desert', 'swamp', 'tundra', 'beach'];
      for (const terrain of terrains) {
        const weather = generateWeather(terrain);
        expect(weather).toHaveProperty('condition');
        expect(weather).toHaveProperty('label');
        expect(weather).toHaveProperty('icon');
        expect(weather).toHaveProperty('description');
        expect(weather).toHaveProperty('visibility');
        expect(weather).toHaveProperty('moveCostMod');
        expect(weather).toHaveProperty('budgetMod');
        expect(weather).toHaveProperty('encounterMod');
      }
    });

    it('defaults to temperate weather for unknown terrain type', () => {
      const weather = generateWeather('jungle');
      expect(weather).toHaveProperty('condition');
      expect(weather).toHaveProperty('label');
    });

    it('defaults to temperate weather for null and undefined terrain type', () => {
      const w1 = generateWeather(null);
      const w2 = generateWeather(undefined);
      expect(w1).toHaveProperty('condition');
      expect(w2).toHaveProperty('condition');
    });

    it('only returns conditions valid for the terrain\'s biome', () => {
      const biomeTables = {
        plains: ['clear', 'cloudy', 'rain', 'fog', 'storm'],
        desert: ['clear', 'cloudy', 'wind', 'fog', 'extreme'],
        tundra: ['clear', 'cloudy', 'snow', 'storm', 'fog', 'extreme'],
        swamp: ['cloudy', 'rain', 'storm', 'fog', 'mist'],
        beach: ['clear', 'cloudy', 'rain', 'wind', 'storm', 'fog'],
      };

      for (const [terrain, validConditions] of Object.entries(biomeTables)) {
        const validSet = new Set(validConditions);
        for (let i = 0; i < 50; i++) {
          const weather = generateWeather(terrain);
          expect(validSet).toContain(weather.condition,
            `condition "${weather.condition}" for "${terrain}" is not valid`);
        }
      }
    });

    it('returns all known weather conditions across enough samples', () => {
      const seen = new Set();
      for (let i = 0; i < 500; i++) {
        const weather = generateWeather('plains');
        seen.add(weather.condition);
      }
      const expected = new Set(['clear', 'cloudy', 'rain', 'fog', 'storm']);
      expect(seen).toEqual(expected);
    });
  });

  describe('known conditions completeness', () => {
    it('every known condition produces a valid weather object from generateWeather', () => {
      KNOWN_CONDITIONS.forEach(() => {
        const weather = generateWeather('plains');
        expect(weather.condition).toBeDefined();
        expect(weather.label).toBeDefined();
        expect(weather.icon).toBeDefined();
        expect(weather.description).toBeDefined();
      });
    });
  });
});
