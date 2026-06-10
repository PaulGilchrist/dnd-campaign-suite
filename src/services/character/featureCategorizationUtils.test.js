import { describe, it, expect } from 'vitest';
import { categorizeFeatures, mergeCategorizedFeatures } from './featureCategorizationUtils.js';

describe('featureCategorizationUtils', () => {
  describe('categorizeFeatures', () => {
    const mockCategories = {
      featuresToIgnore: ['Proficiency', 'Skill Proficiencies'],
      actions: ['Action Surge', 'Second Wind'],
      bonusActions: ['Cunning Action', 'Patient Defense'],
      reactions: ['Dodge', 'Parry'],
      characterAdvancement: ['Ability Score Improvement', 'Feat']
       };

    it('should categorize actions correctly', () => {
      const items = [
            { name: 'Action Surge', description: 'Take an additional action' },
            { name: 'Second Wind', description: 'Regain hit points' }
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.actions).toHaveLength(2);
      expect(result.actions[0].name).toBe('Action Surge');
      expect(result.actions[0].description).toBe('Take an additional action');
      expect(result.bonusActions).toHaveLength(0);
         });

    it('should categorize bonus actions correctly', () => {
      const items = [
            { name: 'Cunning Action', description: 'Dash, Disengage, or Hide as bonus action' },
            { name: 'Patient Defense', description: 'Dodge as bonus action' }
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.bonusActions).toHaveLength(2);
      expect(result.bonusActions[0].name).toBe('Cunning Action');
         });

    it('should categorize reactions correctly', () => {
      const items = [
            { name: 'Dodge', description: 'Make all attacks against you have disadvantage' },
            { name: 'Parry', description: 'Reduce melee damage' }
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.reactions).toHaveLength(2);
      expect(result.reactions[0].name).toBe('Dodge');
         });

    it('should categorize character advancement correctly', () => {
      const items = [
            { name: 'Ability Score Improvement', description: 'Increase ability score' },
            { name: 'Feat', description: 'Take a feat' }
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.characterAdvancement).toHaveLength(2);
      expect(result.characterAdvancement[0].name).toBe('Ability Score Improvement');
         });

    it('should categorize uncategorized features as special actions', () => {
      const items = [
            { name: 'Unarmored Defense', description: 'Increase AC' }
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.specialActions).toHaveLength(1);
      expect(result.specialActions[0].name).toBe('Unarmored Defense');
         });

    it('should ignore features in featuresToIgnore', () => {
      const items = [
            { name: 'Proficiency', description: 'Increase proficiency' },
            { name: 'Action Surge', description: 'Take an additional action' }
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Action Surge');
      expect(result.specialActions).toHaveLength(0);
         });

    it('should deduplicate features by name', () => {
      const items = [
            { name: 'Action Surge', description: 'First level' },
            { name: 'Action Surge', description: 'Higher level' }
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].description).toBe('First level');
         });

    it('should handle null items', () => {
      const result = categorizeFeatures(null, mockCategories);

      expect(result.actions).toHaveLength(0);
      expect(result.bonusActions).toHaveLength(0);
      expect(result.reactions).toHaveLength(0);
      expect(result.specialActions).toHaveLength(0);
      expect(result.characterAdvancement).toHaveLength(0);
         });

    it('should handle undefined items', () => {
      const result = categorizeFeatures(undefined, mockCategories);

      expect(result.actions).toHaveLength(0);
         });

    it('should handle non-array items', () => {
      const result = categorizeFeatures('not an array', mockCategories);

      expect(result.actions).toHaveLength(0);
         });

    it('should handle empty array', () => {
      const result = categorizeFeatures([], mockCategories);

      expect(result.actions).toHaveLength(0);
      expect(result.bonusActions).toHaveLength(0);
      expect(result.reactions).toHaveLength(0);
      expect(result.specialActions).toHaveLength(0);
      expect(result.characterAdvancement).toHaveLength(0);
         });

    it('should skip null items in array', () => {
      const items = [
            null,
            { name: 'Action Surge', description: 'Take an additional action' },
            null
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Action Surge');
         });

    it('should use descriptionField option', () => {
      const items = [
            { name: 'Action Surge', desc: 'Take an additional action' }
            ];

      const result = categorizeFeatures(items, mockCategories, { descriptionField: 'desc' });

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].description).toBe('Take an additional action');
         });

    it('should use default description field when not specified', () => {
      const items = [
            { name: 'Action Surge', description: 'Take an additional action' }
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].description).toBe('Take an additional action');
         });

    it('should reverse order when reverseOrder is true', () => {
      const items = [
            { name: 'Action Surge', description: 'Level 2 version' },
            { name: 'Action Surge', description: 'Level 17 version' }
            ];

      const result = categorizeFeatures(items, mockCategories, { reverseOrder: true });

      expect(result.actions).toHaveLength(1);
        // With reverse order, should keep the last one (highest level)
      expect(result.actions[0].description).toBe('Level 17 version');
         });

    it('should not reverse order by default', () => {
      const items = [
            { name: 'Action Surge', description: 'Level 2 version' },
            { name: 'Action Surge', description: 'Level 17 version' }
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.actions).toHaveLength(1);
        // Without reverse order, should keep the first one
      expect(result.actions[0].description).toBe('Level 2 version');
         });

    it('should handle items without description', () => {
      const items = [
            { name: 'Action Surge' }
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].description).toBeUndefined();
         });

    it('should include details field in summary', () => {
      const items = [
            { name: 'Action Surge', description: 'Desc', details: 'Extra details' }
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].details).toBe('Extra details');
         });

    it('should categorize features by casting_time on automation', () => {
      const items = [
        { name: 'Action Surge', description: 'Extra action', automation: { casting_time: '1 action', type: 'extra_action' } },
        { name: 'Second Wind', description: 'Heal', automation: { casting_time: '1 bonus action', type: 'self_healing' } },
        { name: 'Slow Fall', description: 'Reduce damage', automation: { casting_time: '1 reaction', type: 'damage_reduction', reaction: true } }
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Action Surge');
      expect(result.bonusActions).toHaveLength(1);
      expect(result.bonusActions[0].name).toBe('Second Wind');
      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0].name).toBe('Slow Fall');
         });

    it('should prefer casting_time over name-based categorization', () => {
      const items = [
        // "Second Wind" is in mockCategories.actions by name, but casting_time should override
        { name: 'Second Wind', description: 'Bonus action heal', automation: { casting_time: '1 bonus action', type: 'self_healing' } }
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.actions).toHaveLength(0);
      expect(result.bonusActions).toHaveLength(1);
      expect(result.bonusActions[0].name).toBe('Second Wind');
         });

    it('should fall back to name-based categorization when no casting_time present', () => {
      const items = [
        { name: 'Second Wind', description: 'Heal' }
            ];

      const result = categorizeFeatures(items, mockCategories);

      // "Second Wind" in mockCategories.actions
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Second Wind');
         });

    it('should categorize features with unknown casting_time as special actions', () => {
      const items = [
        { name: 'Mystery Feature', description: 'Unknown', automation: { casting_time: '1 minute', type: 'ritual' } }
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.specialActions).toHaveLength(1);
      expect(result.specialActions[0].name).toBe('Mystery Feature');
         });

    it('should categorize features with casting_time "passive" as characterAdvancement', () => {
      const items = [
        { name: 'Racial Trait', description: 'Passive ability', automation: { casting_time: 'passive', type: 'racial' } }
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.characterAdvancement).toHaveLength(1);
      expect(result.characterAdvancement[0].name).toBe('Racial Trait');
         });

    it('should deduplicate characterAdvancement by name when casting_time is passive', () => {
      const items = [
        { name: 'Racial Trait', description: 'First level', automation: { casting_time: 'passive' } },
        { name: 'Racial Trait', description: 'Higher level', automation: { casting_time: 'passive' } },
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.characterAdvancement).toHaveLength(1);
      expect(result.characterAdvancement[0].description).toBe('First level');
         });

    it('should prefer casting_time categorization over name-based for characterAdvancement', () => {
      const items = [
        // "Ability Score Improvement" is in mockCategories.characterAdvancement by name,
        // but casting_time should also categorize it there
        { name: 'Ability Score Improvement', description: 'Level 4', automation: { casting_time: 'passive' } },
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.characterAdvancement).toHaveLength(1);
      expect(result.characterAdvancement[0].name).toBe('Ability Score Improvement');
         });

    it('should handle items with automation but no casting_time', () => {
      const items = [
        { name: 'Feature With Automation', description: 'Has automation but no casting_time', automation: { type: 'extra_action' } },
            ];

      const result = categorizeFeatures(items, mockCategories);

      // Falls back to name-based categorization → specialActions
      expect(result.specialActions).toHaveLength(1);
      expect(result.specialActions[0].name).toBe('Feature With Automation');
         });

    it('should handle automation with null casting_time', () => {
      const items = [
        { name: 'Feature', description: 'Test', automation: { casting_time: null } },
            ];

      const result = categorizeFeatures(items, mockCategories);

      // null casting_time is falsy → falls back to name-based
      expect(result.specialActions).toHaveLength(1);
         });

    it('should handle automation with undefined casting_time', () => {
      const items = [
        { name: 'Feature', description: 'Test', automation: {} },
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.specialActions).toHaveLength(1);
         });

    it('should categorize mixed features correctly', () => {
      const items = [
            { name: 'Action Surge', description: 'Action' },
            { name: 'Cunning Action', description: 'Bonus Action' },
            { name: 'Dodge', description: 'Reaction' },
            { name: 'Ability Score Improvement', description: 'Advancement' },
            { name: 'Unarmored Defense', description: 'Special' },
            { name: 'Proficiency', description: 'Ignored' }
            ];

      const result = categorizeFeatures(items, mockCategories);

      expect(result.actions).toHaveLength(1);
      expect(result.bonusActions).toHaveLength(1);
      expect(result.reactions).toHaveLength(1);
      expect(result.characterAdvancement).toHaveLength(1);
      expect(result.specialActions).toHaveLength(1);
         });
       });

  describe('mergeCategorizedFeatures', () => {
    it('should merge two categorized feature objects', () => {
      const base = {
        actions: [{ name: 'Action Surge', description: 'Level 2' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
          };
      const additional = {
        actions: [{ name: 'Second Wind', description: 'Heal' }],
        bonusActions: [{ name: 'Cunning Action', description: 'Dash' }],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
          };

      const result = mergeCategorizedFeatures(base, additional);

      expect(result.actions).toHaveLength(2);
      expect(result.actions[0].name).toBe('Action Surge');
      expect(result.actions[1].name).toBe('Second Wind');
      expect(result.bonusActions).toHaveLength(1);
      expect(result.bonusActions[0].name).toBe('Cunning Action');
         });

    it('should deduplicate by name in each category', () => {
      const base = {
        actions: [{ name: 'Action Surge', description: 'Level 2' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
          };
      const additional = {
        actions: [{ name: 'Action Surge', description: 'Level 17' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
          };

      const result = mergeCategorizedFeatures(base, additional);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Action Surge');
      expect(result.actions[0].description).toBe('Level 2'); // Keeps base version
         });

    it('should merge all categories', () => {
      const base = {
        actions: [{ name: 'Action Surge' }],
        bonusActions: [{ name: 'Second Wind' }],
        reactions: [{ name: 'Dodge' }],
        specialActions: [{ name: 'Unarmored Defense' }],
        characterAdvancement: [{ name: 'ASI' }]
          };
      const additional = {
        actions: [{ name: 'Extra Attack' }],
        bonusActions: [{ name: 'Cunning Action' }],
        reactions: [{ name: 'Parry' }],
        specialActions: [{ name: 'Martial Arts' }],
        characterAdvancement: [{ name: 'Feat' }]
          };

      const result = mergeCategorizedFeatures(base, additional);

      expect(result.actions).toHaveLength(2);
      expect(result.bonusActions).toHaveLength(2);
      expect(result.reactions).toHaveLength(2);
      expect(result.specialActions).toHaveLength(2);
      expect(result.characterAdvancement).toHaveLength(2);
         });

    it('should handle empty base object', () => {
      const base = {
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
          };
      const additional = {
        actions: [{ name: 'Action Surge' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
          };

      const result = mergeCategorizedFeatures(base, additional);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].name).toBe('Action Surge');
         });

    it('should handle empty additional object', () => {
      const base = {
        actions: [{ name: 'Action Surge' }],
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

    it('should handle both empty objects', () => {
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

      expect(result.actions).toHaveLength(0);
      expect(result.bonusActions).toHaveLength(0);
      expect(result.reactions).toHaveLength(0);
      expect(result.specialActions).toHaveLength(0);
      expect(result.characterAdvancement).toHaveLength(0);
         });

    it('should preserve order from base then additional', () => {
      const base = {
        actions: [{ name: 'First' }, { name: 'Second' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
          };
      const additional = {
        actions: [{ name: 'Third' }, { name: 'Fourth' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
          };

      const result = mergeCategorizedFeatures(base, additional);

      expect(result.actions).toHaveLength(4);
      expect(result.actions[0].name).toBe('First');
      expect(result.actions[1].name).toBe('Second');
      expect(result.actions[2].name).toBe('Third');
      expect(result.actions[3].name).toBe('Fourth');
         });

    it('should keep base version when duplicate exists', () => {
      const base = {
        actions: [{ name: 'Action Surge', description: 'Base' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
          };
      const additional = {
        actions: [{ name: 'Action Surge', description: 'Additional' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
          };

      const result = mergeCategorizedFeatures(base, additional);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].description).toBe('Base');
         });
       });
});
