// @cleaned-by-ai
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

describe('featureCategorizationUtils', () => {
  describe('categorizeFeatures', () => {
    it('should return empty arrays when items is null', () => {
      const result = categorizeFeatures(null, mockCategories);
      expect(result).toEqual({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });
    });

    it('should return empty arrays when items is undefined', () => {
      const result = categorizeFeatures(undefined, mockCategories);
      expect(result).toEqual({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });
    });

    it('should return empty arrays when items is not an array', () => {
      const result = categorizeFeatures('not an array', mockCategories);
      expect(result).toEqual({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });
    });

    it('should return empty arrays for empty input array', () => {
      const result = categorizeFeatures([], mockCategories);
      expect(result).toEqual({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });
    });

    it('should categorize features by name into actions', () => {
      const items = [
        makeFeature('Action Surge'),
        makeFeature('Second Wind')
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.actions).toHaveLength(2);
      expect(result.actions.map(f => f.name)).toEqual(['Action Surge', 'Second Wind']);
    });

    it('should categorize features by name into bonusActions', () => {
      const items = [
        makeFeature('Cunning Action'),
        makeFeature('Patient Defense')
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.bonusActions).toHaveLength(2);
      expect(result.bonusActions.map(f => f.name)).toEqual(['Cunning Action', 'Patient Defense']);
    });

    it('should categorize features by name into reactions', () => {
      const items = [
        makeFeature('Dodge'),
        makeFeature('Parry')
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.reactions).toHaveLength(2);
      expect(result.reactions.map(f => f.name)).toEqual(['Dodge', 'Parry']);
    });

    it('should categorize features by name into characterAdvancement', () => {
      const items = [
        makeFeature('Ability Score Improvement'),
        makeFeature('Feat')
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.characterAdvancement).toHaveLength(2);
      expect(result.characterAdvancement.map(f => f.name)).toEqual(['Ability Score Improvement', 'Feat']);
    });

    it('should place unrecognized features into specialActions', () => {
      const items = [makeFeature('Unarmored Defense')];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.specialActions).toHaveLength(1);
      expect(result.specialActions[0].name).toBe('Unarmored Defense');
    });

    it('should skip null entries in the items array', () => {
      const items = [
        null,
        makeFeature('Action Surge'),
        null
      ];
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

    it('should preserve description from the configured descriptionField', () => {
      const items = [
        makeFeature('Action Surge', { desc: 'Custom desc field' })
      ];
      const result = categorizeFeatures(items, mockCategories, { descriptionField: 'desc' });
      expect(result.actions[0].description).toBe('Custom desc field');
    });

    it('should preserve description from default description field when not overridden', () => {
      const items = [makeFeature('Action Surge', { description: 'Default desc' })];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.actions[0].description).toBe('Default desc');
    });

    it('should preserve details field in the summary', () => {
      const items = [makeFeature('Action Surge', { details: 'Extra details' })];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.actions[0].details).toBe('Extra details');
    });

    it('should omit description when the feature has no description field', () => {
      const items = [{ name: 'Action Surge' }];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.actions[0].description).toBeUndefined();
    });

    it('should categorize by automation.casting_time when present, overriding name-based categorization', () => {
      const items = [
        // "Second Wind" is in mockCategories.actions by name, but casting_time sends it to bonusActions
        makeFeature('Second Wind', {
          automation: { casting_time: '1 bonus action', type: 'self_healing' }
        })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.actions).toHaveLength(0);
      expect(result.bonusActions).toHaveLength(1);
      expect(result.bonusActions[0].name).toBe('Second Wind');
    });

    it('should support casting_time without the "1 " prefix', () => {
      const items = [
        makeFeature('Action Feature', { automation: { casting_time: 'action' } }),
        makeFeature('Bonus Feature', { automation: { casting_time: 'bonus action' } }),
        makeFeature('Reaction Feature', { automation: { casting_time: 'reaction' } })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.actions[0].name).toBe('Action Feature');
      expect(result.bonusActions[0].name).toBe('Bonus Feature');
      expect(result.reactions[0].name).toBe('Reaction Feature');
    });

    it('should trim whitespace from casting_time before matching', () => {
      const items = [
        makeFeature('Trimmed Feature', {
          automation: { casting_time: '  1 bonus action  ' }
        })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.bonusActions).toHaveLength(1);
      expect(result.bonusActions[0].name).toBe('Trimmed Feature');
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

    it('should deduplicate by name when processing casting_time "passive" entries', () => {
      const items = [
        makeFeature('Racial Trait', {
          description: 'First level',
          automation: { casting_time: 'passive' }
        }),
        makeFeature('Racial Trait', {
          description: 'Higher level',
          automation: { casting_time: 'passive' }
        })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.specialActions).toHaveLength(1);
      expect(result.specialActions[0].description).toBe('First level');
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

    it('should treat null casting_time as absent and fall back to name-based categorization', () => {
      const items = [
        makeFeature('Feature', { automation: { casting_time: null } })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.specialActions).toHaveLength(1);
    });

    it('should handle automation as an array and pick the first item with casting_time', () => {
      const items = [
        makeFeature('Multi-Auto Feature', {
          automation: [
            { casting_time: '1 action', type: 'extra' },
            { casting_time: '1 bonus action', type: 'self_healing' }
          ]
        })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Multi-Auto Feature');
    });

    it('should reverse processing order when reverseOrder is true, keeping the last occurrence', () => {
      const items = [
        makeFeature('Action Surge', { description: 'Level 2' }),
        makeFeature('Action Surge', { description: 'Level 17' })
      ];
      const result = categorizeFeatures(items, mockCategories, { reverseOrder: true });
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].description).toBe('Level 17');
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

    it('should already process highest level first; reverseOrder:true double-reverses', () => {
      // addFeatures already flattens highest-level-first. With reverseOrder:true,
      // categorizeFeatures reverses again, so lowest level comes first and is kept.
      const levels = [
        { features: [makeFeature('Action Surge', { description: 'Level 2' })] },
        { features: [makeFeature('Action Surge', { description: 'Level 17' })] }
      ];
      const result = addFeatures(levels, mockCategories, { reverseOrder: true });
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].description).toBe('Level 2');
    });

    it('should skip levels without features', () => {
      const levels = [
        { features: [makeFeature('Action Surge')] },
        {},
        { features: [makeFeature('Dodge')] }
      ];
      const result = addFeatures(levels, mockCategories);
      expect(result.actions).toHaveLength(1);
      expect(result.reactions).toHaveLength(1);
    });

    it('should handle levels with empty features array', () => {
      const levels = [
        { features: [] },
        { features: [makeFeature('Action Surge')] }
      ];
      const result = addFeatures(levels, mockCategories);
      expect(result.actions).toHaveLength(1);
    });

    it('should handle empty levels array', () => {
      const result = addFeatures([], mockCategories);
      expect(result).toEqual({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });
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

    it('should deduplicate by name, keeping the first occurrence (from base)', () => {
      const base = {
        actions: [makeFeature('Action Surge', { description: 'Base' })],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      };
      const additional = {
        actions: [makeFeature('Action Surge', { description: 'Additional' })],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      };
      const result = mergeCategorizedFeatures(base, additional);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].description).toBe('Base');
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

    it('should preserve order: base items first, then additional items', () => {
      const base = {
        actions: [
          makeFeature('First'),
          makeFeature('Second')
        ],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      };
      const additional = {
        actions: [
          makeFeature('Third'),
          makeFeature('Fourth')
        ],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      };
      const result = mergeCategorizedFeatures(base, additional);
      expect(result.actions.map(f => f.name)).toEqual(['First', 'Second', 'Third', 'Fourth']);
    });

    it('should handle an empty base object', () => {
      const base = {
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      };
      const additional = {
        actions: [makeFeature('Action Surge')],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      };
      const result = mergeCategorizedFeatures(base, additional);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Action Surge');
    });

    it('should handle an empty additional object', () => {
      const base = {
        actions: [makeFeature('Action Surge')],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      };
      const additional = {
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      };
      const result = mergeCategorizedFeatures(base, additional);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Action Surge');
    });

    it('should return all empty arrays when both inputs are empty', () => {
      const base = {
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      };
      const additional = {
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      };
      const result = mergeCategorizedFeatures(base, additional);
      expect(result).toEqual({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });
    });

    it('should deduplicate across base and additional in each category independently', () => {
      const base = {
        actions: [makeFeature('Action Surge')],
        bonusActions: [makeFeature('Cunning Action')],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      };
      const additional = {
        actions: [makeFeature('Action Surge')],
        bonusActions: [makeFeature('Cunning Action')],
        reactions: [makeFeature('Dodge')],
        specialActions: [],
        characterAdvancement: []
      };
      const result = mergeCategorizedFeatures(base, additional);
      expect(result.actions).toHaveLength(1);
      expect(result.bonusActions).toHaveLength(1);
      expect(result.reactions).toHaveLength(1);
    });
  });
});
