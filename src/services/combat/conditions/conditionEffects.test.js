import { describe, it, expect } from 'vitest';
import {
  computeConditionEffects,
  getNetAttackMode,
  combineAttackModes,
  CONDITIONS_THAT_CANNOT_ACT,
  CONDITIONS_THAT_SPEED_ZERO,
  hasSaveModifier,
} from './conditionEffects.js';

describe('conditionEffects', () => {
  describe('CONDITIONS_THAT_CANNOT_ACT', () => {
    it('contains incapacitated', () => {
      expect(CONDITIONS_THAT_CANNOT_ACT.has('incapacitated')).toBe(true);
    });

    it('contains paralyzed', () => {
      expect(CONDITIONS_THAT_CANNOT_ACT.has('paralyzed')).toBe(true);
    });

    it('contains petrified', () => {
      expect(CONDITIONS_THAT_CANNOT_ACT.has('petrified')).toBe(true);
    });

    it('contains stunned', () => {
      expect(CONDITIONS_THAT_CANNOT_ACT.has('stunned')).toBe(true);
    });

    it('contains unconscious', () => {
      expect(CONDITIONS_THAT_CANNOT_ACT.has('unconscious')).toBe(true);
    });
  });

  describe('CONDITIONS_THAT_SPEED_ZERO', () => {
    it('contains grappled', () => {
      expect(CONDITIONS_THAT_SPEED_ZERO.has('grappled')).toBe(true);
    });

    it('contains speed_zero', () => {
      expect(CONDITIONS_THAT_SPEED_ZERO.has('speed_zero')).toBe(true);
    });
  });

  describe('computeConditionEffects', () => {
    it('returns empty effects with no conditions', () => {
      const result = computeConditionEffects();
      expect(result.cannotAct).toBe(false);
      expect(result.speedZero).toBe(false);
      expect(result.attackAdvantageCount).toBe(0);
      expect(result.attackDisadvantageCount).toBe(0);
    });

    it('sets cannotAct and concentrationBroken for incapacitated', () => {
      const result = computeConditionEffects(['incapacitated']);
      expect(result.cannotAct).toBe(true);
      expect(result.concentrationBroken).toBe(true);
    });

    it('sets cannotAct, speedZero, and autoCritWithin5ft for paralyzed', () => {
      const result = computeConditionEffects(['paralyzed']);
      expect(result.cannotAct).toBe(true);
      expect(result.speedZero).toBe(true);
      expect(result.autoCritWithin5ft).toBe(true);
      expect(result.autoFailSaves).toContain('str');
      expect(result.autoFailSaves).toContain('dex');
    });

    it('sets resistantToAll and poisonImmune for petrified', () => {
      const result = computeConditionEffects(['petrified']);
      expect(result.resistantToAll).toBe(true);
      expect(result.poisonImmune).toBe(true);
    });

    it('sets speedZero for grappled', () => {
      const result = computeConditionEffects(['grappled']);
      expect(result.speedZero).toBe(true);
    });

    it('sets abilityCheckDisadvantage for frightened', () => {
      const result = computeConditionEffects(['frightened']);
      expect(result.abilityCheckDisadvantage).toBe(true);
    });

    it('sets attackAdvantageCount for blinded', () => {
      const result = computeConditionEffects(['blinded']);
      expect(result.attackDisadvantageCount).toBeGreaterThan(0);
      expect(result.targetAdvantageCount).toBeGreaterThan(0);
    });

    it('sets attackAdvantageCount for invisible when seeInvisibilityActive is false', () => {
      const result = computeConditionEffects(['invisible'], [], [], false, false, false, false, null, false);
      expect(result.attackAdvantageCount).toBeGreaterThan(0);
    });

    it('does not set attackAdvantageCount for invisible when seeInvisibilityActive is true', () => {
      const result = computeConditionEffects(['invisible'], [], [], false, false, false, false, null, true);
      expect(result.attackAdvantageCount).toBe(0);
    });

    it('sets speedHalved and acPenalty for slow', () => {
      const result = computeConditionEffects(['slow']);
      expect(result.speedHalved).toBe(true);
      expect(result.acPenalty).toBe(2);
      expect(result.slowNoReactions).toBe(true);
      expect(result.slowSomaticFailure).toBe(true);
    });

    it('sets dazed for dazed condition', () => {
      const result = computeConditionEffects(['dazed']);
      expect(result.dazed).toBe(true);
    });

    it('sets saveDisadvantage for charmed', () => {
      const result = computeConditionEffects(['charmed']);
      expect(result.saveDisadvantage).toContain('dex');
    });

    it('sets speedZero for speed_zero condition', () => {
      const result = computeConditionEffects(['speed_zero']);
      expect(result.speedZero).toBe(true);
    });

    it('sets speedZero and saveDisadvantage for restrained', () => {
      const result = computeConditionEffects(['restrained']);
      expect(result.speedZero).toBe(true);
      expect(result.saveDisadvantage).toContain('dex');
    });

    it('sets cannotAct and speedZero for stunned', () => {
      const result = computeConditionEffects(['stunned']);
      expect(result.cannotAct).toBe(true);
      expect(result.speedZero).toBe(true);
    });

    it('sets cannotAct, speedZero, and autoFailSaves for unconscious', () => {
      const result = computeConditionEffects(['unconscious']);
      expect(result.cannotAct).toBe(true);
      expect(result.speedZero).toBe(true);
      expect(result.autoFailSaves).toContain('str');
    });

    it('handles saveModifiers with advantage effect', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveAdvantageCount).toBe(1);
    });

    it('handles saveModifiers with disadvantage effect', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'disadvantage' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveDisadvantageCount).toBe(1);
    });

    it('handles saveModifiers with replacement effect for STR', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'replacement', saveType: 'STR' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.strSaveReplace).toBe(true);
    });

    it('handles saveModifiers with tactical_mind effect', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'tactical_mind', bonusExpression: '1d4' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.tacticalMind).toBe(true);
      expect(result.tacticalMindBonus).toBe('1d4');
    });

    it('handles saveModifiers with reliable_talent effect', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'reliable_talent' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.reliableTalent).toBe(true);
    });

    it('handles saveModifiers with stroke_of_luck effect', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'stroke_of_luck' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.strokeOfLuck).toBe(true);
    });

    it('handles saveModifiers with d20_floor_10 effect', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'd20_floor_10' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.d20Floor10).toBe(true);
    });

    it('handles saveModifiers with potent_cantrip effect', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'potent_cantrip' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.potentCantrip).toBe(true);
    });

    it('handles targetEffects with disadvantage_on_next_save', () => {
      const effects = [{ effect: 'disadvantage_on_next_save' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.riderSaveDisadvantage).toBe(true);
      expect(result.saveDisadvantageCount).toBe(1);
    });

    it('handles targetEffects with next_attack_advantage', () => {
      const effects = [{ effect: 'next_attack_advantage' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.attackAdvantageCount).toBe(1);
    });

    it('handles targetEffects with speed_reduction', () => {
      const effects = [{ effect: 'speed_reduction', value: 20 }];
      const result = computeConditionEffects([], [], effects);
      expect(result.speedReduction).toBe(20);
    });

    it('handles targetEffects with push', () => {
      const effects = [{ effect: 'push', value: 10 }];
      const result = computeConditionEffects([], [], effects);
      expect(result.pushEffect).toBe(true);
      expect(result.pushDistance).toBe(10);
    });

    it('handles targetEffects with damage_bonus', () => {
      const effects = [{ effect: 'damage_bonus', value: 5, damageExpression: '1d6', damageType: 'fire' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.riderAttackBonus).toBe(5);
      expect(result.riderDamageExpression).toBe('1d6');
      expect(result.riderDamageType).toBe('fire');
    });

    it('handles targetEffects with death_strike', () => {
      const effects = [{ effect: 'death_strike', saveType: 'CON', saveDc: 15, damageDoubled: true }];
      const result = computeConditionEffects([], [], effects);
      expect(result.saveType).toBe('CON');
      expect(result.saveDc).toBe(15);
      expect(result.damageDoubled).toBe(true);
    });

    it('handles targetEffects with sleep_repeat_save', () => {
      const effects = [{ effect: 'sleep_repeat_save', saveType: 'WIS', saveDc: 13 }];
      const result = computeConditionEffects([], [], effects);
      expect(result.sleepRepeatSave).toBe(true);
      expect(result.repeatingSave).toBe(true);
      expect(result.saveType).toBe('WIS');
    });

    it('handles targetEffects with slow_repeat_save', () => {
      const effects = [{ effect: 'slow_repeat_save', saveType: 'WIS', saveDc: 15 }];
      const result = computeConditionEffects([], [], effects);
      expect(result.slowRepeatSave).toBe(true);
      expect(result.repeatingSave).toBe(true);
    });

    it('handles targetEffects with stinking_cloud_repeat_save', () => {
      const effects = [{ effect: 'stinking_cloud_repeat_save', saveType: 'CON', saveDc: 14 }];
      const result = computeConditionEffects([], [], effects);
      expect(result.stinkingCloudRepeatSave).toBe(true);
      expect(result.conditionToApply).toBe('poisoned');
    });

    it('handles targetEffects with web_repeat_save', () => {
      const effects = [{ effect: 'web_repeat_save', saveType: 'DEX', saveDc: 14 }];
      const result = computeConditionEffects([], [], effects);
      expect(result.webRepeatSave).toBe(true);
      expect(result.conditionToApply).toBe('restrained');
    });

    it('handles targetEffects with foresight', () => {
      const effects = [{ effect: 'foresight' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.attackAdvantageCount).toBe(1);
      expect(result.saveAdvantageCount).toBe(1);
      expect(result.abilityCheckAdvantage).toBe(true);
      expect(result.targetDisadvantageCount).toBe(1);
    });

    it('handles targetEffects with hex_save_disadvantage', () => {
      const effects = [{ effect: 'hex_save_disadvantage', ability: 'WIS' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.hexSaveDisadvantage).toBe(true);
      expect(result.hexSaveDisadvantageAbility).toBe('WIS');
      expect(result.saveDisadvantageCount).toBe(1);
    });

    it('handles targetEffects with cleave', () => {
      const effects = [{ effect: 'cleave', target: 'creature1', source: 'creature2' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.cleaveAttack).toBe(true);
      expect(result.cleaveTarget).toBe('creature1');
      expect(result.cleaveSource).toBe('creature2');
    });

    it('handles targetEffects with graze', () => {
      const effects = [{ effect: 'graze', target: 'creature1', source: 'creature2' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.grazeDamage).toBe(true);
    });

    it('handles targetEffects with nick', () => {
      const effects = [{ effect: 'nick', target: 'creature1', source: 'creature2' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.nickExtraAttack).toBe(true);
    });

    it('handles targetEffects with topple', () => {
      const effects = [{ effect: 'topple', saveType: 'CON', saveDc: 15 }];
      const result = computeConditionEffects([], [], effects);
      expect(result.toppleEffect).toBe(true);
      expect(result.saveType).toBe('CON');
      expect(result.conditionToApply).toBe('prone');
    });

    it('handles targetEffects with ac_penalty', () => {
      const effects = [{ effect: 'ac_penalty', value: 3 }];
      const result = computeConditionEffects([], [], effects);
      expect(result.acPenalty).toBe(3);
    });

    it('handles targetEffects with dex_save_disadvantage', () => {
      const effects = [{ effect: 'dex_save_disadvantage' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.slowDexSaveDisadvantage).toBe(true);
    });

    it('handles targetEffects with prone_and_push', () => {
      const effects = [{ effect: 'prone_and_push', value: 15 }];
      const result = computeConditionEffects([], [], effects);
      expect(result.pushEffect).toBe(true);
      expect(result.pushDistance).toBe(15);
      expect(result.proneEffect).toBe(true);
    });

    it('handles targetEffects with no_opportunity_attacks (no saveType)', () => {
      const effects = [{ effect: 'no_opportunity_attacks' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.riderCannotOpportunityAttack).toBe(true);
    });

    it('handles targetEffects with incapacitated and saveType (hurl through hell)', () => {
      const effects = [{ effect: 'incapacitated', saveType: 'WIS', saveDc: 15 }];
      const result = computeConditionEffects([], [], effects);
      expect(result.saveType).toBe('WIS');
      expect(result.conditionToApply).toBe('incapacitated');
      expect(result.hurlThroughHell).toBe(true);
    });

    it('handles targetEffects with power_word_stun_repeat_save', () => {
      const effects = [{ effect: 'power_word_stun_repeat_save', saveType: 'CON', saveDc: 18 }];
      const result = computeConditionEffects([], [], effects);
      expect(result.powerWordStun).toBe(true);
      expect(result.repeatingSave).toBe(true);
      expect(result.conditionToApply).toBe('stunned');
    });

    it('handles targetEffects with mass_fear', () => {
      const effects = [{ effect: 'mass_fear', saveType: 'WIS', saveDc: 15, range: '30_ft' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.saveType).toBe('WIS');
      expect(result.conditionToApply).toBe('frightened');
      expect(result.massFearRange).toBe('30_ft');
    });

    it('handles targetEffects with clairvoyant_combatant', () => {
      const effects = [{ effect: 'clairvoyant_combatant', attackerAdvantage: true, defenderDisadvantage: true }];
      const result = computeConditionEffects([], [], effects);
      expect(result.targetAdvantageCount).toBe(1);
      expect(result.attackDisadvantageCount).toBe(1);
    });

    it('handles targetEffects with ray_of_enfeeble_debuff', () => {
      const effects = [{ effect: 'ray_of_enfeeble_debuff', strCheckDisadvantage: true, rayOfEnfeebleDamageReduction: true }];
      const result = computeConditionEffects([], [], effects);
      expect(result.strCheckDisadvantage).toBe(true);
      expect(result.rayOfEnfeebleDamageReduction).toBe(true);
    });

    it('handles targetEffects with multiattack_defense', () => {
      const effects = [{ effect: 'multiattack_defense' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.targetDisadvantageCount).toBe(1);
    });

    it('handles targetEffects with escape_the_horde', () => {
      const effects = [{ effect: 'escape_the_horde' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.targetDisadvantageCount).toBe(1);
    });

    it('handles targetEffects with disadvantage_perception_checks', () => {
      const effects = [{ effect: 'disadvantage_perception_checks' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.abilityCheckDisadvantage).toBe(true);
    });

    it('handles targetEffects with crusher_enhanced_critical', () => {
      const effects = [{ effect: 'crusher_enhanced_critical' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.targetAdvantageCount).toBe(1);
    });

    it('handles targetEffects with no_reactions', () => {
      const effects = [{ effect: 'no_reactions' }];
      const result = computeConditionEffects([], [], effects);
      expect(result.riderNoReactions).toBe(true);
    });

    it('handles noOpportunityAttacks property on targetEffects', () => {
      const effects = [{ noOpportunityAttacks: true }];
      const result = computeConditionEffects([], [], effects);
      expect(result.riderCannotOpportunityAttack).toBe(true);
    });

    it('handles saveType and condition without effect for Cunning Strike', () => {
      const effects = [{ saveType: 'DEX', condition: 'stunned', saveDc: 15 }];
      const result = computeConditionEffects([], [], effects);
      expect(result.saveType).toBe('DEX');
      expect(result.saveDc).toBe(15);
      expect(result.conditionToApply).toBe('stunned');
    });

    it('handles saveModifiers with condition charmed and charmed condition', () => {
      const modifiers = [{ target: 'saving_throw', condition: 'charmed', effect: 'advantage' }];
      const result = computeConditionEffects(['charmed'], modifiers);
      expect(result.saveAdvantage).toContain('charmed');
    });

    it('handles saveModifiers with condition magic and abilities', () => {
      const modifiers = [{ target: 'saving_throw', condition: 'magic', abilities: ['WIS', 'CHA'], effect: 'advantage' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveAdvantageAbilities).toContain('WIS');
    });

    it('handles saveModifiers with ability names for advantage', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage', abilities: ['STR'] }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveAdvantageAbilities).toContain('STR');
    });

    it('handles abilityCheckAdvantageAbilities for per-ability check advantage', () => {
      const modifiers = [{ target: 'attack_roll', effect: 'advantage', abilities: ['STR', 'DEX'] }];
      const result = computeConditionEffects([], modifiers);
      expect(result.abilityCheckAdvantage).toBe(false);
    });

    it('handles dex_jump effect', () => {
      const modifiers = [{ target: 'ability_check', effect: 'dex_jump' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.dexJump).toBe(true);
    });

    it('handles restore_balance effect', () => {
      const modifiers = [{ target: 'd20', effect: 'restore_balance' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.restoreBalance).toBe(true);
    });

    it('handles no_advantage_against effect', () => {
      const modifiers = [{ target: 'attack_roll', effect: 'no_advantage_against' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.noAdvantageAgainst).toBe(true);
    });

    it('handles dark_ones_look effect', () => {
      const modifiers = [{ target: 'attack_roll', effect: 'dark_ones_look' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.darkOnesLook).toBe(true);
    });

    it('handles portent effect', () => {
      const modifiers = [{ target: 'attack_roll', effect: 'portent' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.portent).toBe(true);
    });

    it('handles improved_illusions effect', () => {
      const modifiers = [{ target: 'attack_roll', effect: 'improved_illusions' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.improvedIllusions).toBe(true);
    });

    it('handles illusory_reality effect', () => {
      const modifiers = [{ target: 'attack_roll', effect: 'illusory_reality' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.illusoryReality).toBe(true);
    });

    it('handles soulstitch_spells effect', () => {
      const modifiers = [{ target: 'attack_roll', effect: 'soulstitch_spells' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.soulstitchSpells).toBe(true);
    });

    it('handles pass_without_trace effect', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'pass_without_trace', bonusExpression: '10' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.passWithoutTraceBonus).toBe('10');
    });

    it('handles spell_breaker_dispel_bonus effect', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'spell_breaker_dispel_bonus', bonusExpression: '2d4' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.spellBreakerDispelBonus).toBe(true);
      expect(result.spellBreakerDispelBonusExpression).toBe('2d4');
    });

    it('handles str_check_disadvantage effect', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'str_check_disadvantage' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.strCheckDisadvantage).toBe(true);
    });

    it('handles ray_of_enfeeble_damage_reduction effect', () => {
      const modifiers = [{ target: 'attack_roll', effect: 'ray_of_enfeeble_damage_reduction' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.rayOfEnfeebleDamageReduction).toBe(true);
    });

    it('handles lucky_point with advantage effectType', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'lucky_point', effectType: 'advantage' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.luckyAdvantage).toBe(true);
    });

    it('handles lucky_point with disadvantage effectType', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'lucky_point', effectType: 'disadvantage' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.luckyDisadvantage).toBe(true);
    });

    it('handles modify_d20_roll effect', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'modify_d20_roll', diceExpression: '2d4', canBeBonusOrPenalty: true }];
      const result = computeConditionEffects([], modifiers);
      expect(result.modifyD20Roll).toBe(true);
      expect(result.modifyD20RollDice).toBe('2d4');
      expect(result.modifyD20RollCanBeBonusOrPenalty).toBe(true);
    });

    it('handles wis_replacement effect', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'wis_replacement', abilities: ['CHA'] }];
      const result = computeConditionEffects([], modifiers);
      expect(result.wisCheckReplace).toBe(true);
      expect(result.wisCheckReplaceAbilities).toContain('CHA');
    });

    it('handles reroll effect with bonusExpression', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'reroll', condition: 'rage', bonusExpression: '1d4' }];
      const result = computeConditionEffects(['rage'], modifiers);
      expect(result.autoReroll).toBe(true);
      expect(result.autoRerollCondition).toBe('rage');
      expect(result.autoRerollBonus).toBe('1d4');
    });

    it('handles reroll effect without bonusExpression', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'reroll', condition: 'rage' }];
      const result = computeConditionEffects(['rage'], modifiers);
      expect(result.autoReroll).toBe(true);
      expect(result.autoRerollCondition).toBe('rage');
      expect(result.autoRerollBonus).toBeNull();
    });

    it('handles strCheckReplace from replacement modifier with ability_check target', () => {
      const modifiers = [{ target: 'ability_check', effect: 'replacement', saveType: 'STR' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.strCheckReplace).toBe(true);
    });

    it('handles all_attackers_vs_target advantage', () => {
      const modifiers = [{ target: 'attack_roll', effect: 'advantage' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.attackAdvantageCount).toBe(1);
    });

    it('handles all_attackers_vs_target disadvantage', () => {
      const modifiers = [{ target: 'attack_roll', effect: 'disadvantage' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.attackDisadvantageCount).toBe(1);
    });

    it('handles saveModifiers with modifier.condition matching conditionSet', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage', condition: 'rage' }];
      const result = computeConditionEffects(['rage'], modifiers);
      expect(result.saveAdvantageCount).toBe(1);
    });

    it('handles saveModifiers with no matching modifier condition', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage', condition: 'nonexistent' }];
      const result = computeConditionEffects(['charmed'], modifiers);
      expect(result.saveAdvantageCount).toBe(1);
    });

    it('handles saveModifiers with modifier.condition in CONDITION_KEYWORDS', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage', condition: 'charmed' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveAdvantageCount).toBe(0);
    });

    it('handles saveModifiers with abilities and no abilityName sets saveAdvantageAbilities', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage', abilities: ['STR'] }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveAdvantageAbilities).toEqual(['STR']);
      expect(result.saveAdvantageCount).toBe(0);
    });

    it('handles saveModifiers with no abilities returns true', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveAdvantageCount).toBe(1);
    });

    it('handles saveModifiers with fiend_undead condition', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage', condition: 'fiend_undead' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveAdvantageCount).toBe(1);
    });

    it('handles saveModifiers with holy_nimbus_active condition', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage', condition: 'holy_nimbus_active' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveAdvantageCount).toBe(1);
    });

    it('handles saveModifiers with holy_aura_active condition', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage', condition: 'holy_aura_active' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveAdvantageCount).toBe(1);
    });

    it('handles saveModifiers with living_legend_active condition', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage', condition: 'living_legend_active' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveAdvantageCount).toBe(1);
    });

    it('handles saveModifiers with elder_champion_active condition', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage', condition: 'elder_champion_active' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveAdvantageCount).toBe(1);
    });

    it('handles saveModifiers with protection_from_poison_active condition', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage', condition: 'protection_from_poison_active' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveAdvantageCount).toBe(1);
    });

    it('handles saveModifiers with concentration_breaker condition', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage', condition: 'concentration_breaker' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveAdvantageCount).toBe(1);
    });

    it('handles saveModifiers with pfeag_save_advantage condition', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage', condition: 'pfeag_save_advantage' }];
      const result = computeConditionEffects([], modifiers);
      expect(result.saveAdvantageCount).toBe(1);
    });

    it('returns effects with all default zero/false values when empty', () => {
      const result = computeConditionEffects();
      expect(result.attackAdvantageCount).toBe(0);
      expect(result.attackDisadvantageCount).toBe(0);
      expect(result.abilityCheckDisadvantage).toBe(false);
      expect(result.abilityCheckAdvantage).toBe(false);
      expect(result.cannotAct).toBe(false);
      expect(result.speedZero).toBe(false);
      expect(result.speedReduction).toBe(0);
      expect(result.concentrationBroken).toBe(false);
      expect(result.targetAdvantageCount).toBe(0);
      expect(result.targetDisadvantageCount).toBe(0);
      expect(result.autoCritWithin5ft).toBe(false);
      expect(result.resistantToAll).toBe(false);
      expect(result.poisonImmune).toBe(false);
      expect(result.saveAdvantageCount).toBe(0);
      expect(result.saveDisadvantageCount).toBe(0);
      expect(result.autoReroll).toBe(false);
      expect(result.strSaveReplace).toBe(false);
      expect(result.strCheckReplace).toBe(false);
      expect(result.wisCheckReplace).toBe(false);
      expect(result.reliableTalent).toBe(false);
      expect(result.tacticalMind).toBe(false);
      expect(result.strokeOfLuck).toBe(false);
      expect(result.luckyAdvantage).toBe(false);
      expect(result.luckyDisadvantage).toBe(false);
      expect(result.modifyD20Roll).toBe(false);
      expect(result.dexJump).toBe(false);
      expect(result.restoreBalance).toBe(false);
      expect(result.d20Floor10).toBe(false);
      expect(result.noAdvantageAgainst).toBe(false);
      expect(result.darkOnesLook).toBe(false);
      expect(result.portent).toBe(false);
      expect(result.potentCantrip).toBe(false);
      expect(result.soulstitchSpells).toBe(false);
      expect(result.improvedIllusions).toBe(false);
      expect(result.illusoryReality).toBe(false);
      expect(result.riderSaveDisadvantage).toBe(false);
      expect(result.riderAttackBonus).toBe(0);
      expect(result.damageDoubled).toBe(false);
      expect(result.riderCannotOpportunityAttack).toBe(false);
      expect(result.riderNoReactions).toBe(false);
      expect(result.pushEffect).toBe(false);
      expect(result.pushDistance).toBeNull();
      expect(result.saveType).toBeNull();
      expect(result.saveDc).toBeNull();
      expect(result.saveAbility).toBeNull();
      expect(result.conditionToApply).toBeNull();
      expect(result.conditionDuration).toBeNull();
      expect(result.repeatingSave).toBe(false);
      expect(result.hexSaveDisadvantage).toBe(false);
      expect(result.strCheckDisadvantage).toBe(false);
      expect(result.slowRepeatSave).toBe(false);
      expect(result.slowNoReactions).toBe(false);
      expect(result.slowActionLimit).toBe(false);
      expect(result.slowSingleAttackLimit).toBe(false);
      expect(result.slowSomaticFailure).toBe(false);
      expect(result.slowDexSaveDisadvantage).toBe(false);
      expect(result.stinkingCloudRepeatSave).toBe(false);
      expect(result.webRepeatSave).toBe(false);
      expect(result.acPenalty).toBe(0);
      expect(result.rayOfEnfeebleDamageReduction).toBe(false);
      expect(result.grazeDamage).toBe(false);
      expect(result.nickExtraAttack).toBe(false);
      expect(result.toppleEffect).toBe(false);
      expect(result.toppleSaveType).toBeNull();
      expect(result.toppleSaveDc).toBeNull();
      expect(result.toppleSaveAbility).toBeNull();
    });
  });

  describe('getNetAttackMode', () => {
    it('returns advantage when advantage count exceeds disadvantage', () => {
      expect(getNetAttackMode(3, 1, false)).toBe('advantage');
    });

    it('returns disadvantage when disadvantage count exceeds advantage', () => {
      expect(getNetAttackMode(1, 3, false)).toBe('disadvantage');
    });

    it('returns normal when counts are equal', () => {
      expect(getNetAttackMode(2, 2, false)).toBe('normal');
    });

    it('returns normal when both are zero', () => {
      expect(getNetAttackMode(0, 0, false)).toBe('normal');
    });

    it('respects restoreBalance by decrementing advantage first', () => {
      expect(getNetAttackMode(2, 1, true)).toBe('advantage');
    });

    it('respects restoreBalance when advantage is zero', () => {
      expect(getNetAttackMode(0, 1, true)).toBe('normal');
    });

    it('respects restoreBalance when disadvantage is zero', () => {
      expect(getNetAttackMode(1, 0, true)).toBe('normal');
    });

    it('handles restoreBalance with equal counts', () => {
      expect(getNetAttackMode(2, 2, true)).toBe('normal');
    });
  });

  describe('combineAttackModes', () => {
    it('combines attacker and target advantage counts', () => {
      const attacker = { attackAdvantageCount: 2, attackDisadvantageCount: 0, restoreBalance: false };
      const target = { targetAdvantageCount: 1, targetDisadvantageCount: 0 };
      expect(combineAttackModes(attacker, target, 10)).toBe('advantage');
    });

    it('combines attacker and target disadvantage counts', () => {
      const attacker = { attackAdvantageCount: 0, attackDisadvantageCount: 2, restoreBalance: false };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 1 };
      expect(combineAttackModes(attacker, target, 10)).toBe('disadvantage');
    });

    it('returns normal when combined counts are equal', () => {
      const attacker = { attackAdvantageCount: 1, attackDisadvantageCount: 0, restoreBalance: false };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 1 };
      expect(combineAttackModes(attacker, target, 10)).toBe('normal');
    });

    it('adds advantage when target is prone and within 5ft', () => {
      const attacker = { attackAdvantageCount: 0, attackDisadvantageCount: 0, restoreBalance: false };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0, targetAdvantageIfWithin5ft: true };
      expect(combineAttackModes(attacker, target, 5)).toBe('advantage');
    });

    it('adds disadvantage when target is prone and beyond 5ft', () => {
      const attacker = { attackAdvantageCount: 0, attackDisadvantageCount: 0, restoreBalance: false };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0, targetDisadvantageIfBeyond5ft: true };
      expect(combineAttackModes(attacker, target, 10)).toBe('disadvantage');
    });

    it('resets advantage to zero when target has noAdvantageAgainst', () => {
      const attacker = { attackAdvantageCount: 3, attackDisadvantageCount: 0, restoreBalance: false };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0, noAdvantageAgainst: true };
      expect(combineAttackModes(attacker, target, 10)).toBe('normal');
    });

    it('uses restoreBalance from target effects', () => {
      const attacker = { attackAdvantageCount: 1, attackDisadvantageCount: 0, restoreBalance: false };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0, restoreBalance: true };
      expect(combineAttackModes(attacker, target, 10)).toBe('normal');
    });
  });

  describe('hasSaveModifier', () => {
    it('returns false for empty modifiers', () => {
      expect(hasSaveModifier([], 'saving_throw', 'STR')).toBe(false);
    });

    it('returns false for null modifiers', () => {
      expect(hasSaveModifier(null, 'saving_throw', 'STR')).toBe(false);
    });

    it('returns false when target does not match', () => {
      const modifiers = [{ target: 'attack_roll', effect: 'advantage' }];
      expect(hasSaveModifier(modifiers, 'saving_throw', 'STR')).toBe(false);
    });

    it('returns false when effect is not advantage', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'disadvantage' }];
      expect(hasSaveModifier(modifiers, 'saving_throw', 'STR')).toBe(false);
    });

    it('returns true for simple advantage save modifier', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage' }];
      expect(hasSaveModifier(modifiers, 'saving_throw', 'STR')).toBe(true);
    });

    it('returns false when modifier has abilities but no abilityName', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage', abilities: ['STR'] }];
      expect(hasSaveModifier(modifiers, 'saving_throw', null)).toBe(false);
    });

    it('returns true when modifier has matching ability', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage', abilities: ['STR'] }];
      expect(hasSaveModifier(modifiers, 'saving_throw', 'STR')).toBe(true);
    });

    it('returns false when modifier has non-matching ability', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage', abilities: ['DEX'] }];
      expect(hasSaveModifier(modifiers, 'saving_throw', 'STR')).toBe(false);
    });

    it('handles attack_roll target', () => {
      const modifiers = [{ target: 'attack_roll', effect: 'advantage', abilities: ['STR'] }];
      expect(hasSaveModifier(modifiers, 'attack_roll', 'STR')).toBe(true);
    });
  });
});
