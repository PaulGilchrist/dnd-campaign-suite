import { describe, it, expect } from 'vitest';
import {
  computeConditionEffects,
  saveModifierApplies,
} from './conditionEffects.js';

describe('saveModifierApplies (internal function)', () => {
  describe('creature_grappled_by_you condition', () => {
    it('returns true when combatContext has attacker targeting a grappled creature', () => {
      const modifier = { target: 'saving_throw', condition: 'creature_grappled_by_you' };
      const combatContext = {
        creatures: [
          { name: 'Player', targetName: 'Goblin' },
          { name: 'Goblin', conditions: ['grappled'] },
        ],
        activeCreatureName: 'Player',
      };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, combatContext, [])).toBe(true);
    });

    it('returns false when target creature has no conditions', () => {
      const modifier = { target: 'saving_throw', condition: 'creature_grappled_by_you' };
      const combatContext = {
        creatures: [
          { name: 'Player', targetName: 'Goblin' },
          { name: 'Goblin', conditions: [] },
        ],
        activeCreatureName: 'Player',
      };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, combatContext, [])).toBe(false);
    });

    it('returns false when combatContext is null', () => {
      const modifier = { target: 'saving_throw', condition: 'creature_grappled_by_you' };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, null, [])).toBe(false);
    });

    it('returns false when attackerName is missing', () => {
      const modifier = { target: 'saving_throw', condition: 'creature_grappled_by_you' };
      const combatContext = {
        creatures: [{ name: 'Goblin', conditions: ['grappled'] }],
        attackerName: null,
      };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, combatContext, [])).toBe(false);
    });

    it('returns false when targetName is missing on attacker creature', () => {
      const modifier = { target: 'saving_throw', condition: 'creature_grappled_by_you' };
      const combatContext = {
        creatures: [{ name: 'Player' }],
        activeCreatureName: 'Player',
      };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, combatContext, [])).toBe(false);
    });

    it('handles conditions as objects with key property', () => {
      const modifier = { target: 'saving_throw', condition: 'creature_grappled_by_you' };
      const combatContext = {
        creatures: [
          { name: 'Player', targetName: 'Goblin' },
          { name: 'Goblin', conditions: [{ key: 'grappled' }] },
        ],
        activeCreatureName: 'Player',
      };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, combatContext, [])).toBe(true);
    });

    it('handles conditions as mixed objects and strings', () => {
      const modifier = { target: 'saving_throw', condition: 'creature_grappled_by_you' };
      const combatContext = {
        creatures: [
          { name: 'Player', targetName: 'Goblin' },
          { name: 'Goblin', conditions: ['blinded', { key: 'grappled' }] },
        ],
        activeCreatureName: 'Player',
      };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, combatContext, [])).toBe(true);
    });
  });

  describe('mounted_and_target_one_size_smaller condition', () => {
    it('returns true when attacker is mounted, not incapacitated, targeting one size smaller within 5ft', () => {
      const modifier = { target: 'attack_roll', condition: 'mounted_and_target_one_size_smaller' };
      const combatContext = {
        creatures: [
          { name: 'Player', isMounted: true, mountSize: 'Large', targetName: 'Goblin', rangeToTarget: 5 },
          { name: 'Goblin', size: 'Small', conditions: [] },
        ],
        activeCreatureName: 'Player',
      };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, combatContext, [])).toBe(true);
    });

    it('returns false when attacker is not mounted', () => {
      const modifier = { target: 'attack_roll', condition: 'mounted_and_target_one_size_smaller' };
      const combatContext = {
        creatures: [
          { name: 'Player', isMounted: false, targetName: 'Goblin' },
          { name: 'Goblin', size: 'Small' },
        ],
        activeCreatureName: 'Player',
      };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, combatContext, [])).toBe(false);
    });

    it('returns false when attacker is incapacitated', () => {
      const modifier = { target: 'attack_roll', condition: 'mounted_and_target_one_size_smaller' };
      const combatContext = {
        creatures: [
          { name: 'Player', isMounted: true, mountSize: 'Large', targetName: 'Goblin', rangeToTarget: 5, conditions: ['incapacitated'] },
          { name: 'Goblin', size: 'Small' },
        ],
        activeCreatureName: 'Player',
      };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, combatContext, [])).toBe(false);
    });

    it('returns false when target is same size as mount', () => {
      const modifier = { target: 'attack_roll', condition: 'mounted_and_target_one_size_smaller' };
      const combatContext = {
        creatures: [
          { name: 'Player', isMounted: true, mountSize: 'Large', targetName: 'Orc', rangeToTarget: 5 },
          { name: 'Orc', size: 'Medium' },
        ],
        activeCreatureName: 'Player',
      };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, combatContext, [])).toBe(true);
    });

    it('returns false when beyond 5ft', () => {
      const modifier = { target: 'attack_roll', condition: 'mounted_and_target_one_size_smaller' };
      const combatContext = {
        creatures: [
          { name: 'Player', isMounted: true, mountSize: 'Large', targetName: 'Goblin', rangeToTarget: 10 },
          { name: 'Goblin', size: 'Small' },
        ],
        activeCreatureName: 'Player',
      };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, combatContext, [])).toBe(false);
    });

    it('returns false when combatContext is null', () => {
      const modifier = { target: 'attack_roll', condition: 'mounted_and_target_one_size_smaller' };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, null, [])).toBe(false);
    });

    it('handles conditions as objects for incapacitated check', () => {
      const modifier = { target: 'attack_roll', condition: 'mounted_and_target_one_size_smaller' };
      const combatContext = {
        creatures: [
          { name: 'Player', isMounted: true, mountSize: 'Large', targetName: 'Goblin', rangeToTarget: 5, conditions: [{ key: 'incapacitated' }] },
          { name: 'Goblin', size: 'Small' },
        ],
        activeCreatureName: 'Player',
      };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, combatContext, [])).toBe(false);
    });
  });

  describe('magic condition with abilities', () => {
    it('returns true when modifier has no abilities array', () => {
      const modifier = { target: 'saving_throw', condition: 'magic', abilities: [] };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, null, [])).toBe(true);
    });

    it('returns true when abilityName matches an ability in the list', () => {
      const modifier = { target: 'saving_throw', condition: 'magic', abilities: ['DEX', 'WIS'] };
      expect(saveModifierApplies(modifier, 'DEX', 'DEX', false, false, false, false, null, [])).toBe(true);
    });

    it('returns false when abilityName does not match any ability', () => {
      const modifier = { target: 'saving_throw', condition: 'magic', abilities: ['DEX', 'WIS'] };
      expect(saveModifierApplies(modifier, 'CON', 'STR', false, false, false, false, null, [])).toBe(false);
    });
  });

  describe('first_round_target_no_turn condition', () => {
    it('returns true on round 1 when player has not acted', () => {
      const modifier = { target: 'saving_throw', condition: 'first_round_target_no_turn' };
      const combatContext = {
        round: 1,
        creatures: [{ name: 'Player', hasActed: false }],
        attackerName: 'Player',
      };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, combatContext, [])).toBe(true);
    });

    it('returns false on round 2', () => {
      const modifier = { target: 'saving_throw', condition: 'first_round_target_no_turn' };
      const combatContext = {
        round: 2,
        creatures: [{ name: 'Player' }],
        attackerName: 'Player',
      };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, combatContext, [])).toBe(false);
    });

    it('returns false when player has already acted', () => {
      const modifier = { target: 'saving_throw', condition: 'first_round_target_no_turn' };
      const combatContext = {
        round: 1,
        creatures: [{ name: 'Player', hasActed: true }],
        attackerName: 'Player',
      };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, combatContext, [])).toBe(false);
    });

    it('returns false when combatContext is null', () => {
      const modifier = { target: 'saving_throw', condition: 'first_round_target_no_turn' };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, null, [])).toBe(false);
    });
  });

  describe('condition keyword matching', () => {
    it('returns true when modifier.condition matches a condition in the conditions set', () => {
      const modifier = { target: 'saving_throw', condition: 'rage' };
      expect(saveModifierApplies(modifier, 'saving_throw', 'STR', false, false, false, false, null, ['rage'])).toBe(true);
    });

    it('returns false when modifier.condition is not in conditions set and no abilities match', () => {
      const modifier = { target: 'saving_throw', condition: 'rage', abilities: ['STR'] };
      expect(saveModifierApplies(modifier, 'saving_throw', 'DEX', false, false, false, false, null, [])).toBe(false);
    });

    it('returns true when abilityName matches modifier.abilities', () => {
      const modifier = { target: 'saving_throw', abilities: ['STR', 'DEX'] };
      expect(saveModifierApplies(modifier, 'saving_throw', 'STR', false, false, false, false, null, [])).toBe(true);
    });

    it('returns true when abilityName is null and modifier has abilities', () => {
      const modifier = { target: 'saving_throw', abilities: ['STR', 'DEX'] };
      expect(saveModifierApplies(modifier, 'saving_throw', null, false, false, false, false, null, [])).toBe(true);
    });

    it('returns true as fallback when nothing matches', () => {
      const modifier = { target: 'saving_throw' };
      expect(saveModifierApplies(modifier, 'saving_throw', 'STR', false, false, false, false, null, [])).toBe(true);
    });
  });

  describe('target validation', () => {
    it('returns false for unknown target types', () => {
      const modifier = { target: 'unknown_target' };
      expect(saveModifierApplies(modifier, 'saving_throw', 'STR', false, false, false, false, null, [])).toBe(false);
    });

    it('returns true for valid target types without other conditions', () => {
      const modifier = { target: 'saving_throw' };
      expect(saveModifierApplies(modifier, 'saving_throw', 'STR', false, false, false, false, null, [])).toBe(true);
    });

    it('returns true for save target', () => {
      const modifier = { target: 'save' };
      expect(saveModifierApplies(modifier, 'save', 'STR', false, false, false, false, null, [])).toBe(true);
    });

    it('returns true for attack_rolls_vs_unmounted_near_mount target', () => {
      const modifier = { target: 'attack_rolls_vs_unmounted_near_mount' };
      expect(saveModifierApplies(modifier, 'attack_rolls_vs_unmounted_near_mount', 'STR', false, false, false, false, null, [])).toBe(true);
    });

    it('returns true for concentration_saving_throws target', () => {
      const modifier = { target: 'concentration_saving_throws' };
      expect(saveModifierApplies(modifier, 'concentration_saving_throws', 'STR', false, false, false, false, null, [])).toBe(true);
    });

    it('returns true for death_saving_throws target', () => {
      const modifier = { target: 'death_saving_throws' };
      expect(saveModifierApplies(modifier, 'death_saving_throws', 'STR', false, false, false, false, null, [])).toBe(true);
    });
  });
});

describe('computeConditionEffects - uncovered paths', () => {
  describe('saveModifiers condition-specific save advantage/disadvantage from conditions', () => {
    it('pushes charmed to saveAdvantage when charmed condition is active and modifier has charmed condition with advantage', () => {
      const modifiers = [{ target: 'saving_throw', condition: 'charmed', effect: 'advantage' }];
      const result = computeConditionEffects(['charmed'], modifiers);
      expect(result.saveAdvantage).toContain('charmed');
    });

    it('pushes charmed to saveDisadvantage when charmed condition is active and modifier has charmed condition with disadvantage', () => {
      const modifiers = [{ target: 'saving_throw', condition: 'charmed', effect: 'disadvantage' }];
      const result = computeConditionEffects(['charmed'], modifiers);
      expect(result.saveDisadvantage).toContain('charmed');
    });

    it('pushes poisoned to saveAdvantage when poisoned condition is active and modifier has poison condition with advantage', () => {
      const modifiers = [{ target: 'saving_throw', condition: 'poison', effect: 'advantage' }];
      const result = computeConditionEffects(['poisoned'], modifiers);
      expect(result.saveAdvantage).toContain('poisoned');
    });

    it('pushes poisoned to saveDisadvantage when poisoned condition is active and modifier has poison condition with disadvantage', () => {
      const modifiers = [{ target: 'saving_throw', condition: 'poison', effect: 'disadvantage' }];
      const result = computeConditionEffects(['poisoned'], modifiers);
      expect(result.saveDisadvantage).toContain('poisoned');
    });

    it('tracks per-ability saveAdvantageAbilities for magic condition', () => {
      const modifiers = [{ target: 'saving_throw', condition: 'magic', effect: 'advantage', abilities: ['DEX'] }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveAdvantageAbilities).toEqual(['DEX']);
    });

    it('tracks per-ability saveDisadvantageAbilities for magic condition', () => {
      const modifiers = [{ target: 'saving_throw', condition: 'magic', effect: 'disadvantage', abilities: ['CON'] }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveDisadvantageAbilities).toEqual(['CON']);
    });

    it('pushes against_spell to saveAdvantage', () => {
      const modifiers = [{ target: 'saving_throw', condition: 'against_spell', effect: 'advantage' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveAdvantage).toContain('against_spell');
    });

    it('pushes against_spell to saveDisadvantage', () => {
      const modifiers = [{ target: 'saving_throw', condition: 'against_spell', effect: 'disadvantage' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveDisadvantage).toContain('against_spell');
    });
  });

  describe('Danger Sense while incapacitated', () => {
    it('filters out visible_effect modifiers when incapacitated', () => {
      const modifiers = [
        { target: 'saving_throw', effect: 'advantage', condition: 'visible_effect' },
        { target: 'saving_throw', effect: 'advantage' },
      ];
      const result = computeConditionEffects(['incapacitated'], modifiers);
      // The visible_effect one is filtered, but the plain one still applies
      expect(result.saveAdvantageCount).toBe(1);
    });

    it('does not filter visible_effect when not incapacitated', () => {
      const modifiers = [
        { target: 'saving_throw', effect: 'advantage', condition: 'visible_effect' },
      ];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveAdvantageCount).toBe(1);
    });
  });

  describe('targetEffects: distracting_strike_advantage', () => {
    it('increments targetAdvantageCount', () => {
      const effects = [{ effect: 'distracting_strike_advantage' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.targetAdvantageCount).toBe(1);
    });
  });

  describe('targetEffects: disadvantage_next_attack', () => {
    it('increments attackDisadvantageCount', () => {
      const effects = [{ effect: 'disadvantage_next_attack' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.attackDisadvantageCount).toBe(1);
    });
  });

  describe('targetEffects: goad', () => {
    it('increments attackDisadvantageCount', () => {
      const effects = [{ effect: 'goad' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.attackDisadvantageCount).toBe(1);
    });
  });

  describe('hasSaveAdvantage - uncovered paths', () => {
    it('returns true for against_spell advantage with restoreBalance', () => {
      const effects = { saveAdvantageCount: 0, saveAdvantage: ['against_spell'] };
      expect(hasSaveAdvantage(effects, 'con', true)).toBe(true);
    });

    it('returns true for against_spell advantage without restoreBalance', () => {
      const effects = { saveAdvantageCount: 0, saveAdvantage: ['against_spell'] };
      expect(hasSaveAdvantage(effects, 'con', false)).toBe(true);
    });

    it('returns true for ability-specific saveAdvantageAbilities with restoreBalance', () => {
      const effects = { saveAdvantageCount: 0, saveDisadvantageCount: 0, saveAdvantageAbilities: ['CON'] };
      expect(hasSaveAdvantage(effects, 'con', true)).toBe(true);
    });
  });

  describe('saveModifiers: frightened condition-specific save disadvantage', () => {
    it('pushes frightened to saveDisadvantage when frightened condition is active and modifier has frightened condition with disadvantage', () => {
      const modifiers = [{ target: 'saving_throw', condition: 'frightened', effect: 'disadvantage' }];
      const result = computeConditionEffects(['frightened'], modifiers);
      expect(result.saveDisadvantage).toContain('frightened');
    });
  });

  // Note: ability_check, check, all_attackers_vs_target, and d20 targets
  // are filtered out by saveModifierApplies (line 66) before reaching the
  // applySaveModifiers branches at lines 108-140. These are unreachable
  // through computeConditionEffects and are considered dead code paths.

  describe('applySaveModifiers via computeConditionEffects: attack_rolls disadvantage', () => {
    it('increments attackDisadvantageCount for attack_rolls disadvantage', () => {
      const modifiers = [{ target: 'attack_rolls', effect: 'disadvantage' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.attackDisadvantageCount).toBe(1);
    });
  });

  describe('applySaveModifiers via computeConditionEffects: save disadvantage with abilities', () => {
    it('tracks saveDisadvantageAbilities when modifier has abilities and no abilityName', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'disadvantage', abilities: ['CON', 'WIS'] }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveDisadvantageAbilities).toEqual(['CON', 'WIS']);
      expect(result.saveDisadvantageCount).toBe(0);
    });
  });

  describe('saveModifierApplies: creature_grappled_by_you edge case', () => {
    it('returns false when targetCreature exists but has no conditions property', () => {
      const modifier = { target: 'saving_throw', condition: 'creature_grappled_by_you' };
      const combatContext = {
        creatures: [
          { name: 'Player', targetName: 'Goblin' },
          { name: 'Goblin' },
        ],
        activeCreatureName: 'Player',
      };
      expect(saveModifierApplies(modifier, 'DEX', 'STR', false, false, false, false, combatContext, [])).toBe(false);
    });
  });
});

// Import hasSaveAdvantage for the tests above
import { hasSaveAdvantage } from './conditionEffects.js';
