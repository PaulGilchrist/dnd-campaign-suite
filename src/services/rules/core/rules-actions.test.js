// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
  loadPassiveSkills: vi.fn(),
  loadFeatData: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../character/classRules.js', () => ({
  default: {
    getClass: vi.fn(),
    getFeatures: vi.fn(),
    getHighestSubclassLevel: vi.fn(),
  },
}));

vi.mock('../../character/race-rules/index.js', () => ({
  rules5e: {
    getRace: vi.fn(),
    getRacialBonus: vi.fn(),
    getImmunities: vi.fn(),
    getResistances: vi.fn(),
    getSenses: vi.fn(),
    getTraits: vi.fn(),
  },
  rules2024: {
    getRace: vi.fn(),
    getSenses: vi.fn(),
    getTraits: vi.fn(),
  },
}));

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getClass: vi.fn(),
    getFeatures: vi.fn(),
    getHighestSubclassLevel: vi.fn(),
  },
}));

import rules from '../rules.js';
import classRules from '../../character/classRules.js';
import classRules2024 from '../../character/classRules2024.js';
import { rules5e as raceRules, rules2024 as raceRules2024 } from '../../character/race-rules/index.js';

const makePlayerStats = (overrides = {}) => ({
  name: 'TestCharacter',
  actions: [],
  bonusActions: [],
  reactions: [],
  specialActions: [],
  ...overrides,
});

describe('rules', () => {
  describe('getActions', () => {
    beforeEach(() => {
      classRules.getFeatures.mockReturnValue({
        actions: [{ name: 'Action Surge' }],
        bonusActions: [{ name: 'Second Wind' }],
        reactions: [{ name: 'Opportunity Attack' }],
        specialActions: [{ name: 'Rage' }],
        characterAdvancement: [{ name: 'Ability Score Improvement' }],
      });

      raceRules.getTraits.mockReturnValue({
        actions: [{ name: 'Brave' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });
    });

    it('should combine actions from playerStats, features, and traits', () => {
      const playerStats = makePlayerStats({
        actions: [{ name: 'Attack' }],
      });

      const [actions] = rules.getActions(playerStats);

      expect(actions).toHaveLength(3);
      expect(actions).toContainEqual({ name: 'Attack' });
      expect(actions).toContainEqual({ name: 'Action Surge' });
      expect(actions).toContainEqual({ name: 'Brave' });
    });

    it('should combine actions from all sources for each action type', () => {
      const playerStats = makePlayerStats({
        actions: [{ name: 'Attack' }],
        bonusActions: [{ name: 'Cunning Action' }],
        reactions: [{ name: 'Reaction Attack' }],
        specialActions: [{ name: 'Bonus Special' }],
      });

      const [actions, bonusActions, reactions, specialActions] = rules.getActions(playerStats);

      expect(actions).toHaveLength(3);
      expect(actions).toContainEqual({ name: 'Attack' });
      expect(actions).toContainEqual({ name: 'Action Surge' });
      expect(actions).toContainEqual({ name: 'Brave' });

      expect(bonusActions).toHaveLength(2);
      expect(bonusActions).toContainEqual({ name: 'Cunning Action' });
      expect(bonusActions).toContainEqual({ name: 'Second Wind' });

      expect(reactions).toHaveLength(2);
      expect(reactions).toContainEqual({ name: 'Reaction Attack' });
      expect(reactions).toContainEqual({ name: 'Opportunity Attack' });

      expect(specialActions).toHaveLength(2);
      expect(specialActions).toContainEqual({ name: 'Bonus Special' });
      expect(specialActions).toContainEqual({ name: 'Rage' });
    });

    it('should combine characterAdvancement from features and traits', () => {
      const playerStats = makePlayerStats();

      const [,, , , characterAdvancement] = rules.getActions(playerStats);

      expect(characterAdvancement).toHaveLength(1);
      expect(characterAdvancement).toContainEqual({ name: 'Ability Score Improvement' });
    });

    it('should deduplicate actions by name across all sources', () => {
      classRules.getFeatures.mockReturnValue({
        actions: [{ name: 'Attack' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });

      raceRules.getTraits.mockReturnValue({
        actions: [{ name: 'Attack' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });

      const playerStats = makePlayerStats({
        actions: [{ name: 'Attack' }],
      });

      const [actions] = rules.getActions(playerStats);

      expect(actions).toHaveLength(1);
      expect(actions[0].name).toBe('Attack');
    });

    it('should sort actions alphabetically by name for each action type', () => {
      const playerStats = makePlayerStats({
        actions: [{ name: 'Zombie Strike' }, { name: 'Alpha Strike' }],
        bonusActions: [{ name: 'Zoe Ability' }, { name: 'Alpha Move' }],
        reactions: [{ name: 'Zephyr' }, { name: 'Alpha' }],
        specialActions: [{ name: 'Zephyr' }, { name: 'Alpha' }],
      });

      const [actions, bonusActions, reactions, specialActions] = rules.getActions(playerStats);

      const checkSorted = (arr) => {
        const names = arr.map((a) => a.name);
        const sorted = [...names].sort((a, b) => a.localeCompare(b));
        expect(names).toEqual(sorted);
      };

      checkSorted(actions);
      checkSorted(bonusActions);
      checkSorted(reactions);
      checkSorted(specialActions);
    });

    it('should preserve non-name properties when combining actions', () => {
      const playerStats = makePlayerStats({
        actions: [{ name: 'Attack', description: 'Make a melee weapon attack', details: { damage: '1d8' } }],
      });

      const [actions] = rules.getActions(playerStats);

      expect(actions).toContainEqual({
        name: 'Attack',
        description: 'Make a melee weapon attack',
        details: { damage: '1d8' },
      });
    });

    it('should handle features or traits with no actions but other action types', () => {
      classRules.getFeatures.mockReturnValue({
        actions: [],
        bonusActions: [{ name: 'Feature Bonus' }],
        reactions: [{ name: 'Feature Reaction' }],
        specialActions: [{ name: 'Feature Special' }],
        characterAdvancement: [{ name: 'Feature Advancement' }],
      });

      raceRules.getTraits.mockReturnValue({
        actions: [],
        bonusActions: [{ name: 'Trait Bonus' }],
        reactions: [{ name: 'Trait Reaction' }],
        specialActions: [{ name: 'Trait Special' }],
        characterAdvancement: [{ name: 'Trait Advancement' }],
      });

      const playerStats = makePlayerStats();

      const [actions, bonusActions, reactions, specialActions, characterAdvancement] = rules.getActions(playerStats);

      expect(actions).toEqual([]);
      expect(bonusActions).toContainEqual({ name: 'Feature Bonus' });
      expect(bonusActions).toContainEqual({ name: 'Trait Bonus' });
      expect(reactions).toContainEqual({ name: 'Feature Reaction' });
      expect(reactions).toContainEqual({ name: 'Trait Reaction' });
      expect(specialActions).toContainEqual({ name: 'Feature Special' });
      expect(specialActions).toContainEqual({ name: 'Trait Special' });
      expect(characterAdvancement).toContainEqual({ name: 'Feature Advancement' });
      expect(characterAdvancement).toContainEqual({ name: 'Trait Advancement' });
    });

    it('should return all five arrays even when all inputs are empty', () => {
      classRules.getFeatures.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });

      raceRules.getTraits.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });

      const playerStats = makePlayerStats();

      const [actions, bonusActions, reactions, specialActions, characterAdvancement] = rules.getActions(playerStats);

      expect(actions).toEqual([]);
      expect(bonusActions).toEqual([]);
      expect(reactions).toEqual([]);
      expect(specialActions).toEqual([]);
      expect(characterAdvancement).toEqual([]);
    });
  });

  describe('2024 ruleset dispatch / getActions', () => {
    beforeEach(() => {
      vi.clearAllMocks();

      classRules2024.getFeatures.mockReturnValue({
        actions: [{ name: 'Feature Action' }],
        bonusActions: [{ name: 'Feature Bonus' }],
        reactions: [{ name: 'Feature Reaction' }],
        specialActions: [{ name: 'Feature Special' }],
        characterAdvancement: [{ name: 'Feature Advancement' }],
      });

      raceRules2024.getTraits.mockReturnValue({
        actions: [{ name: 'Trait Action' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });
    });

    it('should include 2024-specific action types in the result', () => {
      const playerStats = makePlayerStats({
        rules: '2024',
        actions: [{ name: 'Base Action' }],
        magicActions: [{ name: 'Magic Blast' }],
        utilizeActions: [{ name: 'Utilize Trap' }],
        craftActions: [{ name: 'Craft Potion' }],
        magicSpecialActions: [{ name: 'Magic Special' }],
        utilizeSpecialActions: [{ name: 'Utilize Special' }],
        craftSpecialActions: [{ name: 'Craft Special' }],
      });

      const [actions, , , specialActions] = rules.getActions(playerStats);

      expect(actions).toContainEqual({ name: 'Base Action' });
      expect(actions).toContainEqual({ name: 'Magic Blast' });
      expect(actions).toContainEqual({ name: 'Utilize Trap' });
      expect(actions).toContainEqual({ name: 'Craft Potion' });
      expect(specialActions).toContainEqual({ name: 'Magic Special' });
      expect(specialActions).toContainEqual({ name: 'Utilize Special' });
      expect(specialActions).toContainEqual({ name: 'Craft Special' });
    });

    it('should normalize string actions and specialActions to objects in 2024 mode', () => {
      classRules2024.getFeatures.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });
      raceRules2024.getTraits.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });

      const playerStats = makePlayerStats({
        rules: '2024',
        actions: ['String Action'],
        specialActions: ['Special String Action'],
      });

      const [actions, , , specialActions] = rules.getActions(playerStats);

      expect(actions).toContainEqual({ name: 'String Action', description: '', details: null });
      expect(specialActions).toContainEqual({ name: 'Special String Action', description: '', details: null });
    });

    it('should handle mixed string and object actions in 2024 mode', () => {
      classRules2024.getFeatures.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });
      raceRules2024.getTraits.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });

      const playerStats = makePlayerStats({
        rules: '2024',
        actions: ['String Action', { name: 'Object Action', description: 'obj desc' }],
      });

      const [actions] = rules.getActions(playerStats);

      expect(actions).toContainEqual({ name: 'String Action', description: '', details: null });
      expect(actions).toContainEqual({ name: 'Object Action', description: 'obj desc' });
    });

    it('should deduplicate in 2024 mode across all action sources', () => {
      classRules2024.getFeatures.mockReturnValue({
        actions: [{ name: 'Attack' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });
      raceRules2024.getTraits.mockReturnValue({
        actions: [{ name: 'Attack' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });

      const playerStats = makePlayerStats({
        rules: '2024',
        actions: [{ name: 'Attack' }],
        magicActions: [{ name: 'Attack' }],
        utilizeActions: [{ name: 'Attack' }],
        craftActions: [{ name: 'Attack' }],
      });

      const [actions] = rules.getActions(playerStats);

      expect(actions).toHaveLength(1);
    });

    it('should sort 2024 actions alphabetically including magic/utilize/craft', () => {
      const playerStats = makePlayerStats({
        rules: '2024',
        actions: [{ name: 'Zebra' }],
        magicActions: [{ name: 'Alpha Magic' }],
        utilizeActions: [{ name: 'Beta Use' }],
        craftActions: [{ name: 'Gamma Craft' }],
      });

      const [actions] = rules.getActions(playerStats);

      const names = actions.map((a) => a.name);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    });
  });

  describe('5e mode excludes 2024-specific action types', () => {
    beforeEach(() => {
      vi.clearAllMocks();

      classRules.getFeatures.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });

      raceRules.getTraits.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });
    });

    it('should not include any 2024-specific action types in 5e mode', () => {
      const playerStats = makePlayerStats({
        magicActions: [{ name: 'Magic Action' }],
        utilizeActions: [{ name: 'Utilize Action' }],
        craftActions: [{ name: 'Craft Action' }],
        magicSpecialActions: [{ name: 'Magic Special Action' }],
      });

      const [actions, , , specialActions] = rules.getActions(playerStats);

      expect(actions).not.toContainEqual(expect.objectContaining({ name: 'Magic Action' }));
      expect(actions).not.toContainEqual(expect.objectContaining({ name: 'Utilize Action' }));
      expect(actions).not.toContainEqual(expect.objectContaining({ name: 'Craft Action' }));
      expect(specialActions).not.toContainEqual(expect.objectContaining({ name: 'Magic Special Action' }));
    });
  });
});
