import { describe, it, expect } from 'vitest';
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
    it('ABILITY_ABBR should list all six ability score abbreviations', () => {
      expect(ABILITY_ABBR).toEqual(['str', 'dex', 'con', 'int', 'wis', 'cha']);
    });

    it('ABILITY_LABELS should map each ability abbreviation to its display label', () => {
      expect(ABILITY_LABELS).toEqual({
        str: 'STR',
        dex: 'DEX',
        con: 'CON',
        int: 'INT',
        wis: 'WIS',
        cha: 'CHA',
      });
    });

    it('ATTITUDE_OPTIONS should have 5 options with value and label', () => {
      expect(ATTITUDE_OPTIONS).toHaveLength(5);
      for (const option of ATTITUDE_OPTIONS) {
        expect(option).toHaveProperty('value');
        expect(option).toHaveProperty('label');
      }
    });

    it('ATTITUDE_COLORS should have entries for all attitude values', () => {
      for (const option of ATTITUDE_OPTIONS) {
        expect(ATTITUDE_COLORS).toHaveProperty(option.value);
        const colors = ATTITUDE_COLORS[option.value];
        expect(colors).toHaveProperty('bg');
        expect(colors).toHaveProperty('color');
        expect(colors).toHaveProperty('border');
      }
    });
  });

  describe('getDefaultFormData', () => {
    it('should return an object with all expected default fields', () => {
      const form = getDefaultFormData();
      expect(form).toHaveProperty('name', '');
      expect(form).toHaveProperty('race', '');
      expect(form).toHaveProperty('classRole', '');
      expect(form).toHaveProperty('appearance', '');
      expect(form).toHaveProperty('personality', '');
      expect(form).toHaveProperty('goals', '');
      expect(form).toHaveProperty('secrets', '');
      expect(form).toHaveProperty('notes', '');
      expect(form).toHaveProperty('tags', '');
      expect(form).toHaveProperty('attitude', 'neutral');
      expect(form).toHaveProperty('image', '');
      expect(form).toHaveProperty('imageName', '');
      expect(form).toHaveProperty('imagePath', '');
      expect(form).toHaveProperty('armorClass', 10);
      expect(form).toHaveProperty('hitPoints', '');
      expect(form).toHaveProperty('hitDice', '');
      expect(form).toHaveProperty('initiativeBonus', '');
      expect(form).toHaveProperty('speed', { walk: '30 ft.' });
      expect(form).toHaveProperty('abilityScores');
      expect(form).toHaveProperty('savingThrowBonuses', {});
      expect(form).toHaveProperty('skillBonuses', {});
      expect(form).toHaveProperty('damageResistances', []);
      expect(form).toHaveProperty('damageImmunities', []);
      expect(form).toHaveProperty('conditionImmunities', []);
      expect(form).toHaveProperty('actions', []);
      expect(form).toHaveProperty('traits', '');
      expect(form).toHaveProperty('reactions', '');
    });

    it('should default all ability scores to 10', () => {
      const form = getDefaultFormData();
      for (const abbr of ABILITY_ABBR) {
        expect(form.abilityScores[abbr]).toBe(10);
      }
    });

    it('should override specific fields when overrides are provided', () => {
      const form = getDefaultFormData({ name: 'Grog', hitPoints: 20, armorClass: 15 });
      expect(form.name).toBe('Grog');
      expect(form.hitPoints).toBe(20);
      expect(form.armorClass).toBe(15);
    });

    it('should override the entire abilityScores object', () => {
      const customScores = { str: 18, dex: 14, con: 16, int: 10, wis: 8, cha: 12 };
      const form = getDefaultFormData({ abilityScores: customScores });
      expect(form.abilityScores).toEqual(customScores);
    });

    it('should return a fresh object each time (no shared mutation)', () => {
      const form1 = getDefaultFormData();
      const form2 = getDefaultFormData();
      form1.abilityScores.str = 20;
      expect(form2.abilityScores.str).toBe(10);
    });

    it('should allow overriding the attitude', () => {
      const form = getDefaultFormData({ attitude: 'positive' });
      expect(form.attitude).toBe('positive');
    });

    it('should allow overriding the speed object', () => {
      const form = getDefaultFormData({ speed: { walk: '40 ft.', burrow: '20 ft.' } });
      expect(form.speed).toEqual({ walk: '40 ft.', burrow: '20 ft.' });
    });

    it('should allow overriding array fields via overrides', () => {
      const form = getDefaultFormData({
        damageResistances: ['fire', 'cold'],
        damageImmunities: ['psychic'],
        actions: [{ name: 'Longsword' }],
      });
      expect(form.damageResistances).toEqual(['fire', 'cold']);
      expect(form.damageImmunities).toEqual(['psychic']);
      expect(form.actions).toEqual([{ name: 'Longsword' }]);
    });
  });

  describe('cleanNPCData', () => {
    it('should return the data object as-is when AC is valid', () => {
      const data = { name: 'Grog', armorClass: 16 };
      const cleaned = cleanNPCData(data);
      expect(cleaned.armorClass).toBe(16);
      expect(cleaned.name).toBe('Grog');
    });

    it('should default null AC to 10', () => {
      const data = { name: 'Grog', armorClass: null };
      const cleaned = cleanNPCData(data);
      expect(cleaned.armorClass).toBe(10);
    });

    it('should default undefined AC to 10', () => {
      const data = { name: 'Grog', armorClass: undefined };
      const cleaned = cleanNPCData(data);
      expect(cleaned.armorClass).toBe(10);
    });

    it('should default empty string AC to 10', () => {
      const data = { name: 'Grog', armorClass: '' };
      const cleaned = cleanNPCData(data);
      expect(cleaned.armorClass).toBe(10);
    });

    it('should default non-numeric AC to 10 and log error', () => {
      const data = { name: 'Grog', armorClass: '16' };
      const consoleSpy = vi.spyOn(console, 'error');
      const cleaned = cleanNPCData(data);
      expect(cleaned.armorClass).toBe(10);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AC] NPC "Grog" has invalid AC: 16. Defaulting to 10.',
      );
      consoleSpy.mockRestore();
    });

    it('should default boolean AC to 10 and log error', () => {
      const data = { name: 'Grog', armorClass: true };
      const consoleSpy = vi.spyOn(console, 'error');
      const cleaned = cleanNPCData(data);
      expect(cleaned.armorClass).toBe(10);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should preserve other fields during cleaning', () => {
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

    it('should leave AC unchanged when it is a valid number 0', () => {
      const data = { name: 'Grog', armorClass: 0 };
      const cleaned = cleanNPCData(data);
      expect(cleaned.armorClass).toBe(0);
    });

    it('should leave AC unchanged when it is a negative number', () => {
      const data = { name: 'Grog', armorClass: -5 };
      const cleaned = cleanNPCData(data);
      expect(cleaned.armorClass).toBe(-5);
    });

    it('should not mutate the original data object', () => {
      const data = { name: 'Grog', armorClass: null };
      const originalAC = data.armorClass;
      const cleaned = cleanNPCData(data);
      expect(data.armorClass).toBe(originalAC);
      expect(cleaned.armorClass).toBe(10);
    });
  });

  describe('getAttitudeStyle', () => {
    it('should return correct style for "deep bonds"', () => {
      const style = getAttitudeStyle('deep bonds');
      expect(style).toEqual({
        backgroundColor: '#1a472a',
        color: '#90ee90',
        borderColor: '#2d6a4f',
      });
    });

    it('should return correct style for "positive"', () => {
      const style = getAttitudeStyle('positive');
      expect(style).toEqual({
        backgroundColor: '#1b4332',
        color: '#b7e4c7',
        borderColor: '#40916c',
      });
    });

    it('should return correct style for "neutral"', () => {
      const style = getAttitudeStyle('neutral');
      expect(style).toEqual({
        backgroundColor: '#4a4a4a',
        color: '#e0e0e0',
        borderColor: '#6b6b6b',
      });
    });

    it('should return correct style for "negative"', () => {
      const style = getAttitudeStyle('negative');
      expect(style).toEqual({
        backgroundColor: '#7b241c',
        color: '#f4a0a0',
        borderColor: '#a43330',
      });
    });

    it('should return correct style for "extreme opposition"', () => {
      const style = getAttitudeStyle('extreme opposition');
      expect(style).toEqual({
        backgroundColor: '#5c030e',
        color: '#ff6b6b',
        borderColor: '#8b0000',
      });
    });

    it('should fall back to neutral style for unknown attitude', () => {
      const style = getAttitudeStyle('unknown-value');
      expect(style).toEqual({
        backgroundColor: '#4a4a4a',
        color: '#e0e0e0',
        borderColor: '#6b6b6b',
      });
    });

    it('should fall back to neutral style for null attitude', () => {
      const style = getAttitudeStyle(null);
      expect(style).toEqual({
        backgroundColor: '#4a4a4a',
        color: '#e0e0e0',
        borderColor: '#6b6b6b',
      });
    });

    it('should fall back to neutral style for undefined attitude', () => {
      const style = getAttitudeStyle(undefined);
      expect(style).toEqual({
        backgroundColor: '#4a4a4a',
        color: '#e0e0e0',
        borderColor: '#6b6b6b',
      });
    });

    it('should fall back to neutral style for empty string attitude', () => {
      const style = getAttitudeStyle('');
      expect(style).toEqual({
        backgroundColor: '#4a4a4a',
        color: '#e0e0e0',
        borderColor: '#6b6b6b',
      });
    });

    it('should return a new style object each call', () => {
      const style1 = getAttitudeStyle('neutral');
      const style2 = getAttitudeStyle('neutral');
      expect(style1).not.toBe(style2);
    });
  });
});
