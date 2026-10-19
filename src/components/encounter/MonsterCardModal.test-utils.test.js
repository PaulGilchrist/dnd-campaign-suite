// @maintained-by-ai
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
    it('returns a default Goblin with the complete stat block fields', () => {
      expect(utils.makeMonster()).toEqual({
        name: 'Goblin',
        size: 'Small',
        type: 'humanoid',
        subtype: '',
        alignment: 'neutral evil',
        armor_class: 15,
        hit_points: 7,
        hit_dice: '2d6',
        speed: { walk: '30 ft.' },
        ability_scores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 10 },
        ability_score_modifiers: { str: -1, dex: 2, con: 0, int: 0, wis: -1, cha: 0 },
        saving_throws: {},
        skills: {},
        senses: null,
        languages: 'Common',
        damage_vulnerabilities: [],
        damage_resistances: [],
        damage_immunities: [],
        condition_immunities: [],
        challenge_rating: '1/4',
        xp: 25,
        actions: [],
        traits: [],
        reactions: [],
        legendary_actions: [],
        lair_actions: [],
        regional_effects: [],
        desc: null,
        book: null,
        page: null,
      });
    });

    it('merges overrides on top of the defaults', () => {
      const monster = utils.makeMonster({ name: 'Ogre', hit_points: 59 });
      expect(monster.name).toBe('Ogre');
      expect(monster.hit_points).toBe(59);
      expect(monster.size).toBe('Small');
    });

    it('returns fresh nested objects on every call so tests cannot mutate shared fixtures', () => {
      const first = utils.makeMonster();
      first.name = 'Mutated';
      first.speed.walk = '5 ft.';
      const second = utils.makeMonster();
      expect(second).not.toBe(first);
      expect(second.name).toBe('Goblin');
      expect(second.speed).toEqual({ walk: '30 ft.' });
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

    it('overrides defaults with the provided values, including onClose', () => {
      const onClose = vi.fn();
      const monster = utils.makeMonster();
      const props = utils.makeProps(monster, { campaignName: 'other-campaign', creatureName: 'Goblin', onClose });
      expect(props.monster).toBe(monster);
      expect(props.campaignName).toBe('other-campaign');
      expect(props.creatureName).toBe('Goblin');
      expect(props.onClose).toBe(onClose);
    });
  });

  describe('hasEntries', () => {
    it.each([
      [null, false],
      [undefined, false],
      [{}, false],
      [{ key: 'value' }, true],
    ])('hasEntries(%j) is %s', (input, expected) => {
      expect(Boolean(utils.hasEntries(input))).toBe(expected);
    });
  });

  describe('hasSenseEntries', () => {
    it.each([
      [null, false],
      [undefined, false],
      [{}, false],
      [{ ac: 20 }, false],
      [{ blindsight: 0 }, false],
      [{ darkvision: null }, false],
      [{ blindsight: 60 }, true],
      [{ darkvision: 60 }, true],
      [{ truesight: 120 }, true],
      [{ tremorsense: 60 }, true],
      [{ passive_perception: 15 }, true],
      [{ blindsight: 60, darkvision: 120, passive_perception: 20 }, true],
    ])('hasSenseEntries(%j) is %s', (input, expected) => {
      expect(Boolean(utils.hasSenseEntries(input))).toBe(expected);
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
    it.each([
      [null, null],
      [undefined, null],
      ['', null],
      ['3', null],
      ['no bonus here', null],
      ['  +2', null],
      ['--2', null],
      ['+', null],
      ['+2', 2],
      ['-1', -1],
      ['+0', 0],
      ['+5', 5],
      ['-4', -4],
      ['+10', 10],
      ['-10', -10],
      ['+2 (from Dexterity)', 2],
      ['-4 bonus', -4],
    ])('parses %j as %s', (input, expected) => {
      expect(utils.parseInitiativeBonus(input)).toBe(expected);
    });
  });

  describe('formatSenses', () => {
    it.each([
      [{}, ''],
      [{ blindsight: 60 }, 'blindsight 60'],
      [{ darkvision: 60 }, 'darkvision 60'],
      [{ truesight: 120 }, 'truesight 120'],
      [{ tremorsense: 60 }, 'tremorsense 60'],
      [{ passive_perception: 15 }, 'passive Perception 15'],
      [{ blindsight: 60, darkvision: 120, passive_perception: 15 }, 'blindsight 60, darkvision 120, passive Perception 15'],
      [{ darkvision: 0 }, ''],
      [{ blindsight: 60, darkvision: null }, 'blindsight 60'],
    ])('formats %j as "%s"', (senses, expected) => {
      expect(utils.formatSenses(senses)).toBe(expected);
    });

    it('throws when passed null, so callers must guard with hasSenseEntries', () => {
      expect(() => utils.formatSenses(null)).toThrow(TypeError);
    });
  });
});
