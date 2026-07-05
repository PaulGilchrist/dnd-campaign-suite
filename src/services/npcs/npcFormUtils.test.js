// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest';
import {
  ABILITY_ABBR,
  ABILITY_LABELS,
  ATTITUDE_OPTIONS,
  ATTITUDE_COLORS,
  getDefaultFormData,
  cleanNPCData,
  getAttitudeStyle,
} from './npcFormUtils.js';

describe('npcFormUtils', () => {
  describe('constants', () => {
    it('ABILITY_ABBR lists all six ability scores', () => {
      expect(ABILITY_ABBR).toEqual(['str', 'dex', 'con', 'int', 'wis', 'cha']);
    });

    it('ABILITY_LABELS maps each abbreviation to its uppercase label', () => {
      expect(ABILITY_LABELS).toEqual({
        str: 'STR',
        dex: 'DEX',
        con: 'CON',
        int: 'INT',
        wis: 'WIS',
        cha: 'CHA',
      });
    });

    it('ATTITUDE_OPTIONS has 5 options with matching ATTITUDE_COLORS keys', () => {
      const attitudeValues = ATTITUDE_OPTIONS.map((o) => o.value);
      expect(attitudeValues).toEqual(Object.keys(ATTITUDE_COLORS));
      for (const option of ATTITUDE_OPTIONS) {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
        expect(typeof option.value).toBe('string');
        expect(typeof option.label).toBe('string');
      }
    });

    it('ATTITUDE_COLORS has bg, color, and border strings for each attitude', () => {
      for (const [, colors] of Object.entries(ATTITUDE_COLORS)) {
        expect(colors).toHaveProperty('bg');
        expect(colors).toHaveProperty('color');
        expect(colors).toHaveProperty('border');
        expect(typeof colors.bg).toBe('string');
        expect(typeof colors.color).toBe('string');
        expect(typeof colors.border).toBe('string');
      }
    });
  });

  describe('getDefaultFormData', () => {
    it('returns correct default values for all fields', () => {
      const form = getDefaultFormData();
      expect(form).toEqual({
        name: '',
        race: '',
        classRole: '',
        appearance: '',
        personality: '',
        goals: '',
        secrets: '',
        notes: '',
        tags: '',
        attitude: 'neutral',
        image: '',
        imageName: '',
        imagePath: '',
        armorClass: 10,
        hitPoints: '',
        hitDice: '',
        initiativeBonus: '',
        speed: { walk: '30 ft.' },
        abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        savingThrowBonuses: {},
        skillBonuses: {},
        damageResistances: [],
        damageImmunities: [],
        conditionImmunities: [],
        actions: [],
        traits: '',
        reactions: '',
      });
    });

    it('applies override scalar, object, and array fields', () => {
      const form = getDefaultFormData({
        name: 'Grog',
        hitPoints: 20,
        armorClass: 15,
        abilityScores: { str: 18, dex: 14, con: 16, int: 10, wis: 8, cha: 12 },
        damageResistances: ['fire', 'cold'],
        damageImmunities: ['psychic'],
        actions: [{ name: 'Longsword' }],
      });
      expect(form.name).toBe('Grog');
      expect(form.hitPoints).toBe(20);
      expect(form.armorClass).toBe(15);
      expect(form.abilityScores).toEqual({ str: 18, dex: 14, con: 16, int: 10, wis: 8, cha: 12 });
      expect(form.damageResistances).toEqual(['fire', 'cold']);
      expect(form.damageImmunities).toEqual(['psychic']);
      expect(form.actions).toEqual([{ name: 'Longsword' }]);
    });

    it('returns a fresh object each call with independent mutable fields', () => {
      const form1 = getDefaultFormData();
      const form2 = getDefaultFormData();
      form1.abilityScores.str = 20;
      form1.damageResistances.push('fire');
      form1.speed.walk = '40 ft.';
      expect(form2.abilityScores.str).toBe(10);
      expect(form2.damageResistances).toEqual([]);
      expect(form2.speed.walk).toBe('30 ft.');
    });
  });

  describe('cleanNPCData', () => {
    it('returns a clone with AC unchanged when valid', () => {
      const data = { name: 'Grog', armorClass: 16, race: 'Orc' };
      const cleaned = cleanNPCData(data);
      expect(cleaned).not.toBe(data);
      expect(cleaned.armorClass).toBe(16);
      expect(cleaned.name).toBe('Grog');
    });

    it('defaults AC to 10 for null, undefined, and empty string without logging', () => {
      const silentValues = [null, undefined, ''];
      const consoleSpy = vi.spyOn(console, 'error');

      for (const v of silentValues) {
        const cleaned = cleanNPCData({ name: 'Grog', armorClass: v });
        expect(cleaned.armorClass).toBe(10);
      }

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('defaults AC to 10 for non-number types and logs an error', () => {
      const noisyValues = ['16', true, NaN];
      const consoleSpy = vi.spyOn(console, 'error');
      const expectedCalls = noisyValues.map(
        (v) => '[AC] NPC "Grog" has invalid AC: ' + v + '. Defaulting to 10.',
      );

      for (let i = 0; i < noisyValues.length; i++) {
        const cleaned = cleanNPCData({ name: 'Grog', armorClass: noisyValues[i] });
        expect(cleaned.armorClass).toBe(10);
        expect(consoleSpy).toHaveBeenCalledWith(expectedCalls[i]);
      }

      consoleSpy.mockRestore();
    });

    it('accepts AC of 0 and negative values as valid', () => {
      expect(cleanNPCData({ name: 'Grog', armorClass: 0 }).armorClass).toBe(0);
      expect(cleanNPCData({ name: 'Grog', armorClass: -5 }).armorClass).toBe(-5);
    });

    it('does not mutate the original data object', () => {
      const data = { name: 'Grog', armorClass: null };
      const cleaned = cleanNPCData(data);
      expect(data.armorClass).toBe(null);
      expect(cleaned.armorClass).toBe(10);
    });

    it('logs error with "undefined" name when name is missing', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const cleaned = cleanNPCData({ armorClass: 'bad' });
      expect(cleaned.armorClass).toBe(10);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AC] NPC "undefined" has invalid AC: bad. Defaulting to 10.',
      );
      consoleSpy.mockRestore();
    });
  });

  describe('getAttitudeStyle', () => {
    it('returns a style object with backgroundColor, color, and borderColor', () => {
      const style = getAttitudeStyle('neutral');
      expect(style).toHaveProperty('backgroundColor');
      expect(style).toHaveProperty('color');
      expect(style).toHaveProperty('borderColor');
    });

    it('returns correct style for each known attitude', () => {
      expect(getAttitudeStyle('deep bonds')).toEqual({
        backgroundColor: '#1a472a',
        color: '#90ee90',
        borderColor: '#2d6a4f',
      });
      expect(getAttitudeStyle('positive')).toEqual({
        backgroundColor: '#1b4332',
        color: '#b7e4c7',
        borderColor: '#40916c',
      });
      expect(getAttitudeStyle('neutral')).toEqual({
        backgroundColor: '#4a4a4a',
        color: '#e0e0e0',
        borderColor: '#6b6b6b',
      });
      expect(getAttitudeStyle('negative')).toEqual({
        backgroundColor: '#7b241c',
        color: '#f4a0a0',
        borderColor: '#a43330',
      });
      expect(getAttitudeStyle('extreme opposition')).toEqual({
        backgroundColor: '#5c030e',
        color: '#ff6b6b',
        borderColor: '#8b0000',
      });
    });

    it('returns neutral style for unknown, null, undefined, and empty string attitudes', () => {
      const neutralStyle = getAttitudeStyle('neutral');
      expect(getAttitudeStyle('unknown-value')).toEqual(neutralStyle);
      expect(getAttitudeStyle(null)).toEqual(neutralStyle);
      expect(getAttitudeStyle(undefined)).toEqual(neutralStyle);
      expect(getAttitudeStyle('')).toEqual(neutralStyle);
    });

    it('returns a new object on each call (not reused)', () => {
      const style1 = getAttitudeStyle('neutral');
      const style2 = getAttitudeStyle('neutral');
      expect(style1).not.toBe(style2);
    });
  });
});
