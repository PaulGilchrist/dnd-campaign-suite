import { describe, it, expect } from 'vitest';
import {
  generateWeather,
} from './weatherService.js';

const TERRAIN_BIOME_CONDITIONS = {
  plains: { biome: 'temperate', conditions: ['clear', 'cloudy', 'rain', 'fog', 'storm'] },
  forest: { biome: 'temperate', conditions: ['clear', 'cloudy', 'rain', 'fog', 'storm'] },
  hills: { biome: 'temperate', conditions: ['clear', 'cloudy', 'rain', 'fog', 'storm'] },
  mountains: { biome: 'cold', conditions: ['clear', 'cloudy', 'snow', 'storm', 'fog', 'extreme'] },
  desert: { biome: 'arid', conditions: ['clear', 'cloudy', 'wind', 'fog', 'extreme'] },
  swamp: { biome: 'wet', conditions: ['cloudy', 'rain', 'storm', 'fog', 'mist'] },
  tundra: { biome: 'cold', conditions: ['clear', 'cloudy', 'snow', 'storm', 'fog', 'extreme'] },
  beach: { biome: 'coastal', conditions: ['clear', 'cloudy', 'rain', 'wind', 'storm', 'fog'] },
};

const EXPECTED_EFFECTS = [
  { condition: 'clear', label: 'Clear', icon: 'sun', visibility: null, moveCostMod: 1.0, budgetMod: 1.0, encounterMod: 0, description: 'Clear skies — no effect on travel' },
  { condition: 'cloudy', label: 'Cloudy', icon: 'cloud', visibility: null, moveCostMod: 1.0, budgetMod: 1.0, encounterMod: 0, description: 'Overcast — no effect on travel' },
  { condition: 'rain', label: 'Rain', icon: 'cloud-rain', visibility: null, moveCostMod: 1.25, budgetMod: 1.0, encounterMod: 10, description: 'Heavy rain — terrain costs +25%' },
  { condition: 'storm', label: 'Storm', icon: 'bolt', visibility: 3, moveCostMod: 1.5, budgetMod: 0.75, encounterMod: 20, description: 'Thunderstorm — terrain costs +50%, visibility limited, daily budget -25%' },
  { condition: 'fog', label: 'Fog', icon: 'smog', visibility: 1, moveCostMod: 1.0, budgetMod: 1.0, encounterMod: -10, description: 'Thick fog — visibility limited to adjacent hexes' },
  { condition: 'wind', label: 'High Wind', icon: 'wind', visibility: null, moveCostMod: 1.0, budgetMod: 0.8, encounterMod: 5, description: 'Strong winds — daily budget -20%' },
  { condition: 'snow', label: 'Snow', icon: 'snowflake', visibility: null, moveCostMod: 1.5, budgetMod: 1.0, encounterMod: 10, description: 'Snowfall — terrain costs +50%' },
  { condition: 'mist', label: 'Mist', icon: 'smog', visibility: 2, moveCostMod: 1.0, budgetMod: 1.0, encounterMod: -5, description: 'Heavy mist — visibility reduced' },
  { condition: 'extreme', label: 'Extreme', icon: 'triangle-exclamation', visibility: 0, moveCostMod: null, budgetMod: 0, encounterMod: 30, description: 'Blizzard or sandstorm — travel impossible, forced camp' },
];

function findCondition(terrain, targetCondition, maxAttempts = 200) {
  for (let i = 0; i < maxAttempts; i++) {
    const weather = generateWeather(terrain);
    if (weather.condition === targetCondition) {
      return weather;
    }
  }
  return null;
}

describe('weatherService', () => {
  describe('generateWeather', () => {
    it('returns all required keys for known, unknown, null, and undefined terrain', () => {
      const requiredKeys = ['condition', 'label', 'icon', 'description', 'visibility', 'moveCostMod', 'budgetMod', 'encounterMod'];
      for (const terrain of ['plains', 'jungle', null, undefined]) {
        const weather = generateWeather(terrain);
        for (const key of requiredKeys) {
          expect(weather).toHaveProperty(key);
        }
      }
    });

    it('maps each terrain to the correct biome conditions', () => {
      const validConditions = new Set();
      for (const [terrain, { conditions }] of Object.entries(TERRAIN_BIOME_CONDITIONS)) {
        for (const c of conditions) validConditions.add(c);
        const weather = generateWeather(terrain);
        expect(conditions).toContain(weather.condition);
      }
    });

    it('returns correct effect values for every weather condition', () => {
      for (const expected of EXPECTED_EFFECTS) {
        const terrain = expected.condition === 'mist' ? 'swamp'
          : expected.condition === 'wind' ? 'desert'
          : expected.condition === 'snow' ? 'mountains'
          : expected.condition === 'extreme' ? 'desert'
          : 'plains';
        const weather = findCondition(terrain, expected.condition);
        expect(weather, `${expected.condition} should appear in its biome`).not.toBeNull();
        expect(weather).toEqual(expected);
      }
    });

    it('each biome only produces its valid conditions', () => {
      for (const [terrain, { conditions }] of Object.entries(TERRAIN_BIOME_CONDITIONS)) {
        const validSet = new Set(conditions);
        for (let i = 0; i < 20; i++) {
          const weather = generateWeather(terrain);
          expect(validSet).toContain(weather.condition);
        }
      }
    });
  });
});
