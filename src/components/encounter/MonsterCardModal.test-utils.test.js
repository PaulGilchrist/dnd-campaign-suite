import { describe, it, expect, vi } from 'vitest';
import * as utils from './MonsterCardModal.test-utils.js';

describe('MonsterCardModal.test-utils', () => {
  describe('defaultConditionEffects', () => {
    it('defines a complete default for every condition-effect field', () => {
      expect(utils.defaultConditionEffects).toEqual({
        attackAdvantageCount: 0,
        attackDisadvantageCount: 0,
        abilityCheckDisadvantage: false,
        autoFailSaves: [],
        saveDisadvantage: [],
        cannotAct: false,
        speedZero: false,
        concentrationBroken: false,
        targetAdvantageCount: 0,
        targetDisadvantageCount: 0,
        targetAdvantageIfWithin5ft: false,
        targetDisadvantageIfBeyond5ft: false,
        autoCritWithin5ft: false,
        resistantToAll: false,
        poisonImmune: false,
        saveAdvantage: [],
        saveAdvantageCount: 0,
        saveDisadvantageCount: 0,
        autoReroll: false,
        autoRerollCondition: null,
        autoRerollBonus: null,
        strSaveReplace: false,
        strCheckReplace: false,
        reliableTalent: false,
        tacticalMind: false,
        tacticalMindBonus: null,
      });
    });
  });

  describe('makeMonster', () => {
    it('returns a default Goblin with the core stat block fields', () => {
      const monster = utils.makeMonster();
      expect(monster.name).toBe('Goblin');
      expect(monster.size).toBe('Small');
      expect(monster.type).toBe('humanoid');
      expect(monster.alignment).toBe('neutral evil');
      expect(monster.armor_class).toBe(15);
      expect(monster.hit_points).toBe(7);
      expect(monster.hit_dice).toBe('2d6');
      expect(monster.speed).toEqual({ walk: '30 ft.' });
      expect(monster.ability_scores).toEqual({ str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 10 });
      expect(monster.ability_score_modifiers).toEqual({ str: -1, dex: 2, con: 0, int: 0, wis: -1, cha: 0 });
      expect(monster.saving_throws).toEqual({});
      expect(monster.skills).toEqual({});
      expect(monster.senses).toBeNull();
      expect(monster.languages).toBe('Common');
      expect(monster.challenge_rating).toBe('1/4');
      expect(monster.xp).toBe(25);
      expect(monster.actions).toEqual([]);
      expect(monster.traits).toEqual([]);
      expect(monster.reactions).toEqual([]);
      expect(monster.legendary_actions).toEqual([]);
      expect(monster.lair_actions).toEqual([]);
      expect(monster.regional_effects).toEqual([]);
    });

    it('merges overrides on top of the defaults', () => {
      const monster = utils.makeMonster({ name: 'Ogre', hit_points: 59 });
      expect(monster.name).toBe('Ogre');
      expect(monster.hit_points).toBe(59);
      expect(monster.size).toBe('Small');
    });

    it('returns a fresh object on every call so tests cannot mutate shared fixtures', () => {
      const first = utils.makeMonster();
      first.name = 'Mutated';
      const second = utils.makeMonster();
      expect(second.name).toBe('Goblin');
      expect(second).not.toBe(first);
    });
  });

  describe('makeProps', () => {
    it('returns a monster prop with test defaults', () => {
      const monster = utils.makeMonster();
      const props = utils.makeProps(monster);
      expect(props.monster).toBe(monster);
      expect(props.campaignName).toBe('test-campaign');
      expect(props.creatures).toEqual([]);
      expect(props.characters).toEqual([]);
      expect(props.creatureName).toBe('');
      expect(props.mapName).toBeNull();
      expect(vi.isMockFunction(props.onClose)).toBe(true);
    });

    it('overrides defaults with the provided values', () => {
      const monster = utils.makeMonster();
      const props = utils.makeProps(monster, { campaignName: 'other-campaign', creatureName: 'Goblin' });
      expect(props.campaignName).toBe('other-campaign');
      expect(props.creatureName).toBe('Goblin');
      expect(props.monster).toBe(monster);
    });

    it('honors a custom onClose handler', () => {
      const onClose = vi.fn();
      const props = utils.makeProps(utils.makeMonster(), { onClose });
      expect(props.onClose).toBe(onClose);
    });
  });

  describe('hasEntries', () => {
    it('is falsy for null, undefined, and empty objects', () => {
      expect(utils.hasEntries(null)).toBeFalsy();
      expect(utils.hasEntries(undefined)).toBeFalsy();
      expect(utils.hasEntries({})).toBeFalsy();
    });

    it('is truthy for a non-empty object', () => {
      expect(utils.hasEntries({ key: 'value' })).toBeTruthy();
    });
  });

  describe('hasSenseEntries', () => {
    it('is falsy for null, undefined, empty objects, and objects with no sense keys', () => {
      expect(utils.hasSenseEntries(null)).toBeFalsy();
      expect(utils.hasSenseEntries(undefined)).toBeFalsy();
      expect(utils.hasSenseEntries({})).toBeFalsy();
      expect(utils.hasSenseEntries({ ac: 20 })).toBeFalsy();
    });

    it('is truthy when any recognized sense is present', () => {
      expect(utils.hasSenseEntries({ blindsight: 60 })).toBeTruthy();
      expect(utils.hasSenseEntries({ darkvision: 60 })).toBeTruthy();
      expect(utils.hasSenseEntries({ truesight: 120 })).toBeTruthy();
      expect(utils.hasSenseEntries({ tremorsense: 60 })).toBeTruthy();
      expect(utils.hasSenseEntries({ passive_perception: 15 })).toBeTruthy();
    });

    it('is truthy when multiple senses are combined', () => {
      expect(utils.hasSenseEntries({ blindsight: 60, darkvision: 120, passive_perception: 20 })).toBeTruthy();
    });

    it('is falsy when sense values are falsy (e.g. 0 or null)', () => {
      expect(utils.hasSenseEntries({ blindsight: 0 })).toBeFalsy();
      expect(utils.hasSenseEntries({ darkvision: null })).toBeFalsy();
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

    it('falls back to the uppercased first three characters for unknown abilities', () => {
      expect(utils.saveAbilityAbbr('Foo')).toBe('FOO');
    });
  });

  describe('abilityNameMap', () => {
    it('maps every ability abbreviation to its full name', () => {
      expect(utils.abilityNameMap).toEqual({
        str: 'Strength',
        dex: 'Dexterity',
        con: 'Constitution',
        int: 'Intelligence',
        wis: 'Wisdom',
        cha: 'Charisma',
      });
    });
  });

  describe('parseInitiativeBonus', () => {
    it.each([null, undefined, '', '3', 'no bonus here', '  +2', '--2', '+'])(
      'returns null for %j',
      (input) => {
        expect(utils.parseInitiativeBonus(input)).toBeNull();
      }
    );

    it.each([
      ['+2', 2],
      ['-1', -1],
      ['+0', 0],
      ['+5', 5],
      ['-4', -4],
      ['+10', 10],
      ['-10', -10],
    ])('parses "%s" as %d', (input, expected) => {
      expect(utils.parseInitiativeBonus(input)).toBe(expected);
    });

    it('parses the leading sign even when the string has trailing context', () => {
      expect(utils.parseInitiativeBonus('+2 (from Dexterity)')).toBe(2);
      expect(utils.parseInitiativeBonus('-4 bonus')).toBe(-4);
    });
  });

  describe('formatSenses', () => {
    it('returns an empty string for an empty object', () => {
      expect(utils.formatSenses({})).toBe('');
    });

    it.each([
      [{ blindsight: 60 }, 'blindsight 60'],
      [{ darkvision: 60 }, 'darkvision 60'],
      [{ truesight: 120 }, 'truesight 120'],
      [{ tremorsense: 60 }, 'tremorsense 60'],
      [{ passive_perception: 15 }, 'passive Perception 15'],
    ])('formats %j as "%s"', (senses, expected) => {
      expect(utils.formatSenses(senses)).toBe(expected);
    });

    it('joins multiple senses with commas in a fixed order', () => {
      expect(utils.formatSenses({ blindsight: 60, darkvision: 120, passive_perception: 15 }))
        .toBe('blindsight 60, darkvision 120, passive Perception 15');
    });

    it('skips falsy sense values', () => {
      expect(utils.formatSenses({ darkvision: 0 })).toBe('');
      expect(utils.formatSenses({ blindsight: 60, darkvision: null })).toBe('blindsight 60');
    });

    it('throws when passed null, so callers must guard with hasSenseEntries', () => {
      expect(() => utils.formatSenses(null)).toThrow(TypeError);
    });
  });
});
