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
    it('ABILITY_ABBR should list all six ability score abbreviations in correct order', () => {
      expect(ABILITY_ABBR).toEqual(['str', 'dex', 'con', 'int', 'wis', 'cha']);
    });

    it('ABILITY_LABELS should map each abbreviation to its uppercase label', () => {
      expect(ABILITY_LABELS).toEqual({
        str: 'STR',
        dex: 'DEX',
        con: 'CON',
        int: 'INT',
        wis: 'WIS',
        cha: 'CHA',
      });
    });

    it('ABILITY_LABELS keys should match ABILITY_ABBR', () => {
      expect(Object.keys(ABILITY_LABELS)).toEqual(ABILITY_ABBR);
    });

    it('ATTITUDE_OPTIONS should have 5 options each with value and label', () => {
      expect(ATTITUDE_OPTIONS).toHaveLength(5);
      for (const option of ATTITUDE_OPTIONS) {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
        expect(typeof option.value).toBe('string');
        expect(typeof option.label).toBe('string');
      }
    });

    it('ATTITUDE_OPTIONS values should match ATTITUDE_COLORS keys', () => {
      const attitudeValues = ATTITUDE_OPTIONS.map((o) => o.value);
      const colorKeys = Object.keys(ATTITUDE_COLORS);
      expect(attitudeValues).toEqual(colorKeys);
    });

    it('ATTITUDE_COLORS should have bg, color, and border for each attitude', () => {
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
    const defaults = {
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
      savingThrowBonuses: {},
      skillBonuses: {},
      damageResistances: [],
      damageImmunities: [],
      conditionImmunities: [],
      actions: [],
      traits: '',
      reactions: '',
    };

    for (const [key, expectedValue] of Object.entries(defaults)) {
      it(`should default ${key} to the correct value`, () => {
        const form = getDefaultFormData();
        expect(form[key]).toEqual(expectedValue);
      });
    }

    it('should default all ability scores to 10', () => {
      const form = getDefaultFormData();
      for (const abbr of ABILITY_ABBR) {
        expect(form.abilityScores[abbr]).toBe(10);
      }
    });

    it('should apply override scalar fields', () => {
      const form = getDefaultFormData({ name: 'Grog', hitPoints: 20, armorClass: 15 });
      expect(form.name).toBe('Grog');
      expect(form.hitPoints).toBe(20);
      expect(form.armorClass).toBe(15);
    });

    it('should apply override object fields by replacing entirely', () => {
      const customScores = { str: 18, dex: 14, con: 16, int: 10, wis: 8, cha: 12 };
      const form = getDefaultFormData({ abilityScores: customScores });
      expect(form.abilityScores).toEqual(customScores);
    });

    it('should apply override array fields by replacing entirely', () => {
      const form = getDefaultFormData({
        damageResistances: ['fire', 'cold'],
        damageImmunities: ['psychic'],
        actions: [{ name: 'Longsword' }],
      });
      expect(form.damageResistances).toEqual(['fire', 'cold']);
      expect(form.damageImmunities).toEqual(['psychic']);
      expect(form.actions).toEqual([{ name: 'Longsword' }]);
    });

    it('should return a fresh object each call with independent arrays/objects', () => {
      const form1 = getDefaultFormData();
      const form2 = getDefaultFormData();
      form1.abilityScores.str = 20;
      form1.damageResistances.push('fire');
      expect(form2.abilityScores.str).toBe(10);
      expect(form2.damageResistances).toEqual([]);
    });

    it('should return a fresh object each call with independent speed objects', () => {
      const form1 = getDefaultFormData();
      const form2 = getDefaultFormData();
      form1.speed.walk = '40 ft.';
      expect(form2.speed.walk).toBe('30 ft.');
    });
  });

  describe('cleanNPCData', () => {
    it('should return data unchanged when AC is a valid number', () => {
      const data = { name: 'Grog', armorClass: 16, race: 'Orc' };
      const cleaned = cleanNPCData(data);
      expect(cleaned).not.toBe(data);
      expect(cleaned.armorClass).toBe(16);
      expect(cleaned.name).toBe('Grog');
      expect(cleaned.race).toBe('Orc');
    });

    it('should default AC to 10 when AC is null', () => {
      const cleaned = cleanNPCData({ name: 'Grog', armorClass: null });
      expect(cleaned.armorClass).toBe(10);
    });

    it('should default AC to 10 when AC is undefined', () => {
      const cleaned = cleanNPCData({ name: 'Grog' });
      expect(cleaned.armorClass).toBe(10);
    });

    it('should default AC to 10 when AC is an empty string', () => {
      const cleaned = cleanNPCData({ name: 'Grog', armorClass: '' });
      expect(cleaned.armorClass).toBe(10);
    });

    it('should default AC to 10 when AC is a numeric string and log an error', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const cleaned = cleanNPCData({ name: 'Grog', armorClass: '16' });
      expect(cleaned.armorClass).toBe(10);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AC] NPC "Grog" has invalid AC: 16. Defaulting to 10.',
      );
      consoleSpy.mockRestore();
    });

    it('should default AC to 10 when AC is a boolean and log an error', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const cleaned = cleanNPCData({ name: 'Grog', armorClass: true });
      expect(cleaned.armorClass).toBe(10);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AC] NPC "Grog" has invalid AC: true. Defaulting to 10.',
      );
      consoleSpy.mockRestore();
    });

    it('should default AC to 10 when AC is NaN and log an error', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      const cleaned = cleanNPCData({ name: 'Grog', armorClass: NaN });
      expect(cleaned.armorClass).toBe(10);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AC] NPC "Grog" has invalid AC: NaN. Defaulting to 10.',
      );
      consoleSpy.mockRestore();
    });

    it('should preserve other fields while correcting AC', () => {
      const data = {
        name: 'Grog',
        race: 'Hill Dwarf',
        hitPoints: 12,
        armorClass: null,
        speed: { walk: '25 ft.' },
      };
      const cleaned = cleanNPCData(data);
      expect(cleaned.name).toBe('Grog');
      expect(cleaned.race).toBe('Hill Dwarf');
      expect(cleaned.hitPoints).toBe(12);
      expect(cleaned.speed).toEqual({ walk: '25 ft.' });
    });

    it('should accept AC of 0 as valid', () => {
      const cleaned = cleanNPCData({ name: 'Grog', armorClass: 0 });
      expect(cleaned.armorClass).toBe(0);
    });

    it('should accept negative AC values', () => {
      const cleaned = cleanNPCData({ name: 'Grog', armorClass: -5 });
      expect(cleaned.armorClass).toBe(-5);
    });

    it('should not mutate the original data object', () => {
      const data = { name: 'Grog', armorClass: null };
      const cleaned = cleanNPCData(data);
      expect(data.armorClass).toBe(null);
      expect(cleaned.armorClass).toBe(10);
    });

    it('should log error with "undefined" name when name is missing', () => {
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
    it('should return a style object with backgroundColor, color, and borderColor', () => {
      const style = getAttitudeStyle('neutral');
      expect(style).toHaveProperty('backgroundColor');
      expect(style).toHaveProperty('color');
      expect(style).toHaveProperty('borderColor');
    });

    it('should return correct style for each known attitude', () => {
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

    it('should return neutral style for unknown, null, undefined, and empty string attitudes', () => {
      const neutralStyle = getAttitudeStyle('neutral');
      expect(getAttitudeStyle('unknown-value')).toEqual(neutralStyle);
      expect(getAttitudeStyle(null)).toEqual(neutralStyle);
      expect(getAttitudeStyle(undefined)).toEqual(neutralStyle);
      expect(getAttitudeStyle('')).toEqual(neutralStyle);
    });

    it('should return a new object on each call (not reused)', () => {
      const style1 = getAttitudeStyle('neutral');
      const style2 = getAttitudeStyle('neutral');
      expect(style1).not.toBe(style2);
    });
  });
});
