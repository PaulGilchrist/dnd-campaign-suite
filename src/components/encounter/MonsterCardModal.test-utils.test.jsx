import { describe, it, expect, vi } from 'vitest';
import * as utils from './MonsterCardModal.test-utils.js';

describe('MonsterCardModal.test-utils', () => {
  describe('defaultConditionEffects', () => {
    it('exports defaultConditionEffects object', () => {
      expect(utils.defaultConditionEffects).toBeDefined();
      expect(typeof utils.defaultConditionEffects).toBe('object');
    });

    it('has all expected numeric count properties', () => {
      const { defaultConditionEffects } = utils;
      expect(defaultConditionEffects.attackAdvantageCount).toBe(0);
      expect(defaultConditionEffects.attackDisadvantageCount).toBe(0);
      expect(defaultConditionEffects.targetAdvantageCount).toBe(0);
      expect(defaultConditionEffects.targetDisadvantageCount).toBe(0);
      expect(defaultConditionEffects.saveAdvantageCount).toBe(0);
      expect(defaultConditionEffects.saveDisadvantageCount).toBe(0);
    });

    it('has all expected boolean properties', () => {
      const { defaultConditionEffects } = utils;
      expect(defaultConditionEffects.abilityCheckDisadvantage).toBe(false);
      expect(defaultConditionEffects.cannotAct).toBe(false);
      expect(defaultConditionEffects.speedZero).toBe(false);
      expect(defaultConditionEffects.concentrationBroken).toBe(false);
      expect(defaultConditionEffects.targetAdvantageIfWithin5ft).toBe(false);
      expect(defaultConditionEffects.targetDisadvantageIfBeyond5ft).toBe(false);
      expect(defaultConditionEffects.autoCritWithin5ft).toBe(false);
      expect(defaultConditionEffects.resistantToAll).toBe(false);
      expect(defaultConditionEffects.poisonImmune).toBe(false);
      expect(defaultConditionEffects.autoReroll).toBe(false);
      expect(defaultConditionEffects.strSaveReplace).toBe(false);
      expect(defaultConditionEffects.strCheckReplace).toBe(false);
      expect(defaultConditionEffects.reliableTalent).toBe(false);
      expect(defaultConditionEffects.tacticalMind).toBe(false);
    });

    it('has all expected array properties', () => {
      const { defaultConditionEffects } = utils;
      expect(Array.isArray(defaultConditionEffects.autoFailSaves)).toBe(true);
      expect(Array.isArray(defaultConditionEffects.saveDisadvantage)).toBe(true);
      expect(Array.isArray(defaultConditionEffects.saveAdvantage)).toBe(true);
    });

    it('has all expected nullable properties', () => {
      const { defaultConditionEffects } = utils;
      expect(defaultConditionEffects.autoRerollCondition).toBeNull();
      expect(defaultConditionEffects.autoRerollBonus).toBeNull();
      expect(defaultConditionEffects.tacticalMindBonus).toBeNull();
    });
  });

  describe('makeMonster', () => {
    it('exports makeMonster function', () => {
      expect(utils.makeMonster).toBeDefined();
      expect(typeof utils.makeMonster).toBe('function');
    });

    it('returns a monster object with default values', () => {
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
    });

    it('returns a monster with ability scores', () => {
      const monster = utils.makeMonster();
      expect(monster.ability_scores.str).toBe(8);
      expect(monster.ability_scores.dex).toBe(14);
      expect(monster.ability_scores.con).toBe(10);
      expect(monster.ability_scores.int).toBe(10);
      expect(monster.ability_scores.wis).toBe(8);
      expect(monster.ability_scores.cha).toBe(10);
    });

    it('returns a monster with ability score modifiers', () => {
      const monster = utils.makeMonster();
      expect(monster.ability_score_modifiers.str).toBe(-1);
      expect(monster.ability_score_modifiers.dex).toBe(2);
      expect(monster.ability_score_modifiers.con).toBe(0);
      expect(monster.ability_score_modifiers.int).toBe(0);
      expect(monster.ability_score_modifiers.wis).toBe(-1);
      expect(monster.ability_score_modifiers.cha).toBe(0);
    });

    it('returns a monster with speed object', () => {
      const monster = utils.makeMonster();
      expect(monster.speed.walk).toBe('30 ft.');
    });

    it('returns a monster with empty arrays for lists', () => {
      const monster = utils.makeMonster();
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

    it('returns a monster with empty objects for maps', () => {
      const monster = utils.makeMonster();
      expect(monster.saving_throws).toEqual({});
      expect(monster.skills).toEqual({});
    });

    it('returns a monster with null for optional fields', () => {
      const monster = utils.makeMonster();
      expect(monster.senses).toBeNull();
      expect(monster.desc).toBeNull();
      expect(monster.book).toBeNull();
      expect(monster.page).toBeNull();
    });

    it('merges overrides into default monster', () => {
      const monster = utils.makeMonster({ name: 'Ogre', hit_points: 59 });
      expect(monster.name).toBe('Ogre');
      expect(monster.hit_points).toBe(59);
      // Default values should still be present
      expect(monster.size).toBe('Small');
      expect(monster.armor_class).toBe(15);
    });

    it('allows overriding all fields', () => {
      const monster = utils.makeMonster({
        name: 'Tarrasque',
        size: 'Colossal',
        type: 'dragon',
        challenge_rating: '30',
        xp: 33000,
      });
      expect(monster.name).toBe('Tarrasque');
      expect(monster.size).toBe('Colossal');
      expect(monster.type).toBe('dragon');
      expect(monster.challenge_rating).toBe('30');
      expect(monster.xp).toBe(33000);
    });
  });

  describe('makeProps', () => {
    it('exports makeProps function', () => {
      expect(utils.makeProps).toBeDefined();
      expect(typeof utils.makeProps).toBe('function');
    });

    it('returns props with monster and defaults', () => {
      const monster = utils.makeMonster();
      const props = utils.makeProps(monster);
      expect(props.monster).toBe(monster);
      expect(props.campaignName).toBe('test-campaign');
      expect(props.creatures).toEqual([]);
      expect(props.creatureName).toBe('');
      expect(props.mapName).toBeNull();
      expect(props.characters).toEqual([]);
    });

    it('merges overrides into props', () => {
      const monster = utils.makeMonster();
      const props = utils.makeProps(monster, { campaignName: 'my-campaign', creatureName: 'Goblin' });
      expect(props.campaignName).toBe('my-campaign');
      expect(props.creatureName).toBe('Goblin');
      expect(props.monster).toBe(monster);
    });

    it('accepts onClose mock', () => {
      const onClose = vi.fn();
      const props = utils.makeProps(utils.makeMonster(), { onClose });
      expect(props.onClose).toBe(onClose);
    });
  });

  describe('hasEntries', () => {
    it('exports hasEntries function', () => {
      expect(utils.hasEntries).toBeDefined();
      expect(typeof utils.hasEntries).toBe('function');
    });

    it('returns falsy for null', () => {
      expect(utils.hasEntries(null)).toBeFalsy();
    });

    it('returns falsy for undefined', () => {
      expect(utils.hasEntries(undefined)).toBeFalsy();
    });

    it('returns false for empty object', () => {
      expect(utils.hasEntries({})).toBe(false);
    });

    it('returns true for non-empty object', () => {
      expect(utils.hasEntries({ key: 'value' })).toBe(true);
    });

    it('returns true for object with one entry', () => {
      expect(utils.hasEntries({ a: 1 })).toBe(true);
    });
  });

  describe('hasSenseEntries', () => {
    it('exports hasSenseEntries function', () => {
      expect(utils.hasSenseEntries).toBeDefined();
      expect(typeof utils.hasSenseEntries).toBe('function');
    });

    it('returns false for null', () => {
      expect(utils.hasSenseEntries(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(utils.hasSenseEntries(undefined)).toBeFalsy();
    });

    it('returns falsy for empty object', () => {
      expect(utils.hasSenseEntries({})).toBeFalsy();
    });

    it('returns truthy when blindsight is set', () => {
      expect(!!utils.hasSenseEntries({ blindsight: 60 })).toBe(true);
    });

    it('returns truthy when darkvision is set', () => {
      expect(!!utils.hasSenseEntries({ darkvision: 60 })).toBe(true);
    });

    it('returns truthy when truesight is set', () => {
      expect(!!utils.hasSenseEntries({ truesight: 120 })).toBe(true);
    });

    it('returns truthy when tremorsense is set', () => {
      expect(!!utils.hasSenseEntries({ tremorsense: 60 })).toBe(true);
    });

    it('returns truthy when passive_perception is set', () => {
      expect(!!utils.hasSenseEntries({ passive_perception: 15 })).toBe(true);
    });

    it('returns truthy when multiple senses are set', () => {
      expect(!!utils.hasSenseEntries({
        blindsight: 60,
        darkvision: 120,
        passive_perception: 20,
      })).toBe(true);
    });
  });

  describe('saveAbilityAbbr', () => {
    it('exports saveAbilityAbbr function', () => {
      expect(utils.saveAbilityAbbr).toBeDefined();
      expect(typeof utils.saveAbilityAbbr).toBe('function');
    });

    it('converts Strength to STR', () => {
      expect(utils.saveAbilityAbbr('Strength')).toBe('STR');
    });

    it('converts Dexterity to DEX', () => {
      expect(utils.saveAbilityAbbr('Dexterity')).toBe('DEX');
    });

    it('converts Constitution to CON', () => {
      expect(utils.saveAbilityAbbr('Constitution')).toBe('CON');
    });

    it('converts Intelligence to INT', () => {
      expect(utils.saveAbilityAbbr('Intelligence')).toBe('INT');
    });

    it('converts Wisdom to WIS', () => {
      expect(utils.saveAbilityAbbr('Wisdom')).toBe('WIS');
    });

    it('converts Charisma to CHA', () => {
      expect(utils.saveAbilityAbbr('Charisma')).toBe('CHA');
    });

    it('returns uppercase first 3 chars for unknown ability', () => {
      expect(utils.saveAbilityAbbr('Foo')).toBe('FOO');
    });

    it('returns uppercase first 3 chars for null', () => {
      expect(utils.saveAbilityAbbr(null)).toBe(undefined);
    });
  });

  describe('abilityNameMap', () => {
    it('exports abilityNameMap', () => {
      expect(utils.abilityNameMap).toBeDefined();
      expect(typeof utils.abilityNameMap).toBe('object');
    });

    it('maps lowercase keys to full names', () => {
      expect(utils.abilityNameMap.str).toBe('Strength');
      expect(utils.abilityNameMap.dex).toBe('Dexterity');
      expect(utils.abilityNameMap.con).toBe('Constitution');
      expect(utils.abilityNameMap.int).toBe('Intelligence');
      expect(utils.abilityNameMap.wis).toBe('Wisdom');
      expect(utils.abilityNameMap.cha).toBe('Charisma');
    });
  });

  describe('parseInitiativeBonus', () => {
    it('exports parseInitiativeBonus function', () => {
      expect(utils.parseInitiativeBonus).toBeDefined();
      expect(typeof utils.parseInitiativeBonus).toBe('function');
    });

    it('returns null for null input', () => {
      expect(utils.parseInitiativeBonus(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(utils.parseInitiativeBonus(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(utils.parseInitiativeBonus('')).toBeNull();
    });

    it('parses positive bonus', () => {
      expect(utils.parseInitiativeBonus('+2')).toBe(2);
    });

    it('parses negative bonus', () => {
      expect(utils.parseInitiativeBonus('-1')).toBe(-1);
    });

    it('parses larger positive bonus', () => {
      expect(utils.parseInitiativeBonus('+5')).toBe(5);
    });

    it('parses larger negative bonus', () => {
      expect(utils.parseInitiativeBonus('-4')).toBe(-4);
    });

    it('returns null when no match', () => {
      expect(utils.parseInitiativeBonus('no bonus here')).toBeNull();
    });
  });

  describe('parseExtraDamageDice', () => {
    it('exports parseExtraDamageDice function', () => {
      expect(utils.parseExtraDamageDice).toBeDefined();
      expect(typeof utils.parseExtraDamageDice).toBe('function');
    });

    it('returns empty array for null', () => {
      expect(utils.parseExtraDamageDice(null)).toEqual([]);
    });

    it('returns empty array for undefined', () => {
      expect(utils.parseExtraDamageDice(undefined)).toEqual([]);
    });

    it('parses single damage die', () => {
      expect(utils.parseExtraDamageDice('1d8')).toEqual(['1d8']);
    });

    it('parses multiple damage dice', () => {
      expect(utils.parseExtraDamageDice('2d6+4')).toEqual(['2d6+4']);
    });

    it('excludes matching formula', () => {
      expect(utils.parseExtraDamageDice('2d6+4 1d8', '2d6+4')).toEqual(['1d8']);
    });

    it('handles spaces in formula', () => {
      expect(utils.parseExtraDamageDice('2d6 + 4 1d8', '2d6+4')).toEqual(['1d8']);
    });

    it('returns all dice when no exclusion', () => {
      const result = utils.parseExtraDamageDice('1d6 1d8', '');
      expect(result).toContain('1d6');
      expect(result).toContain('1d8');
    });
  });

  describe('formatSenses', () => {
    it('exports formatSenses function', () => {
      expect(utils.formatSenses).toBeDefined();
      expect(typeof utils.formatSenses).toBe('function');
    });

    it('throws when passed null', () => {
      expect(() => utils.formatSenses(null)).toThrow();
    });

    it('returns empty string for empty object', () => {
      expect(utils.formatSenses({})).toBe('');
    });

    it('formats blindsight', () => {
      expect(utils.formatSenses({ blindsight: 60 })).toBe('blindsight 60');
    });

    it('formats darkvision', () => {
      expect(utils.formatSenses({ darkvision: 60 })).toBe('darkvision 60');
    });

    it('formats truesight', () => {
      expect(utils.formatSenses({ truesight: 120 })).toBe('truesight 120');
    });

    it('formats tremorsense', () => {
      expect(utils.formatSenses({ tremorsense: 60 })).toBe('tremorsense 60');
    });

    it('formats passive perception', () => {
      expect(utils.formatSenses({ passive_perception: 15 })).toBe('passive Perception 15');
    });

    it('formats multiple senses comma-separated', () => {
      const result = utils.formatSenses({
        blindsight: 60,
        darkvision: 120,
        passive_perception: 15,
      });
      expect(result).toBe('blindsight 60, darkvision 120, passive Perception 15');
    });
  });
});
