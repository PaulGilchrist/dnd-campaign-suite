import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
  loadPassiveSkills: vi.fn(),
  loadFeatData: vi.fn().mockResolvedValue([])
}));

vi.mock('../../character/classRules.js', () => ({
  default: {
    getClass: vi.fn(),
    getFeatures: vi.fn(),
    getHighestSubclassLevel: vi.fn()
  }
}));

vi.mock('../../character/race-rules/index.js', () => ({
  rules5e: {
    getRace: vi.fn(),
    getRacialBonus: vi.fn(),
    getImmunities: vi.fn(),
    getResistances: vi.fn(),
    getSenses: vi.fn(),
    getTraits: vi.fn()
  },
  rules2024: {
    getRace: vi.fn(),
    getSenses: vi.fn(),
    getTraits: vi.fn()
  }
}));

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getClass: vi.fn(),
    getFeatures: vi.fn(),
    getHighestSubclassLevel: vi.fn()
  }
}));

import rules from '../rules.js';
import classRules from '../../character/classRules.js';
import classRules2024 from '../../character/classRules2024.js';
import { rules5e as raceRules, rules2024 as raceRules2024 } from '../../character/race-rules/index.js';

describe('rules', () => {
  describe('getActions', () => {
    beforeEach(() => {
      classRules.getFeatures.mockReturnValue({
        actions: [{ name: 'Action Surge' }],
        bonusActions: [{ name: 'Second Wind' }],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });

      raceRules.getTraits.mockReturnValue({
        actions: [{ name: 'Brave' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });
    });

    it('should combine actions from playerStats, features, and traits', () => {
      const playerStats = {
        actions: [{ name: 'Attack' }],
        bonusActions: [],
        reactions: [],
        specialActions: []
      };

      const [actions] = rules.getActions(playerStats);

      expect(actions).toContainEqual(expect.objectContaining({ name: 'Attack' }));
      expect(actions).toContainEqual(expect.objectContaining({ name: 'Action Surge' }));
      expect(actions).toContainEqual(expect.objectContaining({ name: 'Brave' }));
    });

    it('should deduplicate actions by name', () => {
      classRules.getFeatures.mockReturnValue({
        actions: [{ name: 'Attack' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });

      const playerStats = {
        actions: [{ name: 'Attack' }],
        bonusActions: [],
        reactions: [],
        specialActions: []
      };

      const [actions] = rules.getActions(playerStats);

      expect(actions.filter(a => a.name === 'Attack')).toHaveLength(1);
    });

    it('should return sorted actions', () => {
      const playerStats = {
        actions: [{ name: 'Zebra Attack' }],
        bonusActions: [],
        reactions: [],
        specialActions: []
      };

      const [actions] = rules.getActions(playerStats);

      expect(actions[0].name).toBe('Action Surge');
    });

    it('should handle missing playerStats actions', () => {
      const playerStats = {
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: []
      };

      const [actions, bonusActions, reactions, specialActions, characterAdvancement] = rules.getActions(playerStats);

      expect(actions).toBeDefined();
      expect(bonusActions).toBeDefined();
      expect(reactions).toBeDefined();
      expect(specialActions).toBeDefined();
      expect(characterAdvancement).toBeDefined();
    });
  });

  describe('2024 ruleset dispatch / getActions', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should include magic/utilize/craft actions in 2024 mode', () => {
      classRules2024.getFeatures.mockReturnValue({
        actions: [{ name: 'Feature Action' }],
        bonusActions: [{ name: 'Feature Bonus' }],
        reactions: [{ name: 'Feature Reaction' }],
        specialActions: [],
        characterAdvancement: []
      });
      raceRules2024.getTraits.mockReturnValue({
        actions: [{ name: 'Trait Action' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });
      const playerStats = {
        rules: '2024',
        actions: ['String Action'],
        bonusActions: [{ name: 'Player Bonus' }],
        reactions: [{ name: 'Player Reaction' }],
        specialActions: [],
        magicActions: [{ name: 'Magic Action' }],
        utilizeActions: [{ name: 'Utilize Action' }],
        craftActions: [{ name: 'Craft Action' }]
      };
      const [actions, bonusActions, reactions] = rules.getActions(playerStats);
      expect(actions).toContainEqual(expect.objectContaining({ name: 'Magic Action' }));
      expect(actions).toContainEqual(expect.objectContaining({ name: 'Utilize Action' }));
      expect(actions).toContainEqual(expect.objectContaining({ name: 'Craft Action' }));
      expect(actions).toContainEqual(expect.objectContaining({ name: 'String Action', description: '' }));
      expect(bonusActions).toHaveLength(2);
      expect(reactions).toHaveLength(2);
    });

    it('should normalize string actions to objects in 2024 mode', () => {
      classRules2024.getFeatures.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });
      raceRules2024.getTraits.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });
      const playerStats = {
        rules: '2024',
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: ['Special String Action'],
        magicSpecialActions: [{ name: 'Magic Special' }]
      };
      const [, , , specialActions] = rules.getActions(playerStats);
      expect(specialActions).toContainEqual(expect.objectContaining({ name: 'Special String Action', description: '' }));
      expect(specialActions).toContainEqual(expect.objectContaining({ name: 'Magic Special' }));
    });

    it('should not include magic/utilize/craft actions in 5e mode', () => {
      classRules.getFeatures.mockReturnValue({
        actions: [{ name: 'Feature Action' }],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });
      raceRules.getTraits.mockReturnValue({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });
      const playerStats = {
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        magicActions: [{ name: 'Magic Action' }],
        utilizeActions: [{ name: 'Utilize Action' }]
      };
      const [actions] = rules.getActions(playerStats);
      expect(actions).not.toContainEqual(expect.objectContaining({ name: 'Magic Action' }));
      expect(actions).not.toContainEqual(expect.objectContaining({ name: 'Utilize Action' }));
    });
  });
});
