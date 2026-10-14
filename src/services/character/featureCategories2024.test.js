import { describe, it, expect } from 'vitest';
import { categories2024 } from './featureCategories.js';

const {
  featuresToIgnore,
  actions,
  bonusActions,
  reactions,
  characterAdvancement
} = categories2024;

describe('featureCategories2024', () => {
  describe('featuresToIgnore', () => {
    it('should contain core 2024 class feature categories to ignore', () => {
      const expectedItems = [
        'Ability Score Improvement',
        'Channel Divinity',
        'Extra Attack',
        'Epic Boon',
        'Fighting Style',
        'Spellcasting',
        'Thieves\' Cant',
      ];

      for (const item of expectedItems) {
        expect(featuresToIgnore).toContain(item);
      }
    });

    it('should contain 2024-specific ignore entries', () => {
      const expectedItems = [
        '(capstone - depends on subclass)',
        'Barbarian Subclass',
        'Bard Subclass',
        'Cleric Subclass',
        'Fighter Subclass',
        'Monk Subclass',
        'Paladin Subclass',
        'Ranger Subclass',
        'Rogue Subclass',
        'Sorcerer Subclass',
        'Warlock Subclass',
        'Wizard Subclass',
      ];

      for (const item of expectedItems) {
        expect(featuresToIgnore).toContain(item);
      }
    });

    it('should have no duplicates', () => {
      const unique = new Set(featuresToIgnore);
      expect(featuresToIgnore).toHaveLength(unique.size);
    });

    it('should not contain active class features', () => {
      const activeFeatures = [
        'Sneak Attack',
        'Evasion',
        'Uncanny Dodge',
        'Second Wind',
        'Action Surge',
        'Ki',
        'Martial Archetype',
      ];

      for (const item of activeFeatures) {
        expect(featuresToIgnore).not.toContain(item);
      }
    });
  });

  describe('actions', () => {
    it('should list 2024-specific action features', () => {
      expect(actions).toContain('Naturally Stealthy');
    });
  });

  describe('bonusActions', () => {
    it('should list 2024-specific bonus action features', () => {
      expect(bonusActions).toContain("Nature's Veil");
    });
  });

  describe('reactions', () => {
    it('should list 2024-specific reaction features', () => {
      expect(reactions).toContain('Protection');
    });
  });

  describe('characterAdvancement', () => {
    it('should contain key 2024 character advancement entries', () => {
      const expectedItems = [
        'Deft Explorer',
        'Draconic Ancestry',
        'Expertise',
        'Implements of Mercy',
        'Magical Secrets',
        'Pact Magic',
      ];

      for (const item of expectedItems) {
        expect(characterAdvancement).toContain(item);
      }
    });

    it('does not ignore Implements of Mercy so it renders on the sheet (CLA-181)', () => {
      expect(featuresToIgnore).not.toContain('Implements of Mercy');
    });

    it('should have no duplicates', () => {
      const unique = new Set(characterAdvancement);
      expect(characterAdvancement).toHaveLength(unique.size);
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

    it('should not have empty categories', () => {
      expect(actions.length).toBeGreaterThan(0);
      expect(bonusActions.length).toBeGreaterThan(0);
      expect(reactions.length).toBeGreaterThan(0);
      expect(characterAdvancement.length).toBeGreaterThan(0);
    });

    it('should have more ignore entries than 5e', () => {
      // 2024 ruleset has subclass-based categorization, so more items to ignore
      expect(featuresToIgnore.length).toBeGreaterThan(30);
    });
  });
});
