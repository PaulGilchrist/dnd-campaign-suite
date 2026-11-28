// @maintained-by-ai 2026-11-27
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateWeather,
} from './weatherService.js';

// Pins verbatim from weatherService.js: each biome is a d8 table rolled once
// via Math.random() (generateWeather, L114). Weather is rolled on explicit
// GM action only (handleGenerateWeather/handleReRollWeather, HexMap.jsx L331
// ← TravelPanel "Re-roll weather" button, TravelPanel.jsx L103) — never on a
// clock (no-timers mandate); this service holds no state, no Date.now, no
// fetch. Export census (2026-11-27 sweep): generateWeather is the module's
// ONLY export; getBiome/getWeatherTable/getWeatherEffects are module-private
// and pinned THROUGH generateWeather below. No dead exports.

// VERBATIM WEATHER_TABLES from weatherService.js L1-7, keyed by biome. The
// duplicate entries ARE the distribution weights — pinning the arrays pins
// the odds; no statistical sampling.
const BIOME_TABLES = {
  temperate: ['clear', 'cloudy', 'cloudy', 'cloudy', 'rain', 'rain', 'fog', 'storm'],
  arid: ['clear', 'cloudy', 'cloudy', 'wind', 'wind', 'fog', 'fog', 'extreme'],
  cold: ['clear', 'cloudy', 'cloudy', 'snow', 'snow', 'storm', 'fog', 'extreme'],
  wet: ['cloudy', 'cloudy', 'rain', 'rain', 'rain', 'storm', 'fog', 'mist'],
  coastal: ['clear', 'cloudy', 'cloudy', 'rain', 'wind', 'wind', 'storm', 'fog'],
};

// VERBATIM TERRAIN_BIOME from weatherService.js L9-18; unknown/null/
// undefined fall back to 'temperate' (getBiome, L104).
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

// VERBATIM WEATHER_EFFECTS from weatherService.js L28-101. These exact fields
// are the travel contract consumed downstream (cites re-verified 2026-11-27):
// - budgetMod → useTravelManagement.js L306 (`w?.budgetMod ?? 1`, floored —
//   the floor/consumption behavior is the useTravelManagement lanes' face,
//   e.g. useTravelManagement.weather-budget-init; the base-budget bytes are
//   travelService.test.js's face (getDailyHexBudget, travelService.js L86) —
//   this lane pins ONLY the mod bytes)
// - moveCostMod → useTravelManagement.js L341 and L525
//   (`weather?.moveCostMod === null` → impassable/halt message)
// - encounterMod → randomEventService.js L28 (`(weather?.encounterMod || 0) / 100`)
// - label/icon/description → TravelPanel.jsx TravelWeatherSection (L93-103)
// There is deliberately NO `visibility` field: it had zero consumers, so the
// rows no longer advertise a visibility mechanic (bug-weather-visibility-
// advertised-never-enforced). The full-shape toEqual census below is the
// regression lock: any re-added field (visibility or other) on any row fails
// the exact-object comparison at that slot — re-add only WITH a consumer.
const WEATHER_EFFECTS = {
  clear: { label: 'Clear', icon: 'sun', moveCostMod: 1.0, budgetMod: 1.0, encounterMod: 0, description: 'Clear skies — no effect on travel' },
  cloudy: { label: 'Cloudy', icon: 'cloud', moveCostMod: 1.0, budgetMod: 1.0, encounterMod: 0, description: 'Overcast — no effect on travel' },
  rain: { label: 'Rain', icon: 'cloud-rain', moveCostMod: 1.25, budgetMod: 1.0, encounterMod: 10, description: 'Heavy rain — terrain costs +25%' },
  storm: { label: 'Storm', icon: 'bolt', moveCostMod: 1.5, budgetMod: 0.75, encounterMod: 20, description: 'Thunderstorm — terrain costs +50%, daily budget -25%' },
  fog: { label: 'Fog', icon: 'smog', moveCostMod: 1.0, budgetMod: 1.0, encounterMod: -10, description: 'Thick fog — encounter chance -10%' },
  wind: { label: 'High Wind', icon: 'wind', moveCostMod: 1.0, budgetMod: 0.8, encounterMod: 5, description: 'Strong winds — daily budget -20%' },
  snow: { label: 'Snow', icon: 'snowflake', moveCostMod: 1.5, budgetMod: 1.0, encounterMod: 10, description: 'Snowfall — terrain costs +50%' },
  mist: { label: 'Mist', icon: 'smog', moveCostMod: 1.0, budgetMod: 1.0, encounterMod: -5, description: 'Heavy mist — encounter chance -5%' },
  extreme: { label: 'Extreme', icon: 'triangle-exclamation', moveCostMod: null, budgetMod: 0, encounterMod: 30, description: 'Blizzard or sandstorm — travel impossible, forced camp' },
};

// Full expected record for a condition: { condition, ...effect }.
function record(condition) {
  return { condition, ...WEATHER_EFFECTS[condition] };
}

// ONE spy per test (beforeEach baseline; afterEach restoreAllMocks unwinds
// it). rigIndex steers the same spy — no re-spying mid-test. A roll index i
// on an 8-entry table: floor(((i + 0.5) / 8) * 8) === i.
let randomSpy;
beforeEach(() => {
  randomSpy = vi.spyOn(Math, 'random');
});
afterEach(() => {
  vi.restoreAllMocks();
});

function rigIndex(table, i) {
  randomSpy.mockReturnValue((i + 0.5) / table.length);
}

describe('weatherService', () => {
  describe('generateWeather', () => {
    it('consumes exactly one roll per call and returns the full effect record', () => {
      rigIndex(BIOME_TABLES.temperate, 0);
      expect(generateWeather('plains')).toEqual(record('clear'));
      expect(randomSpy).toHaveBeenCalledTimes(1);
    });

    it('every terrain walks its biome table slot-by-slot to exact weather records', () => {
      // One census pins ALL of: the 5 table byte sequences (duplicate entries
      // = distribution weights), the full TERRAIN_BIOME map (a mis-mapped
      // terrain fails some slot — e.g. arid vs cold diverge at slot 3:
      // wind vs snow), the unknown/null/undefined → temperate fallback, and
      // every condition's exact effect record (budgetMod/moveCostMod/
      // encounterMod/label/icon/description — the travel/randomEvent/panel
      // consumer contract). Full-shape toEqual also locks the field SET: a
      // re-added zero-consumer field (the retired `visibility`) fails here.
      const terrains = [...Object.keys(TERRAIN_BIOME), 'jungle', null, undefined];
      for (const terrain of terrains) {
        const table = BIOME_TABLES[TERRAIN_BIOME[terrain] ?? 'temperate'];
        for (let i = 0; i < table.length; i++) {
          rigIndex(table, i);
          expect(generateWeather(terrain), `${terrain} slot ${i}`).toEqual(record(table[i]));
        }
      }
    });
  });
});
