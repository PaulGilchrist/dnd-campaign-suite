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

describe('weatherService', () => {
  describe('getBiome', () => {
    it('should return correct biome for plains', () => {
      expect(getBiome('plains')).toBe('temperate');
    });

    it('should return correct biome for forest', () => {
      expect(getBiome('forest')).toBe('temperate');
    });

    it('should return correct biome for hills', () => {
      expect(getBiome('hills')).toBe('temperate');
    });

    it('should return correct biome for mountains', () => {
      expect(getBiome('mountains')).toBe('cold');
    });

    it('should return correct biome for desert', () => {
      expect(getBiome('desert')).toBe('arid');
    });

    it('should return correct biome for swamp', () => {
      expect(getBiome('swamp')).toBe('wet');
    });

    it('should return correct biome for tundra', () => {
      expect(getBiome('tundra')).toBe('cold');
    });

    it('should return correct biome for beach', () => {
      expect(getBiome('beach')).toBe('coastal');
    });

    it('should default to temperate for unknown terrain type', () => {
      expect(getBiome('jungle')).toBe('temperate');
    });

    it('should default to temperate for null input', () => {
      expect(getBiome(null)).toBe('temperate');
    });

    it('should default to temperate for undefined input', () => {
      expect(getBiome(undefined)).toBe('temperate');
    });
  });

  describe('getWeatherTable', () => {
    it('should return temperate table', () => {
      const table = getWeatherTable('temperate');
      expect(table).toEqual([
        'clear', 'cloudy', 'cloudy', 'cloudy', 'rain', 'rain', 'fog', 'storm',
      ]);
    });

    it('should return arid table', () => {
      const table = getWeatherTable('arid');
      expect(table).toEqual([
        'clear', 'cloudy', 'cloudy', 'wind', 'wind', 'fog', 'fog', 'extreme',
      ]);
    });

    it('should return cold table', () => {
      const table = getWeatherTable('cold');
      expect(table).toEqual([
        'clear', 'cloudy', 'cloudy', 'snow', 'snow', 'storm', 'fog', 'extreme',
      ]);
    });

    it('should return wet table', () => {
      const table = getWeatherTable('wet');
      expect(table).toEqual([
        'cloudy', 'cloudy', 'rain', 'rain', 'rain', 'storm', 'fog', 'mist',
      ]);
    });

    it('should return coastal table', () => {
      const table = getWeatherTable('coastal');
      expect(table).toEqual([
        'clear', 'cloudy', 'cloudy', 'rain', 'wind', 'wind', 'storm', 'fog',
      ]);
    });

    it('should default to temperate table for unknown biome', () => {
      const table = getWeatherTable('tropical');
      expect(table).toEqual([
        'clear', 'cloudy', 'cloudy', 'cloudy', 'rain', 'rain', 'fog', 'storm',
      ]);
    });

    it('should return the same table reference for temperate', () => {
      const table1 = getWeatherTable('temperate');
      const table2 = getWeatherTable('temperate');
      expect(table1).toBe(table2);
    });
  });

  describe('generateWeather', () => {
    it('should return a weather effect object for plains terrain', () => {
      const weather = generateWeather('plains');
      expect(weather).toHaveProperty('condition');
      expect(weather).toHaveProperty('label');
      expect(weather).toHaveProperty('icon');
      expect(weather).toHaveProperty('description');
    });

    it('should return a weather effect object for desert terrain', () => {
      const weather = generateWeather('desert');
      expect(weather).toHaveProperty('condition');
      expect(weather).toHaveProperty('label');
      expect(weather).toHaveProperty('icon');
    });

    it('should return a weather effect object for tundra terrain', () => {
      const weather = generateWeather('tundra');
      expect(weather).toHaveProperty('condition');
      expect(weather).toHaveProperty('label');
      expect(weather).toHaveProperty('icon');
    });

    it('should return a weather effect object for swamp terrain', () => {
      const weather = generateWeather('swamp');
      expect(weather).toHaveProperty('condition');
      expect(weather).toHaveProperty('label');
      expect(weather).toHaveProperty('icon');
    });

    it('should return a weather effect object for beach terrain', () => {
      const weather = generateWeather('beach');
      expect(weather).toHaveProperty('condition');
      expect(weather).toHaveProperty('label');
      expect(weather).toHaveProperty('icon');
    });

    it('should return temperate weather for unknown terrain', () => {
      const weather = generateWeather('jungle');
      expect(weather).toHaveProperty('condition');
      expect(weather).toHaveProperty('label');
    });

    it('should return random conditions from the table (statistical test)', () => {
      const conditions = new Set();
      for (let i = 0; i < 200; i++) {
        const weather = generateWeather('plains');
        conditions.add(weather.condition);
      }
      // temperate table has 8 conditions, should see multiple unique ones
      expect(conditions.size).toBeGreaterThan(2);
    });

    it('should only return valid conditions for the biome', () => {
      const temperateConditions = new Set([
        'clear', 'cloudy', 'rain', 'fog', 'storm',
      ]);
      for (let i = 0; i < 100; i++) {
        const weather = generateWeather('plains');
        expect(temperateConditions).toContain(weather.condition);
      }
    });

    it('should only return valid arid conditions', () => {
      const aridConditions = new Set(['clear', 'cloudy', 'wind', 'fog', 'extreme']);
      for (let i = 0; i < 100; i++) {
        const weather = generateWeather('desert');
        expect(aridConditions).toContain(weather.condition);
      }
    });

    it('should include all weather effect properties', () => {
      const weather = generateWeather('plains');
      expect(weather).toHaveProperty('visibility');
      expect(weather).toHaveProperty('moveCostMod');
      expect(weather).toHaveProperty('budgetMod');
      expect(weather).toHaveProperty('encounterMod');
    });
  });

  describe('getWeatherEffects', () => {
    it('should return full weather object for clear', () => {
      const effect = getWeatherEffects('clear');
      expect(effect.condition).toBe('clear');
      expect(effect.label).toBe('Clear');
      expect(effect.icon).toBe('sun');
      expect(effect.visibility).toBeNull();
      expect(effect.moveCostMod).toBe(1.0);
      expect(effect.budgetMod).toBe(1.0);
      expect(effect.encounterMod).toBe(0);
      expect(effect.description).toBe('Clear skies — no effect on travel');
    });

    it('should return full weather object for cloudy', () => {
      const effect = getWeatherEffects('cloudy');
      expect(effect.condition).toBe('cloudy');
      expect(effect.label).toBe('Cloudy');
      expect(effect.icon).toBe('cloud');
      expect(effect.visibility).toBeNull();
      expect(effect.moveCostMod).toBe(1.0);
      expect(effect.budgetMod).toBe(1.0);
      expect(effect.encounterMod).toBe(0);
      expect(effect.description).toBe('Overcast — no effect on travel');
    });

    it('should return full weather object for rain', () => {
      const effect = getWeatherEffects('rain');
      expect(effect.condition).toBe('rain');
      expect(effect.label).toBe('Rain');
      expect(effect.icon).toBe('cloud-rain');
      expect(effect.visibility).toBeNull();
      expect(effect.moveCostMod).toBe(1.25);
      expect(effect.budgetMod).toBe(1.0);
      expect(effect.encounterMod).toBe(10);
      expect(effect.description).toBe('Heavy rain — terrain costs +25%');
    });

    it('should return full weather object for storm', () => {
      const effect = getWeatherEffects('storm');
      expect(effect.condition).toBe('storm');
      expect(effect.label).toBe('Storm');
      expect(effect.icon).toBe('bolt');
      expect(effect.visibility).toBe(3);
      expect(effect.moveCostMod).toBe(1.5);
      expect(effect.budgetMod).toBe(0.75);
      expect(effect.encounterMod).toBe(20);
      expect(effect.description).toBe('Thunderstorm — terrain costs +50%, visibility limited, daily budget -25%');
    });

    it('should return full weather object for fog', () => {
      const effect = getWeatherEffects('fog');
      expect(effect.condition).toBe('fog');
      expect(effect.label).toBe('Fog');
      expect(effect.icon).toBe('smog');
      expect(effect.visibility).toBe(1);
      expect(effect.moveCostMod).toBe(1.0);
      expect(effect.budgetMod).toBe(1.0);
      expect(effect.encounterMod).toBe(-10);
      expect(effect.description).toBe('Thick fog — visibility limited to adjacent hexes');
    });

    it('should return full weather object for wind', () => {
      const effect = getWeatherEffects('wind');
      expect(effect.condition).toBe('wind');
      expect(effect.label).toBe('High Wind');
      expect(effect.icon).toBe('wind');
      expect(effect.visibility).toBeNull();
      expect(effect.moveCostMod).toBe(1.0);
      expect(effect.budgetMod).toBe(0.8);
      expect(effect.encounterMod).toBe(5);
      expect(effect.description).toBe('Strong winds — daily budget -20%');
    });

    it('should return full weather object for snow', () => {
      const effect = getWeatherEffects('snow');
      expect(effect.condition).toBe('snow');
      expect(effect.label).toBe('Snow');
      expect(effect.icon).toBe('snowflake');
      expect(effect.visibility).toBeNull();
      expect(effect.moveCostMod).toBe(1.5);
      expect(effect.budgetMod).toBe(1.0);
      expect(effect.encounterMod).toBe(10);
      expect(effect.description).toBe('Snowfall — terrain costs +50%');
    });

    it('should return full weather object for mist', () => {
      const effect = getWeatherEffects('mist');
      expect(effect.condition).toBe('mist');
      expect(effect.label).toBe('Mist');
      expect(effect.icon).toBe('smog');
      expect(effect.visibility).toBe(2);
      expect(effect.moveCostMod).toBe(1.0);
      expect(effect.budgetMod).toBe(1.0);
      expect(effect.encounterMod).toBe(-5);
      expect(effect.description).toBe('Heavy mist — visibility reduced');
    });

    it('should return full weather object for extreme', () => {
      const effect = getWeatherEffects('extreme');
      expect(effect.condition).toBe('extreme');
      expect(effect.label).toBe('Extreme');
      expect(effect.icon).toBe('triangle-exclamation');
      expect(effect.visibility).toBe(0);
      expect(effect.moveCostMod).toBeNull();
      expect(effect.budgetMod).toBe(0);
      expect(effect.encounterMod).toBe(30);
      expect(effect.description).toBe('Blizzard or sandstorm — travel impossible, forced camp');
    });

    it('should fallback to clear for unknown condition', () => {
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

    it('should fallback to clear for null condition', () => {
      const effect = getWeatherEffects(null);
      expect(effect.condition).toBeNull();
      expect(effect.label).toBe('Clear');
      expect(effect.icon).toBe('sun');
    });

    it('should fallback to clear for undefined condition', () => {
      const effect = getWeatherEffects(undefined);
      expect(effect.condition).toBeUndefined();
      expect(effect.label).toBe('Clear');
      expect(effect.icon).toBe('sun');
    });
  });

  describe('getWeatherIcon', () => {
    it('should return icon for clear', () => {
      expect(getWeatherIcon('clear')).toBe('sun');
    });

    it('should return icon for cloudy', () => {
      expect(getWeatherIcon('cloudy')).toBe('cloud');
    });

    it('should return icon for rain', () => {
      expect(getWeatherIcon('rain')).toBe('cloud-rain');
    });

    it('should return icon for storm', () => {
      expect(getWeatherIcon('storm')).toBe('bolt');
    });

    it('should return icon for fog', () => {
      expect(getWeatherIcon('fog')).toBe('smog');
    });

    it('should return icon for wind', () => {
      expect(getWeatherIcon('wind')).toBe('wind');
    });

    it('should return icon for snow', () => {
      expect(getWeatherIcon('snow')).toBe('snowflake');
    });

    it('should return icon for mist', () => {
      expect(getWeatherIcon('mist')).toBe('smog');
    });

    it('should return icon for extreme', () => {
      expect(getWeatherIcon('extreme')).toBe('triangle-exclamation');
    });

    it('should return sun for unknown condition', () => {
      expect(getWeatherIcon('hurricane')).toBe('sun');
    });

    it('should return sun for null condition', () => {
      expect(getWeatherIcon(null)).toBe('sun');
    });

    it('should return sun for undefined condition', () => {
      expect(getWeatherIcon(undefined)).toBe('sun');
    });
  });

  describe('getWeatherLabel', () => {
    it('should return label for clear', () => {
      expect(getWeatherLabel('clear')).toBe('Clear');
    });

    it('should return label for cloudy', () => {
      expect(getWeatherLabel('cloudy')).toBe('Cloudy');
    });

    it('should return label for rain', () => {
      expect(getWeatherLabel('rain')).toBe('Rain');
    });

    it('should return label for storm', () => {
      expect(getWeatherLabel('storm')).toBe('Storm');
    });

    it('should return label for fog', () => {
      expect(getWeatherLabel('fog')).toBe('Fog');
    });

    it('should return label for wind', () => {
      expect(getWeatherLabel('wind')).toBe('High Wind');
    });

    it('should return label for snow', () => {
      expect(getWeatherLabel('snow')).toBe('Snow');
    });

    it('should return label for mist', () => {
      expect(getWeatherLabel('mist')).toBe('Mist');
    });

    it('should return label for extreme', () => {
      expect(getWeatherLabel('extreme')).toBe('Extreme');
    });

    it('should return Unknown for unknown condition', () => {
      expect(getWeatherLabel('hurricane')).toBe('Unknown');
    });

    it('should return Unknown for null condition', () => {
      expect(getWeatherLabel(null)).toBe('Unknown');
    });

    it('should return Unknown for undefined condition', () => {
      expect(getWeatherLabel(undefined)).toBe('Unknown');
    });
  });

  describe('getWeatherDescription', () => {
    it('should return description for clear', () => {
      expect(getWeatherDescription('clear')).toBe('Clear skies — no effect on travel');
    });

    it('should return description for cloudy', () => {
      expect(getWeatherDescription('cloudy')).toBe('Overcast — no effect on travel');
    });

    it('should return description for rain', () => {
      expect(getWeatherDescription('rain')).toBe('Heavy rain — terrain costs +25%');
    });

    it('should return description for storm', () => {
      expect(getWeatherDescription('storm')).toBe('Thunderstorm — terrain costs +50%, visibility limited, daily budget -25%');
    });

    it('should return description for fog', () => {
      expect(getWeatherDescription('fog')).toBe('Thick fog — visibility limited to adjacent hexes');
    });

    it('should return description for wind', () => {
      expect(getWeatherDescription('wind')).toBe('Strong winds — daily budget -20%');
    });

    it('should return description for snow', () => {
      expect(getWeatherDescription('snow')).toBe('Snowfall — terrain costs +50%');
    });

    it('should return description for mist', () => {
      expect(getWeatherDescription('mist')).toBe('Heavy mist — visibility reduced');
    });

    it('should return description for extreme', () => {
      expect(getWeatherDescription('extreme')).toBe('Blizzard or sandstorm — travel impossible, forced camp');
    });

    it('should return empty string for unknown condition', () => {
      expect(getWeatherDescription('hurricane')).toBe('');
    });

    it('should return empty string for null condition', () => {
      expect(getWeatherDescription(null)).toBe('');
    });

    it('should return empty string for undefined condition', () => {
      expect(getWeatherDescription(undefined)).toBe('');
    });
  });
});
