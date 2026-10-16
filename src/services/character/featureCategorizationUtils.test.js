import { describe, it, expect } from 'vitest';
import {
  categorizeFeatures,
  mergeCategorizedFeatures,
  addFeatures
} from './featureCategorizationUtils.js';

// Pure-logic lane: canned fixtures pin the categorizer's routing tables,
// not data fidelity (disk anchors live in featureCategories2024/5e tests).
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
    it('returns the exact empty envelope for null/undefined/non-array items and for arrays of null entries', () => {
      expect(categorizeFeatures(null, mockCategories)).toStrictEqual(emptyResult);
      expect(categorizeFeatures(undefined, mockCategories)).toStrictEqual(emptyResult);
      expect(categorizeFeatures('not an array', mockCategories)).toStrictEqual(emptyResult);
      expect(categorizeFeatures([null, undefined], mockCategories)).toStrictEqual(emptyResult);
    });

    it('routes names through the category lists and emits the exact item envelope', () => {
      const items = [
        makeFeature('Action Surge', { level: 2 }),
        makeFeature('Cunning Action'),
        makeFeature('Dodge'),
        makeFeature('Ability Score Improvement')
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.actions.map(f => f.name)).toEqual(['Action Surge']);
      expect(result.bonusActions.map(f => f.name)).toEqual(['Cunning Action']);
      expect(result.reactions.map(f => f.name)).toEqual(['Dodge']);
      expect(result.characterAdvancement.map(f => f.name)).toEqual(['Ability Score Improvement']);
      expect(result.specialActions).toHaveLength(0);
      // Consumer contract (classRules/rules-actions): buildItemSummary keys,
      // level defaulted to null, missing fields present-but-undefined.
      expect(result.actions[0]).toStrictEqual({
        name: 'Action Surge',
        level: 2,
        description: 'Test description',
        details: undefined,
        automation: undefined
      });
    });

    it('drops unrecognized names AND featuresToIgnore entries into specialActions', () => {
      // featuresToIgnore is a consumer-side filter — categorizeFeatures never
      // reads it, so its entries land in specialActions like any unknown name.
      const items = [
        makeFeature('Unarmored Defense'),
        makeFeature('Proficiency'),
        makeFeature('Skill Proficiencies')
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.specialActions.map(f => f.name)).toEqual(['Unarmored Defense', 'Proficiency', 'Skill Proficiencies']);
    });

    it('dedupes by name per-category (first occurrence wins) — per-target, NOT global', () => {
      const dupes = [
        makeFeature('Action Surge', { description: 'Level 2' }),
        makeFeature('Action Surge', { description: 'Level 17' })
      ];
      const result = categorizeFeatures(dupes, mockCategories);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].description).toBe('Level 2');

      // SYNTHETIC: same name reaching two DIFFERENT buckets (first via
      // casting_time, second via name fallback) is kept in both — the
      // pushUnique guard is scoped to each target list.
      const rerouted = [
        makeFeature('Synthetic Duo', { automation: { casting_time: '1 action' } }),
        makeFeature('Synthetic Duo')
      ];
      const reroutedResult = categorizeFeatures(rerouted, mockCategories);
      expect(reroutedResult.actions.map(f => f.name)).toEqual(['Synthetic Duo']);
      expect(reroutedResult.specialActions.map(f => f.name)).toEqual(['Synthetic Duo']);
    });

    it('uses a custom descriptionField and omits description when absent', () => {
      const custom = [makeFeature('Action Surge', { desc: 'Custom desc field' })];
      const resultCustom = categorizeFeatures(custom, mockCategories, { descriptionField: 'desc' });
      expect(resultCustom.actions[0].description).toBe('Custom desc field');

      const noDesc = [{ name: 'Action Surge' }];
      const resultNoDesc = categorizeFeatures(noDesc, mockCategories);
      expect(resultNoDesc.actions[0].description).toBeUndefined();
    });

    it('reroutes via automation.casting_time, falling back to name lists only when casting_time is absent', () => {
      const items = [
        // casting_time wins over the name bucket ('Second Wind' is in actions, lands in bonusActions)
        makeFeature('Second Wind', { automation: { casting_time: '1 bonus action', type: 'self_healing' } }),
        // automation WITHOUT casting_time → name-based fallback still applies
        makeFeature('Action Surge', { automation: { type: 'extra_action' } }),
        // no name-list membership, no casting_time → specialActions
        makeFeature('Feature With Automation', { automation: { type: 'extra_action' } })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.actions.map(f => f.name)).toEqual(['Action Surge']);
      expect(result.bonusActions.map(f => f.name)).toEqual(['Second Wind']);
      expect(result.specialActions.map(f => f.name)).toEqual(['Feature With Automation']);
    });

    // Normalization vocabulary is pinned by castingTimeUtils.test.js —
    // these pins only cover the categorizer's interaction with it.
    it('routes bare and whitespace-padded casting times to the right bucket', () => {
      const items = [
        makeFeature('Action Feature', { automation: { casting_time: 'action' } }),
        makeFeature('Bonus Feature', { automation: { casting_time: 'bonus action' } }),
        makeFeature('Reaction Feature', { automation: { casting_time: 'reaction' } }),
        makeFeature('Trimmed Feature', { automation: { casting_time: '  1 action  ' } })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.actions.map(f => f.name)).toEqual(['Action Feature', 'Trimmed Feature']);
      expect(result.bonusActions.map(f => f.name)).toEqual(['Bonus Feature']);
      expect(result.reactions.map(f => f.name)).toEqual(['Reaction Feature']);
    });

    it('categorizes Illusory Reality (CLA-179) into bonusActions, not specialActions', () => {
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

    it('routes unmapped casting times to specialActions — passive too, unless the name is in characterAdvancement', () => {
      const items = [
        makeFeature('Ritual Feature', { automation: { casting_time: '1 minute' } }),
        makeFeature('Racial Trait', { automation: { casting_time: 'passive' } }),
        makeFeature('Feat', { automation: { casting_time: 'passive' } })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.specialActions.map(f => f.name)).toEqual(['Ritual Feature', 'Racial Trait']);
      expect(result.characterAdvancement.map(f => f.name)).toEqual(['Feat']);
    });

    it('prefers item-level casting_time over automation.casting_time and scans automation arrays for reactions', () => {
      const items = [
        // SYNTHETIC boundary pair: item-level casting_time wins over automation's
        makeFeature('Item Wins', { casting_time: '1 action', automation: { casting_time: '1 bonus action' } }),
        makeFeature('Reaction From Automation Array', {
          automation: [{ casting_time: 'reaction' }, { casting_time: 'action' }]
        })
      ];
      const result = categorizeFeatures(items, mockCategories);
      expect(result.actions.map(f => f.name)).toEqual(['Item Wins']);
      expect(result.bonusActions).toHaveLength(0);
      expect(result.reactions.map(f => f.name)).toEqual(['Reaction From Automation Array']);
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

    it('applies exact routing precedence — SYNTHETIC probes pinning source L72-73 and L93-96', () => {
      // SYNTHETIC: name in BOTH characterAdvancement and actions lists.
      // Name-path fallback checks characterAdvancement first (L93 before L94).
      const dualListCategories = {
        ...mockCategories,
        actions: [...mockCategories.actions, 'Synthetic Multi-List'],
        characterAdvancement: [...mockCategories.characterAdvancement, 'Synthetic Multi-List']
      };
      const items = [
        makeFeature('Synthetic Multi-List'),
        // SYNTHETIC: passive item-level time but a reaction inside the
        // automation array — hasReaction beats passive (L72 before L73).
        makeFeature('Synthetic Passive Reaction', {
          casting_time: 'passive',
          automation: [{ casting_time: '1 reaction' }]
        })
      ];
      const result = categorizeFeatures(items, dualListCategories);
      expect(result.characterAdvancement.map(f => f.name)).toEqual(['Synthetic Multi-List']);
      expect(result.actions).toHaveLength(0);
      expect(result.reactions.map(f => f.name)).toEqual(['Synthetic Passive Reaction']);
      expect(result.specialActions).toHaveLength(0);
    });
  });

  describe('addFeatures', () => {
    it('flattens features from all levels and categorizes them', () => {
      const levels = [
        { features: [makeFeature('Action Surge')] },
        { features: [makeFeature('Cunning Action')] },
        { features: [makeFeature('Dodge')] }
      ];
      const result = addFeatures(levels, mockCategories);
      expect(result.actions.map(f => f.name)).toEqual(['Action Surge']);
      expect(result.bonusActions.map(f => f.name)).toEqual(['Cunning Action']);
      expect(result.reactions.map(f => f.name)).toEqual(['Dodge']);
    });

    it('skips levels without features and handles empty features arrays', () => {
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

    it('accumulates highest-level-first by default; reverseOrder restores lowest-level-first', () => {
      // classRules.js flattens classLevels last-to-first, so the DEFAULT
      // dedupe keeps the HIGHEST level description (real consumer path).
      const levels = [
        { features: [makeFeature('Action Surge', { description: 'Level 2' })] },
        { features: [makeFeature('Action Surge', { description: 'Level 17' })] }
      ];
      expect(addFeatures(levels, mockCategories).actions[0].description).toBe('Level 17');
      // reverseOrder:true reverses the flattening again, keeping Level 2.
      const result = addFeatures(levels, mockCategories, { reverseOrder: true });
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].description).toBe('Level 2');
    });
  });

  describe('mergeCategorizedFeatures', () => {
    it('concatenates all five categories base-first, passes objects through by identity, and mutates neither input', () => {
      const baseAction = makeFeature('Action Surge');
      const base = {
        actions: [baseAction, makeFeature('Second')],
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
      expect(result.actions.map(f => f.name)).toEqual(['Action Surge', 'Second', 'Extra Attack']);
      expect(result.bonusActions.map(f => f.name)).toEqual(['Second Wind', 'Cunning Action']);
      expect(result.reactions.map(f => f.name)).toEqual(['Dodge', 'Parry']);
      expect(result.specialActions.map(f => f.name)).toEqual(['Unarmored Defense', 'Martial Arts']);
      expect(result.characterAdvancement.map(f => f.name)).toEqual(['ASI', 'Feat']);
      // MERGE-vs-replace discipline: summaries are passed through untouched.
      expect(result.actions[0]).toBe(baseAction);
      expect(base.actions).toHaveLength(2);
      expect(additional.actions).toHaveLength(1);
    });

    it('dedupes by name across base and additional, keeping the base occurrence', () => {
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

    it('throws on missing category arrays while categorizeFeatures skips missing categories', () => {
      // Honest asymmetry: merge spreads every key unguarded (TypeError),
      // while categorizeFeatures destructures with defaults — the live
      // rules-actions.js path passes `cr.featureCategories || {}`.
      expect(() => mergeCategorizedFeatures({}, {})).toThrow(TypeError);
      const result = categorizeFeatures([makeFeature('Anything')], {});
      expect(result.specialActions.map(f => f.name)).toEqual(['Anything']);
      expect(result.actions).toHaveLength(0);
    });
  });
});
