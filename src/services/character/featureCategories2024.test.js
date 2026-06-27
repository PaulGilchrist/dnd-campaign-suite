// @improved-by-ai
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
    it('should be an array', () => {
      expect(Array.isArray(featuresToIgnore)).toBe(true);
    });

    it('should contain all expected class feature categories to ignore', () => {
      const expectedItems = [
        '(capstone - depends on subclass)',
        'Ability Score Improvement',
        'Barbarian Subclass',
        'Bard Subclass',
        'Bardic Inspiration',
        'Body and Mind',
        'Channel Divinity',
        'Cleric Subclass',
        'Celestial Resistance',
        'Damage Resistance',
        'Darkvision',
        'Draconic Resilience',
        'Druid Subclass',
        'Druidic',
        'Eldritch Invocations',
        'Epic Boon',
        'Extra Attack',
        'Two Extra Attacks',
        'Three Extra Attacks',
        'Fast Movement',
        'Feat',
        'Feral Senses',
        'Fighter Subclass',
        'Fighting Style',
        'Foe Slayer',
        'Gnomish Cunning',
        'Implements of Mercy',
        'Increased Hit Points',
        'Keen Senses',
        'Monk Subclass',
        'Paladin Subclass',
        'Rage',
        'Ranger Subclass',
        'Rogue Subclass',
        'Scholar',
        'Skillful',
        'Sorcerer Subclass',
        'Spellcasting',
        'Subclass feature',
        "Thieves' Cant",
        'Trance',
        'Unarmored Defense',
        'Unarmored Movement',
        'Versatile',
        'Warlock Subclass',
        'Wizard Subclass'
      ];

      for (const item of expectedItems) {
        expect(featuresToIgnore).toContain(item);
      }
    });


    it('should not contain items that are not meant to be ignored', () => {
      const notIgnored = [
        'Sneak Attack',
        'Evasion',
        'Uncanny Dodge',
        'Second Wind',
        'Action Surge',
        'Ki',
        'Martial Archetype',
        'Monastic Tradition',
        'Primal Path',
        'Ranger Archetype',
        'Roguish Archetype',
        'Sacred Oath',
        'Sorcerous Origin'
      ];

      for (const item of notIgnored) {
        expect(featuresToIgnore).not.toContain(item);
      }
    });

    it('should contain no duplicate entries', () => {
      const unique = new Set(featuresToIgnore);
      expect(featuresToIgnore).toHaveLength(unique.size);
    });

    it('should use consistent string casing (no trailing whitespace)', () => {
      for (const item of featuresToIgnore) {
        expect(item).toBe(item.trim());
        expect(item).toMatch(/^[A-Z(]/);
      }
    });
  });

  describe('actions', () => {
    it('should be an array', () => {
      expect(Array.isArray(actions)).toBe(true);
    });

    it('should contain the expected action entries', () => {
      expect(actions).toContain('Naturally Stealthy');
    });

    it('should contain no duplicate entries', () => {
      const unique = new Set(actions);
      expect(actions).toHaveLength(unique.size);
    });
  });

  describe('bonusActions', () => {
    it('should be an array', () => {
      expect(Array.isArray(bonusActions)).toBe(true);
    });

    it('should contain the expected bonus action entries', () => {
      expect(bonusActions).toContain("Nature's Veil");
    });

    it('should contain no duplicate entries', () => {
      const unique = new Set(bonusActions);
      expect(bonusActions).toHaveLength(unique.size);
    });
  });

  describe('reactions', () => {
    it('should be an array', () => {
      expect(Array.isArray(reactions)).toBe(true);
    });

    it('should be empty (no 2024-specific reactions defined)', () => {
      expect(reactions).toHaveLength(0);
    });

    it('should contain no duplicate entries', () => {
      const unique = new Set(reactions);
      expect(reactions).toHaveLength(unique.size);
    });
  });

  describe('characterAdvancement', () => {
    it('should be an array', () => {
      expect(Array.isArray(characterAdvancement)).toBe(true);
    });

    it('should contain all expected advancement entries', () => {
      const expectedItems = [
        'Deft Explorer',
        'Divine Order',
        'Draconic Ancestry',
        'Dwarven Toughness',
        'Elfish Lineage',
        'Expertise',
        'Gnomish Lineage',
        'Halfling Nimbleness',
        'Fiendish Legacies',
        'LightBearer',
        'Magical Secrets',
        'Otherworldly Presence',
        'Pact Magic',
        'Second-Storywork',
        'Slippery Mind',
        'Somatic Components'
      ];

      for (const item of expectedItems) {
        expect(characterAdvancement).toContain(item);
      }
    });


    it('should contain no duplicate entries', () => {
      const unique = new Set(characterAdvancement);
      expect(characterAdvancement).toHaveLength(unique.size);
    });
  });

  describe('data integrity', () => {
    it('should have no overlap between featuresToIgnore and action categories', () => {
      const allActionItems = [
        ...actions,
        ...bonusActions,
        ...reactions,
        ...characterAdvancement
      ];

      for (const item of featuresToIgnore) {
        expect(allActionItems).not.toContain(item);
      }
    });

    it('should have no overlap between action categories', () => {
      const allItems = [
        ...actions,
        ...bonusActions,
        ...reactions,
        ...characterAdvancement
      ];
      const unique = new Set(allItems);
      expect(allItems).toHaveLength(unique.size);
    });
  });
});
