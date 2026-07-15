// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('./auraOfProtection.js', () => ({
  hasAuraOfProtection: vi.fn(),
  hasCannotActCondition: vi.fn(),
  isWithinRange: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────

import { computeAuraComboEffects } from './auraComboEffects.js';
import { hasAuraOfProtection, hasCannotActCondition, isWithinRange } from './auraOfProtection.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

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

    it('skips entries with no computedStats or null computedStats', async () => {
      setupDefaults();
      const chars = [
        makeCharacter('Alice', []),
        { name: 'Ghost' },
        { name: 'Phantom', computedStats: null },
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

    it('handles missing automation or passives gracefully', async () => {
      hasAuraOfProtection.mockReturnValue(false);
      const chars = [
        makeCharacter('Alice', []),
        { name: 'Paladin', computedStats: {} },
        { name: 'Wizard', computedStats: { automation: {} } },
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

    it('picks highest speed bonus from multiple sources regardless of order', async () => {
      setupDefaults();
      const auraAlacrity15 = { name: 'Aura of Alacrity', type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '+15 ft.' };
      const auraAlacrity20 = { name: 'Aura of Alacrity', type: 'passive_buff', effect: 'speed_bonus', bonusExpression: '+20 ft.' };
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin1', [AURA_OF_PROTECTION, auraAlacrity20]),
        makeCharacter('Paladin2', [AURA_OF_PROTECTION, auraAlacrity15]),
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

  describe('Aura of Courage / Devotion — condition immunities', () => {
    it('adds frightened and charmed immunities with correct sources', async () => {
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

    it('overwrites source when a second Paladin grants the same immunity', async () => {
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
      expect(result.immunitySources.frightened).toBe('Paladin2');
    });

    it('ignores passives with wrong name or wrong conditionImmunity', async () => {
      const fakeCourage = { name: 'Aura of Courage', type: 'passive_buff', conditionImmunity: 'poisoned' };
      const fakeCourageName = { name: 'Other Courage', type: 'passive_buff', conditionImmunity: 'frightened' };
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin1', [AURA_OF_PROTECTION, fakeCourage]),
        makeCharacter('Paladin2', [AURA_OF_PROTECTION, fakeCourageName]),
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

    it('deduplicates and merges resistances from multiple sources', async () => {
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

    it('does not add resistances when array is empty or missing', async () => {
      setupDefaults();
      const auraWardingEmpty = { name: 'Aura of Warding', type: 'passive_buff', resistances: [] };
      const auraWardingMissing = { name: 'Aura of Warding', type: 'passive_buff' };
      const charsEmpty = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin1', [AURA_OF_PROTECTION, auraWardingEmpty]),
      ];
      const result1 = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: charsEmpty,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result1.resistances).toEqual([]);
      expect(result1.resistanceSource).toBeNull();

      const charsMissing = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin2', [AURA_OF_PROTECTION, auraWardingMissing]),
      ];
      const result2 = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: charsMissing,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result2.resistances).toEqual([]);
      expect(result2.resistanceSource).toBeNull();
    });
  });

  describe('combining multiple aura types', () => {
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

    it('combines speed, immunities, and resistances from different Paladins', async () => {
      setupDefaults();
      const chars = [
        makeCharacter('Alice', []),
        makeCharacter('Paladin1', [AURA_OF_PROTECTION, AURA_OF_ALACRITY]),
        makeCharacter('Paladin2', [AURA_OF_PROTECTION, AURA_OF_COURAGE]),
        makeCharacter('Paladin3', [AURA_OF_PROTECTION, AURA_OF_WARDING]),
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
      expect(result.resistances).toEqual(expect.arrayContaining(['Necrotic', 'Psychic', 'Radiant']));
      expect(result.resistanceSource).toBe('Paladin3');
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
      isWithinRange.mockImplementation(async () => true);
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

  describe('ally filtering', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      setupDefaults();
      getRuntimeValue.mockReturnValue([]);
    });

    it('returns defaults when selectedAllies excludes the target', async () => {
      getRuntimeValue.mockReturnValue(['OtherPlayer']);

      const chars = [
        makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_COURAGE, AURA_OF_WARDING]),
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

    it('applies effects when selectedAllies includes the target', async () => {
      getRuntimeValue.mockReturnValue(['Alice']);

      const chars = [
        makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_COURAGE, AURA_OF_WARDING]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.immunities).toContain('frightened');
      expect(result.immunitySources.frightened).toBe('Paladin');
      expect(result.resistances).toContain('Necrotic');
      expect(result.resistanceSource).toBe('Paladin');
    });

    it('skips sources where selectedAllies excludes the target', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'Paladin1' && key === 'selectedAllies') return ['Wizard'];
        if (name === 'Paladin2' && key === 'selectedAllies') return ['Alice'];
        return undefined;
      });

      const chars = [
        makeCharacter('Paladin1', [AURA_OF_PROTECTION, AURA_OF_COURAGE]),
        makeCharacter('Paladin2', [AURA_OF_PROTECTION, AURA_OF_WARDING]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.immunities).toEqual([]);
      expect(result.resistances).toContain('Necrotic');
      expect(result.resistanceSource).toBe('Paladin2');
    });

    it('falls back to no ally filtering when selectedAllies is null', async () => {
      getRuntimeValue.mockReturnValue(null);

      const chars = [
        makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_COURAGE]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.immunities).toContain('frightened');
    });

    it('falls back to no ally filtering when selectedAllies is empty', async () => {
      getRuntimeValue.mockReturnValue([]);

      const chars = [
        makeCharacter('Paladin', [AURA_OF_PROTECTION, AURA_OF_COURAGE]),
      ];
      const result = await computeAuraComboEffects({
        targetName: 'Alice',
        characters: chars,
        campaignName: 'test',
        activeMapName: null,
      });
      expect(result.immunities).toContain('frightened');
    });
  });
});
