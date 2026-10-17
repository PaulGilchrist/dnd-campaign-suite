// @maintained-by-ai
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  generateWeather,
} from './weatherService.js';

// Pins verbatim from weatherService.js: each biome is a d8 table rolled once
// via Math.random() (weatherService.js L115). Weather is rolled on explicit
// GM action only (TravelPanel "Re-roll weather" → HexMap.jsx L131) — never
// on a clock (no-timers mandate); this service holds no state and no fetch.

// VERBATIM WEATHER_TABLES from weatherService.js L1-7, keyed by biome.
const BIOME_TABLES = {
  temperate: ['clear', 'cloudy', 'cloudy', 'cloudy', 'rain', 'rain', 'fog', 'storm'],
  arid: ['clear', 'cloudy', 'cloudy', 'wind', 'wind', 'fog', 'fog', 'extreme'],
  cold: ['clear', 'cloudy', 'cloudy', 'snow', 'snow', 'storm', 'fog', 'extreme'],
  wet: ['cloudy', 'cloudy', 'rain', 'rain', 'rain', 'storm', 'fog', 'mist'],
  coastal: ['clear', 'cloudy', 'cloudy', 'rain', 'wind', 'wind', 'storm', 'fog'],
};

// VERBATIM TERRAIN_BIOME from weatherService.js L9-18; unknown/null/
// undefined fall back to 'temperate' (getBiome, L105).
const TERRAIN_BIOME = {
  plains: 'temperate',
  forest: 'temperate',
  hills: 'temperate',
  mountains: 'cold',
  desert: 'arid',
  swamp: 'wet',
  tundra: 'cold',
  beach: 'coastal',
};

// VERBATIM WEATHER_EFFECTS from weatherService.js L20-102. These exact
// fields are the travel contract consumed downstream:
// - budgetMod → useTravelManagement.js L104 (`w?.budgetMod ?? 1`, floored)
// - moveCostMod → useTravelManagement.js L112-113 (null = impassable hex)
//   and L193 (`weather?.moveCostMod === null` → halt message)
// - encounterMod → randomEventService.js L17 (`(weather?.encounterMod || 0) / 100`)
// - label/icon/description → TravelPanel.jsx TravelWeatherSection (L39-46)
const WEATHER_EFFECTS = {
  clear: { label: 'Clear', icon: 'sun', visibility: null, moveCostMod: 1.0, budgetMod: 1.0, encounterMod: 0, description: 'Clear skies — no effect on travel' },
  cloudy: { label: 'Cloudy', icon: 'cloud', visibility: null, moveCostMod: 1.0, budgetMod: 1.0, encounterMod: 0, description: 'Overcast — no effect on travel' },
  rain: { label: 'Rain', icon: 'cloud-rain', visibility: null, moveCostMod: 1.25, budgetMod: 1.0, encounterMod: 10, description: 'Heavy rain — terrain costs +25%' },
  storm: { label: 'Storm', icon: 'bolt', visibility: 3, moveCostMod: 1.5, budgetMod: 0.75, encounterMod: 20, description: 'Thunderstorm — terrain costs +50%, visibility limited, daily budget -25%' },
  fog: { label: 'Fog', icon: 'smog', visibility: 1, moveCostMod: 1.0, budgetMod: 1.0, encounterMod: -10, description: 'Thick fog — visibility limited to adjacent hexes' },
  wind: { label: 'High Wind', icon: 'wind', visibility: null, moveCostMod: 1.0, budgetMod: 0.8, encounterMod: 5, description: 'Strong winds — daily budget -20%' },
  snow: { label: 'Snow', icon: 'snowflake', visibility: null, moveCostMod: 1.5, budgetMod: 1.0, encounterMod: 10, description: 'Snowfall — terrain costs +50%' },
  mist: { label: 'Mist', icon: 'smog', visibility: 2, moveCostMod: 1.0, budgetMod: 1.0, encounterMod: -5, description: 'Heavy mist — visibility reduced' },
  extreme: { label: 'Extreme', icon: 'triangle-exclamation', visibility: 0, moveCostMod: null, budgetMod: 0, encounterMod: 30, description: 'Blizzard or sandstorm — travel impossible, forced camp' },
};

// Full expected record for a condition: { condition, ...effect }.
function record(condition) {
  return { condition, ...WEATHER_EFFECTS[condition] };
}

// Rig Math.random so the d8 index lands exactly on slot i of an 8-entry
// table: floor(((i + 0.5) / 8) * 8) === i. Capture is vi.spyOn; restore is
// afterEach's vi.restoreAllMocks (settlementGenerator.test.js pattern).
function rigIndex(table, i) {
  return vi.spyOn(Math, 'random').mockReturnValue((i + 0.5) / table.length);
}

// Representative terrain per biome, derived from TERRAIN_BIOME (no duplicate
// mapping tables in the test) — first terrain wins per biome.
const BIOME_TERRAIN = {};
for (const [terrain, biome] of Object.entries(TERRAIN_BIOME)) {
  if (!(biome in BIOME_TERRAIN)) BIOME_TERRAIN[biome] = terrain;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('weatherService', () => {
  describe('generateWeather', () => {
    it('consumes exactly one roll per call and returns the full effect record', () => {
      const spy = rigIndex(BIOME_TABLES.temperate, 0);
      // Exact full object — replaces the former toHaveProperty key-scan.
      expect(generateWeather('plains')).toEqual(record('clear'));
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('each terrain resolves to its biome table — first/last deterministic pins', () => {
      // Fingerprint each biome by its table ends (unique per table except
      // arid/cold, disambiguated at slot 3 below).
      const fingerprints = [
        // [terrain, first condition, last condition]
        ['plains', 'clear', 'storm'],
        ['forest', 'clear', 'storm'],
        ['hills', 'clear', 'storm'],
        ['mountains', 'clear', 'extreme'],
        ['tundra', 'clear', 'extreme'],
        ['desert', 'clear', 'extreme'],
        ['swamp', 'cloudy', 'mist'],
        ['beach', 'clear', 'fog'],
        // Unknown/null/undefined → temperate fallback (storm-last is
        // unique to the temperate table among first-'clear' tables).
        ['jungle', 'clear', 'storm'],
        [null, 'clear', 'storm'],
        [undefined, 'clear', 'storm'],
      ];
      for (const [terrain, first, last] of fingerprints) {
        rigIndex(BIOME_TABLES[TERRAIN_BIOME[terrain] ?? 'temperate'], 0);
        expect(generateWeather(terrain), `${terrain} slot 0`).toEqual(record(first));
        rigIndex(BIOME_TABLES[TERRAIN_BIOME[terrain] ?? 'temperate'], 7);
        expect(generateWeather(terrain), `${terrain} slot 7`).toEqual(record(last));
      }
    });

    it('arid and cold tables are distinguished at slot 3 (wind vs snow)', () => {
      rigIndex(BIOME_TABLES.arid, 3);
      expect(generateWeather('desert')).toEqual(record('wind'));
      rigIndex(BIOME_TABLES.cold, 3);
      expect(generateWeather('mountains')).toEqual(record('snow'));
    });

    it('enumerates every biome table slot to its exact weather record', () => {
      // Replaces the former findCondition retry spam (up to 200 unrigged
      // rolls per condition) and the stochastic 20-roll containment loop:
      // one rigged roll per slot proves each table's full membership and
      // each condition's exact effect fields (budgetMod/moveCostMod/
      // encounterMod/label — the travel/randomEvent consumer contract).
      for (const [biome, table] of Object.entries(BIOME_TABLES)) {
        for (let i = 0; i < table.length; i++) {
          rigIndex(table, i);
          expect(generateWeather(BIOME_TERRAIN[biome]), `${biome}[${i}]`).toEqual(record(table[i]));
        }
      }
    });

    it('extreme weather is impassable and halts the travel lane', () => {
      // Travel #2011 pins: budgetMod × base budget floors to 0 hexes and
      // moveCostMod === null blocks movement (useTravelManagement L113/193).
      // Base budgets are real: normal pace = 4 hexes (getDailyHexBudget,
      // travelService.js L94).
      rigIndex(BIOME_TABLES.arid, 7);
      const extreme = generateWeather('desert');
      expect(extreme.moveCostMod).toBeNull(); // impassable (useTravelManagement L113 → cost null)
      expect(extreme.budgetMod).toBe(0);
      expect(Math.floor(4 * extreme.budgetMod)).toBe(0); // normal pace 4 hexes → 0
      expect(extreme.encounterMod).toBe(30); // +30% encounter pressure (randomEventService L17 → 0.3)

      // Storm keeps partial budget with floor truncation: 4 × 0.75 = 3.
      rigIndex(BIOME_TABLES.temperate, 7);
      const storm = generateWeather('plains');
      expect(Math.floor(4 * storm.budgetMod)).toBe(3); // -25% daily budget, truncated
      expect(storm.moveCostMod).toBe(1.5); // +50% terrain cost, still passable
    });
  });
});
