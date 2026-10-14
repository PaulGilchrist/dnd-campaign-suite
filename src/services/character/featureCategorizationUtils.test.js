import { describe, it, expect } from 'vitest';
import {
  categorizeFeatures,
  mergeCategorizedFeatures,
  addFeatures
} from './featureCategorizationUtils.js';

const mockCategories = {
  featuresToIgnore: ['Proficiency', 'Skill Proficiencies'],
  actions: ['Action Surge', 'Second Wind'],
  bonusActions: ['Cunning Action', 'Patient Defense'],
  reactions: ['Dodge', 'Parry'],
  characterAdvancement: ['Ability Score Improvement', 'Feat']
};

const makeFeature = (name, overrides = {}) => ({
  name,
  description: 'Test description',
  ...overrides
});

const emptyResult = {
  actions: [],
  bonusActions: [],
  reactions: [],
  specialActions: [],
  characterAdvancement: []
};

describe('featureCategorizationUtils', () => {
  describe('categorizeFeatures', () => {
    it('should return empty categorized result when items is null, undefined, or not an array', () => {
      expect(categorizeFeatures(null, mockCategories)).toEqual(emptyResult);
      expect(categorizeFeatures(undefined, mockCategories)).toEqual(emptyResult);
      expect(categorizeFeatures('not an array', mockCategories)).toEqual(emptyResult);
    });

    it('should place features listed in categories into the correct arrays', () => {
      const items = [
        makeFeature('Action Surge'),
        makeFeature('Second Wind'),
        makeFeature('Cunning Action'),
        makeFeature('Patient Defense'),
        makeFeature('Dodge'),
        makeFeature('Parry'),
        makeFeature('Ability Score Improvement'),
        makeFeature('Feat')
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.actions).toHaveLength(2);
      expect(result.actions.map(f => f.name)).toEqual(['Action Surge', 'Second Wind']);
      expect(result.bonusActions).toHaveLength(2);
      expect(result.bonusActions.map(f => f.name)).toEqual(['Cunning Action', 'Patient Defense']);
      expect(result.reactions).toHaveLength(2);
      expect(result.reactions.map(f => f.name)).toEqual(['Dodge', 'Parry']);
      expect(result.characterAdvancement).toHaveLength(2);
      expect(result.characterAdvancement.map(f => f.name)).toEqual(['Ability Score Improvement', 'Feat']);
      expect(result.specialActions).toHaveLength(0);
    });

    it('should place unrecognized features into specialActions', () => {
      const items = [makeFeature('Unarmored Defense')];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.specialActions).toHaveLength(1);
      expect(result.specialActions[0].name).toBe('Unarmored Defense');
    });

    it('should skip null entries in the items array', () => {
      const items = [null, makeFeature('Action Surge'), null];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Action Surge');
    });

    it('should deduplicate features by name, keeping the first occurrence', () => {
      const items = [
        makeFeature('Action Surge', { description: 'Level 2' }),
        makeFeature('Action Surge', { description: 'Level 17' })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].description).toBe('Level 2');
    });

    it('should use a custom descriptionField and omit description when absent', () => {
      const custom = [makeFeature('Action Surge', { desc: 'Custom desc field' })];
      const resultCustom = categorizeFeatures(custom, mockCategories, { descriptionField: 'desc' });
      expect(resultCustom.actions[0].description).toBe('Custom desc field');

      const noDesc = [{ name: 'Action Surge' }];
      const resultNoDesc = categorizeFeatures(noDesc, mockCategories);
      expect(resultNoDesc.actions[0].description).toBeUndefined();
    });

    it('should categorize by automation.casting_time when present, overriding name-based categorization', () => {
      const items = [
        makeFeature('Second Wind', {
          automation: { casting_time: '1 bonus action', type: 'self_healing' }
        })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.actions).toHaveLength(0);
      expect(result.bonusActions).toHaveLength(1);
      expect(result.bonusActions[0].name).toBe('Second Wind');
    });

    it('should support casting_time values with and without the "1 " prefix, with trimming', () => {
      const items = [
        makeFeature('Action Feature', { automation: { casting_time: 'action' } }),
        makeFeature('Bonus Feature', { automation: { casting_time: 'bonus action' } }),
        makeFeature('Reaction Feature', { automation: { casting_time: 'reaction' } }),
        makeFeature('Trimmed Feature', { automation: { casting_time: '  1 action  ' } })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.actions).toHaveLength(2);
      expect(result.actions.map(f => f.name)).toEqual(['Action Feature', 'Trimmed Feature']);
      expect(result.bonusActions).toHaveLength(1);
      expect(result.bonusActions[0].name).toBe('Bonus Feature');
      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0].name).toBe('Reaction Feature');
    });

    it('should categorize Illusory Reality (CLA-179) into bonusActions, not specialActions', () => {
      const items = [
        makeFeature('Illusory Reality', {
          automation: { type: 'illusory_reality', effect: 'illusory_reality', casting_time: '1 bonus action' }
        })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.bonusActions).toHaveLength(1);
      expect(result.bonusActions[0].name).toBe('Illusory Reality');
      expect(result.specialActions).toHaveLength(0);
    });

    it('should treat unknown casting_time values as specialActions', () => {
      const items = [
        makeFeature('Ritual Feature', {
          automation: { casting_time: '1 minute' }
        })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.specialActions).toHaveLength(1);
      expect(result.specialActions[0].name).toBe('Ritual Feature');
    });

    it('should categorize casting_time "passive" as specialActions unless the name is in characterAdvancement', () => {
      const items = [
        makeFeature('Racial Trait', { automation: { casting_time: 'passive' } }),
        makeFeature('Feat', { automation: { casting_time: 'passive' } })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.specialActions).toHaveLength(1);
      expect(result.specialActions[0].name).toBe('Racial Trait');
      expect(result.characterAdvancement).toHaveLength(1);
      expect(result.characterAdvancement[0].name).toBe('Feat');
    });

    it('should fall back to name-based categorization when automation lacks casting_time', () => {
      const items = [
        makeFeature('Feature With Automation', {
          automation: { type: 'extra_action' }
        })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.specialActions).toHaveLength(1);
      expect(result.specialActions[0].name).toBe('Feature With Automation');
    });

    it('should read casting_time from the item itself and support reaction in automation array', () => {
      const items = [
        makeFeature('Item Casting Time Feature', { casting_time: '1 action' }),
        makeFeature('Reaction From Automation Array', {
          automation: [{ casting_time: 'reaction' }, { casting_time: 'action' }]
        })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Item Casting Time Feature');
      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0].name).toBe('Reaction From Automation Array');
    });

    it('prefers an actionable casting time over a leading passive in a multi-automation array — CLA-218', () => {
      const items = [
        makeFeature('Mage Hand Legerdemain', {
          automation: [
            { type: 'passive_rule', effect: 'mage_hand_legerdemain', casting_time: 'passive' },
            { type: 'conditional_advantage', target: 'ability_check', condition: 'mage_hand_legerdemain', effect: 'advantage', abilities: ['DEX'] },
            { type: 'mage_hand_control', range: '30_ft', action: 'bonus_action', casting_time: '1 bonus action' }
          ]
        })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.bonusActions).toHaveLength(1);
      expect(result.bonusActions[0].name).toBe('Mage Hand Legerdemain');
      expect(result.specialActions).toHaveLength(0);
    });

    it('keeps all-passive automation arrays in specialActions — CLA-218 regression guard', () => {
      const items = [
        makeFeature('Passive Duo', {
          automation: [
            { type: 'passive_rule', effect: 'a', casting_time: 'passive' },
            { type: 'passive_rule', effect: 'b', casting_time: 'passive' }
          ]
        })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.specialActions).toHaveLength(1);
      expect(result.bonusActions).toHaveLength(0);
    });

    it('should categorize a mixed set of features into the correct categories', () => {
      const items = [
        makeFeature('Action Surge'),
        makeFeature('Cunning Action'),
        makeFeature('Dodge'),
        makeFeature('Ability Score Improvement'),
        makeFeature('Unarmored Defense'),
        makeFeature('Proficiency')
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Action Surge');
      expect(result.bonusActions).toHaveLength(1);
      expect(result.bonusActions[0].name).toBe('Cunning Action');
      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0].name).toBe('Dodge');
      expect(result.characterAdvancement).toHaveLength(1);
      expect(result.characterAdvancement[0].name).toBe('Ability Score Improvement');
      expect(result.specialActions).toHaveLength(2);
      expect(result.specialActions.map(f => f.name)).toEqual(['Unarmored Defense', 'Proficiency']);
    });
  });

  describe('addFeatures', () => {
    it('should flatten features from all levels and categorize them', () => {
      const levels = [
        { features: [makeFeature('Action Surge')] },
        { features: [makeFeature('Cunning Action')] },
        { features: [makeFeature('Dodge')] }
      ];
      const result = addFeatures(levels, mockCategories);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Action Surge');
      expect(result.bonusActions).toHaveLength(1);
      expect(result.bonusActions[0].name).toBe('Cunning Action');
      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0].name).toBe('Dodge');
    });

    it('should skip levels without features and handle empty features arrays', () => {
      const levels = [
        { features: [makeFeature('Action Surge')] },
        {},
        { features: [] },
        { features: [makeFeature('Dodge')] }
      ];
      const result = addFeatures(levels, mockCategories);
      expect(result.actions).toHaveLength(1);
      expect(result.reactions).toHaveLength(1);
    });

    it('should pass options through to categorizeFeatures', () => {
      // addFeatures already processes levels from highest to lowest (reverse).
      // Passing reverseOrder: true reverses again, so first occurrence (Level 2) is kept.
      const levels = [
        { features: [makeFeature('Action Surge', { description: 'Level 2' })] },
        { features: [makeFeature('Action Surge', { description: 'Level 17' })] }
      ];
      const result = addFeatures(levels, mockCategories, { reverseOrder: true });
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].description).toBe('Level 2');
    });
  });

  describe('mergeCategorizedFeatures', () => {
    it('should merge features from both objects into each category', () => {
      const base = {
        actions: [makeFeature('Action Surge')],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      };
      const additional = {
        actions: [makeFeature('Second Wind')],
        bonusActions: [makeFeature('Cunning Action')],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      };
      const result = mergeCategorizedFeatures(base, additional);
      expect(result.actions).toHaveLength(2);
      expect(result.actions.map(f => f.name)).toEqual(['Action Surge', 'Second Wind']);
      expect(result.bonusActions).toHaveLength(1);
      expect(result.bonusActions[0].name).toBe('Cunning Action');
    });

    it('should deduplicate by name across base and additional, keeping the first occurrence', () => {
      const base = {
        actions: [makeFeature('Action Surge', { description: 'Base' })],
        bonusActions: [makeFeature('Cunning Action')],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      };
      const additional = {
        actions: [makeFeature('Action Surge', { description: 'Additional' })],
        bonusActions: [makeFeature('Cunning Action')],
        reactions: [makeFeature('Dodge')],
        specialActions: [],
        characterAdvancement: []
      };
      const result = mergeCategorizedFeatures(base, additional);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].description).toBe('Base');
      expect(result.bonusActions).toHaveLength(1);
      expect(result.reactions).toHaveLength(1);
    });

    it('should preserve order: base items first, then additional items', () => {
      const base = {
        actions: [makeFeature('First'), makeFeature('Second')],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      };
      const additional = {
        actions: [makeFeature('Third'), makeFeature('Fourth')],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      };
      const result = mergeCategorizedFeatures(base, additional);
      expect(result.actions.map(f => f.name)).toEqual(['First', 'Second', 'Third', 'Fourth']);
    });

    it('should merge across all five categories', () => {
      const base = {
        actions: [makeFeature('Action Surge')],
        bonusActions: [makeFeature('Second Wind')],
        reactions: [makeFeature('Dodge')],
        specialActions: [makeFeature('Unarmored Defense')],
        characterAdvancement: [makeFeature('ASI')]
      };
      const additional = {
        actions: [makeFeature('Extra Attack')],
        bonusActions: [makeFeature('Cunning Action')],
        reactions: [makeFeature('Parry')],
        specialActions: [makeFeature('Martial Arts')],
        characterAdvancement: [makeFeature('Feat')]
      };
      const result = mergeCategorizedFeatures(base, additional);
      expect(result.actions).toHaveLength(2);
      expect(result.bonusActions).toHaveLength(2);
      expect(result.reactions).toHaveLength(2);
      expect(result.specialActions).toHaveLength(2);
      expect(result.characterAdvancement).toHaveLength(2);
    });
  });
});
