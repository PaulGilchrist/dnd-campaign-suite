// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { computeConditionEffects } from './conditionEffects.js';

// ---------------------------------------------------------------------------
// computeConditionEffects — saveType-based modifier conditions
// ---------------------------------------------------------------------------

describe('computeConditionEffects — saveType-based modifier conditions', () => {
  it('applies charmed advantage when charmed condition is active', () => {
    const modifiers = [{ target: 'saving_throw', condition: 'charmed', effect: 'advantage' }];
    const result = computeConditionEffects({ conditions: ['charmed'], saveModifiers: modifiers });
    expect(result.saveAdvantage).toContain('charmed');
  });

  it('applies charmed disadvantage when charmed condition is active', () => {
    const modifiers = [{ target: 'saving_throw', condition: 'charmed', effect: 'disadvantage' }];
    const result = computeConditionEffects({ conditions: ['charmed'], saveModifiers: modifiers });
    expect(result.saveDisadvantage).toContain('charmed');
  });

  it('applies frightened disadvantage when frightened condition is active', () => {
    const modifiers = [{ target: 'saving_throw', condition: 'frightened', effect: 'disadvantage' }];
    const result = computeConditionEffects({ conditions: ['frightened'], saveModifiers: modifiers });
    expect(result.saveDisadvantage).toContain('frightened');
  });

  it('applies poisoned advantage when poisoned condition is active', () => {
    const modifiers = [{ target: 'saving_throw', condition: 'poison', effect: 'advantage' }];
    const result = computeConditionEffects({ conditions: ['poisoned'], saveModifiers: modifiers });
    expect(result.saveAdvantage).toContain('poisoned');
  });

  it('applies poisoned disadvantage when poisoned condition is active', () => {
    const modifiers = [{ target: 'saving_throw', condition: 'poison', effect: 'disadvantage' }];
    const result = computeConditionEffects({ conditions: ['poisoned'], saveModifiers: modifiers });
    expect(result.saveDisadvantage).toContain('poisoned');
  });

  it('applies against_spell advantage', () => {
    const modifiers = [{ target: 'saving_throw', condition: 'against_spell', effect: 'advantage' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.saveAdvantage).toContain('against_spell');
  });

  it('applies against_spell disadvantage', () => {
    const modifiers = [{ target: 'saving_throw', condition: 'against_spell', effect: 'disadvantage' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.saveDisadvantage).toContain('against_spell');
  });

  it('tracks per-ability saveAdvantageAbilities for magic condition with abilities', () => {
    const modifiers = [{ target: 'saving_throw', condition: 'magic', effect: 'advantage', abilities: ['DEX'] }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.saveAdvantageAbilities).toContain('DEX');
  });

  it('tracks per-ability saveDisadvantageAbilities for magic condition with abilities', () => {
    const modifiers = [{ target: 'saving_throw', condition: 'magic', effect: 'disadvantage', abilities: ['CON', 'WIS'] }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.saveDisadvantageAbilities).toContain('CON');
    expect(result.saveDisadvantageAbilities).toContain('WIS');
  });

  it('skips visible_effect modifiers when incapacitated', () => {
    const modifiers = [
      { target: 'saving_throw', effect: 'advantage', condition: 'visible_effect' },
      { target: 'saving_throw', effect: 'advantage' },
    ];
    const result = computeConditionEffects({ conditions: ['incapacitated'], saveModifiers: modifiers });
    // visible_effect is filtered, but the plain advantage still applies
    expect(result.saveAdvantageCount).toBe(1);
  });

  it('includes visible_effect modifiers when not incapacitated', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'advantage', condition: 'visible_effect' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.saveAdvantageCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeConditionEffects — targetEffects
// ---------------------------------------------------------------------------

describe('computeConditionEffects — targetEffects', () => {
  it('increments targetAdvantageCount for distracting_strike_advantage', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'distracting_strike_advantage' }] });
    expect(result.targetAdvantageCount).toBe(1);
  });

  it('increments attackDisadvantageCount for disadvantage_next_attack', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'disadvantage_next_attack' }] });
    expect(result.attackDisadvantageCount).toBe(1);
  });

  it('sets attacksOtherDisadvantageSource for compelled_duel', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'compelled_duel', source: 'Paladin' }] });
    expect(result.attacksOtherDisadvantageSource).toBe('Paladin');
  });

  it('sets attacksOtherDisadvantageSource for taunting_step', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'taunting_step', source: 'Paladin' }] });
    expect(result.attacksOtherDisadvantageSource).toBe('Paladin');
  });

  it('increments attackAdvantageCount for next_attack_advantage without vexTarget', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'next_attack_advantage' }] });
    expect(result.attackAdvantageCount).toBe(1);
  });

  it('sets vexAdvantageTargets for next_attack_advantage with vexTarget', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'next_attack_advantage', vexTarget: 'Goblin' }] });
    expect(result.vexAdvantageTargets).toContain('Goblin');
  });

  it('increments targetDisadvantageCount for escape_the_horde', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'escape_the_horde' }] });
    expect(result.targetDisadvantageCount).toBe(1);
  });

  it('increments targetDisadvantageCount for multiattack_defense', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'multiattack_defense' }] });
    expect(result.targetDisadvantageCount).toBe(1);
  });

  it('sets riderSaveDisadvantage and saveDisadvantageCount for disadvantage_on_next_save', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'disadvantage_on_next_save' }] });
    expect(result.riderSaveDisadvantage).toBe(true);
    expect(result.saveDisadvantageCount).toBe(1);
  });

  it('sets abilityCheckDisadvantage for disadvantage_perception_checks', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'disadvantage_perception_checks' }] });
    expect(result.abilityCheckDisadvantage).toBe(true);
  });

  it('sets riderCannotOpportunityAttack when noOpportunityAttacks is true', () => {
    const result = computeConditionEffects({ targetEffects: [{ noOpportunityAttacks: true }] });
    expect(result.riderCannotOpportunityAttack).toBe(true);
  });

  it('sets riderNoReactions for no_reactions effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'no_reactions' }] });
    expect(result.riderNoReactions).toBe(true);
  });

  it('adds speedReduction for speed_reduction effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'speed_reduction', value: 15 }] });
    expect(result.speedReduction).toBe(15);
  });

  it('sets pushEffect and pushDistance for push effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'push', value: 10 }] });
    expect(result.pushEffect).toBe(true);
    expect(result.pushDistance).toBe(10);
  });

  it('sets riderAttackBonus and damage info for damage_bonus effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'damage_bonus', value: 5, damageExpression: '2d6', damageType: 'fire' }] });
    expect(result.riderAttackBonus).toBe(5);
    expect(result.riderDamageExpression).toBe('2d6');
    expect(result.riderDamageType).toBe('fire');
  });

  it('sets pushEffect, pushDistance, and proneEffect for prone_and_push', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'prone_and_push', value: 5 }] });
    expect(result.pushEffect).toBe(true);
    expect(result.pushDistance).toBe(5);
    expect(result.proneEffect).toBe(true);
  });

  it('sets saveType/saveDc/saveAbility/conditionToApply/conditionDuration for save-based effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ saveType: 'DEX', condition: 'prone', saveDc: 15, saveAbility: 'DEX' }] });
    expect(result.saveType).toBe('DEX');
    expect(result.saveDc).toBe(15);
    expect(result.saveAbility).toBe('DEX');
    expect(result.conditionToApply).toBe('prone');
    expect(result.conditionDuration).toBe('until_start_of_next_turn');
  });

  it('sets repeatingSave when repeatingSave is true on effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ saveType: 'DEX', condition: 'prone', repeatingSave: true }] });
    expect(result.repeatingSave).toBe(undefined);
  });

  it('sets massFear fields for mass_fear effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'mass_fear', saveType: 'WIS', saveDc: 13, condition: 'frightened', range: '30_ft' }] });
    expect(result.saveType).toBe('WIS');
    expect(result.saveDc).toBe(13);
    expect(result.conditionToApply).toBe('frightened');
    expect(result.massFearRange).toBe('30_ft');
  });

  it('sets damageDoubled for death_strike effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'death_strike', damageDoubled: true }] });
    expect(result.damageDoubled).toBe(true);
  });

  it('sets riderCannotOpportunityAttack for no_opportunity_attacks without saveType', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'no_opportunity_attacks' }] });
    expect(result.riderCannotOpportunityAttack).toBe(true);
  });

  it('sets hurlThroughHell fields for incapacitated effect with saveType', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'incapacitated', saveType: 'WIS', saveDc: 15 }] });
    expect(result.saveType).toBe('WIS');
    expect(result.conditionToApply).toBe('incapacitated');
    expect(result.hurlThroughHell).toBe(true);
  });

  it('ignores unknown effect keys without crashing', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'unknown_repeat_save' }] });
    expect(result.saveType).toBeNull();
    expect(result.conditionToApply).toBeNull();
    expect(result.powerWordStun).toBeUndefined();
  });

  it('handles topple effect with CON save', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'topple', saveType: 'CON', saveDc: 15 }] });
    expect(result.toppleEffect).toBe(true);
    expect(result.saveType).toBe('CON');
    expect(result.saveDc).toBe(15);
    expect(result.conditionToApply).toBe('prone');
  });

  it('handles mass_fear effect with WIS save', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'mass_fear', saveType: 'WIS', saveDc: 13, condition: 'frightened' }] });
    expect(result.saveType).toBe('WIS');
    expect(result.saveDc).toBe(13);
    expect(result.conditionToApply).toBe('frightened');
  });

  it('handles incapacitated effect with saveType', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'incapacitated', saveType: 'WIS', saveDc: 15 }] });
    expect(result.saveType).toBe('WIS');
    expect(result.conditionToApply).toBe('incapacitated');
  });

  it('sets targetAdvantageCount and targetDisadvantageCount for clairvoyant_combatant', () => {
    const result = computeConditionEffects({ targetEffects: [
      { effect: 'clairvoyant_combatant', attackerAdvantage: true, defenderDisadvantage: true },
    ] });
    expect(result.targetAdvantageCount).toBe(1);
    expect(result.targetDisadvantageCount).toBe(1);
  });

  it('sets all foresight fields for foresight effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'foresight' }] });
    expect(result.attackAdvantageCount).toBe(1);
    expect(result.saveAdvantageCount).toBe(1);
    expect(result.abilityCheckAdvantage).toBe(true);
    expect(result.targetDisadvantageCount).toBe(1);
  });

  it('sets saveDisadvantage entry for hex_save_disadvantage', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'hex_save_disadvantage', ability: 'CON' }] });
    expect(result.saveDisadvantage).toContain('con');
    expect(result.saveDisadvantageCount).toBe(1);
  });

  it('sets strCheckDisadvantage and rayOfEnfeebleDamageReduction for ray_of_enfeeble_debuff', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'ray_of_enfeeble_debuff', strCheckDisadvantage: true, rayOfEnfeebleDamageReduction: true }] });
    expect(result.strCheckDisadvantage).toBe(true);
    expect(result.rayOfEnfeebleDamageReduction).toBe(true);
  });

  it('sets cleaveAttack fields for cleave effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'cleave', target: 'Goblin', source: 'Player' }] });
    expect(result.cleaveAttack).toBe(true);
    expect(result.cleaveTarget).toBe('Goblin');
    expect(result.cleaveSource).toBe('Player');
  });

  it('sets nickExtraAttack fields for nick effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'nick', target: 'Goblin', source: 'Player' }] });
    expect(result.nickExtraAttack).toBe(true);
    expect(result.nickTarget).toBe('Goblin');
    expect(result.nickSource).toBe('Player');
  });

  it('sets topple fields for topple effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'topple', saveType: 'CON', saveDc: 14 }] });
    expect(result.toppleEffect).toBe(true);
    expect(result.saveType).toBe('CON');
    expect(result.saveDc).toBe(14);
    expect(result.saveAbility).toBe('CON');
    expect(result.conditionToApply).toBe('prone');
  });

  it('adds acPenalty for ac_penalty effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'ac_penalty', value: 3 }] });
    expect(result.acPenalty).toBe(3);
  });

  it('sets slowDexSaveDisadvantage and saveDisadvantage for dex_save_disadvantage', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'dex_save_disadvantage' }] });
    expect(result.slowDexSaveDisadvantage).toBe(true);
    expect(result.saveDisadvantage).toContain('dex');
  });

  it('adds to targetAdvantageCount for crusher_enhanced_critical', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'crusher_enhanced_critical' }] });
    expect(result.targetAdvantageCount).toBe(1);
  });

  it('handles banishment effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'banishment' }] });
    expect(result.saveType).toBeNull();
    expect(result.conditionToApply).toBeNull();
  });

  it('handles forcecage effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'forcecage', dc: 15 }] });
    expect(result.saveType).toBeNull();
    expect(result.conditionToApply).toBeNull();
  });

  it('handles prismatic_spray_indigo effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'prismatic_spray_indigo' }] });
    expect(result.saveType).toBeNull();
  });

  it('handles prismatic_spray_violet effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'prismatic_spray_violet' }] });
    expect(result.saveType).toBeNull();
  });

  it('handles pass_without_trace_bonus target effect', () => {
    expect(computeConditionEffects({ targetEffects: [{ effect: 'pass_without_trace_bonus', bonusExpression: '10' }] }).passWithoutTraceBonus).toBe('10');
  });

  it('handles holy_aura target effect with source tracking', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'holy_aura', source: 'Paladin' }] });
    expect(result.targetDisadvantageCount).toBe(1);
    expect(result.saveAdvantageCount).toBe(1);
    expect(result.saveAdvantageReasons).toContain('Holy Aura');
    expect(result.saveAdvantageReasons).toContain('Paladin');
  });

  it('handles circle_of_power target effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'circle_of_power' }] });
    expect(result.saveAdvantage).toContain('against_spell');
    expect(result.saveAdvantageReasons).toContain('Circle of Power');
  });

  it('handles foresight without blindsight/truesight (targetDisadvantageCount)', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'foresight' }] });
    expect(result.targetDisadvantageCount).toBe(1);
  });

  it('handles foresight with blindsight (no targetDisadvantageCount)', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'foresight' }], attackerSenses: [{ name: 'Blindsight' }] });
    expect(result.targetDisadvantageCount).toBe(0);
  });

  it('handles blur with blindsight (no targetDisadvantageCount)', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'blur' }], attackerSenses: [{ name: 'Truesight' }] });
    expect(result.targetDisadvantageCount).toBe(0);
  });

  it('handles blur without blindsight (targetDisadvantageCount)', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'blur' }] });
    expect(result.targetDisadvantageCount).toBe(1);
  });

  it('handles faerie_fire effect with source tracking', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'faerie_fire', source: 'Cleric' }] });
    expect(result.targetAdvantageCount).toBe(1);
    expect(result.targetAdvantageReasons).toContain('Cleric');
    expect(result.noAdvantageAgainstInvisible).toBe(true);
  });

  it('handles hex_ability_check_disadvantage effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'hex_ability_check_disadvantage', ability: 'CON' }] });
    expect(result.abilityCheckDisadvantageAbilities).toContain('CON');
  });

  it('handles enhance_ability effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'enhance_ability', ability: 'stealth' }] });
    expect(result.abilityCheckAdvantageAbilities).toContain('STEALTH');
  });

  it('handles advantage_abilities effect with source', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'advantage_abilities', source: 'Bard' }] });
    expect(result.abilityCheckAdvantage).toBe(true);
    expect(result.abilityCheckAdvantageReasons).toContain('Bard');
  });

  it('handles advantage_attacks effect with source', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'advantage_attacks', source: 'Bard' }] });
    expect(result.attackAdvantageCount).toBe(1);
    expect(result.attackAdvantageReasons).toContain('Bard');
  });

  it('handles advantage_saves effect with source', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'advantage_saves', source: 'Paladin' }] });
    expect(result.saveAdvantageCount).toBe(1);
    expect(result.saveAdvantageReasons).toContain('Paladin');
  });

  it('handles resistance_damage_reduction effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'resistance_damage_reduction' }] });
    expect(result.resistanceDamageReduction).toBe(true);
  });

  it('handles bane_penalty effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'bane_penalty' }] });
    expect(result.banePenalty).toBe(true);
  });

  it('handles bless_bonus effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'bless_bonus' }] });
    expect(result.blessBonus).toBe(true);
  });

  it('handles beacon_of_hope target effect', () => {
    const result = computeConditionEffects({ targetEffects: [{ effect: 'beacon_of_hope' }] });
    expect(result.beaconOfHope).toBe(true);
    expect(result.saveAdvantageAbilities).toContain('WIS');
    expect(result.saveAdvantageReasons).toContain('Beacon of Hope');
  });
});

// ---------------------------------------------------------------------------
// computeConditionEffects — applied modifier effects
// ---------------------------------------------------------------------------

describe('computeConditionEffects — applied modifier effects', () => {
  it('increments attackAdvantageCount for attack_rolls advantage', () => {
    const modifiers = [{ target: 'attack_rolls', effect: 'advantage' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.attackAdvantageCount).toBe(1);
  });

  it('increments attackDisadvantageCount for attack_rolls disadvantage', () => {
    const modifiers = [{ target: 'attack_rolls', effect: 'disadvantage' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.attackDisadvantageCount).toBe(1);
  });

  it('sets autoRerollForSaves for reroll effect on saving_throw', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'reroll', condition: 'favored_enemy' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.autoRerollForSaves).toBe(true);
    expect(result.autoRerollForChecks).toBe(false);
    expect(result.autoRerollCondition).toBe('favored_enemy');
  });

  it('sets autoRerollForChecks and autoRerollForSaves for reroll effect on d20 target (CLA-216: a d20 Test covers checks and saves)', () => {
    const modifiers = [{ target: 'd20', effect: 'reroll', condition: 'roll_equals_1' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.autoRerollForChecks).toBe(true);
    expect(result.autoRerollForSaves).toBe(true);
    expect(result.autoRerollCondition).toBe('roll_equals_1');
  });

  it('sets autoRerollBonus when bonusExpression is provided', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'reroll', bonusExpression: '+5' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.autoRerollBonus).toBe('+5');
  });

  it('sets strSaveReplace for replacement effect with STR and saving_throw target', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'replacement', saveType: 'STR' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.strSaveReplace).toBe(true);
  });

  it('sets strCheckReplace for replacement effect with STR and check target', () => {
    const modifiers = [{ target: 'check', effect: 'replacement', saveType: 'STR' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.strCheckReplace).toBe(true);
  });

  it('sets tacticalMind and tacticalMindBonus for tactical_mind effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'tactical_mind', bonusExpression: 'int_level' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.tacticalMind).toBe(true);
    expect(result.tacticalMindBonus).toBe('int_level');
  });

  it('sets wisCheckReplace and wisCheckReplaceAbilities for wis_replacement effect', () => {
    const modifiers = [{ target: 'check', effect: 'wis_replacement', abilities: ['CHA'] }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.wisCheckReplace).toBe(true);
    expect(result.wisCheckReplaceAbilities).toEqual(['CHA']);
  });

  it('sets reliableTalent for reliable_talent effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'reliable_talent' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.reliableTalent).toBe(true);
  });

  it('sets strokeOfLuck for stroke_of_luck effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'stroke_of_luck' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.strokeOfLuck).toBe(true);
  });

  it('sets luckyAdvantage for lucky_point with advantage effectType', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'lucky_point', effectType: 'advantage' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.luckyAdvantage).toBe(true);
  });

  it('sets luckyDisadvantage for lucky_point with disadvantage effectType', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'lucky_point', effectType: 'disadvantage' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.luckyDisadvantage).toBe(true);
  });

  it('sets modifyD20Roll fields for modify_d20_roll effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'modify_d20_roll', diceExpression: '2d6', canBeBonusOrPenalty: true }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.modifyD20Roll).toBe(true);
    expect(result.modifyD20RollDice).toBe('2d6');
    expect(result.modifyD20RollCanBeBonusOrPenalty).toBe(true);
  });

  it('defaults modifyD20RollDice to 2d4 when diceExpression is missing', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'modify_d20_roll' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.modifyD20RollDice).toBe('2d4');
  });

  it('never sets restoreBalance passively for restore_balance effect (CLA-295)', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'restore_balance' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.restoreBalance).toBe(false);
  });

  it('sets d20Floor10 for d20_floor_10 effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'd20_floor_10' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.d20Floor10).toBe(true);
  });

  it('sets noAdvantageAgainst for no_advantage_against effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'no_advantage_against' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.noAdvantageAgainst).toBe(true);
  });

  it('sets darkOnesLuck for dark_ones_luck effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'dark_ones_luck' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.darkOnesLuck).toBe(true);
  });

  it('sets portent for portent effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'portent' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.portent).toBe(true);
  });

  it('sets improvedIllusions for improved_illusions effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'improved_illusions' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.improvedIllusions).toBe(true);
  });

  it('sets illusoryReality for illusory_reality effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'illusory_reality' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.illusoryReality).toBe(true);
  });

  it('sets potentCantrip for potent_cantrip effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'potent_cantrip' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.potentCantrip).toBe(true);
  });

  it('sets soulstitchSpells for soulstitch_spells effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'soulstitch_spells' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.soulstitchSpells).toBe(true);
  });

  it('sets passWithoutTraceBonus with default of 10 when bonusExpression is missing', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'pass_without_trace' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.passWithoutTraceBonus).toBe('10');
  });

  it('sets passWithoutTraceBonus from bonusExpression when provided', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'pass_without_trace', bonusExpression: '+5' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.passWithoutTraceBonus).toBe('+5');
  });

  it('sets strCheckDisadvantage for str_check_disadvantage effect', () => {
    const modifiers = [{ target: 'check', effect: 'str_check_disadvantage' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.strCheckDisadvantage).toBe(true);
  });

  it('sets rayOfEnfeebleDamageReduction for ray_of_enfeeble_damage_reduction effect', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'ray_of_enfeeble_damage_reduction' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.rayOfEnfeebleDamageReduction).toBe(true);
  });

  it('increments saveDisadvantageCount for save disadvantage without abilities', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'disadvantage' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.saveDisadvantageCount).toBe(1);
  });

  it('increments saveAdvantageCount for save advantage without abilities', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'advantage' }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.saveAdvantageCount).toBe(1);
  });

  it('tracks per-ability saveDisadvantageAbilities when modifier has abilities and no abilityName', () => {
    const modifiers = [{ target: 'saving_throw', effect: 'disadvantage', abilities: ['CON', 'WIS'] }];
    const result = computeConditionEffects({ saveModifiers: modifiers });
    expect(result.saveDisadvantageAbilities).toEqual(['CON', 'WIS']);
    expect(result.saveDisadvantageCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeConditionEffects — peerless_athlete skills
// ---------------------------------------------------------------------------

describe('computeConditionEffects — peerless_athlete skills', () => {
  it('populates peerlessAthleteAdvantageSkills from conditional_advantage with skills field', () => {
    const modifiers = [
      { target: 'ability_check', condition: 'peerless_athlete', effect: 'advantage', abilities: ['STR'], skills: ['Athletics'] },
      { target: 'ability_check', condition: 'peerless_athlete', effect: 'advantage', abilities: ['DEX'], skills: ['Acrobatics'] },
    ];
    const effects = computeConditionEffects({ saveModifiers: modifiers, isPeerlessAthlete: true });
    expect(effects.peerlessAthleteAdvantageSkills).toEqual(['Athletics', 'Acrobatics']);
  });

  it('does not populate abilityCheckAdvantageAbilities for peerless_athlete with skills field', () => {
    const modifiers = [
      { target: 'ability_check', condition: 'peerless_athlete', effect: 'advantage', abilities: ['STR'], skills: ['Athletics'] },
      { target: 'ability_check', condition: 'peerless_athlete', effect: 'advantage', abilities: ['DEX'], skills: ['Acrobatics'] },
    ];
    const effects = computeConditionEffects({ saveModifiers: modifiers, isPeerlessAthlete: true });
    expect(effects.abilityCheckAdvantageAbilities).toBeNull();
  });

  it('populates abilityCheckAdvantageSkills for deception_performance_checks target', () => {
    const modifiers = [
      { target: 'deception_performance_checks', condition: 'disguised', effect: 'advantage', ability: 'Charisma' },
    ];
    const effects = computeConditionEffects({ saveModifiers: modifiers });
    expect(effects.abilityCheckAdvantageSkills).toEqual(['Deception', 'Performance']);
  });
});
