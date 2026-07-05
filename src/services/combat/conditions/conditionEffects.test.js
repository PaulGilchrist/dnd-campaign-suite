// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest';
import {
  computeConditionEffects,
  getNetAttackMode,
  combineAttackModes,
  CONDITIONS_THAT_CANNOT_ACT,
  CONDITIONS_THAT_SPEED_ZERO,
  hasSaveModifier,
  hasSaveAdvantage,
} from './conditionEffects.js';

describe('conditionEffects', () => {
  describe('CONDITIONS_THAT_CANNOT_ACT', () => {
    it('contains exactly the expected incapacitating conditions', () => {
      const expected = new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']);
      expect(CONDITIONS_THAT_CANNOT_ACT).toEqual(expected);
    });
  });

  describe('CONDITIONS_THAT_SPEED_ZERO', () => {
    it('contains exactly the expected speed-zero conditions', () => {
      const expected = new Set(['grappled', 'paralyzed', 'petrified', 'restrained', 'stunned', 'unconscious', 'speed_zero']);
      expect(CONDITIONS_THAT_SPEED_ZERO).toEqual(expected);
    });
  });

  describe('computeConditionEffects', () => {
    describe('condition effects by type', () => {
      it('returns default values when called with no arguments', () => {
        const result = computeConditionEffects();
        expect(result.cannotAct).toBe(false);
        expect(result.speedZero).toBe(false);
        expect(result.attackAdvantageCount).toBe(0);
        expect(result.attackDisadvantageCount).toBe(0);
        expect(result.saveAdvantageCount).toBe(0);
        expect(result.saveDisadvantageCount).toBe(0);
      });

      it('combines effects from multiple conditions', () => {
        const result = computeConditionEffects(['blinded', 'paralyzed']);
        expect(result.cannotAct).toBe(true);
        expect(result.speedZero).toBe(true);
        expect(result.attackDisadvantageCount).toBe(1);
        expect(result.autoFailSaves).toEqual(['str', 'dex']);
      });
    });

    describe('incapacitating conditions', () => {
      it('sets cannotAct and concentrationBroken for incapacitated', () => {
        const result = computeConditionEffects(['incapacitated']);
        expect(result.cannotAct).toBe(true);
        expect(result.concentrationBroken).toBe(true);
      });

      it('sets cannotAct, speedZero, autoCritWithin5ft, and autoFailSaves for paralyzed', () => {
        const result = computeConditionEffects(['paralyzed']);
        expect(result.cannotAct).toBe(true);
        expect(result.speedZero).toBe(true);
        expect(result.autoCritWithin5ft).toBe(true);
        expect(result.targetAdvantageCount).toBe(1);
        expect(result.autoFailSaves).toEqual(['str', 'dex']);
      });

      it('sets cannotAct, speedZero, resistantToAll, poisonImmune for petrified', () => {
        const result = computeConditionEffects(['petrified']);
        expect(result.cannotAct).toBe(true);
        expect(result.speedZero).toBe(true);
        expect(result.resistantToAll).toBe(true);
        expect(result.poisonImmune).toBe(true);
        expect(result.autoFailSaves).toEqual(['str', 'dex']);
      });

      it('sets cannotAct, speedZero, autoFailSaves for stunned', () => {
        const result = computeConditionEffects(['stunned']);
        expect(result.cannotAct).toBe(true);
        expect(result.speedZero).toBe(true);
        expect(result.autoFailSaves).toEqual(['str', 'dex']);
        expect(result.targetAdvantageCount).toBe(1);
      });

      it('sets cannotAct, speedZero, autoCritWithin5ft for unconscious', () => {
        const result = computeConditionEffects(['unconscious']);
        expect(result.cannotAct).toBe(true);
        expect(result.speedZero).toBe(true);
        expect(result.autoFailSaves).toEqual(['str', 'dex']);
        expect(result.autoCritWithin5ft).toBe(true);
      });
    });

    describe('mobility-restricting conditions', () => {
      it('sets speedZero and grants attack disadvantage for grappled', () => {
        const result = computeConditionEffects(['grappled']);
        expect(result.speedZero).toBe(true);
        expect(result.attackDisadvantageCount).toBe(1);
      });

      it('sets speedZero for speed_zero condition', () => {
        const result = computeConditionEffects(['speed_zero']);
        expect(result.speedZero).toBe(true);
      });

      it('sets speedHalved, acPenalty, and action restrictions for slow', () => {
        const result = computeConditionEffects(['slow']);
        expect(result.speedHalved).toBe(true);
        expect(result.speedReduction).toBe(50);
        expect(result.acPenalty).toBe(2);
        expect(result.slowNoReactions).toBe(true);
        expect(result.slowActionLimit).toBe(true);
        expect(result.slowSingleAttackLimit).toBe(true);
        expect(result.slowSomaticFailure).toBe(true);
        expect(result.targetAdvantageCount).toBe(1);
      });
    });

    describe('combat-disadvantage conditions', () => {
      it('grants attack disadvantage and target advantage for blinded', () => {
        const result = computeConditionEffects(['blinded']);
        expect(result.attackDisadvantageCount).toBe(1);
        expect(result.targetAdvantageCount).toBe(1);
      });

      it('grants attack disadvantage, target advantage, and save disadvantage for charmed', () => {
        const result = computeConditionEffects(['charmed']);
        expect(result.attackDisadvantageCount).toBe(1);
        expect(result.targetAdvantageCount).toBe(1);
        expect(result.saveDisadvantage).toContain('dex');
      });

      it('grants attack disadvantage and ability check disadvantage for frightened', () => {
        const result = computeConditionEffects(['frightened']);
        expect(result.attackDisadvantageCount).toBe(1);
        expect(result.abilityCheckDisadvantage).toBe(true);
      });

      it('grants attack disadvantage and ability check disadvantage for poisoned', () => {
        const result = computeConditionEffects(['poisoned']);
        expect(result.attackDisadvantageCount).toBe(1);
        expect(result.abilityCheckDisadvantage).toBe(true);
      });

      it('grants conditional target advantage/disadvantage for prone', () => {
        const result = computeConditionEffects(['prone']);
        expect(result.attackDisadvantageCount).toBe(1);
        expect(result.targetAdvantageIfWithin5ft).toBe(true);
        expect(result.targetDisadvantageIfBeyond5ft).toBe(true);
      });

      it('grants attack disadvantage, target advantage, and dex save disadvantage for restrained', () => {
        const result = computeConditionEffects(['restrained']);
        expect(result.speedZero).toBe(true);
        expect(result.attackDisadvantageCount).toBe(1);
        expect(result.targetAdvantageCount).toBe(1);
        expect(result.saveDisadvantage).toContain('dex');
      });

      it('sets dazed and grants target advantage for dazed', () => {
        const result = computeConditionEffects(['dazed']);
        expect(result.dazed).toBe(true);
        expect(result.targetAdvantageCount).toBe(1);
      });
    });

    describe('invisible condition with seeInvisibility', () => {
      it('grants attack advantage and target disadvantage when seeInvisibility is false', () => {
        const result = computeConditionEffects(['invisible'], [], [], false, false, false, false, null, false);
        expect(result.attackAdvantageCount).toBe(1);
        expect(result.targetDisadvantageCount).toBe(1);
      });

      it('grants no advantage when seeInvisibility is true', () => {
        const result = computeConditionEffects(['invisible'], [], [], false, false, false, false, null, true);
        expect(result.attackAdvantageCount).toBe(0);
        expect(result.targetDisadvantageCount).toBe(0);
      });
    });

    describe('saveModifiers: advantage/disadvantage effects', () => {
      it('counts advantage and disadvantage save modifiers', () => {
        expect(computeConditionEffects([], [{ target: 'saving_throw', effect: 'advantage' }]).saveAdvantageCount).toBe(1);
        expect(computeConditionEffects([], [{ target: 'saving_throw', effect: 'disadvantage' }]).saveDisadvantageCount).toBe(1);
      });

      it('tracks saveAdvantageAbilities when modifier has abilities', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'advantage', abilities: ['STR', 'DEX'] }];
        const result = computeConditionEffects([], modifiers);
        expect(result.saveAdvantageAbilities).toEqual(['STR', 'DEX']);
        expect(result.saveAdvantageCount).toBe(0);
      });

      it('applies advantage for attack_roll target', () => {
        const result = computeConditionEffects([], [{ target: 'attack_roll', effect: 'advantage' }]);
        expect(result.attackAdvantageCount).toBe(1);
      });

      it('does not apply advantage when modifier.condition is an active condition keyword', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'advantage', condition: 'charmed' }];
        const result = computeConditionEffects(['charmed'], modifiers);
        expect(result.saveAdvantageCount).toBe(0);
      });

      it('applies advantage for fiend_undead condition', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'advantage', condition: 'fiend_undead' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.saveAdvantageCount).toBe(1);
      });
    });

    describe('saveModifiers: replacement effects', () => {
      it('sets strSaveReplace and strCheckReplace for replacement on saving_throw and ability_check', () => {
        const strMod = { target: 'saving_throw', effect: 'replacement', saveType: 'STR' };
        expect(computeConditionEffects([], [strMod]).strSaveReplace).toBe(true);

        const checkMod = { target: 'ability_check', effect: 'replacement', saveType: 'STR' };
        expect(computeConditionEffects([], [checkMod]).strCheckReplace).toBe(true);
      });
    });

    describe('saveModifiers: special effects', () => {
      const specialEffects = [
        { modifier: { target: 'saving_throw', effect: 'tactical_mind', bonusExpression: '1d4' }, field: 'tacticalMind', value: true },
        { modifier: { target: 'saving_throw', effect: 'reliable_talent' }, field: 'reliableTalent', value: true },
        { modifier: { target: 'saving_throw', effect: 'stroke_of_luck' }, field: 'strokeOfLuck', value: true },
        { modifier: { target: 'saving_throw', effect: 'd20_floor_10' }, field: 'd20Floor10', value: true },
        { modifier: { target: 'saving_throw', effect: 'potent_cantrip' }, field: 'potentCantrip', value: true },
        { modifier: { target: 'ability_check', effect: 'dex_jump' }, field: 'dexJump', value: true },
        { modifier: { target: 'd20', effect: 'restore_balance' }, field: 'restoreBalance', value: true },
        { modifier: { target: 'attack_roll', effect: 'no_advantage_against' }, field: 'noAdvantageAgainst', value: true },
        { modifier: { target: 'attack_roll', effect: 'dark_ones_look' }, field: 'darkOnesLook', value: true },
        { modifier: { target: 'attack_roll', effect: 'portent' }, field: 'portent', value: true },
        { modifier: { target: 'attack_roll', effect: 'improved_illusions' }, field: 'improvedIllusions', value: true },
        { modifier: { target: 'attack_roll', effect: 'illusory_reality' }, field: 'illusoryReality', value: true },
        { modifier: { target: 'attack_roll', effect: 'soulstitch_spells' }, field: 'soulstitchSpells', value: true },
        { modifier: { target: 'saving_throw', effect: 'str_check_disadvantage' }, field: 'strCheckDisadvantage', value: true },
        { modifier: { target: 'attack_roll', effect: 'ray_of_enfeeble_damage_reduction' }, field: 'rayOfEnfeebleDamageReduction', value: true },
      ];

      for (const { modifier, field, value } of specialEffects) {
        it(`handles ${modifier.effect}`, () => {
          expect(computeConditionEffects([], [modifier])[field]).toBe(value);
        });
      }

      it('handles pass_without_trace with bonusExpression', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'pass_without_trace', bonusExpression: '10' }];
        expect(computeConditionEffects([], modifiers).passWithoutTraceBonus).toBe('10');
      });

      it('handles wis_replacement with abilities', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'wis_replacement', abilities: ['CHA'] }];
        const result = computeConditionEffects([], modifiers);
        expect(result.wisCheckReplace).toBe(true);
        expect(result.wisCheckReplaceAbilities).toContain('CHA');
      });

      it('handles modify_d20_roll with optional properties', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'modify_d20_roll', diceExpression: '2d4', canBeBonusOrPenalty: true }];
        const result = computeConditionEffects([], modifiers);
        expect(result.modifyD20Roll).toBe(true);
        expect(result.modifyD20RollDice).toBe('2d4');
        expect(result.modifyD20RollCanBeBonusOrPenalty).toBe(true);
      });

      it('handles lucky_point with advantage and disadvantage effectType', () => {
        expect(computeConditionEffects([], [{ target: 'saving_throw', effect: 'lucky_point', effectType: 'advantage' }]).luckyAdvantage).toBe(true);
        expect(computeConditionEffects([], [{ target: 'saving_throw', effect: 'lucky_point', effectType: 'disadvantage' }]).luckyDisadvantage).toBe(true);
      });

      it('handles reroll effect with and without bonusExpression', () => {
        const withBonus = computeConditionEffects(['rage'], [{ target: 'saving_throw', effect: 'reroll', condition: 'rage', bonusExpression: '1d4' }]);
        expect(withBonus.autoReroll).toBe(true);
        expect(withBonus.autoRerollCondition).toBe('rage');
        expect(withBonus.autoRerollBonus).toBe('1d4');

        const withoutBonus = computeConditionEffects(['rage'], [{ target: 'saving_throw', effect: 'reroll', condition: 'rage' }]);
        expect(withoutBonus.autoRerollBonus).toBeNull();
      });
    });

    describe('targetEffects: save-related', () => {
      it('handles disadvantage_on_next_save', () => {
        const effects = [{ effect: 'disadvantage_on_next_save' }];
        const result = computeConditionEffects([], [], effects);
        expect(result.riderSaveDisadvantage).toBe(true);
        expect(result.saveDisadvantageCount).toBe(1);
      });

      it('handles hex_save_disadvantage with ability', () => {
        const effects = [{ effect: 'hex_save_disadvantage', ability: 'WIS' }];
        const result = computeConditionEffects([], [], effects);
        expect(result.hexSaveDisadvantage).toBe(true);
        expect(result.hexSaveDisadvantageAbility).toBe('WIS');
        expect(result.saveDisadvantageCount).toBe(1);
      });

      it('handles death_strike with save parameters and damageDoubled', () => {
        const effects = [{ effect: 'death_strike', saveType: 'CON', saveDc: 15, damageDoubled: true }];
        const result = computeConditionEffects([], [], effects);
        expect(result.saveType).toBe('CON');
        expect(result.saveDc).toBe(15);
        expect(result.damageDoubled).toBe(true);
      });

      it('handles repeat save effects (sleep, slow, stinking_cloud, web, power_word_stun)', () => {
        expect(computeConditionEffects([], [], [{ effect: 'sleep_repeat_save', saveType: 'WIS', saveDc: 13 }]).sleepRepeatSave).toBe(true);
        expect(computeConditionEffects([], [], [{ effect: 'slow_repeat_save', saveType: 'WIS', saveDc: 15 }]).slowRepeatSave).toBe(true);
        expect(computeConditionEffects([], [], [{ effect: 'stinking_cloud_repeat_save', saveType: 'CON', saveDc: 14 }]).stinkingCloudRepeatSave).toBe(true);
        expect(computeConditionEffects([], [], [{ effect: 'web_repeat_save', saveType: 'DEX', saveDc: 14 }]).webRepeatSave).toBe(true);
        expect(computeConditionEffects([], [], [{ effect: 'power_word_stun_repeat_save', saveType: 'CON', saveDc: 18 }]).powerWordStun).toBe(true);
      });

      it('handles Cunning Strike-style save with condition', () => {
        const effects = [{ saveType: 'DEX', condition: 'stunned', saveDc: 15 }];
        const result = computeConditionEffects([], [], effects);
        expect(result.saveType).toBe('DEX');
        expect(result.saveDc).toBe(15);
        expect(result.conditionToApply).toBe('stunned');
      });
    });

    describe('targetEffects: attack-related', () => {
      it('handles next_attack_advantage and vexTarget', () => {
        expect(computeConditionEffects([], [], [{ effect: 'next_attack_advantage' }]).attackAdvantageCount).toBe(1);
        const vexResult = computeConditionEffects([], [], [{ effect: 'next_attack_advantage', target: 'Player', vexTarget: 'Goblin' }]);
        expect(vexResult.attackAdvantageCount).toBe(0);
        expect(vexResult.vexAdvantageTargets).toEqual(['Goblin']);
      });

      it('handles crusher_enhanced_critical and clairvoyant_combatant', () => {
        expect(computeConditionEffects([], [], [{ effect: 'crusher_enhanced_critical' }]).targetAdvantageCount).toBe(1);
        const clairResult = computeConditionEffects([], [], [{ effect: 'clairvoyant_combatant', attackerAdvantage: true, defenderDisadvantage: true }]);
        expect(clairResult.targetAdvantageCount).toBe(1);
        expect(clairResult.attackDisadvantageCount).toBe(1);
      });

      it('handles multiattack_defense and escape_the_horde', () => {
        expect(computeConditionEffects([], [], [{ effect: 'multiattack_defense' }]).targetDisadvantageCount).toBe(1);
        expect(computeConditionEffects([], [], [{ effect: 'escape_the_horde' }]).targetDisadvantageCount).toBe(1);
      });

      it('handles disadvantage_perception_checks and ray_of_enfeeble_debuff', () => {
        expect(computeConditionEffects([], [], [{ effect: 'disadvantage_perception_checks' }]).abilityCheckDisadvantage).toBe(true);
        const rayResult = computeConditionEffects([], [], [{ effect: 'ray_of_enfeeble_debuff', strCheckDisadvantage: true, rayOfEnfeebleDamageReduction: true }]);
        expect(rayResult.strCheckDisadvantage).toBe(true);
        expect(rayResult.rayOfEnfeebleDamageReduction).toBe(true);
      });
    });

    describe('targetEffects: movement, positioning, and combat actions', () => {
      it('handles speed_reduction, push, prone_and_push, and ac_penalty', () => {
        expect(computeConditionEffects([], [], [{ effect: 'speed_reduction', value: 20 }]).speedReduction).toBe(20);
        const pushResult = computeConditionEffects([], [], [{ effect: 'push', value: 10 }]);
        expect(pushResult.pushEffect).toBe(true);
        expect(pushResult.pushDistance).toBe(10);
        const pronePushResult = computeConditionEffects([], [], [{ effect: 'prone_and_push', value: 15 }]);
        expect(pronePushResult.pushEffect).toBe(true);
        expect(pronePushResult.proneEffect).toBe(true);
        expect(computeConditionEffects([], [], [{ effect: 'ac_penalty', value: 3 }]).acPenalty).toBe(3);
      });

      it('handles no_opportunity_attacks and no_reactions', () => {
        expect(computeConditionEffects([], [], [{ effect: 'no_opportunity_attacks' }]).riderCannotOpportunityAttack).toBe(true);
        expect(computeConditionEffects([], [], [{ noOpportunityAttacks: true }]).riderCannotOpportunityAttack).toBe(true);
        expect(computeConditionEffects([], [], [{ effect: 'no_reactions' }]).riderNoReactions).toBe(true);
      });

      it('handles cleave, nick, and topple effects', () => {
        const cleaveResult = computeConditionEffects([], [], [{ effect: 'cleave', target: 'creature1', source: 'creature2' }]);
        expect(cleaveResult.cleaveAttack).toBe(true);
        expect(cleaveResult.cleaveTarget).toBe('creature1');

        const nickResult = computeConditionEffects([], [], [{ effect: 'nick', target: 'creature1', source: 'creature2' }]);
        expect(nickResult.nickExtraAttack).toBe(true);

        const toppleResult = computeConditionEffects([], [], [{ effect: 'topple', saveType: 'CON', saveDc: 15 }]);
        expect(toppleResult.toppleEffect).toBe(true);
        expect(toppleResult.conditionToApply).toBe('prone');
      });
    });

    describe('targetEffects: damage and special', () => {
      it('handles damage_bonus with all parameters', () => {
        const result = computeConditionEffects([], [], [{ effect: 'damage_bonus', value: 5, damageExpression: '1d6', damageType: 'fire' }]);
        expect(result.riderAttackBonus).toBe(5);
        expect(result.riderDamageExpression).toBe('1d6');
        expect(result.riderDamageType).toBe('fire');
      });

      it('handles foresight with comprehensive benefits', () => {
        const result = computeConditionEffects([], [], [{ effect: 'foresight' }]);
        expect(result.attackAdvantageCount).toBe(1);
        expect(result.saveAdvantageCount).toBe(1);
        expect(result.abilityCheckAdvantage).toBe(true);
        expect(result.targetDisadvantageCount).toBe(1);
      });

      it('handles mass_fear and incapacitated (hurl through hell)', () => {
        const massResult = computeConditionEffects([], [], [{ effect: 'mass_fear', saveType: 'WIS', saveDc: 15, range: '30_ft' }]);
        expect(massResult.conditionToApply).toBe('frightened');
        expect(massResult.massFearRange).toBe('30_ft');

        const hurlResult = computeConditionEffects([], [], [{ effect: 'incapacitated', saveType: 'WIS', saveDc: 15 }]);
        expect(hurlResult.hurlThroughHell).toBe(true);
        expect(hurlResult.conditionToApply).toBe('incapacitated');
      });
    });

    describe('saveModifiers: condition-conditional effects', () => {
      it('applies advantage when modifier.condition matches an active condition', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'advantage', condition: 'fiend_undead' }];
        const result = computeConditionEffects(['fiend_undead'], modifiers);
        expect(result.saveAdvantageCount).toBe(1);
      });
    });
  });

  describe('getNetAttackMode', () => {
    it('returns advantage/disadvantage/normal based on net counts', () => {
      expect(getNetAttackMode(3, 1, false)).toBe('advantage');
      expect(getNetAttackMode(1, 3, false)).toBe('disadvantage');
      expect(getNetAttackMode(2, 2, false)).toBe('normal');
      expect(getNetAttackMode(0, 0, false)).toBe('normal');
    });

    it('neutralizes one advantage/disadvantage when restoreBalance is true', () => {
      expect(getNetAttackMode(1, 0, true)).toBe('normal');
      expect(getNetAttackMode(0, 1, true)).toBe('normal');
    });

    it('leaves excess counts after restoreBalance neutralization', () => {
      expect(getNetAttackMode(2, 1, true)).toBe('advantage');
      expect(getNetAttackMode(1, 2, true)).toBe('disadvantage');
      expect(getNetAttackMode(0, 2, true)).toBe('disadvantage');
    });

    it('returns normal when restoreBalance with equal counts', () => {
      expect(getNetAttackMode(2, 2, true)).toBe('normal');
    });
  });

  describe('combineAttackModes', () => {
    it('combines attacker and target advantage/disadvantage counts', () => {
      const attackerAdv = { attackAdvantageCount: 2, attackDisadvantageCount: 0, restoreBalance: false };
      const targetAdv = { targetAdvantageCount: 1, targetDisadvantageCount: 0 };
      expect(combineAttackModes(attackerAdv, targetAdv, 10)).toBe('advantage');

      const attackerDis = { attackAdvantageCount: 0, attackDisadvantageCount: 2, restoreBalance: false };
      const targetDis = { targetAdvantageCount: 0, targetDisadvantageCount: 1 };
      expect(combineAttackModes(attackerDis, targetDis, 10)).toBe('disadvantage');
    });

    it('returns normal when combined counts cancel out', () => {
      const attacker = { attackAdvantageCount: 1, attackDisadvantageCount: 0, restoreBalance: false };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 1 };
      expect(combineAttackModes(attacker, target, 10)).toBe('normal');
    });

    it('handles prone conditional advantage/disadvantage', () => {
      const attacker = { attackAdvantageCount: 0, attackDisadvantageCount: 0, restoreBalance: false };
      const targetWithin = { targetAdvantageCount: 0, targetDisadvantageCount: 0, targetAdvantageIfWithin5ft: true };
      const targetBeyond = { targetAdvantageCount: 0, targetDisadvantageCount: 0, targetDisadvantageIfBeyond5ft: true };

      expect(combineAttackModes(attacker, targetWithin, 5)).toBe('advantage');
      expect(combineAttackModes(attacker, targetWithin, 10)).toBe('normal');
      expect(combineAttackModes(attacker, targetBeyond, 10)).toBe('disadvantage');
      expect(combineAttackModes(attacker, targetBeyond, 5)).toBe('normal');
    });

    it('resets advantage with noAdvantageAgainst', () => {
      const attacker = { attackAdvantageCount: 3, attackDisadvantageCount: 0, restoreBalance: false };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0, noAdvantageAgainst: true };
      expect(combineAttackModes(attacker, target, 10)).toBe('normal');
    });

    it('uses restoreBalance from target effects', () => {
      const attacker = { attackAdvantageCount: 1, attackDisadvantageCount: 0, restoreBalance: false };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0, restoreBalance: true };
      expect(combineAttackModes(attacker, target, 10)).toBe('normal');
    });

    it('handles vexAdvantageTargets', () => {
      const attacker = { attackAdvantageCount: 0, attackDisadvantageCount: 0, restoreBalance: false, vexAdvantageTargets: ['Goblin'] };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0 };
      expect(combineAttackModes(attacker, target, 5, 'Goblin')).toBe('advantage');
      expect(combineAttackModes(attacker, target, 5, 'Orc')).toBe('normal');
      expect(combineAttackModes({ ...attacker, vexAdvantageTargets: null }, target, 5, 'Goblin')).toBe('normal');
    });
  });

  describe('hasSaveModifier', () => {
    it('returns false for empty/null modifiers or non-matching target/effect', () => {
      expect(hasSaveModifier([], 'saving_throw', 'STR')).toBe(false);
      expect(hasSaveModifier(null, 'saving_throw', 'STR')).toBe(false);
      expect(hasSaveModifier([{ target: 'attack_roll', effect: 'advantage' }], 'saving_throw', 'STR')).toBe(false);
      expect(hasSaveModifier([{ target: 'saving_throw', effect: 'disadvantage' }], 'saving_throw', 'STR')).toBe(false);
    });

    it('returns true for matching advantage save modifier', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage' }];
      expect(hasSaveModifier(modifiers, 'saving_throw', 'STR')).toBe(true);
    });

    it('matches ability-specific modifiers', () => {
      const strMod = [{ target: 'saving_throw', effect: 'advantage', abilities: ['STR'] }];
      expect(hasSaveModifier(strMod, 'saving_throw', 'STR')).toBe(true);
      expect(hasSaveModifier(strMod, 'saving_throw', 'DEX')).toBe(false);
      expect(hasSaveModifier(strMod, 'saving_throw', null)).toBe(false);
    });
  });

  describe('hasSaveAdvantage', () => {
    it('returns false for null/undefined effects or when no advantage exists', () => {
      expect(hasSaveAdvantage(null, 'STR', false)).toBe(false);
      expect(hasSaveAdvantage(undefined, 'STR', false)).toBe(false);
      expect(hasSaveAdvantage({ saveAdvantageCount: 0, saveAdvantage: [], saveAdvantageAbilities: [] }, 'STR', false)).toBe(false);
    });

    it('returns true when saveAdvantageCount is positive', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage' }];
      const effects = computeConditionEffects([], modifiers);
      expect(hasSaveAdvantage(effects, 'STR', false)).toBe(true);
    });

    it('handles condition-specific and ability-specific saveAdvantage', () => {
      const condMod = [{ target: 'saving_throw', condition: 'charmed', effect: 'advantage' }];
      const condEffects = computeConditionEffects(['charmed'], condMod);
      expect(hasSaveAdvantage(condEffects, 'charmed', false)).toBe(true);
      expect(hasSaveAdvantage(condEffects, 'frightened', false)).toBe(false);

      const abMod = [{ target: 'saving_throw', effect: 'advantage', abilities: ['STR'] }];
      const abEffects = computeConditionEffects([], abMod);
      expect(hasSaveAdvantage(abEffects, 'STR', false)).toBe(true);
      expect(hasSaveAdvantage(abEffects, 'DEX', false)).toBe(false);
    });

    it('applies restoreBalance reduction to saveAdvantageCount', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage' }];
      const effects = computeConditionEffects([], modifiers);
      expect(hasSaveAdvantage(effects, 'STR', true)).toBe(false);

      const doubleEffects = computeConditionEffects([], [
        { target: 'saving_throw', effect: 'advantage' },
        { target: 'saving_throw', effect: 'advantage' },
      ]);
      expect(hasSaveAdvantage(doubleEffects, 'STR', true)).toBe(true);
    });

    it('returns true for against_spell regardless of saveType', () => {
      const effects = computeConditionEffects([], [{ target: 'saving_throw', condition: 'against_spell', effect: 'advantage' }]);
      expect(hasSaveAdvantage(effects, 'con', false)).toBe(true);
      expect(hasSaveAdvantage(effects, 'dex', false)).toBe(true);
    });
  });
});
