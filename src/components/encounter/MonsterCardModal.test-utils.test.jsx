/* @improved-by-ai */
import { describe, it, expect, vi } from 'vitest';
import * as utils from './MonsterCardModal.test-utils.js';

describe('MonsterCardModal.test-utils', () => {
  describe('makeMonster', () => {
    it('returns a Goblin with correct defaults', () => {
      const monster = utils.makeMonster();
      expect(monster.name).toBe('Goblin');
      expect(monster.size).toBe('Small');
      expect(monster.type).toBe('humanoid');
      expect(monster.alignment).toBe('neutral evil');
      expect(monster.armor_class).toBe(15);
      expect(monster.hit_points).toBe(7);
      expect(monster.hit_dice).toBe('2d6');
      expect(monster.challenge_rating).toBe('1/4');
      expect(monster.xp).toBe(25);
      expect(monster.languages).toBe('Common');
      expect(monster.ability_scores).toEqual({ str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 10 });
      expect(monster.ability_score_modifiers).toEqual({ str: -1, dex: 2, con: 0, int: 0, wis: -1, cha: 0 });
      expect(monster.speed.walk).toBe('30 ft.');
      expect(monster.senses).toBeNull();
      expect(monster.desc).toBeNull();
      expect(monster.book).toBeNull();
      expect(monster.page).toBeNull();
      expect(monster.subtype).toBe('');
      expect(monster.saving_throws).toEqual({});
      expect(monster.skills).toEqual({});
      expect(monster.actions).toEqual([]);
      expect(monster.traits).toEqual([]);
      expect(monster.reactions).toEqual([]);
      expect(monster.legendary_actions).toEqual([]);
      expect(monster.lair_actions).toEqual([]);
      expect(monster.regional_effects).toEqual([]);
      expect(monster.damage_vulnerabilities).toEqual([]);
      expect(monster.damage_resistances).toEqual([]);
      expect(monster.damage_immunities).toEqual([]);
      expect(monster.condition_immunities).toEqual([]);
    });

    it('merges overrides into default monster', () => {
      const monster = utils.makeMonster({ name: 'Ogre', hit_points: 59 });
      expect(monster.name).toBe('Ogre');
      expect(monster.hit_points).toBe(59);
      expect(monster.size).toBe('Small');
      expect(monster.armor_class).toBe(15);
    });

    it('does not mutate the original when overrides are applied', () => {
      const defaultMonster = utils.makeMonster();
      utils.makeMonster({ name: 'Ogre' });
      expect(defaultMonster.name).toBe('Goblin');
    });
  });

  describe('makeProps', () => {
    it('returns props with monster and defaults', () => {
      const monster = utils.makeMonster();
      const props = utils.makeProps(monster);
      expect(props.monster).toBe(monster);
      expect(props.campaignName).toBe('test-campaign');
      expect(props.creatures).toEqual([]);
      expect(props.creatureName).toBe('');
      expect(props.mapName).toBeNull();
      expect(props.characters).toEqual([]);
      expect(typeof props.onClose).toBe('function');
    });

    it('merges overrides into props and preserves monster reference', () => {
      const monster = utils.makeMonster();
      const props = utils.makeProps(monster, { campaignName: 'my-campaign', creatureName: 'Goblin' });
      expect(props.campaignName).toBe('my-campaign');
      expect(props.creatureName).toBe('Goblin');
      expect(props.monster).toBe(monster);
    });

    it('accepts custom onClose', () => {
      const onClose = vi.fn();
      const props = utils.makeProps(utils.makeMonster(), { onClose });
      expect(props.onClose).toBe(onClose);
    });
  });

  describe('hasEntries', () => {
    it('returns falsy for null, undefined, and empty object', () => {
      expect(utils.hasEntries(null)).toBeFalsy();
      expect(utils.hasEntries(undefined)).toBeFalsy();
      expect(utils.hasEntries({})).toBeFalsy();
    });

    it('returns true for non-empty object', () => {
      expect(utils.hasEntries({ key: 'value' })).toBe(true);
    });
  });

  describe('hasSenseEntries', () => {
    it('returns falsy for null, undefined, empty object, and object without sense keys', () => {
      expect(utils.hasSenseEntries(null)).toBeFalsy();
      expect(utils.hasSenseEntries(undefined)).toBeFalsy();
      expect(utils.hasSenseEntries({})).toBeFalsy();
      expect(utils.hasSenseEntries({ ac: 20 })).toBeFalsy();
    });

    it('returns truthy for each sense type and combinations', () => {
      expect(!!utils.hasSenseEntries({ blindsight: 60 })).toBe(true);
      expect(!!utils.hasSenseEntries({ darkvision: 60 })).toBe(true);
      expect(!!utils.hasSenseEntries({ truesight: 120 })).toBe(true);
      expect(!!utils.hasSenseEntries({ tremorsense: 60 })).toBe(true);
      expect(!!utils.hasSenseEntries({ passive_perception: 15 })).toBe(true);
      expect(!!utils.hasSenseEntries({ blindsight: 60, darkvision: 120, passive_perception: 20 })).toBe(true);
    });
  });

  describe('saveAbilityAbbr', () => {
    it.each([
      ['Strength', 'STR'],
      ['Dexterity', 'DEX'],
      ['Constitution', 'CON'],
      ['Intelligence', 'INT'],
      ['Wisdom', 'WIS'],
      ['Charisma', 'CHA'],
      ['strength', 'STR'],
    ])('converts %s to %s', (input, expected) => {
      expect(utils.saveAbilityAbbr(input)).toBe(expected);
    });

    it('returns uppercase first 3 chars for unknown ability', () => {
      expect(utils.saveAbilityAbbr('Foo')).toBe('FOO');
    });

    it('returns undefined for null', () => {
      expect(utils.saveAbilityAbbr(null)).toBe(undefined);
    });
  });

  describe('abilityNameMap', () => {
    it('maps lowercase keys to full ability names', () => {
      expect(utils.abilityNameMap.str).toBe('Strength');
      expect(utils.abilityNameMap.dex).toBe('Dexterity');
      expect(utils.abilityNameMap.con).toBe('Constitution');
      expect(utils.abilityNameMap.int).toBe('Intelligence');
      expect(utils.abilityNameMap.wis).toBe('Wisdom');
      expect(utils.abilityNameMap.cha).toBe('Charisma');
    });
  });

  describe('parseInitiativeBonus', () => {
    it.each([
      [null, null],
      [undefined, null],
      ['', null],
    ])('returns null for %s input', (input, expected) => {
      expect(utils.parseInitiativeBonus(input)).toBe(expected);
    });

    it.each([
      ['+2', 2],
      ['-1', -1],
      ['+5', 5],
      ['-4', -4],
      ['+10', 10],
      ['-10', -10],
    ])('parses "%s" to %d', (input, expected) => {
      expect(utils.parseInitiativeBonus(input)).toBe(expected);
    });

    it('returns null for plain number without sign', () => {
      expect(utils.parseInitiativeBonus('3')).toBeNull();
    });

    it('returns null when no match', () => {
      expect(utils.parseInitiativeBonus('no bonus here')).toBeNull();
    });
  });

  describe('parseExtraDamageDice', () => {
    it.each([
      [null, []],
      [undefined, []],
    ])('returns empty array for %s input', (input, expected) => {
      expect(utils.parseExtraDamageDice(input)).toEqual(expected);
    });

    it('parses single and multiple damage dice', () => {
      expect(utils.parseExtraDamageDice('1d8')).toEqual(['1d8']);
      expect(utils.parseExtraDamageDice('2d6+4')).toEqual(['2d6+4']);
    });

    it('excludes matching formula', () => {
      expect(utils.parseExtraDamageDice('2d6+4 1d8', '2d6+4')).toEqual(['1d8']);
    });

    it('handles spaces in formula', () => {
      expect(utils.parseExtraDamageDice('2d6 + 4 1d8', '2d6+4')).toEqual(['1d8']);
    });

    it('returns all dice when exclusion is empty', () => {
      const result = utils.parseExtraDamageDice('1d6 1d8', '');
      expect(result).toContain('1d6');
      expect(result).toContain('1d8');
    });

    it('excludes formula matching entire string', () => {
      expect(utils.parseExtraDamageDice('1d8', '1d8')).toEqual([]);
    });
  });

  describe('formatSenses', () => {
    it('returns empty string for empty object', () => {
      expect(utils.formatSenses({})).toBe('');
    });

    it('formats individual and combined senses', () => {
      expect(utils.formatSenses({ blindsight: 60 })).toBe('blindsight 60');
      expect(utils.formatSenses({ darkvision: 60 })).toBe('darkvision 60');
      expect(utils.formatSenses({ truesight: 120 })).toBe('truesight 120');
      expect(utils.formatSenses({ tremorsense: 60 })).toBe('tremorsense 60');
      expect(utils.formatSenses({ passive_perception: 15 })).toBe('passive Perception 15');
      expect(utils.formatSenses({ blindsight: 60, darkvision: 120, passive_perception: 15 }))
        .toBe('blindsight 60, darkvision 120, passive Perception 15');
    });

    it('returns empty string when all sense values are null/undefined', () => {
      expect(utils.formatSenses({ blindsight: null, darkvision: undefined })).toBe('');
    });

    it('throws when passed null', () => {
      expect(() => utils.formatSenses(null)).toThrow(TypeError);
    });
  });
});
