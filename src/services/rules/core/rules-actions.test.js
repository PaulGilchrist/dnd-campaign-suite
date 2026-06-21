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

    it('should combine bonusActions from playerStats, features, and traits', () => {
      const playerStats = makePlayerStats({
        bonusActions: [{ name: 'Cunning Action' }],
      });

      const [, bonusActions] = rules.getActions(playerStats);

      expect(bonusActions).toHaveLength(2);
      expect(bonusActions).toContainEqual({ name: 'Cunning Action' });
      expect(bonusActions).toContainEqual({ name: 'Second Wind' });
    });

    it('should combine reactions from playerStats, features, and traits', () => {
      const playerStats = makePlayerStats({
        reactions: [{ name: 'Reaction Attack' }],
      });

      const [,, reactions] = rules.getActions(playerStats);

      expect(reactions).toHaveLength(2);
      expect(reactions).toContainEqual({ name: 'Reaction Attack' });
      expect(reactions).toContainEqual({ name: 'Opportunity Attack' });
    });

    it('should combine specialActions from playerStats, features, and traits', () => {
      const playerStats = makePlayerStats({
        specialActions: [{ name: 'Bonus Special' }],
      });

      const [,, , specialActions] = rules.getActions(playerStats);

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

    it('should sort actions alphabetically by name', () => {
      const playerStats = makePlayerStats({
        actions: [{ name: 'Zombie Strike' }, { name: 'Alpha Strike' }],
      });

      const [actions] = rules.getActions(playerStats);

      const names = actions.map((a) => a.name);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    });

    it('should sort bonusActions alphabetically', () => {
      const playerStats = makePlayerStats({
        bonusActions: [{ name: 'Zoe Ability' }, { name: 'Alpha Move' }],
      });

      const [, bonusActions] = rules.getActions(playerStats);

      const names = bonusActions.map((a) => a.name);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    });

    it('should sort reactions alphabetically', () => {
      const playerStats = makePlayerStats({
        reactions: [{ name: 'Zephyr' }, { name: 'Alpha' }],
      });

      const [,, reactions] = rules.getActions(playerStats);

      const names = reactions.map((a) => a.name);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    });

    it('should sort specialActions alphabetically', () => {
      const playerStats = makePlayerStats({
        specialActions: [{ name: 'Zephyr' }, { name: 'Alpha' }],
      });

      const [,, , specialActions] = rules.getActions(playerStats);

      const names = specialActions.map((a) => a.name);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
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

    it('should deduplicate by name only, keeping first occurrence properties', () => {
      classRules.getFeatures.mockReturnValue({
        actions: [{ name: 'Attack', description: 'From features' }],
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

      const playerStats = makePlayerStats({
        actions: [{ name: 'Attack', description: 'From player' }],
      });

      const [actions] = rules.getActions(playerStats);

      expect(actions).toHaveLength(1);
      // uniqBy keeps the first occurrence, which is playerStats.actions
      expect(actions[0].description).toBe('From player');
    });

    it('should handle features with no actions but other action types', () => {
      classRules.getFeatures.mockReturnValue({
        actions: [],
        bonusActions: [{ name: 'Feature Bonus' }],
        reactions: [{ name: 'Feature Reaction' }],
        specialActions: [{ name: 'Feature Special' }],
        characterAdvancement: [{ name: 'Feature Advancement' }],
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
      expect(bonusActions).toContainEqual({ name: 'Feature Bonus' });
      expect(reactions).toContainEqual({ name: 'Feature Reaction' });
      expect(specialActions).toContainEqual({ name: 'Feature Special' });
      expect(characterAdvancement).toContainEqual({ name: 'Feature Advancement' });
    });

    it('should handle traits with no actions but other action types', () => {
      raceRules.getTraits.mockReturnValue({
        actions: [],
        bonusActions: [{ name: 'Trait Bonus' }],
        reactions: [{ name: 'Trait Reaction' }],
        specialActions: [{ name: 'Trait Special' }],
        characterAdvancement: [{ name: 'Trait Advancement' }],
      });

      classRules.getFeatures.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: [],
      });

      const playerStats = makePlayerStats();

      const [actions, bonusActions, reactions, specialActions, characterAdvancement] = rules.getActions(playerStats);

      expect(actions).toEqual([]);
      expect(bonusActions).toContainEqual({ name: 'Trait Bonus' });
      expect(reactions).toContainEqual({ name: 'Trait Reaction' });
      expect(specialActions).toContainEqual({ name: 'Trait Special' });
      expect(characterAdvancement).toContainEqual({ name: 'Trait Advancement' });
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

    it('should include magicActions in 2024 mode', () => {
      const playerStats = makePlayerStats({
        rules: '2024',
        magicActions: [{ name: 'Magic Blast' }],
      });

      const [actions] = rules.getActions(playerStats);

      expect(actions).toContainEqual({ name: 'Magic Blast' });
    });

    it('should include utilizeActions in 2024 mode', () => {
      const playerStats = makePlayerStats({
        rules: '2024',
        utilizeActions: [{ name: 'Utilize Trap' }],
      });

      const [actions] = rules.getActions(playerStats);

      expect(actions).toContainEqual({ name: 'Utilize Trap' });
    });

    it('should include craftActions in 2024 mode', () => {
      const playerStats = makePlayerStats({
        rules: '2024',
        craftActions: [{ name: 'Craft Potion' }],
      });

      const [actions] = rules.getActions(playerStats);

      expect(actions).toContainEqual({ name: 'Craft Potion' });
    });

    it('should include magicSpecialActions in 2024 mode', () => {
      const playerStats = makePlayerStats({
        rules: '2024',
        specialActions: [],
        magicSpecialActions: [{ name: 'Magic Special' }],
      });

      const [,, , specialActions] = rules.getActions(playerStats);

      expect(specialActions).toContainEqual({ name: 'Magic Special' });
    });

    it('should include utilizeSpecialActions in 2024 mode', () => {
      const playerStats = makePlayerStats({
        rules: '2024',
        specialActions: [],
        utilizeSpecialActions: [{ name: 'Utilize Special' }],
      });

      const [,, , specialActions] = rules.getActions(playerStats);

      expect(specialActions).toContainEqual({ name: 'Utilize Special' });
    });

    it('should include craftSpecialActions in 2024 mode', () => {
      const playerStats = makePlayerStats({
        rules: '2024',
        specialActions: [],
        craftSpecialActions: [{ name: 'Craft Special' }],
      });

      const [,, , specialActions] = rules.getActions(playerStats);

      expect(specialActions).toContainEqual({ name: 'Craft Special' });
    });

    it('should normalize string actions to objects in 2024 mode', () => {
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
      });

      const [actions] = rules.getActions(playerStats);

      expect(actions).toContainEqual({ name: 'String Action', description: '', details: null });
    });

    it('should normalize string specialActions to objects in 2024 mode', () => {
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
        specialActions: ['Special String Action'],
      });

      const [,, , specialActions] = rules.getActions(playerStats);

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

    it('should handle missing optional action arrays in 2024 mode', () => {
      const playerStats = makePlayerStats({
        rules: '2024',
        actions: ['Only Action'],
        // magicActions, utilizeActions, craftActions are undefined
      });

      const [actions] = rules.getActions(playerStats);

      expect(actions).toContainEqual({ name: 'Only Action', description: '', details: null });
      expect(actions).not.toContainEqual(expect.objectContaining({ name: 'Magic Action' }));
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

    it('should not include magicActions in 5e mode', () => {
      const playerStats = makePlayerStats({
        magicActions: [{ name: 'Magic Action' }],
      });

      const [actions] = rules.getActions(playerStats);

      expect(actions).not.toContainEqual(expect.objectContaining({ name: 'Magic Action' }));
    });

    it('should not include utilizeActions in 5e mode', () => {
      const playerStats = makePlayerStats({
        utilizeActions: [{ name: 'Utilize Action' }],
      });

      const [actions] = rules.getActions(playerStats);

      expect(actions).not.toContainEqual(expect.objectContaining({ name: 'Utilize Action' }));
    });

    it('should not include craftActions in 5e mode', () => {
      const playerStats = makePlayerStats({
        craftActions: [{ name: 'Craft Action' }],
      });

      const [actions] = rules.getActions(playerStats);

      expect(actions).not.toContainEqual(expect.objectContaining({ name: 'Craft Action' }));
    });

    it('should not include magicSpecialActions in 5e mode', () => {
      const playerStats = makePlayerStats({
        magicSpecialActions: [{ name: 'Magic Special Action' }],
      });

      const [,, , specialActions] = rules.getActions(playerStats);

      expect(specialActions).not.toContainEqual(expect.objectContaining({ name: 'Magic Special Action' }));
    });
  });
});
