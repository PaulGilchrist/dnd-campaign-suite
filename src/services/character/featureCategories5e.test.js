import { describe, it, expect } from 'vitest';
import { categories5e, getCategories, categories2024 } from './featureCategories.js';

const {
  featuresToIgnore,
  actions,
  bonusActions,
  reactions,
  characterAdvancement
} = categories5e;

describe('featureCategories5e', () => {
  describe('getCategories', () => {
    it('should return categories5e for ruleset "5e"', () => {
      const result = getCategories('5e');
      expect(result).toBe(categories5e);
    });

    it('should return categories2024 for ruleset "2024"', () => {
      const result = getCategories('2024');
      expect(result).toBe(categories2024);
    });

    it('should return categories5e for any other ruleset value', () => {
      const result = getCategories('invalid');
      expect(result).toBe(categories5e);
    });
  });

  describe('featuresToIgnore', () => {
    it('should be an array', () => {
      expect(Array.isArray(featuresToIgnore)).toBe(true);
    });

    it('should have no duplicates', () => {
      const unique = new Set(featuresToIgnore);
      expect(featuresToIgnore).toHaveLength(unique.size);
    });

    it('should contain all Spellcasting-related categories', () => {
      const spellcastingItems = [
        'Spellcasting',
        'Divine Domain',
        'Sacred Oath',
        'Sorcerous Origin',
      ];
      for (const item of spellcastingItems) {
        expect(featuresToIgnore).toContain(item);
      }
    });

    it('should contain all Extra Attack / Multi-Attack categories', () => {
      expect(featuresToIgnore).toContain('Extra Attack');
    });

    it('should contain all subclass archetype categories', () => {
      const archetypeItems = [
        'Martial Archetype',
        'Monastic Tradition',
        'Primal Path',
        'Ranger Archetype',
        'Roguish Archetype',
      ];
      for (const item of archetypeItems) {
        expect(featuresToIgnore).toContain(item);
      }
    });

    it('should contain Druid-specific ignored categories', () => {
      const druidItems = [
        'Druid Circle',
        'Druidic',
      ];
      for (const item of druidItems) {
        expect(featuresToIgnore).toContain(item);
      }
    });

    it('should contain Channel Divinity', () => {
      expect(featuresToIgnore).toContain('Channel Divinity');
    });

    it('should contain Ki', () => {
      expect(featuresToIgnore).toContain('Ki');
    });

    it('should contain Ability Score Improvement', () => {
      expect(featuresToIgnore).toContain('Ability Score Improvement');
    });

    it('should contain Brutal Critical and Domain Spells', () => {
      expect(featuresToIgnore).toContain('Brutal Critical');
      expect(featuresToIgnore).toContain('Domain Spells');
    });

    it('should not contain active class features', () => {
      expect(featuresToIgnore).toContain('Ability Score Improvement');
      expect(featuresToIgnore).not.toContain('Sneak Attack');
      expect(featuresToIgnore).not.toContain('Evasion');
      expect(featuresToIgnore).not.toContain('Uncanny Dodge');
      expect(featuresToIgnore).not.toContain('Second Wind');
      expect(featuresToIgnore).not.toContain('Action Surge');
      expect(featuresToIgnore).not.toContain('Martial Arts');
    });

    it('should not contain items that are non-class features', () => {
      const nonClassFeatures = [
        'Fighting Style',
        'Favored Enemy',
        'Natural Explorer',
        'Ranger\'s Companion',
      ];
      for (const item of nonClassFeatures) {
        expect(featuresToIgnore).not.toContain(item);
      }
    });
  });

  describe('actions', () => {
    it('should be an array', () => {
      expect(Array.isArray(actions)).toBe(true);
    });

    it('should have no duplicates', () => {
      const unique = new Set(actions);
      expect(actions).toHaveLength(unique.size);
    });

    it('should list Avenging Angel as an action feature', () => {
      expect(actions).toContain('Avenging Angel');
    });
  });

  describe('bonusActions', () => {
    it('should be an array', () => {
      expect(Array.isArray(bonusActions)).toBe(true);
    });

    it('should have no duplicates', () => {
      const unique = new Set(bonusActions);
      expect(bonusActions).toHaveLength(unique.size);
    });

    it('should be empty (all bonus actions are commented out)', () => {
      expect(bonusActions).toHaveLength(0);
    });
  });

  describe('reactions', () => {
    it('should be an array', () => {
      expect(Array.isArray(reactions)).toBe(true);
    });

    it('should have no duplicates', () => {
      const unique = new Set(reactions);
      expect(reactions).toHaveLength(unique.size);
    });

    it('should list Bend Luck as a reaction feature', () => {
      expect(reactions).toContain('Bend Luck');
    });
  });

  describe('characterAdvancement', () => {
    it('should be an array', () => {
      expect(Array.isArray(characterAdvancement)).toBe(true);
    });

    it('should have no duplicates', () => {
      const unique = new Set(characterAdvancement);
      expect(characterAdvancement).toHaveLength(unique.size);
    });

    it('should list Mystic Arcanum as a character advancement entry', () => {
      expect(characterAdvancement).toContain('Mystic Arcanum');
    });
  });

  describe('data integrity', () => {
    it('should have no overlap between featuresToIgnore and action categories', () => {
      const allActionItems = [
        ...actions, ...bonusActions, ...reactions, ...characterAdvancement
      ];
      for (const item of featuresToIgnore) {
        expect(allActionItems).not.toContain(item);
      }
    });

    it('should have no overlap between action categories', () => {
      const allItems = [
        ...actions, ...bonusActions, ...reactions, ...characterAdvancement
      ];
      const unique = new Set(allItems);
      expect(allItems).toHaveLength(unique.size);
    });

    it('should not have empty action categories', () => {
      expect(actions.length).toBeGreaterThan(0);
      expect(reactions.length).toBeGreaterThan(0);
      expect(characterAdvancement.length).toBeGreaterThan(0);
    });

    it('should have more ignore entries than 2024 action/bonus/reaction categories combined', () => {
      const total2024ActionLike =
        categories2024.actions.length +
        categories2024.bonusActions.length +
        categories2024.reactions.length;
      expect(featuresToIgnore.length).toBeGreaterThan(total2024ActionLike);
    });
  });
});
