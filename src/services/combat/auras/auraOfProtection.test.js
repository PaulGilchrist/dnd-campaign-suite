// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────

vi.mock('../../maps/mapsService.js', () => ({
  loadMapData: vi.fn(),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

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

import { loadMapData } from '../../maps/mapsService.js';
import { getDistanceFeet } from '../../rules/combat/rangeValidation.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

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

function mockMapWithPlayers(players) {
  loadMapData.mockResolvedValue({ players });
}

// ── Constants ───────────────────────────────────────────────────

describe('constants', () => {
  it('exports CANNOT_ACT_CONDITIONS with the five incapacitating conditions', () => {
    expect(CANNOT_ACT_CONDITIONS).toEqual([
      'incapacitated',
      'paralyzed',
      'petrified',
      'stunned',
      'unconscious',
    ]);
  });

  it('exports DEFAULT_AURA_RANGE_FT as 10 and EXPANDED_AURA_RANGE_FT as 30', () => {
    expect(DEFAULT_AURA_RANGE_FT).toBe(10);
    expect(EXPANDED_AURA_RANGE_FT).toBe(30);
  });
});

// ── hasAura ─────────────────────────────────────────────────────

describe('hasAura', () => {
  it('returns true when a passive with the matching name exists', () => {
    const stats = makeStats({ automation: { passives: [makePassive('Aura of Protection')] } });
    expect(hasAura(stats, 'Aura of Protection')).toBe(true);
  });

  it('returns false when no passive matches the given name', () => {
    const stats = makeStats({ automation: { passives: [makePassive('Divine Smite')] } });
    expect(hasAura(stats, 'Aura of Protection')).toBe(false);
  });

  it('returns false when playerStats is null or undefined', () => {
    expect(hasAura(null, 'Aura of Protection')).toBe(false);
    expect(hasAura(undefined, 'Aura of Protection')).toBe(false);
  });

  it('returns false when automation or passives is missing', () => {
    expect(hasAura(makeStats(), 'Aura of Protection')).toBe(false);
    expect(hasAura({ automation: {} }, 'Aura of Protection')).toBe(false);
    expect(hasAura({ automation: { passives: null } }, 'Aura of Protection')).toBe(false);
  });
});

// ── hasAuraOfProtection ─────────────────────────────────────────

describe('hasAuraOfProtection', () => {
  it('returns true when the character has the Aura of Protection passive', () => {
    const stats = makeStats({ automation: { passives: [makePassive('Aura of Protection')] } });
    expect(hasAuraOfProtection(stats)).toBe(true);
  });

  it('returns false when the character lacks the passive or stats is null', () => {
    const stats = makeStats({ automation: { passives: [makePassive('Other Aura')] } });
    expect(hasAuraOfProtection(stats)).toBe(false);
    expect(hasAuraOfProtection(null)).toBe(false);
  });
});

// ── getAuraRangeFromStats ───────────────────────────────────────

describe('getAuraRangeFromStats', () => {
  it('returns expanded range when Aura Expansion is present', () => {
    const stats = makeStats({
      automation: { passives: [makePassive('Aura of Protection'), makePassive('Aura Expansion')] },
    });
    expect(getAuraRangeFromStats(stats)).toBe(EXPANDED_AURA_RANGE_FT);
  });

  it('returns expanded range even without Aura of Protection', () => {
    const stats = makeStats({ automation: { passives: [makePassive('Aura Expansion')] } });
    expect(getAuraRangeFromStats(stats)).toBe(EXPANDED_AURA_RANGE_FT);
  });

  it('returns default range when Aura Expansion is absent', () => {
    const stats = makeStats({ automation: { passives: [makePassive('Some Other Feature')] } });
    expect(getAuraRangeFromStats(stats)).toBe(DEFAULT_AURA_RANGE_FT);
  });
});

// ── getChaModifier ──────────────────────────────────────────────

describe('getChaModifier', () => {
  it('returns cha.bonus when present (including zero and negative)', () => {
    expect(getChaModifier({ abilities: [{ name: 'Charisma', bonus: 5 }] })).toBe(5);
    expect(getChaModifier({ abilities: [{ name: 'Charisma', bonus: 0 }] })).toBe(0);
    expect(getChaModifier({ abilities: [{ name: 'Charisma', bonus: -2 }] })).toBe(-2);
  });

  it('prefers cha.bonus over the computed formula', () => {
    const stats = {
      abilities: [{ name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, bonus: 7 }],
    };
    expect(getChaModifier(stats)).toBe(7);
  });

  it('computes mod from baseScore + increases when bonus is absent', () => {
    const stats = {
      abilities: [{ name: 'Charisma', baseScore: 16, featIncrease: 0, miscIncrease: 0 }],
    };
    expect(getChaModifier(stats)).toBe(3);
  });

  it('includes featIncrease and miscIncrease in the formula and floors odd results', () => {
    // base 14 + feat 2 + misc 2 = 18 -> floor((18-10)/2) = 4
    const stats = {
      abilities: [{ name: 'Charisma', baseScore: 14, featIncrease: 2, miscIncrease: 2 }],
    };
    expect(getChaModifier(stats)).toBe(4);

    // base 15 -> floor((15-10)/2) = floor(2.5) = 2
    const statsFloored = {
      abilities: [{ name: 'Charisma', baseScore: 15, featIncrease: 0, miscIncrease: 0 }],
    };
    expect(getChaModifier(statsFloored)).toBe(2);
  });

  it('returns 0 when Charisma ability is not found or abilities is missing', () => {
    expect(getChaModifier({ abilities: [{ name: 'Strength' }] })).toBe(0);
    expect(getChaModifier({ abilities: [] })).toBe(0);
    expect(getChaModifier({})).toBe(0);
  });

  it('throws when playerStats is null', () => {
    expect(() => getChaModifier(null)).toThrow();
  });
});

// ── hasCannotActCondition ───────────────────────────────────────

describe('hasCannotActCondition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true for any of the incapacitating conditions', () => {
    for (const condition of CANNOT_ACT_CONDITIONS) {
      getRuntimeValue.mockReturnValue([condition]);
      expect(hasCannotActCondition('Paladin', 'Campaign')).toBe(true);
    }
  });

  it('returns false when none of the conditions match or array is empty', () => {
    getRuntimeValue.mockReturnValue(['blinded', 'poisoned']);
    expect(hasCannotActCondition('Paladin', 'Campaign')).toBe(false);
    getRuntimeValue.mockReturnValue([]);
    expect(hasCannotActCondition('Paladin', 'Campaign')).toBe(false);
  });

  it('returns false when activeConditions is not an array or getRuntimeValue throws', () => {
    getRuntimeValue.mockReturnValue(null);
    expect(hasCannotActCondition('Paladin', 'Campaign')).toBe(false);
    getRuntimeValue.mockImplementation(() => {
      throw new Error('runtime unavailable');
    });
    expect(hasCannotActCondition('Paladin', 'Campaign')).toBe(false);
  });

  it('passes the sourceName to getRuntimeValue', () => {
    getRuntimeValue.mockReturnValue([]);
    hasCannotActCondition('Gallant', 'Quest');
    expect(getRuntimeValue).toHaveBeenCalledWith('Gallant', 'activeConditions');
  });
});

// ── isWithinRange ───────────────────────────────────────────────

describe('isWithinRange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when activeMapName is falsy', async () => {
    expect(await isWithinRange('A', 'B', 'C', null, [])).toBe(true);
    expect(await isWithinRange('A', 'B', 'C', undefined, [])).toBe(true);
    expect(await isWithinRange('A', 'B', 'C', '', [])).toBe(true);
  });

  it('returns true when map data has no players or players array is empty', async () => {
    mockMapWithPlayers([]);
    expect(await isWithinRange('A', 'B', 'C', 'Map', [])).toBe(true);
    loadMapData.mockResolvedValue({});
    expect(await isWithinRange('A', 'B', 'C', 'Map', [])).toBe(true);
  });

  it('returns true when either source or target is not found on the map', async () => {
    mockMapWithPlayers([{ name: 'B', gridX: 0, gridY: 0 }]);
    expect(await isWithinRange('A', 'B', 'C', 'Map', [])).toBe(true);

    mockMapWithPlayers([{ name: 'A', gridX: 0, gridY: 0 }]);
    expect(await isWithinRange('A', 'B', 'C', 'Map', [])).toBe(true);
  });

  it('returns true when getDistanceFeet returns null', async () => {
    mockMapWithPlayers([
      { name: 'A', gridX: 0, gridY: 0 },
      { name: 'B', gridX: 2, gridY: 0 },
    ]);
    getDistanceFeet.mockReturnValue(null);
    expect(await isWithinRange('A', 'B', 'C', 'Map', [])).toBe(true);
  });

  it('returns true when distance is within range, false when outside', async () => {
    mockMapWithPlayers([
      { name: 'A', gridX: 0, gridY: 0 },
      { name: 'B', gridX: 2, gridY: 0 },
    ]);

    getDistanceFeet.mockReturnValue(10);
    expect(await isWithinRange('A', 'B', 'C', 'Map', [])).toBe(true);

    getDistanceFeet.mockReturnValue(11);
    expect(await isWithinRange('A', 'B', 'C', 'Map', [])).toBe(false);
  });

  it('uses expanded aura range when source has Aura Expansion', async () => {
    mockMapWithPlayers([
      { name: 'A', gridX: 0, gridY: 0 },
      { name: 'B', gridX: 10, gridY: 0 },
    ]);
    getDistanceFeet.mockReturnValue(25);

    const sourceEntry = makeSourceEntry('A', {
      automation: { passives: [makePassive('Aura Expansion')] },
    });
    expect(await isWithinRange('A', 'B', 'C', 'Map', [sourceEntry])).toBe(true);

    getDistanceFeet.mockReturnValue(31);
    expect(await isWithinRange('A', 'B', 'C', 'Map', [sourceEntry])).toBe(false);
  });

  it('falls back to default range when sourceEntry has no computedStats', async () => {
    mockMapWithPlayers([
      { name: 'A', gridX: 0, gridY: 0 },
      { name: 'B', gridX: 2, gridY: 0 },
    ]);
    getDistanceFeet.mockReturnValue(10);

    const sourceEntry = makeSourceEntry('A', null);
    expect(await isWithinRange('A', 'B', 'C', 'Map', [sourceEntry])).toBe(true);
  });

  it('returns true when loadMapData or getDistanceFeet throws', async () => {
    loadMapData.mockRejectedValue(new Error('network error'));
    expect(await isWithinRange('A', 'B', 'C', 'Map', [])).toBe(true);

    loadMapData.mockResolvedValue({
      players: [
        { name: 'A', gridX: 0, gridY: 0 },
        { name: 'B', gridX: 2, gridY: 0 },
      ],
    });
    getDistanceFeet.mockImplementation(() => {
      throw new Error('position error');
    });
    expect(await isWithinRange('A', 'B', 'C', 'Map', [])).toBe(true);
  });
});

// ── computeAuraBonus ────────────────────────────────────────────

describe('computeAuraBonus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { bonus: 0, sourceName: null } when there are no characters or no valid aura bearers', async () => {
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [],
      campaignName: 'C',
      activeMapName: '',
    });
    expect(result).toEqual({ bonus: 0, sourceName: null });

    const result2 = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [makeSourceEntry('', {}), makeSourceEntry('Paladin', null)],
      campaignName: 'C',
      activeMapName: '',
    });
    expect(result2).toEqual({ bonus: 0, sourceName: null });

    const result3 = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [makeSourceEntry('Wizard', {
        automation: { passives: [makePassive('Spell Sniper')] },
      })],
      campaignName: 'C',
      activeMapName: '',
    });
    expect(result3).toEqual({ bonus: 0, sourceName: null });
  });

  it('skips sources with a cannot-act condition', async () => {
    getRuntimeValue.mockReturnValue(['stunned']);
    const paladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 5 }],
    });
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [paladin],
      campaignName: 'C',
      activeMapName: '',
    });
    expect(result).toEqual({ bonus: 0, sourceName: null });
  });

  it('skips sources that are out of range', async () => {
    getRuntimeValue.mockReturnValue([]);
    mockMapWithPlayers([
      { name: 'Paladin', gridX: 0, gridY: 0 },
      { name: 'Cleric', gridX: 10, gridY: 0 },
    ]);
    getDistanceFeet.mockReturnValue(20);

    const paladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 5 }],
    });
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [paladin],
      campaignName: 'C',
      activeMapName: 'Map',
    });
    expect(result).toEqual({ bonus: 0, sourceName: null });
  });

  it('returns the cha bonus from the first valid aura bearer', async () => {
    const paladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 3 }],
    });
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [paladin],
      campaignName: 'C',
      activeMapName: '',
    });
    expect(result).toEqual({ bonus: 3, sourceName: 'Paladin' });
  });

  it('clamps negative and zero modifiers to a minimum bonus of 1', async () => {
    const negativePaladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: -2 }],
    });
    const result1 = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [negativePaladin],
      campaignName: 'C',
      activeMapName: '',
    });
    expect(result1).toEqual({ bonus: 1, sourceName: 'Paladin' });

    const zeroPaladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 0 }],
    });
    const result2 = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [zeroPaladin],
      campaignName: 'C',
      activeMapName: '',
    });
    expect(result2).toEqual({ bonus: 1, sourceName: 'Paladin' });
  });

  it('selects the source with the highest bonus, skipping disabled or out-of-range ones', async () => {
    // Test highest bonus selection
    const p1 = makeSourceEntry('Paladin1', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 2 }],
    });
    const p2 = makeSourceEntry('Paladin2', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 5 }],
    });
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [p1, p2],
      campaignName: 'C',
      activeMapName: '',
    });
    expect(result).toEqual({ bonus: 5, sourceName: 'Paladin2' });

    // Test skipping petrified source in the middle
    getRuntimeValue.mockReturnValueOnce(['petrified']);
    const p3 = makeSourceEntry('Paladin1', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 5 }],
    });
    const p4 = makeSourceEntry('Paladin2', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 8 }],
    });
    const result2 = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [p3, p4],
      campaignName: 'C',
      activeMapName: '',
    });
    expect(result2).toEqual({ bonus: 8, sourceName: 'Paladin2' });

    // Test skipping out-of-range source
    getRuntimeValue.mockReturnValue([]).mockReturnValue([]);
    mockMapWithPlayers([
      { name: 'Paladin1', gridX: 0, gridY: 0 },
      { name: 'Paladin2', gridX: 5, gridY: 0 },
      { name: 'Cleric', gridX: 8, gridY: 0 },
    ]);
    getDistanceFeet.mockReturnValueOnce(20).mockReturnValueOnce(5);

    const p5 = makeSourceEntry('Paladin1', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 5 }],
    });
    const p6 = makeSourceEntry('Paladin2', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 3 }],
    });
    const result3 = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [p5, p6],
      campaignName: 'C',
      activeMapName: 'Map',
    });
    expect(result3).toEqual({ bonus: 3, sourceName: 'Paladin2' });
  });

  it('computes bonus from baseScore when cha.bonus is absent', async () => {
    const paladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', baseScore: 18, featIncrease: 0, miscIncrease: 0 }],
    });
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [paladin],
      campaignName: 'C',
      activeMapName: '',
    });
    expect(result).toEqual({ bonus: 4, sourceName: 'Paladin' });
  });

  it('uses expanded aura range when source has Aura Expansion', async () => {
    getRuntimeValue.mockReturnValue([]);
    mockMapWithPlayers([
      { name: 'Paladin', gridX: 0, gridY: 0 },
      { name: 'Cleric', gridX: 10, gridY: 0 },
    ]);
    getDistanceFeet.mockReturnValue(25);

    const paladin = makeSourceEntry('Paladin', {
      automation: {
        passives: [makePassive('Aura of Protection'), makePassive('Aura Expansion')],
      },
      abilities: [{ name: 'Charisma', bonus: 3 }],
    });
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [paladin],
      campaignName: 'C',
      activeMapName: 'Map',
    });
    expect(result).toEqual({ bonus: 3, sourceName: 'Paladin' });
  });

  it('does not call map services for characters without aura', async () => {
    const wizard = makeSourceEntry('Wizard', {
      automation: { passives: [makePassive('Spell Sniper')] },
    });
    await computeAuraBonus({
      targetName: 'Cleric',
      characters: [wizard],
      campaignName: 'C',
      activeMapName: '',
    });
    expect(loadMapData).not.toHaveBeenCalled();
  });

  it('calls loadMapData only for valid aura bearers in sequence', async () => {
    getRuntimeValue.mockReturnValue([]).mockReturnValue([]);
    loadMapData.mockResolvedValue({
      players: [{ name: 'Paladin1', gridX: 0, gridY: 0 }, { name: 'Cleric', gridX: 1, gridY: 0 }],
    }).mockResolvedValue({
      players: [{ name: 'Paladin2', gridX: 0, gridY: 0 }, { name: 'Cleric', gridX: 1, gridY: 0 }],
    });
    getDistanceFeet.mockReturnValue(5).mockReturnValue(5);

    const p1 = makeSourceEntry('Paladin1', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 3 }],
    });
    const p2 = makeSourceEntry('Paladin2', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 4 }],
    });
    await computeAuraBonus({
      targetName: 'Ally',
      characters: [p1, p2],
      campaignName: 'C',
      activeMapName: 'Map',
    });
    expect(loadMapData).toHaveBeenCalledTimes(2);
  });

  it('skips non-aura entries between aura bearers without calling map services for them', async () => {
    getRuntimeValue.mockReturnValue([]);
    loadMapData.mockResolvedValue({
      players: [{ name: 'Paladin', gridX: 0, gridY: 0 }, { name: 'Cleric', gridX: 1, gridY: 0 }],
    });
    getDistanceFeet.mockReturnValue(5);

    const wizard = makeSourceEntry('Wizard', {});
    const paladin = makeSourceEntry('Paladin', {
      automation: { passives: [makePassive('Aura of Protection')] },
      abilities: [{ name: 'Charisma', bonus: 2 }],
    });
    const result = await computeAuraBonus({
      targetName: 'Cleric',
      characters: [wizard, paladin],
      campaignName: 'C',
      activeMapName: 'Map',
    });
    expect(result).toEqual({ bonus: 2, sourceName: 'Paladin' });
    expect(loadMapData).toHaveBeenCalledTimes(1);
  });
});
