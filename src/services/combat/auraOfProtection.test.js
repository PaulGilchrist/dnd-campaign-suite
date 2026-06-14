import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// ── Imports (Vite returns mocked versions) ─────────────────────

import {
  CANNOT_ACT_CONDITIONS,
  DEFAULT_AURA_RANGE_FT,
  EXPANDED_AURA_RANGE_FT,
  hasAura,
  hasAuraOfProtection,
  getAuraRangeFromStats,
  getChaModifier,
  hasCannotActCondition,
  isWithinRange,
  computeAuraBonus,
} from './auraOfProtection.js';

import { loadMapData } from '../maps/mapsService.js';
import { getDistanceFeet } from '../rules/combat/rangeValidation.js';
import { getRuntimeValue } from '../../hooks/useRuntimeState.js';

// ── Helpers ─────────────────────────────────────────────────────

function makeStats(extra = {}) {
  return { automation: extra.automation ?? null };
}

function makePassive(name) {
  return { name };
}

function makeSourceEntry(name, computedStats) {
  return { name, computedStats };
}

/**
 * Helpers to configure the mocked dependencies so that isWithinRange returns
 * a desired result.  Because isWithinRange lives in the same module we cannot
 * vi.mock it directly — instead we control its outcome via loadMapData +
 * getDistanceFeet or by passing an empty activeMapName (fast-path true).
 */

/** Quick path: return true immediately when activeMapName == '' */
const IN_RANGE_PASS = '';            // activeMapName — short-circuit to true
const OUT_OF_RANGE_FAIL = 'map';    // triggers full lookup path

// ── Tests ───────────────────────────────────────────────────────

describe('constants', () => {
  it('exports CANNOT_ACT_CONDITIONS with correct values', () => {
    expect(CANNOT_ACT_CONDITIONS).toEqual([
       'incapacitated',
       'paralyzed',
       'petrified',
       'stunned',
       'unconscious',
     ]);
   });

  it('exports DEFAULT_AURA_RANGE_FT as 10', () => {
    expect(DEFAULT_AURA_RANGE_FT).toBe(10);
   });

  it('exports EXPANDED_AURA_RANGE_FT as 30', () => {
    expect(EXPANDED_AURA_RANGE_FT).toBe(30);
   });
});

describe('hasAura', () => {
  it('returns true when passive with matching name exists', () => {
    const stats = makeStats({
      automation: { passives: [makePassive('Aura of Protection')] },
     });
    expect(hasAura(stats, 'Aura of Protection')).toBe(true);
   });

  it('returns false when no matching passive name', () => {
    const stats = makeStats({
      automation: { passives: [makePassive('Divine Smite')] },
     });
    expect(hasAura(stats, 'Aura of Protection')).toBe(false);
   });

  it('returns false when playerStats is null', () => {
    expect(hasAura(null, 'Aura of Protection')).toBe(false);
   });

  it('returns false when playerStats is undefined', () => {
    expect(hasAura(undefined, 'Aura of Protection')).toBe(false);
   });

  it('returns false when automation is missing', () => {
    expect(hasAura(makeStats(), 'Aura of Protection')).toBe(false);
   });

  it('returns false when passives array is empty', () => {
    const stats = makeStats({ automation: { passives: [] } });
    expect(hasAura(stats, 'Aura of Protection')).toBe(false);
   });

  it('iterates through all passives before returning false', () => {
    const stats = makeStats({
      automation: {
        passives: [makePassive('One'), makePassive('Two'), makePassive('Three')],
       },
     });
    expect(hasAura(stats, 'Target')).toBe(false);
   });
});

describe('hasAuraOfProtection', () => {
  it('returns true when Aura of Protection passive exists', () => {
    const stats = makeStats({
      automation: { passives: [makePassive('Aura of Protection')] },
     });
    expect(hasAuraOfProtection(stats)).toBe(true);
   });

  it('returns false when Aura of Protection passive does not exist', () => {
    const stats = makeStats({
      automation: { passives: [makePassive('Other Aura')] },
     });
    expect(hasAuraOfProtection(stats)).toBe(false);
   });

  it('returns false when playerStats is null', () => {
    expect(hasAuraOfProtection(null)).toBe(false);
   });
});

describe('getAuraRangeFromStats', () => {
  it('returns DEFAULT_AURA_RANGE_FT when only Aura of Protection present', () => {
    const stats = makeStats({
      automation: { passives: [makePassive('Aura of Protection')] },
     });
    expect(getAuraRangeFromStats(stats)).toBe(DEFAULT_AURA_RANGE_FT);
   });

  it('returns EXPANDED_AURA_RANGE_FT when Aura Expansion present', () => {
    const stats = makeStats({
      automation: {
        passives: [makePassive('Aura of Protection'), makePassive('Aura Expansion')],
       },
     });
    expect(getAuraRangeFromStats(stats)).toBe(EXPANDED_AURA_RANGE_FT);
   });

  it('returns DEFAULT_AURA_RANGE_FT when neither aura present', () => {
    const stats = makeStats({
      automation: { passives: [makePassive('Some Other Feature')] },
     });
    expect(getAuraRangeFromStats(stats)).toBe(DEFAULT_AURA_RANGE_FT);
   });

  it('returns EXPANDED_AURA_RANGE_FT even without Aura of Protection if Aura Expansion present', () => {
    const stats = makeStats({
      automation: { passives: [makePassive('Aura Expansion')] },
     });
    expect(getAuraRangeFromStats(stats)).toBe(EXPANDED_AURA_RANGE_FT);
   });
});

describe('getChaModifier', () => {
  it('uses cha.bonus when available (not null or undefined)', () => {
    const stats = {
      abilities: [{ name: 'Charisma', bonus: 5 }],
     };
    expect(getChaModifier(stats)).toBe(5);
   });

  it('uses cha.bonus even when negative', () => {
    const stats = {
      abilities: [{ name: 'Charisma', bonus: -2 }],
     };
    expect(getChaModifier(stats)).toBe(-2);
   });

  it('uses cha.bonus of zero', () => {
    const stats = {
      abilities: [{ name: 'Charisma', bonus: 0 }],
     };
    expect(getChaModifier(stats)).toBe(0);
   });

  it('computes mod from baseScore when bonus is absent', () => {
    const stats = {
      abilities: [
         {
          name: 'Charisma',
          baseScore: 16,
          abilityImprovements: 0,
          miscBonus: 0,
         },
       ],
     };
    // floor((16 + 0 + 0 - 10) / 2) = floor(3) = 3
    expect(getChaModifier(stats)).toBe(3);
   });

  it('includes abilityImprovements in computation', () => {
    const stats = {
      abilities: [
         {
          name: 'Charisma',
          baseScore: 14,
          abilityImprovements: 2,
          miscBonus: 0,
         },
       ],
     };
    // floor((14 + 2 + 0 - 10) / 2) = floor(3) = 3
    expect(getChaModifier(stats)).toBe(3);
   });

  it('includes miscBonus in computation', () => {
    const stats = {
      abilities: [
         {
          name: 'Charisma',
          baseScore: 10,
          abilityImprovements: 0,
          miscBonus: 2,
         },
       ],
     };
    // floor((10 + 0 + 2 - 10) / 2) = floor(1) = 1
    expect(getChaModifier(stats)).toBe(1);
   });

  it('handles odd total in formula (floor division)', () => {
    const stats = {
      abilities: [
         {
          name: 'Charisma',
          baseScore: 15,
          abilityImprovements: 0,
          miscBonus: 0,
         },
       ],
     };
    // floor((15 + 0 + 0 - 10) / 2) = floor(2.5) = 2
    expect(getChaModifier(stats)).toBe(2);
   });

  it('handles negative computed mod', () => {
    const stats = {
      abilities: [
         {
          name: 'Charisma',
          baseScore: 7,
          abilityImprovements: 0,
          miscBonus: 0,
         },
       ],
     };
    // floor((7 + 0 + 0 - 10) / 2) = floor(-1.5) = -2
    expect(getChaModifier(stats)).toBe(-2);
   });

  it('returns 0 when Charisma ability not found', () => {
    const stats = { abilities: [{ name: 'Strength' }] };
    expect(getChaModifier(stats)).toBe(0);
   });

  it('returns 0 when abilities array is empty', () => {
    const stats = { abilities: [] };
    expect(getChaModifier(stats)).toBe(0);
   });

  it('returns 0 when abilities is missing', () => {
    const stats = {};
    expect(getChaModifier(stats)).toBe(0);
   });

  it('prefers bonus over computed value even with full baseScore present', () => {
    const stats = {
      abilities: [
         {
          name: 'Charisma',
          baseScore: 10,
          abilityImprovements: 0,
          miscBonus: 0,
          bonus: 7,
         },
       ],
     };
    expect(getChaModifier(stats)).toBe(7);
   });

  it('throws when playerStats is null (no abilities property)', () => {
    expect(() => getChaModifier(null)).toThrow();
   });
});

describe('hasCannotActCondition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
   });

  it('returns true when active conditions include incapacitated', () => {
    getRuntimeValue.mockReturnValue(['incapacitated']);
    expect(hasCannotActCondition('Paladin', 'MyCampaign')).toBe(true);
   });

  it('returns true for paralyzed condition', () => {
    getRuntimeValue.mockReturnValue(['paralyzed']);
    expect(hasCannotActCondition('Paladin', 'MyCampaign')).toBe(true);
   });

  it('returns true for petrified condition', () => {
    getRuntimeValue.mockReturnValue(['petrified']);
    expect(hasCannotActCondition('Paladin', 'MyCampaign')).toBe(true);
   });

  it('returns true for stunned condition', () => {
    getRuntimeValue.mockReturnValue(['stunned']);
    expect(hasCannotActCondition('Paladin', 'MyCampaign')).toBe(true);
   });

  it('returns true for unconscious condition', () => {
    getRuntimeValue.mockReturnValue(['unconscious']);
    expect(hasCannotActCondition('Paladin', 'MyCampaign')).toBe(true);
   });

  it('returns true when any non-cannot-act conditions mixed with one that matches', () => {
    getRuntimeValue.mockReturnValue(['poisoned', 'stunned']);
    expect(hasCannotActCondition('Paladin', 'MyCampaign')).toBe(true);
   });

  it('returns false when activeConditions has no matching condition', () => {
    getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
    expect(hasCannotActCondition('Paladin', 'MyCampaign')).toBe(false);
   });

  it('returns false when activeConditions is empty array', () => {
    getRuntimeValue.mockReturnValue([]);
    expect(hasCannotActCondition('Paladin', 'MyCampaign')).toBe(false);
   });

  it('returns false when activeConditions is not an array (null)', () => {
    getRuntimeValue.mockReturnValue(null);
    expect(hasCannotActCondition('Paladin', 'MyCampaign')).toBe(false);
   });

  it('returns false when activeConditions is not an array (string)', () => {
    getRuntimeValue.mockReturnValue('stunned');
    expect(hasCannotActCondition('Paladin', 'MyCampaign')).toBe(false);
   });

  it('returns false when getRuntimeValue throws an error', () => {
    getRuntimeValue.mockImplementation(() => {
      throw new Error('runtime unavailable');
     });
    expect(hasCannotActCondition('Paladin', 'MyCampaign')).toBe(false);
   });

  it('calls getRuntimeValue with correct sourceName and key', () => {
    getRuntimeValue.mockReturnValue([]);
    hasCannotActCondition('Gallant', 'Quest');
    expect(getRuntimeValue).toHaveBeenCalledWith('Gallant', 'activeConditions');
   });

  it('uses passed sourceName for getRuntimeValue call', () => {
    getRuntimeValue.mockReturnValue(['stunned']);
    hasCannotActCondition('Dawnbringer', '');
    expect(getRuntimeValue).toHaveBeenLastCalledWith(
       'Dawnbringer',
       'activeConditions',
     );
   });
});

describe('isWithinRange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
   });

  it('returns true when activeMapName is falsy (null)', async () => {
    const result = await isWithinRange(
       'Paladin',
       'Cleric',
       'TestCampaign',
      null,
       [],
     );
    expect(result).toBe(true);
   });

  it('returns true when activeMapName is falsy (undefined)', async () => {
    const result = await isWithinRange(
       'Paladin',
       'Cleric',
       'TestCampaign',
      undefined,
       [],
     );
    expect(result).toBe(true);
   });

  it('returns true when loadMapData returns no players', async () => {
    loadMapData.mockResolvedValue({});
    const result = await isWithinRange(
       'Paladin',
       'Cleric',
       'TestCampaign',
       'Combat Map',
       [],
     );
    expect(result).toBe(true);
   });

  it('returns true when loadMapData returns empty players array', async () => {
    loadMapData.mockResolvedValue({ players: [] });
    const result = await isWithinRange(
       'Paladin',
       'Cleric',
       'TestCampaign',
       'Combat Map',
       [],
     );
    expect(result).toBe(true);
   });

  it('returns true when source player not found in map', async () => {
    loadMapData.mockResolvedValue({
      players: [{ name: 'Cleric', gridX: 0, gridY: 0 }],
     });
    const result = await isWithinRange(
       'Paladin',
       'Cleric',
       'TestCampaign',
       'Combat Map',
       [],
     );
    expect(result).toBe(true);
   });

  it('returns true when target player not found in map', async () => {
    loadMapData.mockResolvedValue({
      players: [{ name: 'Paladin', gridX: 0, gridY: 0 }],
     });
    const result = await isWithinRange(
       'Paladin',
       'Cleric',
       'TestCampaign',
       'Combat Map',
       [],
     );
    expect(result).toBe(true);
   });

  it('returns true when getDistanceFeet returns null', async () => {
    loadMapData.mockResolvedValue({
      players: [
         { name: 'Paladin', gridX: 0, gridY: 0 },
         { name: 'Cleric', gridX: 2, gridY: 0 },
       ],
     });
    getDistanceFeet.mockReturnValue(null);
    const result = await isWithinRange(
       'Paladin',
       'Cleric',
       'TestCampaign',
       'Combat Map',
       [],
     );
    expect(result).toBe(true);
   });

  it('returns true when target within default range (exact boundary)', async () => {
    loadMapData.mockResolvedValue({
      players: [
         { name: 'Paladin', gridX: 0, gridY: 0 },
         { name: 'Cleric', gridX: 2, gridY: 0 },
       ],
     });
    getDistanceFeet.mockReturnValue(10); // exactly at DEFAULT_AURA_RANGE_FT boundary
    const result = await isWithinRange(
       'Paladin',
       'Cleric',
       'TestCampaign',
       'Combat Map',
       [],
     );
    expect(result).toBe(true);
   });

  it('returns false when target outside default range', async () => {
    loadMapData.mockResolvedValue({
      players: [
         { name: 'Paladin', gridX: 0, gridY: 0 },
         { name: 'Cleric', gridX: 5, gridY: 0 },
       ],
     });
    getDistanceFeet.mockReturnValue(15); // > 10 ft default range
    const result = await isWithinRange(
       'Paladin',
       'Cleric',
       'TestCampaign',
       'Combat Map',
       [],
     );
    expect(result).toBe(false);
   });

  it('returns false when target outside expanded range of source entry', async () => {
    loadMapData.mockResolvedValue({
      players: [
         { name: 'Paladin', gridX: 0, gridY: 0 },
         { name: 'Cleric', gridX: 10, gridY: 0 },
       ],
     });
    getDistanceFeet.mockReturnValue(35); // > 30 ft expanded range

    const sourceEntry = makeSourceEntry('Paladin', {});
    const result = await isWithinRange(
       'Paladin',
       'Cleric',
       'TestCampaign',
       'Combat Map',
       [sourceEntry],
     );
    expect(result).toBe(false);
   });

  it('uses expanded range from sourceEntry computedStats with Aura Expansion', async () => {
    loadMapData.mockResolvedValue({
      players: [
         { name: 'Paladin', gridX: 0, gridY: 0 },
         { name: 'Cleric', gridX: 10, gridY: 0 },
       ],
     });
    getDistanceFeet.mockReturnValue(25); // <= 30 ft expanded range

    const sourceEntry = makeSourceEntry('Paladin', {
      automation: {
        passives: [makePassive('Aura Expansion')],
       },
     });
    const result = await isWithinRange(
       'Paladin',
       'Cleric',
       'TestCampaign',
       'Combat Map',
       [sourceEntry],
     );
    expect(result).toBe(true);
   });

  it('uses default range when sourceEntry has no computedStats', async () => {
    loadMapData.mockResolvedValue({
      players: [
         { name: 'Paladin', gridX: 0, gridY: 0 },
         { name: 'Cleric', gridX: 2, gridY: 0 },
       ],
     });
    getDistanceFeet.mockReturnValue(10);

    const sourceEntry = makeSourceEntry('Paladin', null);
    const result = await isWithinRange(
       'Paladin',
       'Cleric',
       'TestCampaign',
       'Combat Map',
       [sourceEntry],
     );
    expect(result).toBe(true);
   });

  it('calls getDistanceFeet once for valid source and target', async () => {
    loadMapData.mockResolvedValue({
      players: [
          { name: 'Paladin', gridX: 0, gridY: 0 },
          { name: 'Cleric', gridX: 2, gridY: 0 },
        ],
      });
    getDistanceFeet.mockReturnValue(5);

    await isWithinRange('Paladin', 'Cleric', '', 'SomeMap', []);
    expect(getDistanceFeet).toHaveBeenCalledTimes(1);
    });

  it('uses default range when computedCharacters is empty array', async () => {
    loadMapData.mockResolvedValue({
      players: [
         { name: 'Paladin', gridX: 0, gridY: 0 },
         { name: 'Cleric', gridX: 2, gridY: 0 },
       ],
     });
    getDistanceFeet.mockReturnValue(10);

    const result = await isWithinRange(
       'Paladin',
       'Cleric',
       'TestCampaign',
       'Combat Map',
       [],
     );
    expect(result).toBe(true);
   });

  it('returns true when loadMapData throws an error', async () => {
    loadMapData.mockRejectedValue(new Error('network error'));
    const result = await isWithinRange(
       'Paladin',
       'Cleric',
       'TestCampaign',
       'Combat Map',
       [],
     );
    expect(result).toBe(true);
   });

  it('returns true when getDistanceFeet throws an error', async () => {
    loadMapData.mockResolvedValue({
      players: [
         { name: 'Paladin', gridX: 0, gridY: 0 },
         { name: 'Cleric', gridX: 2, gridY: 0 },
       ],
     });
    getDistanceFeet.mockImplementation(() => {
      throw new Error('position error');
     });
    const result = await isWithinRange(
       'Paladin',
       'Cleric',
       'TestCampaign',
       'Combat Map',
       [],
     );
    expect(result).toBe(true);
   });

  it('calls loadMapData with campaignName and activeMapName', async () => {
    loadMapData.mockResolvedValue({ players: [] });
    await isWithinRange(
       'Paladin',
       'Cleric',
       'MyCampaign',
       'Dungeon Map',
       [],
     );
    expect(loadMapData).toHaveBeenCalledWith('MyCampaign', 'Dungeon Map');
   });

  it('uses default range when computedCharacters has wrong name entry', async () => {
    loadMapData.mockResolvedValue({
      players: [
        { name: 'Paladin', gridX: 0, gridY: 0 },
        { name: 'Cleric', gridX: 2, gridY: 0 },
      ],
    });
    getDistanceFeet.mockReturnValue(5);

    const wrongEntry = makeSourceEntry('SomeoneElse', { something: true });
    const result = await isWithinRange(
      'Paladin',
      'Cleric',
      '',
      '',
      [wrongEntry],
    );
    expect(result).toBe(true);
   });
});

describe('computeAuraBonus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
   });

  it('returns bonus 0 and sourceName null when no characters have aura', async () => {
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [],
      campaignName: '',
      activeMapName: IN_RANGE_PASS, // empty string → always in range
     });
    expect(result).toEqual({ bonus: 0, sourceName: null });
   });

  it('skips entries with no name (falsy)', async () => {
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [makeSourceEntry('', {})],
      campaignName: '',
      activeMapName: IN_RANGE_PASS,
     });
    expect(result).toEqual({ bonus: 0, sourceName: null });
   });

  it('skips entries with no computedStats', async () => {
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [makeSourceEntry('Paladin', null)],
      campaignName: '',
      activeMapName: IN_RANGE_PASS,
     });
    expect(result).toEqual({ bonus: 0, sourceName: null });
   });

  it('skips entries without Aura of Protection', async () => {
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [
        makeSourceEntry('Wizard', {
          automation: { passives: [makePassive('Spell Sniper')] },
         }),
       ],
      campaignName: '',
      activeMapName: IN_RANGE_PASS,
     });
    expect(result).toEqual({ bonus: 0, sourceName: null });
   });

  it('skips sources that have cannot-act condition', async () => {
    getRuntimeValue.mockReturnValue(['stunned']);

    const paladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 5 }],
     });
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [paladin],
      campaignName: '',
      activeMapName: IN_RANGE_PASS,
     });
    expect(result).toEqual({ bonus: 0, sourceName: null });
   });

  it('skips sources out of range (controlled via getDistanceFeet)', async () => {
    getRuntimeValue.mockReturnValue([]); // no conditions
    loadMapData.mockResolvedValue({
      players: [
        { name: 'Paladin', gridX: 0, gridY: 0 },
        { name: 'Cleric', gridX: 10, gridY: 0 },
       ],
     });
    getDistanceFeet.mockReturnValue(20); // outside default 10 ft range

    const paladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 5 }],
     });
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [paladin],
      campaignName: '',
      activeMapName: OUT_OF_RANGE_FAIL, // triggers full lookup
     });
    expect(result).toEqual({ bonus: 0, sourceName: null });
   });

  it('returns positive cha bonus from first valid aura bearer', async () => {
    const paladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 3 }],
     });
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [paladin],
      campaignName: '',
      activeMapName: IN_RANGE_PASS, // short-circuit → in range
     });
    expect(result).toEqual({ bonus: 3, sourceName: 'Paladin' });
   });

  it('uses Math.max(1, chaMod) — negative mod becomes 1', async () => {
    const paladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: -2 }],
     });
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [paladin],
      campaignName: '',
      activeMapName: IN_RANGE_PASS,
     });
    expect(result).toEqual({ bonus: 1, sourceName: 'Paladin' });
   });

  it('uses Math.max(1, chaMod) — zero mod becomes 1', async () => {
    const paladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 0 }],
     });
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [paladin],
      campaignName: '',
      activeMapName: IN_RANGE_PASS,
     });
    expect(result).toEqual({ bonus: 1, sourceName: 'Paladin' });
   });

  it('selects the higher bonus from two viable sources', async () => {
    const paladin1 = makeSourceEntry('Paladin1', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 2 }],
     });
    const paladin2 = makeSourceEntry('Paladin2', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 5 }],
     });
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [paladin1, paladin2],
      campaignName: '',
      activeMapName: IN_RANGE_PASS,
     });
    expect(result).toEqual({ bonus: 5, sourceName: 'Paladin2' });
   });

  it('skips a mid-list disabled source but picks the one after', async () => {
     // paladin1 is stunned (cannot act), paladin2 is fine — no getRuntimeValue calls needed
    const paladin1 = makeSourceEntry('Paladin1', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 5 }],
     });
    const paladin2 = makeSourceEntry('Paladin2', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 8 }],
     });

     // Mock: first call for Paladin1 → stunned, second never called (skipped)
    getRuntimeValue.mockReturnValueOnce(['petrified']);

    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [paladin1, paladin2],
      campaignName: '',
      activeMapName: IN_RANGE_PASS,
     });
    expect(result).toEqual({ bonus: 8, sourceName: 'Paladin2' });
   });

  it('skips a mid-list out-of-range source but picks the one after', async () => {
    getRuntimeValue.mockReturnValue([]).mockReturnValue([]); // both no conditions

      // Use .mockImplementation to handle sequential calls properly
    loadMapData.mockImplementation(async () => ({
       players: [
          { name: 'Paladin1', gridX: 0, gridY: 0 },
          { name: 'Paladin2', gridX: 5, gridY: 0 },
          { name: 'Cleric', gridX: 8, gridY: 0 },
        ],
      }));

    getDistanceFeet.mockReturnValueOnce(20).mockReturnValueOnce(5); // Paladin1 at 20ft (=out), Paladin2 at 5ft (=in)

    const paladin1 = makeSourceEntry('Paladin1', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 5 }],
      });
    const paladin2 = makeSourceEntry('Paladin2', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 3 }],
      });
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [paladin1, paladin2],
      campaignName: '',
      activeMapName: OUT_OF_RANGE_FAIL, // both use full lookup path
      });
    expect(result).toEqual({ bonus: 3, sourceName: 'Paladin2' });
     });

  it('does not call isWithinRange for sources without aura', async () => {
     // Because activeMapName == '', the isWithinRange call short-circuits before
     // loadMapData is ever called.
    const wizard = makeSourceEntry('Wizard', {
      automation: { passives: [makePassive('Spell Sniper')] },
     });

    await computeAuraBonus({
      targetName: 'Cleric',
      characters: [wizard],
      campaignName: '',
      activeMapName: IN_RANGE_PASS,
     });
     // loadMapData should never be called because the only source has no aura
    expect(loadMapData).not.toHaveBeenCalled();
   });

  it('calls isWithinRange with correct arguments for valid source', async () => {
    getRuntimeValue.mockReturnValue([]);
    loadMapData.mockResolvedValue({
      players: [
        { name: 'Paladin', gridX: 0, gridY: 0 },
        { name: 'Cleric', gridX: 1, gridY: 0 },
       ],
     });
    getDistanceFeet.mockReturnValue(5);

    const paladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 3 }],
     });
    await computeAuraBonus({
      targetName: 'Cleric',
      characters: [paladin],
      campaignName: 'MyCampaign',
      activeMapName: OUT_OF_RANGE_FAIL,
     });
     // Verify loadMapData was called with right campaign + map
    expect(loadMapData).toHaveBeenCalledWith('MyCampaign', OUT_OF_RANGE_FAIL);
   });

  it('calls isWithinRange for each valid aura bearer in sequence', async () => {
    getRuntimeValue.mockReturnValue([]).mockReturnValue([]);
    loadMapData.mockResolvedValue({
      players: [
        { name: 'Paladin1', gridX: 0, gridY: 0 },
        { name: 'Cleric', gridX: 1, gridY: 0 },
       ],
     }).mockResolvedValue({
      players: [
        { name: 'Paladin2', gridX: 0, gridY: 0 },
        { name: 'Cleric', gridX: 1, gridY: 0 },
       ],
     });
    getDistanceFeet.mockReturnValue(5).mockReturnValue(5);

    const paladin1 = makeSourceEntry('Paladin1', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 3 }],
     });
    const paladin2 = makeSourceEntry('Paladin2', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 4 }],
     });
    await computeAuraBonus({
      targetName: 'Ally',
      characters: [paladin1, paladin2],
      campaignName: '',
      activeMapName: OUT_OF_RANGE_FAIL,
     });
     // loadMapData called once per isWithinRange → twice because two aura bearers
    expect(loadMapData).toHaveBeenCalledTimes(2);
   });

  it('returns computed bonus when cha comes from baseScore formula', async () => {
    const paladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [
         {
          name: 'Charisma',
          baseScore: 18,
          abilityImprovements: 0,
          miscBonus: 0,
         },
       ],
     });
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [paladin],
      campaignName: '',
      activeMapName: IN_RANGE_PASS, // short-circuit → in range
     });
    // floor((18+0+0-10)/2) = 4, Math.max(1,4) = 4
    expect(result).toEqual({ bonus: 4, sourceName: 'Paladin' });
   });

  it('does not skip ahead when a non-aura entry is in between', async () => {
     // Wizard has no aura → skipped. Paladin follows → checked normally.
    const wizard = makeSourceEntry('Wizard', {});
    const paladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 2 }],
     });

     // Only one getRuntimeValue call because wizard is skipped entirely
    getRuntimeValue.mockReturnValueOnce(['stunned']); // called for Paladin — doesn't matter, next will win

    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [wizard, paladin],
      campaignName: '',
      activeMapName: IN_RANGE_PASS,
     });
     // The Palidn has 'stunned' so should be skipped too → zero bonus
    expect(result).toEqual({ bonus: 0, sourceName: null });
   });

  it('handles expanded aura range in computeAuraBonus', async () => {
    getRuntimeValue.mockReturnValue([]);
    loadMapData.mockResolvedValue({
      players: [
        { name: 'Paladin', gridX: 0, gridY: 0 },
        { name: 'Cleric', gridX: 10, gridY: 0 },
       ],
     });
    // Distance 25 ft — outside default 10 ft but inside expanded 30 ft

    const paladin = makeSourceEntry('Paladin', {
      automation: {
        passives: [
          makePassive('Aura of Protection'),
          makePassive('Aura Expansion'),
         ],
       },
      abilities: [{ name: 'Charisma', bonus: 3 }],
     });

    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [paladin],
      campaignName: '',
      activeMapName: OUT_OF_RANGE_FAIL,
     });
    expect(result).toEqual({ bonus: 3, sourceName: 'Paladin' });
   });
});
