// @improved-by-ai
import { describe, it, expect } from 'vitest';
import {
  getBiome,
  getWeatherTable,
  generateWeather,
  getWeatherEffects,
  getWeatherIcon,
  getWeatherLabel,
  getWeatherDescription,
} from './weatherService.js';

const KNOWN_CONDITIONS = [
  'clear', 'cloudy', 'rain', 'storm', 'fog', 'wind', 'snow', 'mist', 'extreme',
];

describe('weatherService', () => {
  describe('getBiome', () => {
    it('maps each terrain type to its expected biome', () => {
      expect(getBiome('plains')).toBe('temperate');
      expect(getBiome('forest')).toBe('temperate');
      expect(getBiome('hills')).toBe('temperate');
      expect(getBiome('mountains')).toBe('cold');
      expect(getBiome('desert')).toBe('arid');
      expect(getBiome('swamp')).toBe('wet');
      expect(getBiome('tundra')).toBe('cold');
      expect(getBiome('beach')).toBe('coastal');
    });

    it('defaults to temperate for unknown, null, and undefined terrain types', () => {
      expect(getBiome('jungle')).toBe('temperate');
      expect(getBiome(null)).toBe('temperate');
      expect(getBiome(undefined)).toBe('temperate');
    });
  });

  describe('getWeatherTable', () => {
    it('returns the correct table for each biome', () => {
      expect(getWeatherTable('temperate')).toEqual([
        'clear', 'cloudy', 'cloudy', 'cloudy', 'rain', 'rain', 'fog', 'storm',
      ]);
      expect(getWeatherTable('arid')).toEqual([
        'clear', 'cloudy', 'cloudy', 'wind', 'wind', 'fog', 'fog', 'extreme',
      ]);
      expect(getWeatherTable('cold')).toEqual([
        'clear', 'cloudy', 'cloudy', 'snow', 'snow', 'storm', 'fog', 'extreme',
      ]);
      expect(getWeatherTable('wet')).toEqual([
        'cloudy', 'cloudy', 'rain', 'rain', 'rain', 'storm', 'fog', 'mist',
      ]);
      expect(getWeatherTable('coastal')).toEqual([
        'clear', 'cloudy', 'cloudy', 'rain', 'wind', 'wind', 'storm', 'fog',
      ]);
    });

    it('defaults to temperate table for unknown biome', () => {
      expect(getWeatherTable('tropical')).toEqual(getWeatherTable('temperate'));
    });

    it('returns stable references for known biomes', () => {
      const t1 = getWeatherTable('temperate');
      const t2 = getWeatherTable('temperate');
      expect(t1).toBe(t2);
      expect(getWeatherTable('arid')).toBe(getWeatherTable('arid'));
    });
  });

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

  describe('getWeatherEffects', () => {
    const expectedEffects = {
      clear: {
        condition: 'clear', label: 'Clear', icon: 'sun', visibility: null,
        moveCostMod: 1.0, budgetMod: 1.0, encounterMod: 0,
        description: 'Clear skies — no effect on travel',
      },
      cloudy: {
        condition: 'cloudy', label: 'Cloudy', icon: 'cloud', visibility: null,
        moveCostMod: 1.0, budgetMod: 1.0, encounterMod: 0,
        description: 'Overcast — no effect on travel',
      },
      rain: {
        condition: 'rain', label: 'Rain', icon: 'cloud-rain', visibility: null,
        moveCostMod: 1.25, budgetMod: 1.0, encounterMod: 10,
        description: 'Heavy rain — terrain costs +25%',
      },
      storm: {
        condition: 'storm', label: 'Storm', icon: 'bolt', visibility: 3,
        moveCostMod: 1.5, budgetMod: 0.75, encounterMod: 20,
        description: 'Thunderstorm — terrain costs +50%, visibility limited, daily budget -25%',
      },
      fog: {
        condition: 'fog', label: 'Fog', icon: 'smog', visibility: 1,
        moveCostMod: 1.0, budgetMod: 1.0, encounterMod: -10,
        description: 'Thick fog — visibility limited to adjacent hexes',
      },
      wind: {
        condition: 'wind', label: 'High Wind', icon: 'wind', visibility: null,
        moveCostMod: 1.0, budgetMod: 0.8, encounterMod: 5,
        description: 'Strong winds — daily budget -20%',
      },
      snow: {
        condition: 'snow', label: 'Snow', icon: 'snowflake', visibility: null,
        moveCostMod: 1.5, budgetMod: 1.0, encounterMod: 10,
        description: 'Snowfall — terrain costs +50%',
      },
      mist: {
        condition: 'mist', label: 'Mist', icon: 'smog', visibility: 2,
        moveCostMod: 1.0, budgetMod: 1.0, encounterMod: -5,
        description: 'Heavy mist — visibility reduced',
      },
      extreme: {
        condition: 'extreme', label: 'Extreme', icon: 'triangle-exclamation', visibility: 0,
        moveCostMod: null, budgetMod: 0, encounterMod: 30,
        description: 'Blizzard or sandstorm — travel impossible, forced camp',
      },
    };

    it('returns the correct effect object for each known condition', () => {
      for (const [condition, expected] of Object.entries(expectedEffects)) {
        const effect = getWeatherEffects(condition);
        expect(effect).toEqual(expected);
      }
    });

    it('returns clear defaults for unknown conditions', () => {
      const effect = getWeatherEffects('hurricane');
      expect(effect.condition).toBe('hurricane');
      expect(effect.label).toBe('Clear');
      expect(effect.icon).toBe('sun');
      expect(effect.visibility).toBeNull();
      expect(effect.moveCostMod).toBe(1.0);
      expect(effect.budgetMod).toBe(1.0);
      expect(effect.encounterMod).toBe(0);
      expect(effect.description).toBe('Clear skies — no effect on travel');
    });

    it('returns clear defaults for null and undefined conditions', () => {
      const nullEffect = getWeatherEffects(null);
      const undefEffect = getWeatherEffects(undefined);

      expect(nullEffect.condition).toBeNull();
      expect(nullEffect.label).toBe('Clear');
      expect(nullEffect.icon).toBe('sun');

      expect(undefEffect.condition).toBeUndefined();
      expect(undefEffect.label).toBe('Clear');
      expect(undefEffect.icon).toBe('sun');
    });
  });

  describe('getWeatherIcon', () => {
    it('returns the correct icon for each known condition', () => {
      expect(getWeatherIcon('clear')).toBe('sun');
      expect(getWeatherIcon('cloudy')).toBe('cloud');
      expect(getWeatherIcon('rain')).toBe('cloud-rain');
      expect(getWeatherIcon('storm')).toBe('bolt');
      expect(getWeatherIcon('fog')).toBe('smog');
      expect(getWeatherIcon('wind')).toBe('wind');
      expect(getWeatherIcon('snow')).toBe('snowflake');
      expect(getWeatherIcon('mist')).toBe('smog');
      expect(getWeatherIcon('extreme')).toBe('triangle-exclamation');
    });

    it('returns sun for unknown, null, and undefined conditions', () => {
      expect(getWeatherIcon('hurricane')).toBe('sun');
      expect(getWeatherIcon(null)).toBe('sun');
      expect(getWeatherIcon(undefined)).toBe('sun');
    });
  });

  describe('getWeatherLabel', () => {
    it('returns the correct label for each known condition', () => {
      expect(getWeatherLabel('clear')).toBe('Clear');
      expect(getWeatherLabel('cloudy')).toBe('Cloudy');
      expect(getWeatherLabel('rain')).toBe('Rain');
      expect(getWeatherLabel('storm')).toBe('Storm');
      expect(getWeatherLabel('fog')).toBe('Fog');
      expect(getWeatherLabel('wind')).toBe('High Wind');
      expect(getWeatherLabel('snow')).toBe('Snow');
      expect(getWeatherLabel('mist')).toBe('Mist');
      expect(getWeatherLabel('extreme')).toBe('Extreme');
    });

    it('returns Unknown for unknown, null, and undefined conditions', () => {
      expect(getWeatherLabel('hurricane')).toBe('Unknown');
      expect(getWeatherLabel(null)).toBe('Unknown');
      expect(getWeatherLabel(undefined)).toBe('Unknown');
    });
  });

  describe('getWeatherDescription', () => {
    it('returns the correct description for each known condition', () => {
      expect(getWeatherDescription('clear')).toBe('Clear skies — no effect on travel');
      expect(getWeatherDescription('cloudy')).toBe('Overcast — no effect on travel');
      expect(getWeatherDescription('rain')).toBe('Heavy rain — terrain costs +25%');
      expect(getWeatherDescription('storm')).toBe('Thunderstorm — terrain costs +50%, visibility limited, daily budget -25%');
      expect(getWeatherDescription('fog')).toBe('Thick fog — visibility limited to adjacent hexes');
      expect(getWeatherDescription('wind')).toBe('Strong winds — daily budget -20%');
      expect(getWeatherDescription('snow')).toBe('Snowfall — terrain costs +50%');
      expect(getWeatherDescription('mist')).toBe('Heavy mist — visibility reduced');
      expect(getWeatherDescription('extreme')).toBe('Blizzard or sandstorm — travel impossible, forced camp');
    });

    it('returns empty string for unknown, null, and undefined conditions', () => {
      expect(getWeatherDescription('hurricane')).toBe('');
      expect(getWeatherDescription(null)).toBe('');
      expect(getWeatherDescription(undefined)).toBe('');
    });
  });

  describe('known conditions completeness', () => {
    it('every known condition has a corresponding icon, label, and description', () => {
      for (const condition of KNOWN_CONDITIONS) {
        expect(getWeatherIcon(condition)).toBeDefined();
        expect(getWeatherLabel(condition)).toBeDefined();
        expect(getWeatherDescription(condition)).toBeDefined();
      }
    });

    it('getWeatherEffects returns the same values as the individual accessor functions for each condition', () => {
      for (const condition of KNOWN_CONDITIONS) {
        const effect = getWeatherEffects(condition);
        expect(effect.icon).toBe(getWeatherIcon(condition));
        expect(effect.label).toBe(getWeatherLabel(condition));
        expect(effect.description).toBe(getWeatherDescription(condition));
      }
    });
  });
});
