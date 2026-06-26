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
    describe('empty input', () => {
      it('returns all default values when called with no arguments', () => {
        const result = computeConditionEffects();
        expect(result).toEqual({
          attackAdvantageCount: 0,
          attackDisadvantageCount: 0,
          abilityCheckDisadvantage: false,
          abilityCheckAdvantage: false,
          abilityCheckAdvantageAbilities: null,
          abilityCheckAdvantageSkill: null,
          autoFailSaves: [],
          saveDisadvantage: [],
          cannotAct: false,
          speedZero: false,
          speedReduction: 0,
          concentrationBroken: false,
          targetAdvantageCount: 0,
          targetDisadvantageCount: 0,
          targetAdvantageIfWithin5ft: false,
          targetDisadvantageIfBeyond5ft: false,
          autoCritWithin5ft: false,
          resistantToAll: false,
          poisonImmune: false,
          saveAdvantage: [],
          saveAdvantageCount: 0,
          saveDisadvantageCount: 0,
          saveDisadvantageAbilities: null,
          autoReroll: false,
          autoRerollCondition: null,
          autoRerollBonus: null,
          strSaveReplace: false,
          strCheckReplace: false,
          wisCheckReplace: false,
          reliableTalent: false,
          tacticalMind: false,
          tacticalMindBonus: null,
          strokeOfLuck: false,
          luckyAdvantage: false,
          luckyDisadvantage: false,
          modifyD20Roll: false,
          modifyD20RollDice: null,
          modifyD20RollCanBeBonusOrPenalty: false,
          dexJump: false,
          restoreBalance: false,
          d20Floor10: false,
          noAdvantageAgainst: false,
          darkOnesLook: false,
          portent: false,
          potentCantrip: false,
          soulstitchSpells: false,
          passWithoutTraceBonus: null,
          improvedIllusions: false,
          illusoryReality: false,
          riderSaveDisadvantage: false,
          riderAttackBonus: 0,
          riderDamageExpression: null,
          riderDamageType: '',
          damageDoubled: false,
          riderCannotOpportunityAttack: false,
          riderNoReactions: false,
          pushEffect: false,
          pushDistance: null,
          saveType: null,
          saveDc: null,
          saveAbility: null,
          conditionToApply: null,
          conditionDuration: null,
          repeatingSave: false,
          hexSaveDisadvantage: false,
          hexSaveDisadvantageAbility: null,
          strCheckDisadvantage: false,
          slowRepeatSave: false,
          slowNoReactions: false,
          slowActionLimit: false,
          slowSingleAttackLimit: false,
          slowSomaticFailure: false,
          slowDexSaveDisadvantage: false,
          stinkingCloudRepeatSave: false,
          webRepeatSave: false,
          acPenalty: 0,
          rayOfEnfeebleDamageReduction: false,
          seeInvisibilityActive: false,
          wardingBondAcBonus: 0,
          cleaveAttack: false,
           vexAdvantageTargets: null,
           nickExtraAttack: false,
          toppleEffect: false,
          toppleSaveType: null,
          toppleSaveDc: null,
          toppleSaveAbility: null,
        });
      });
    });

    describe('condition: blinded', () => {
      it('grants attack disadvantage and target advantage', () => {
        const result = computeConditionEffects(['blinded']);
        expect(result.attackDisadvantageCount).toBe(1);
        expect(result.targetAdvantageCount).toBe(1);
      });
    });

    describe('condition: charmed', () => {
      it('grants attack disadvantage, target advantage, and save disadvantage for dex', () => {
        const result = computeConditionEffects(['charmed']);
        expect(result.attackDisadvantageCount).toBe(1);
        expect(result.targetAdvantageCount).toBe(1);
        expect(result.saveDisadvantage).toContain('dex');
      });
    });

    describe('condition: frightened', () => {
      it('grants attack disadvantage and ability check disadvantage', () => {
        const result = computeConditionEffects(['frightened']);
        expect(result.attackDisadvantageCount).toBe(1);
        expect(result.abilityCheckDisadvantage).toBe(true);
      });
    });

    describe('condition: grappled', () => {
      it('sets speedZero and grants attack disadvantage', () => {
        const result = computeConditionEffects(['grappled']);
        expect(result.speedZero).toBe(true);
        expect(result.attackDisadvantageCount).toBe(1);
      });
    });

    describe('condition: incapacitated', () => {
      it('sets cannotAct and concentrationBroken', () => {
        const result = computeConditionEffects(['incapacitated']);
        expect(result.cannotAct).toBe(true);
        expect(result.concentrationBroken).toBe(true);
      });
    });

    describe('condition: invisible', () => {
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

    describe('condition: paralyzed', () => {
      it('sets cannotAct, speedZero, autoCritWithin5ft, and autoFailSaves for str and dex', () => {
        const result = computeConditionEffects(['paralyzed']);
        expect(result.cannotAct).toBe(true);
        expect(result.speedZero).toBe(true);
        expect(result.autoCritWithin5ft).toBe(true);
        expect(result.targetAdvantageCount).toBe(1);
        expect(result.autoFailSaves).toEqual(['str', 'dex']);
      });
    });

    describe('condition: petrified', () => {
      it('sets cannotAct, speedZero, resistantToAll, poisonImmune, and autoFailSaves', () => {
        const result = computeConditionEffects(['petrified']);
        expect(result.cannotAct).toBe(true);
        expect(result.speedZero).toBe(true);
        expect(result.resistantToAll).toBe(true);
        expect(result.poisonImmune).toBe(true);
        expect(result.targetAdvantageCount).toBe(1);
        expect(result.autoFailSaves).toEqual(['str', 'dex']);
      });
    });

    describe('condition: poisoned', () => {
      it('grants attack disadvantage and ability check disadvantage', () => {
        const result = computeConditionEffects(['poisoned']);
        expect(result.attackDisadvantageCount).toBe(1);
        expect(result.abilityCheckDisadvantage).toBe(true);
      });
    });

    describe('condition: prone', () => {
      it('grants attack disadvantage and conditional target advantage based on range', () => {
        const result = computeConditionEffects(['prone']);
        expect(result.attackDisadvantageCount).toBe(1);
        expect(result.targetAdvantageIfWithin5ft).toBe(true);
        expect(result.targetDisadvantageIfBeyond5ft).toBe(true);
      });
    });

    describe('condition: restrained', () => {
      it('sets speedZero, grants attack disadvantage, target advantage, and save disadvantage for dex', () => {
        const result = computeConditionEffects(['restrained']);
        expect(result.speedZero).toBe(true);
        expect(result.attackDisadvantageCount).toBe(1);
        expect(result.targetAdvantageCount).toBe(1);
        expect(result.saveDisadvantage).toContain('dex');
      });
    });

    describe('condition: slow', () => {
      it('sets speedHalved, speedReduction, acPenalty, and multiple action/reaction restrictions', () => {
        const result = computeConditionEffects(['slow']);
        expect(result.speedHalved).toBe(true);
        expect(result.speedReduction).toBe(50);
        expect(result.acPenalty).toBe(2);
        expect(result.slowNoReactions).toBe(true);
        expect(result.slowActionLimit).toBe(true);
        expect(result.slowSingleAttackLimit).toBe(true);
        expect(result.slowSomaticFailure).toBe(true);
        expect(result.targetAdvantageCount).toBe(1);
        expect(result.saveDisadvantage).toContain('dex');
      });
    });

    describe('condition: speed_zero', () => {
      it('sets speedZero', () => {
        const result = computeConditionEffects(['speed_zero']);
        expect(result.speedZero).toBe(true);
      });
    });

    describe('condition: stunned', () => {
      it('sets cannotAct, speedZero, autoFailSaves, and grants target advantage', () => {
        const result = computeConditionEffects(['stunned']);
        expect(result.cannotAct).toBe(true);
        expect(result.speedZero).toBe(true);
        expect(result.autoFailSaves).toEqual(['str', 'dex']);
        expect(result.targetAdvantageCount).toBe(1);
      });
    });

    describe('condition: unconscious', () => {
      it('sets cannotAct, speedZero, autoFailSaves, and autoCritWithin5ft', () => {
        const result = computeConditionEffects(['unconscious']);
        expect(result.cannotAct).toBe(true);
        expect(result.speedZero).toBe(true);
        expect(result.autoFailSaves).toEqual(['str', 'dex']);
        expect(result.targetAdvantageCount).toBe(1);
        expect(result.autoCritWithin5ft).toBe(true);
      });
    });

    describe('condition: dazed', () => {
      it('sets dazed and grants target advantage', () => {
        const result = computeConditionEffects(['dazed']);
        expect(result.dazed).toBe(true);
        expect(result.targetAdvantageCount).toBe(1);
      });
    });

    describe('saveModifiers: advantage/disadvantage effects', () => {
      it('counts advantage save modifiers', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'advantage' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.saveAdvantageCount).toBe(1);
      });

      it('counts disadvantage save modifiers', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'disadvantage' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.saveDisadvantageCount).toBe(1);
      });

      it('tracks saveAdvantageAbilities when modifier has abilities and no abilityName is provided', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'advantage', abilities: ['STR'] }];
        const result = computeConditionEffects([], modifiers);
        expect(result.saveAdvantageAbilities).toEqual(['STR']);
        expect(result.saveAdvantageCount).toBe(0);
      });

      it('tracks saveAdvantageAbilities when modifier has abilities but no abilityName', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'advantage', abilities: ['STR', 'DEX'] }];
        const result = computeConditionEffects([], modifiers);
        expect(result.saveAdvantageAbilities).toEqual(['STR', 'DEX']);
        expect(result.saveAdvantageCount).toBe(0);
      });

      it('applies advantage for attack_roll target', () => {
        const modifiers = [{ target: 'attack_roll', effect: 'advantage' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.attackAdvantageCount).toBe(1);
      });

      it('applies advantage for attack_roll target with specific abilities', () => {
        const modifiers = [{ target: 'attack_roll', effect: 'advantage', abilities: ['STR', 'DEX'] }];
        const result = computeConditionEffects([], modifiers);
        expect(result.attackAdvantageCount).toBe(1);
      });
    });

    describe('saveModifiers: replacement effects', () => {
      it('sets strSaveReplace for STR replacement on saving_throw target', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'replacement', saveType: 'STR' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.strSaveReplace).toBe(true);
      });

      it('sets strCheckReplace for STR replacement on ability_check target', () => {
        const modifiers = [{ target: 'ability_check', effect: 'replacement', saveType: 'STR' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.strCheckReplace).toBe(true);
      });
    });

    describe('saveModifiers: special effects', () => {
      it('handles tactical_mind with bonusExpression', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'tactical_mind', bonusExpression: '1d4' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.tacticalMind).toBe(true);
        expect(result.tacticalMindBonus).toBe('1d4');
      });

      it('handles reliable_talent', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'reliable_talent' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.reliableTalent).toBe(true);
      });

      it('handles stroke_of_luck', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'stroke_of_luck' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.strokeOfLuck).toBe(true);
      });

      it('handles d20_floor_10', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'd20_floor_10' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.d20Floor10).toBe(true);
      });

      it('handles potent_cantrip', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'potent_cantrip' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.potentCantrip).toBe(true);
      });

      it('handles dex_jump', () => {
        const modifiers = [{ target: 'ability_check', effect: 'dex_jump' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.dexJump).toBe(true);
      });

      it('handles restore_balance', () => {
        const modifiers = [{ target: 'd20', effect: 'restore_balance' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.restoreBalance).toBe(true);
      });

      it('handles no_advantage_against', () => {
        const modifiers = [{ target: 'attack_roll', effect: 'no_advantage_against' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.noAdvantageAgainst).toBe(true);
      });

      it('handles dark_ones_look', () => {
        const modifiers = [{ target: 'attack_roll', effect: 'dark_ones_look' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.darkOnesLook).toBe(true);
      });

      it('handles portent with attack_roll target', () => {
        const modifiers = [{ target: 'attack_roll', effect: 'portent' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.portent).toBe(true);
      });

      it('handles portent with d20 target', () => {
        const modifiers = [{ target: 'd20', effect: 'portent' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.portent).toBe(true);
      });

      it('handles portent with saving_throw target', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'portent' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.portent).toBe(true);
      });

      it('handles improved_illusions', () => {
        const modifiers = [{ target: 'attack_roll', effect: 'improved_illusions' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.improvedIllusions).toBe(true);
      });

      it('handles illusory_reality', () => {
        const modifiers = [{ target: 'attack_roll', effect: 'illusory_reality' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.illusoryReality).toBe(true);
      });

      it('handles soulstitch_spells', () => {
        const modifiers = [{ target: 'attack_roll', effect: 'soulstitch_spells' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.soulstitchSpells).toBe(true);
      });

      it('handles pass_without_trace with bonusExpression', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'pass_without_trace', bonusExpression: '10' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.passWithoutTraceBonus).toBe('10');
      });

      it('handles str_check_disadvantage', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'str_check_disadvantage' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.strCheckDisadvantage).toBe(true);
      });

      it('handles ray_of_enfeeble_damage_reduction', () => {
        const modifiers = [{ target: 'attack_roll', effect: 'ray_of_enfeeble_damage_reduction' }];
        const result = computeConditionEffects([], modifiers);
        expect(result.rayOfEnfeebleDamageReduction).toBe(true);
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
    });

    describe('saveModifiers: condition-conditional effects', () => {
      it('does not apply advantage when modifier.condition is a CONDITION_KEYWORD', () => {
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

      it('handles death_strike with save parameters', () => {
        const effects = [{ effect: 'death_strike', saveType: 'CON', saveDc: 15, damageDoubled: true }];
        const result = computeConditionEffects([], [], effects);
        expect(result.saveType).toBe('CON');
        expect(result.saveDc).toBe(15);
        expect(result.damageDoubled).toBe(true);
      });

      it('handles sleep_repeat_save', () => {
        const effects = [{ effect: 'sleep_repeat_save', saveType: 'WIS', saveDc: 13 }];
        const result = computeConditionEffects([], [], effects);
        expect(result.sleepRepeatSave).toBe(true);
        expect(result.repeatingSave).toBe(true);
        expect(result.saveType).toBe('WIS');
        expect(result.conditionToApply).toBe('unconscious');
      });

      it('handles slow_repeat_save', () => {
        const effects = [{ effect: 'slow_repeat_save', saveType: 'WIS', saveDc: 15 }];
        const result = computeConditionEffects([], [], effects);
        expect(result.slowRepeatSave).toBe(true);
        expect(result.repeatingSave).toBe(true);
      });

      it('handles stinking_cloud_repeat_save', () => {
        const effects = [{ effect: 'stinking_cloud_repeat_save', saveType: 'CON', saveDc: 14 }];
        const result = computeConditionEffects([], [], effects);
        expect(result.stinkingCloudRepeatSave).toBe(true);
        expect(result.conditionToApply).toBe('poisoned');
      });

      it('handles web_repeat_save', () => {
        const effects = [{ effect: 'web_repeat_save', saveType: 'DEX', saveDc: 14 }];
        const result = computeConditionEffects([], [], effects);
        expect(result.webRepeatSave).toBe(true);
        expect(result.conditionToApply).toBe('restrained');
      });

      it('handles power_word_stun_repeat_save', () => {
        const effects = [{ effect: 'power_word_stun_repeat_save', saveType: 'CON', saveDc: 18 }];
        const result = computeConditionEffects([], [], effects);
        expect(result.powerWordStun).toBe(true);
        expect(result.repeatingSave).toBe(true);
        expect(result.conditionToApply).toBe('stunned');
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
      it('handles next_attack_advantage', () => {
        const effects = [{ effect: 'next_attack_advantage' }];
        const result = computeConditionEffects([], [], effects);
        expect(result.attackAdvantageCount).toBe(1);
      });

      it('handles next_attack_advantage with vexTarget', () => {
        const effects = [{ effect: 'next_attack_advantage', target: 'Player', vexTarget: 'Goblin' }];
        const result = computeConditionEffects([], [], effects);
        expect(result.attackAdvantageCount).toBe(0);
        expect(result.vexAdvantageTargets).toEqual(['Goblin']);
      });

      it('handles crusher_enhanced_critical', () => {
        const effects = [{ effect: 'crusher_enhanced_critical' }];
        const result = computeConditionEffects([], [], effects);
        expect(result.targetAdvantageCount).toBe(1);
      });

      it('handles clairvoyant_combatant with attackerAdvantage and defenderDisadvantage', () => {
        const effects = [{ effect: 'clairvoyant_combatant', attackerAdvantage: true, defenderDisadvantage: true }];
        const result = computeConditionEffects([], [], effects);
        expect(result.targetAdvantageCount).toBe(1);
        expect(result.attackDisadvantageCount).toBe(1);
      });

      it('handles multiattack_defense', () => {
        const effects = [{ effect: 'multiattack_defense' }];
        const result = computeConditionEffects([], [], effects);
        expect(result.targetDisadvantageCount).toBe(1);
      });

      it('handles escape_the_horde', () => {
        const effects = [{ effect: 'escape_the_horde' }];
        const result = computeConditionEffects([], [], effects);
        expect(result.targetDisadvantageCount).toBe(1);
      });

      it('handles disadvantage_perception_checks', () => {
        const effects = [{ effect: 'disadvantage_perception_checks' }];
        const result = computeConditionEffects([], [], effects);
        expect(result.abilityCheckDisadvantage).toBe(true);
      });

      it('handles ray_of_enfeeble_debuff', () => {
        const effects = [{ effect: 'ray_of_enfeeble_debuff', strCheckDisadvantage: true, rayOfEnfeebleDamageReduction: true }];
        const result = computeConditionEffects([], [], effects);
        expect(result.strCheckDisadvantage).toBe(true);
        expect(result.rayOfEnfeebleDamageReduction).toBe(true);
      });
    });

    describe('targetEffects: movement and positioning', () => {
      it('handles speed_reduction', () => {
        const effects = [{ effect: 'speed_reduction', value: 20 }];
        const result = computeConditionEffects([], [], effects);
        expect(result.speedReduction).toBe(20);
      });

      it('handles push', () => {
        const effects = [{ effect: 'push', value: 10 }];
        const result = computeConditionEffects([], [], effects);
        expect(result.pushEffect).toBe(true);
        expect(result.pushDistance).toBe(10);
      });

      it('handles prone_and_push', () => {
        const effects = [{ effect: 'prone_and_push', value: 15 }];
        const result = computeConditionEffects([], [], effects);
        expect(result.pushEffect).toBe(true);
        expect(result.pushDistance).toBe(15);
        expect(result.proneEffect).toBe(true);
      });

      it('handles ac_penalty', () => {
        const effects = [{ effect: 'ac_penalty', value: 3 }];
        const result = computeConditionEffects([], [], effects);
        expect(result.acPenalty).toBe(3);
      });

      it('handles dex_save_disadvantage', () => {
        const effects = [{ effect: 'dex_save_disadvantage' }];
        const result = computeConditionEffects([], [], effects);
        expect(result.slowDexSaveDisadvantage).toBe(true);
      });
    });

    describe('targetEffects: combat actions', () => {
      it('handles no_opportunity_attacks as effect', () => {
        const effects = [{ effect: 'no_opportunity_attacks' }];
        const result = computeConditionEffects([], [], effects);
        expect(result.riderCannotOpportunityAttack).toBe(true);
      });

      it('handles noOpportunityAttacks as property', () => {
        const effects = [{ noOpportunityAttacks: true }];
        const result = computeConditionEffects([], [], effects);
        expect(result.riderCannotOpportunityAttack).toBe(true);
      });

      it('handles no_reactions', () => {
        const effects = [{ effect: 'no_reactions' }];
        const result = computeConditionEffects([], [], effects);
        expect(result.riderNoReactions).toBe(true);
      });

      it('handles cleave with target and source', () => {
        const effects = [{ effect: 'cleave', target: 'creature1', source: 'creature2' }];
        const result = computeConditionEffects([], [], effects);
        expect(result.cleaveAttack).toBe(true);
        expect(result.cleaveTarget).toBe('creature1');
        expect(result.cleaveSource).toBe('creature2');
      });

      it('handles nick', () => {
        const effects = [{ effect: 'nick', target: 'creature1', source: 'creature2' }];
        const result = computeConditionEffects([], [], effects);
        expect(result.nickExtraAttack).toBe(true);
      });

      it('handles topple with save parameters', () => {
        const effects = [{ effect: 'topple', saveType: 'CON', saveDc: 15 }];
        const result = computeConditionEffects([], [], effects);
        expect(result.toppleEffect).toBe(true);
        expect(result.saveType).toBe('CON');
        expect(result.conditionToApply).toBe('prone');
      });
    });

    describe('targetEffects: damage and special', () => {
      it('handles damage_bonus with all parameters', () => {
        const effects = [{ effect: 'damage_bonus', value: 5, damageExpression: '1d6', damageType: 'fire' }];
        const result = computeConditionEffects([], [], effects);
        expect(result.riderAttackBonus).toBe(5);
        expect(result.riderDamageExpression).toBe('1d6');
        expect(result.riderDamageType).toBe('fire');
      });

      it('handles mass_fear with range', () => {
        const effects = [{ effect: 'mass_fear', saveType: 'WIS', saveDc: 15, range: '30_ft' }];
        const result = computeConditionEffects([], [], effects);
        expect(result.saveType).toBe('WIS');
        expect(result.conditionToApply).toBe('frightened');
        expect(result.massFearRange).toBe('30_ft');
      });

      it('handles foresight with comprehensive benefits', () => {
        const effects = [{ effect: 'foresight' }];
        const result = computeConditionEffects([], [], effects);
        expect(result.attackAdvantageCount).toBe(1);
        expect(result.saveAdvantageCount).toBe(1);
        expect(result.abilityCheckAdvantage).toBe(true);
        expect(result.targetDisadvantageCount).toBe(1);
      });

      it('handles incapacitated effect with saveType (hurl through hell)', () => {
        const effects = [{ effect: 'incapacitated', saveType: 'WIS', saveDc: 15 }];
        const result = computeConditionEffects([], [], effects);
        expect(result.saveType).toBe('WIS');
        expect(result.conditionToApply).toBe('incapacitated');
        expect(result.hurlThroughHell).toBe(true);
      });
    });

    describe('combined conditions', () => {
      it('stacks effects from multiple conditions', () => {
        const result = computeConditionEffects(['blinded', 'paralyzed']);
        expect(result.cannotAct).toBe(true);
        expect(result.speedZero).toBe(true);
        expect(result.attackDisadvantageCount).toBe(1);
        expect(result.autoFailSaves).toEqual(['str', 'dex']);
      });

      it('applies save modifiers when conditions are active', () => {
        const modifiers = [{ target: 'saving_throw', effect: 'advantage', condition: 'fiend_undead' }];
        const result = computeConditionEffects(['fiend_undead'], modifiers);
        expect(result.saveAdvantageCount).toBe(1);
      });
    });
  });

  describe('getNetAttackMode', () => {
    it('returns advantage when advantage count exceeds disadvantage', () => {
      expect(getNetAttackMode(3, 1, false)).toBe('advantage');
    });

    it('returns disadvantage when disadvantage count exceeds advantage', () => {
      expect(getNetAttackMode(1, 3, false)).toBe('disadvantage');
    });

    it('returns normal when counts are equal and non-zero', () => {
      expect(getNetAttackMode(2, 2, false)).toBe('normal');
    });

    it('returns normal when both are zero', () => {
      expect(getNetAttackMode(0, 0, false)).toBe('normal');
    });

    it('returns advantage when restoreBalance reduces disadvantage to zero', () => {
      expect(getNetAttackMode(2, 1, true)).toBe('advantage');
    });

    it('returns normal when restoreBalance eliminates the advantage', () => {
      expect(getNetAttackMode(1, 1, true)).toBe('normal');
    });

    it('returns normal when restoreBalance eliminates disadvantage', () => {
      expect(getNetAttackMode(0, 1, true)).toBe('normal');
    });

    it('returns normal when restoreBalance eliminates advantage but disadvantage remains', () => {
      expect(getNetAttackMode(1, 2, true)).toBe('disadvantage');
    });

    it('returns normal when restoreBalance with equal counts', () => {
      expect(getNetAttackMode(2, 2, true)).toBe('normal');
    });

    it('handles restoreBalance when advantage is zero and disadvantage remains', () => {
      expect(getNetAttackMode(0, 2, true)).toBe('disadvantage');
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

    it('returns normal when combined counts cancel out', () => {
      const attacker = { attackAdvantageCount: 1, attackDisadvantageCount: 0, restoreBalance: false };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 1 };
      expect(combineAttackModes(attacker, target, 10)).toBe('normal');
    });

    it('adds advantage when target is prone and within 5ft', () => {
      const attacker = { attackAdvantageCount: 0, attackDisadvantageCount: 0, restoreBalance: false };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0, targetAdvantageIfWithin5ft: true };
      expect(combineAttackModes(attacker, target, 5)).toBe('advantage');
    });

    it('does not add advantage when target is prone but beyond 5ft', () => {
      const attacker = { attackAdvantageCount: 0, attackDisadvantageCount: 0, restoreBalance: false };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0, targetAdvantageIfWithin5ft: true };
      expect(combineAttackModes(attacker, target, 10)).toBe('normal');
    });

    it('adds disadvantage when target is beyond 5ft and has disadvantage beyond range', () => {
      const attacker = { attackAdvantageCount: 0, attackDisadvantageCount: 0, restoreBalance: false };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0, targetDisadvantageIfBeyond5ft: true };
      expect(combineAttackModes(attacker, target, 10)).toBe('disadvantage');
    });

    it('does not add disadvantage when target is within 5ft and has disadvantage beyond range', () => {
      const attacker = { attackAdvantageCount: 0, attackDisadvantageCount: 0, restoreBalance: false };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0, targetDisadvantageIfBeyond5ft: true };
      expect(combineAttackModes(attacker, target, 5)).toBe('normal');
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

    it('resets advantage to zero with noAdvantageAgainst overriding restoreBalance', () => {
      const attacker = { attackAdvantageCount: 3, attackDisadvantageCount: 1, restoreBalance: false };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0, noAdvantageAgainst: true, restoreBalance: true };
      expect(combineAttackModes(attacker, target, 10)).toBe('normal');
    });

    it('adds advantage when attacking a Vex target that matches', () => {
      const attacker = { attackAdvantageCount: 0, attackDisadvantageCount: 0, restoreBalance: false, vexAdvantageTargets: ['Goblin'] };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0 };
      expect(combineAttackModes(attacker, target, 5, 'Goblin')).toBe('advantage');
    });

    it('does not add advantage when attacking a different creature than the Vex target', () => {
      const attacker = { attackAdvantageCount: 0, attackDisadvantageCount: 0, restoreBalance: false, vexAdvantageTargets: ['Goblin'] };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0 };
      expect(combineAttackModes(attacker, target, 5, 'Orc')).toBe('normal');
    });

    it('does not add advantage when vexAdvantageTargets is null', () => {
      const attacker = { attackAdvantageCount: 0, attackDisadvantageCount: 0, restoreBalance: false, vexAdvantageTargets: null };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0 };
      expect(combineAttackModes(attacker, target, 5, 'Goblin')).toBe('normal');
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

  describe('hasSaveAdvantage', () => {
    it('returns false for null effects', () => {
      expect(hasSaveAdvantage(null, 'STR', false)).toBe(false);
    });

    it('returns false when no save advantage exists', () => {
      const result = computeConditionEffects();
      expect(hasSaveAdvantage(result, 'STR', false)).toBe(false);
    });

    it('returns true when saveAdvantageCount is positive', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage' }];
      const effects = computeConditionEffects([], modifiers);
      expect(hasSaveAdvantage(effects, 'STR', false)).toBe(true);
    });

    it('returns true for condition-specific saveAdvantage', () => {
      const modifiers = [{ target: 'saving_throw', condition: 'charmed', effect: 'advantage' }];
      const effects = computeConditionEffects(['charmed'], modifiers);
      expect(hasSaveAdvantage(effects, 'charmed', false)).toBe(true);
    });

    it('returns false for non-matching condition-specific saveAdvantage', () => {
      const modifiers = [{ target: 'saving_throw', condition: 'charmed', effect: 'advantage' }];
      const effects = computeConditionEffects(['charmed'], modifiers);
      expect(hasSaveAdvantage(effects, 'frightened', false)).toBe(false);
    });

    it('returns true when restoreBalance still leaves advantage', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage' }, { target: 'saving_throw', effect: 'advantage' }];
      const effects = computeConditionEffects([], modifiers);
      expect(hasSaveAdvantage(effects, 'STR', true)).toBe(true);
    });

    it('returns false when restoreBalance consumes all advantage', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage' }];
      const effects = computeConditionEffects([], modifiers);
      expect(hasSaveAdvantage(effects, 'STR', true)).toBe(false);
    });

    it('returns true for ability-specific saveAdvantageAbilities', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage', abilities: ['STR'] }];
      const effects = computeConditionEffects([], modifiers);
      expect(hasSaveAdvantage(effects, 'STR', false)).toBe(true);
    });

    it('returns false for non-matching ability in saveAdvantageAbilities', () => {
      const modifiers = [{ target: 'saving_throw', effect: 'advantage', abilities: ['DEX'] }];
      const effects = computeConditionEffects([], modifiers);
      expect(hasSaveAdvantage(effects, 'STR', false)).toBe(false);
    });
  });
});
