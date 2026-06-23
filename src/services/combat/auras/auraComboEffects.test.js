// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('./auraOfProtection.js', () => ({
  hasAuraOfProtection: vi.fn(),
  hasCannotActCondition: vi.fn(),
  isWithinRange: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

import { computeAuraComboEffects } from './auraComboEffects.js';
import { hasAuraOfProtection, hasCannotActCondition, isWithinRange } from './auraOfProtection.js';

// ── Helpers ─────────────────────────────────────────────────────

function makeStats(passives) {
  return { automation: { passives: passives || [] } };
}

function makeCharacter(name, passives) {
  return { name, computedStats: makeStats(passives) };
}

const AURA_OF_PROTECTION = { name: 'Aura of Protection', type: 'passive_buff', effect: 'saving_throw_bonus' };
const AURA_OF_ALACRITY = { name: 'Aura of Alacrity', type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '+10 ft.' };
const AURA_OF_ALACRITY_NO_BONUS = { name: 'Aura of Alacrity', type: 'passive_buff', effect: 'speed_bonus' };
const AURA_OF_COURAGE = { name: 'Aura of Courage', type: 'passive_buff', conditionImmunity: 'frightened' };
const AURA_OF_DEVOTION = { name: 'Aura of Devotion', type: 'passive_buff', conditionImmunity: 'charmed' };
const AURA_OF_WARDING = { name: 'Aura of Warding', type: 'passive_buff', resistances: ['Necrotic', 'Psychic', 'Radiant'] };

// Default mock setup used by most tests
function setupDefaults() {
  hasAuraOfProtection.mockImplementation(() => true);
  hasCannotActCondition.mockImplementation(() => false);
  isWithinRange.mockImplementation(async () => true);
}

// Helper to mock hasCannotActCondition with per-call overrides
function mockCannotActSequence(values) {
  let i = 0;
  hasCannotActCondition.mockImplementation(() => {
    const result = values[i++] ?? false;
    return result;
  });
  // Also set the default return to false for any calls beyond the array
  hasCannotActCondition.mockReturnValue(false);
}

// ── Tests ───────────────────────────────────────────────────────

describe('computeAuraComboEffects', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('empty / no-effect scenarios', () => {
    it('returns defaults when characters array is empty', async () => {
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: [],
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result).toEqual({
        speedBonus: 0,
        speedSource: null,
        immunities: [],
        immunitySources: {},
        resistances: [],
        resistanceSource: null,
      });
    });

    it('returns defaults when no characters have auras', async () => {
      hasAuraOfProtection.mockReturnValue(false);
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Bob', []),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result).toEqual({
        speedBonus: 0,
        speedSource: null,
        immunities: [],
        immunitySources: {},
        resistances: [],
        resistanceSource: null,
      });
    });

    it('returns defaults when only Aura of Protection is present without any secondary aura', async () => {
    setupDefaults();
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin', [AURA_OF_PROTECTION]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.speedBonus).toBe(0);
      expect(result.speedSource).toBeNull();
      expect(result.immunities).toEqual([]);
      expect(result.immunitySources).toEqual({});
      expect(result.resistances).toEqual([]);
      expect(result.resistanceSource).toBeNull();
    });

    it('skips entries with no computedStats', async () => {
    setupDefaults();
      const chars = [
        makeCharacter('Alice', []),
        { name: 'Ghost' },
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.speedBonus).toBe(0);
      expect(result.speedSource).toBeNull();
    });

    it('skips entries with null computedStats', async () => {
      const chars = [
        makeCharacter('Alice', []),
        { name: 'Ghost', computedStats: null },
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.speedBonus).toBe(0);
    });

    it('skips entries with empty passives array', async () => {
      hasAuraOfProtection.mockReturnValue(false);
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin', []),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.speedBonus).toBe(0);
    });
  });

  describe('Aura of Alacrity — speed bonus', () => {
    it('applies speed bonus from a single Paladin', async () => {
    setupDefaults();
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.speedBonus).toBe(10);
      expect(result.speedSource).toBe('Paladin');
    });

    it('defaults to 10 when bonusExpression is missing', async () => {
    setupDefaults();
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_ALACRITY_NO_BONUS]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.speedBonus).toBe(10);
      expect(result.speedSource).toBe('Paladin');
    });

    it('picks highest speed bonus from multiple sources', async () => {
    setupDefaults();
      const auraAlacrity15 = { name: 'Aura of Alacrity', type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '+15 ft.' };
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin1', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
        makeCharacter('Paladin2', [AURA_OF_PROTECTION, auraAlacrity15]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.speedBonus).toBe(15);
      expect(result.speedSource).toBe('Paladin2');
    });

    it('picks higher bonus even when it comes first', async () => {
    setupDefaults();
      const auraAlacrity20 = { name: 'Aura of Alacrity', type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '+20 ft.' };
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin1', [AURA_OF_PROTECTION, auraAlacrity20]),
        makeCharacter('Paladin2', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.speedBonus).toBe(20);
      expect(result.speedSource).toBe('Paladin1');
    });

    it('applies effects to the aura bearer themselves', async () => {
    setupDefaults();
      const chars = [
        makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Paladin',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.speedBonus).toBe(10);
      expect(result.speedSource).toBe('Paladin');
    });

    it('ignores non-speed-bonus passives on the same character', async () => {
    setupDefaults();
      const passiveWithoutSpeed = { name: 'Aura of Fortitude', type: 'passive_buff', effect: 'hp_boost' };
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_ALACRITY, passiveWithoutSpeed]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.speedBonus).toBe(10);
      expect(result.speedSource).toBe('Paladin');
    });
  });

  describe('Aura of Courage — frightened immunity', () => {
    it('adds frightened to immunities with correct source', async () => {
    setupDefaults();
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_COURAGE]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.immunities).toContain('frightened');
      expect(result.immunitySources.frightened).toBe('Paladin');
    });

    it('overwrites source when a second Paladin also grants it', async () => {
    setupDefaults();
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin1', [AURA_OF_PROTECTION, AURA_OF_COURAGE]),
        makeCharacter('Paladin2', [AURA_OF_PROTECTION, AURA_OF_COURAGE]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.immunities).toContain('frightened');
      expect(result.immunitySources.frightened).toBe('Paladin2');
    });

    it('does not add immunity when aura is not present', async () => {
    setupDefaults();
      const passiveWithoutCourage = { name: 'Aura of Fortitude', type: 'passive_buff' };
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin', [AURA_OF_PROTECTION, passiveWithoutCourage]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.immunities).not.toContain('frightened');
      expect(result.immunitySources.frightened).toBeUndefined();
    });
  });

  describe('Aura of Devotion — charmed immunity', () => {
    it('adds charmed to immunities with correct source', async () => {
    setupDefaults();
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_DEVOTION]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.immunities).toContain('charmed');
      expect(result.immunitySources.charmed).toBe('Paladin');
    });

    it('overwrites source when a second Paladin also grants it', async () => {
    setupDefaults();
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin1', [AURA_OF_PROTECTION, AURA_OF_DEVOTION]),
        makeCharacter('Paladin2', [AURA_OF_PROTECTION, AURA_OF_DEVOTION]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.immunities).toContain('charmed');
      expect(result.immunitySources.charmed).toBe('Paladin2');
    });
  });

  describe('Aura of Warding — resistances', () => {
    it('applies resistances with correct source', async () => {
    setupDefaults();
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_WARDING]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.resistances).toEqual(expect.arrayContaining(['Necrotic', 'Psychic', 'Radiant']));
      expect(result.resistanceSource).toBe('Paladin');
    });

    it('deduplicates resistances from multiple sources', async () => {
    setupDefaults();
      const auraWarding2 = { name: 'Aura of Warding', type: 'passive_buff', resistances: ['Necrotic', 'Fire'] };
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin1', [AURA_OF_PROTECTION, AURA_OF_WARDING]),
        makeCharacter('Paladin2', [AURA_OF_PROTECTION, auraWarding2]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.resistances).toEqual(expect.arrayContaining(['Necrotic', 'Psychic', 'Radiant', 'Fire']));
      expect(result.resistances).toHaveLength(4);
      expect(result.resistanceSource).toBe('Paladin2');
    });

    it('does not add resistances when resistances array is empty', async () => {
    setupDefaults();
      const auraWardingEmpty = { name: 'Aura of Warding', type: 'passive_buff', resistances: [] };
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin', [AURA_OF_PROTECTION, auraWardingEmpty]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.resistances).toEqual([]);
      expect(result.resistanceSource).toBeNull();
    });

    it('does not add resistances when resistances property is missing', async () => {
    setupDefaults();
      const auraWardingMissing = { name: 'Aura of Warding', type: 'passive_buff' };
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin', [AURA_OF_PROTECTION, auraWardingMissing]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.resistances).toEqual([]);
      expect(result.resistanceSource).toBeNull();
    });
  });

  describe('combining multiple aura types from a single source', () => {
    it('applies all combo effects from a single Paladin', async () => {
    setupDefaults();
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_ALACRITY, AURA_OF_COURAGE, AURA_OF_DEVOTION, AURA_OF_WARDING]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.speedBonus).toBe(10);
      expect(result.speedSource).toBe('Paladin');
      expect(result.immunities).toContain('frightened');
      expect(result.immunities).toContain('charmed');
      expect(result.resistances).toEqual(expect.arrayContaining(['Necrotic', 'Psychic', 'Radiant']));
      expect(result.resistanceSource).toBe('Paladin');
    });
  });

  describe('combining effects from multiple sources', () => {
    it('combines different immunities from multiple Paladins', async () => {
    setupDefaults();
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin1', [AURA_OF_PROTECTION, AURA_OF_COURAGE]),
        makeCharacter('Paladin2', [AURA_OF_PROTECTION, AURA_OF_DEVOTION]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.immunities).toContain('frightened');
      expect(result.immunities).toContain('charmed');
      expect(result.immunitySources.frightened).toBe('Paladin1');
      expect(result.immunitySources.charmed).toBe('Paladin2');
    });

    it('combines speed bonus with immunities from different sources', async () => {
    setupDefaults();
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin1', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
        makeCharacter('Paladin2', [AURA_OF_PROTECTION, AURA_OF_COURAGE]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.speedBonus).toBe(10);
      expect(result.speedSource).toBe('Paladin1');
      expect(result.immunities).toContain('frightened');
      expect(result.immunitySources.frightened).toBe('Paladin2');
    });

    it('combines immunities and resistances from different sources', async () => {
    setupDefaults();
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin1', [AURA_OF_PROTECTION, AURA_OF_COURAGE]),
        makeCharacter('Paladin2', [AURA_OF_PROTECTION, AURA_OF_WARDING]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.immunities).toContain('frightened');
      expect(result.resistances).toEqual(expect.arrayContaining(['Necrotic', 'Psychic', 'Radiant']));
      expect(result.immunitySources.frightened).toBe('Paladin1');
      expect(result.resistanceSource).toBe('Paladin2');
    });
  });

  describe('incapacitated source filtering', () => {
    it('does not apply effects from incapacitated source', async () => {
      mockCannotActSequence([true]);
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.speedBonus).toBe(0);
      expect(result.speedSource).toBeNull();
    });

    it('still applies effects from other sources when one is incapacitated', async () => {
      hasAuraOfProtection.mockImplementation(() => true);
      isWithinRange.mockImplementation(async () => true);
      hasCannotActCondition.mockImplementation(() => false);
      let cannotActIndex = 0;
      const cannotActValues = [true, false];
      hasCannotActCondition.mockImplementation(() => cannotActValues[cannotActIndex++] ?? false);
      const chars = [
        makeCharacter('Paladin1', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
        makeCharacter('Paladin2', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.speedBonus).toBe(10);
      expect(result.speedSource).toBe('Paladin2');
    });

    it('skips all sources when all are incapacitated', async () => {
      hasCannotActCondition.mockReturnValue(true);
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin1', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
        makeCharacter('Paladin2', [AURA_OF_PROTECTION, AURA_OF_COURAGE]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.speedBonus).toBe(0);
      expect(result.speedSource).toBeNull();
      expect(result.immunities).toEqual([]);
      expect(result.resistances).toEqual([]);
    });
  });

  describe('range filtering', () => {
    it('does not apply effects from out-of-range source', async () => {
      isWithinRange.mockResolvedValueOnce(false);
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: 'some-map',
      });
      expect(result.speedBonus).toBe(0);
      expect(result.speedSource).toBeNull();
    });

    it('still applies effects from in-range sources when one is out of range', async () => {
      hasAuraOfProtection.mockImplementation(() => true);
      let rangeIndex = 0;
      const rangeValues = [false, true];
      isWithinRange.mockImplementation(async () => rangeValues[rangeIndex++] ?? true);
      const chars = [
        makeCharacter('Paladin1', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
        makeCharacter('Paladin2', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: 'some-map',
      });
      expect(result.speedBonus).toBe(10);
      expect(result.speedSource).toBe('Paladin2');
    });

    it('skips all sources when all are out of range', async () => {
      isWithinRange.mockResolvedValue(false);
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin1', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
        makeCharacter('Paladin2', [AURA_OF_PROTECTION, AURA_OF_COURAGE]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: 'some-map',
      });
      expect(result.speedBonus).toBe(0);
      expect(result.speedSource).toBeNull();
      expect(result.immunities).toEqual([]);
      expect(result.resistances).toEqual([]);
    });

    it('calls isWithinRange even when activeMapName is null', async () => {
    setupDefaults();
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
      ];
      await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(isWithinRange).toHaveBeenCalled();
    });
  });

  describe('passive matching edge cases', () => {
    it('ignores passives with wrong name even if they have conditionImmunity', async () => {
    setupDefaults();
      const fakeCourage = { name: 'Other Courage', type: 'passive_buff', conditionImmunity: 'frightened' };
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin', [AURA_OF_PROTECTION, fakeCourage]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.immunities).not.toContain('frightened');
    });

    it('ignores passives with wrong effect even if Aura of Alacrity name', async () => {
    setupDefaults();
      const fakeAlacrity = { name: 'Aura of Alacrity', type: 'passive_buff', effect: 'not_speed_bonus' };
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin', [AURA_OF_PROTECTION, fakeAlacrity]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.speedBonus).toBe(0);
    });

    it('ignores passives with wrong conditionImmunity even if Aura of Courage name', async () => {
      const fakeCourage = { name: 'Aura of Courage', type: 'passive_buff', conditionImmunity: 'poisoned' };
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin', [AURA_OF_PROTECTION, fakeCourage]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.immunities).not.toContain('frightened');
    });
  });

  describe('automation passives shape edge cases', () => {
    it('handles missing automation gracefully', async () => {
      hasAuraOfProtection.mockReturnValue(false);
      const chars = [
        makeCharacter('Alice', []),
        { name: 'Paladin', computedStats: {} },
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.speedBonus).toBe(0);
    });

    it('handles automation without passives gracefully', async () => {
      hasAuraOfProtection.mockReturnValue(false);
      const chars = [
        makeCharacter('Alice', []),
        { name: 'Paladin', computedStats: { automation: {} } },
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.speedBonus).toBe(0);
    });
  });
});
