// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { collectSaveModifiers } from '../automation/automationModifiers.js';
import { collectAutomationFromFeatures } from '../automation/automationCollector.js';
import {
  computeConditionEffects,
  getNetAttackMode,
  combineAttackModes,
  hasSaveAdvantage,
} from './conditionEffects.js';

describe('restore_balance feature', () => {
  describe('collectSaveModifiers extracts restore_balance', () => {
    it('extracts a restore_balance modifier from a feature with single automation', () => {
      const features = [{
        name: 'Restore Balance',
        automation: { type: 'restore_balance', target: 'd20', range: '60_ft' },
      }];

      const result = collectSaveModifiers(features);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        source: 'Restore Balance',
        target: 'd20',
        effect: 'restore_balance',
      });
    });

    it('extracts restore_balance when automation is an array', () => {
      const features = [{
        name: 'Restore Balance',
        automation: [
          { type: 'restore_balance', target: 'd20' },
          { type: 'some_other', target: 'attack_roll' },
        ],
      }];

      const result = collectSaveModifiers(features);

      const balanceMods = result.filter(m => m.effect === 'restore_balance');
      expect(balanceMods).toHaveLength(1);
      expect(balanceMods[0].source).toBe('Restore Balance');
    });

    it('extracts restore_balance with default target when not specified', () => {
      const features = [{
        name: 'Restore Balance',
        automation: { type: 'restore_balance' },
      }];

      const result = collectSaveModifiers(features);

      expect(result[0].target).toBe('d20');
    });

    it('ignores features without automation', () => {
      const features = [
        { name: 'Restore Balance' },
        { name: 'Restore Balance', automation: { type: 'restore_balance' } },
      ];

      const result = collectSaveModifiers(features);

      expect(result).toHaveLength(1);
    });

    it('ignores features with null automation', () => {
      const features = [
        { name: 'Restore Balance', automation: null },
        { name: 'Restore Balance', automation: { type: 'restore_balance' } },
      ];

      const result = collectSaveModifiers(features);

      expect(result).toHaveLength(1);
    });

    it('returns empty array when features is null', () => {
      const result = collectSaveModifiers(null);
      expect(result).toEqual([]);
    });

    it('returns empty array when features is undefined', () => {
      const result = collectSaveModifiers(undefined);
      expect(result).toEqual([]);
    });
  });

  describe('collectAutomationFromFeatures categorizes restore_balance', () => {
    it('places restore_balance in reactions', () => {
      const features = [{
        name: 'Restore Balance',
        automation: { type: 'restore_balance', target: 'd20' },
      }];

      const result = collectAutomationFromFeatures(features, {});

      expect(result.reactions).toHaveLength(1);
      expect(result.reactions[0].type).toBe('restore_balance');
    });

    it('does not place restore_balance in actions', () => {
      const features = [{
        name: 'Restore Balance',
        automation: { type: 'restore_balance', target: 'd20' },
      }];

      const result = collectAutomationFromFeatures(features, {});

      const actionTypes = result.actions.map(a => a.type);
      expect(actionTypes).not.toContain('restore_balance');
    });

    it('does not place restore_balance in bonusActions', () => {
      const features = [{
        name: 'Restore Balance',
        automation: { type: 'restore_balance', target: 'd20' },
      }];

      const result = collectAutomationFromFeatures(features, {});

      const bonusActionTypes = result.bonusActions.map(a => a.type);
      expect(bonusActionTypes).not.toContain('restore_balance');
    });

    it('returns empty arrays when features is null', () => {
      const result = collectAutomationFromFeatures(null, {});
      expect(result.actions).toEqual([]);
      expect(result.bonusActions).toEqual([]);
      expect(result.reactions).toEqual([]);
    });
  });

  describe('computeConditionEffects sets restoreBalance flag', () => {
    it('sets restoreBalance to true when a restore_balance modifier is present', () => {
      const saveModifiers = [{
        source: 'Restore Balance',
        target: 'd20',
        condition: '',
        effect: 'restore_balance',
      }];

      const effects = computeConditionEffects([], saveModifiers);

      expect(effects.restoreBalance).toBe(true);
    });

    it('sets restoreBalance to false when no restore_balance modifier exists', () => {
      const saveModifiers = [{
        source: 'Other Feature',
        target: 'saving_throw',
        effect: 'advantage',
      }];

      const effects = computeConditionEffects([], saveModifiers);

      expect(effects.restoreBalance).toBe(false);
    });

    it('sets restoreBalance to false with empty modifiers', () => {
      const effects = computeConditionEffects([], []);
      expect(effects.restoreBalance).toBe(false);
    });

    it('sets restoreBalance to false with no modifiers argument', () => {
      const effects = computeConditionEffects();
      expect(effects.restoreBalance).toBe(false);
    });
  });

  describe('getNetAttackMode with restoreBalance', () => {
    it('neutralizes one advantage', () => {
      expect(getNetAttackMode(1, 0, true)).toBe('normal');
    });

    it('neutralizes one disadvantage', () => {
      expect(getNetAttackMode(0, 1, true)).toBe('normal');
    });

    it('leaves excess advantage after neutralization', () => {
      expect(getNetAttackMode(2, 1, true)).toBe('advantage');
    });

    it('leaves excess disadvantage after neutralization', () => {
      expect(getNetAttackMode(1, 2, true)).toBe('disadvantage');
    });

    it('leaves excess advantage when advantage far exceeds disadvantage', () => {
      expect(getNetAttackMode(5, 1, true)).toBe('advantage');
    });

    it('leaves excess disadvantage when disadvantage far exceeds advantage', () => {
      expect(getNetAttackMode(1, 5, true)).toBe('disadvantage');
    });

    it('returns normal when both counts are zero', () => {
      expect(getNetAttackMode(0, 0, true)).toBe('normal');
    });

    it('returns normal when advantage equals disadvantage with restoreBalance', () => {
      expect(getNetAttackMode(3, 3, true)).toBe('normal');
    });

    it('does not modify counts when restoreBalance is false', () => {
      expect(getNetAttackMode(1, 0, false)).toBe('advantage');
      expect(getNetAttackMode(0, 1, false)).toBe('disadvantage');
    });

    it('returns advantage when restoreBalance reduces but advantage remains', () => {
      expect(getNetAttackMode(3, 1, true)).toBe('advantage');
    });

    it('returns disadvantage when restoreBalance reduces but disadvantage remains', () => {
      expect(getNetAttackMode(1, 3, true)).toBe('disadvantage');
    });
  });

  describe('combineAttackModes with restoreBalance', () => {
    it('neutralizes a single attacker advantage from restoreBalance on attacker', () => {
      const attacker = { attackAdvantageCount: 1, attackDisadvantageCount: 0, restoreBalance: true };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0 };
      expect(combineAttackModes(attacker, target, 10)).toBe('normal');
    });

    it('neutralizes a single target advantage from restoreBalance on target', () => {
      const attacker = { attackAdvantageCount: 0, attackDisadvantageCount: 0, restoreBalance: false };
      const target = { targetAdvantageCount: 1, targetDisadvantageCount: 0, restoreBalance: true };
      expect(combineAttackModes(attacker, target, 10)).toBe('normal');
    });

    it('does not neutralize when both sides have advantage', () => {
      const attacker = { attackAdvantageCount: 1, attackDisadvantageCount: 0, restoreBalance: true };
      const target = { targetAdvantageCount: 1, targetDisadvantageCount: 0, restoreBalance: false };
      expect(combineAttackModes(attacker, target, 10)).toBe('advantage');
    });

    it('neutralizes combined advantage/disadvantage across attacker and target', () => {
      const attacker = { attackAdvantageCount: 1, attackDisadvantageCount: 0, restoreBalance: true };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 1 };
      expect(combineAttackModes(attacker, target, 10)).toBe('normal');
    });

    it('respects noAdvantageAgainst even with restoreBalance', () => {
      const attacker = { attackAdvantageCount: 3, attackDisadvantageCount: 0, restoreBalance: true };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0, noAdvantageAgainst: true };
      expect(combineAttackModes(attacker, target, 10)).toBe('normal');
    });

    it('handles restoreBalance with prone positioning advantage', () => {
      const attacker = { attackAdvantageCount: 0, attackDisadvantageCount: 0, restoreBalance: true };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0, targetAdvantageIfWithin5ft: true };
      expect(combineAttackModes(attacker, target, 5)).toBe('normal');
    });

    it('handles restoreBalance with prone disadvantage beyond 5ft', () => {
      const attacker = { attackAdvantageCount: 0, attackDisadvantageCount: 0, restoreBalance: true };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 0, targetDisadvantageIfBeyond5ft: true };
      expect(combineAttackModes(attacker, target, 10)).toBe('normal');
    });

    it('leaves excess advantage when restoreBalance cannot cancel all', () => {
      const attacker = { attackAdvantageCount: 1, attackDisadvantageCount: 0, restoreBalance: true };
      const target = { targetAdvantageCount: 2, targetDisadvantageCount: 0 };
      expect(combineAttackModes(attacker, target, 10)).toBe('advantage');
    });

    it('leaves excess disadvantage when restoreBalance cannot cancel all', () => {
      const attacker = { attackAdvantageCount: 0, attackDisadvantageCount: 0, restoreBalance: true };
      const target = { targetAdvantageCount: 0, targetDisadvantageCount: 3 };
      expect(combineAttackModes(attacker, target, 10)).toBe('disadvantage');
    });
  });

  describe('hasSaveAdvantage with restoreBalance', () => {
    it('returns false when restoreBalance cancels a single advantage count', () => {
      const effects = { saveAdvantageCount: 1, saveDisadvantageCount: 0 };
      expect(hasSaveAdvantage(effects, 'con', true)).toBe(false);
    });

    it('returns true when advantage count exceeds restoreBalance cancellation', () => {
      const effects = { saveAdvantageCount: 2, saveDisadvantageCount: 0 };
      expect(hasSaveAdvantage(effects, 'con', true)).toBe(true);
    });

    it('returns true for condition-specific advantage despite restoreBalance', () => {
      const effects = { saveAdvantageCount: 0, saveDisadvantageCount: 0, saveAdvantage: ['charmed'] };
      expect(hasSaveAdvantage(effects, 'charmed', true)).toBe(true);
    });

    it('returns false for non-matching condition-specific advantage with restoreBalance', () => {
      const effects = { saveAdvantageCount: 0, saveDisadvantageCount: 0, saveAdvantage: ['charmed'] };
      expect(hasSaveAdvantage(effects, 'con', true)).toBe(false);
    });

    it('returns false when no advantages exist and restoreBalance is true', () => {
      const effects = { saveAdvantageCount: 0, saveDisadvantageCount: 0 };
      expect(hasSaveAdvantage(effects, 'con', true)).toBe(false);
    });

    it('returns true for ability-specific advantage despite restoreBalance', () => {
      const effects = { saveAdvantageCount: 0, saveDisadvantageCount: 0, saveAdvantageAbilities: ['CON'] };
      expect(hasSaveAdvantage(effects, 'con', true)).toBe(true);
    });

    it('returns false for non-matching ability with restoreBalance', () => {
      const effects = { saveAdvantageCount: 0, saveDisadvantageCount: 0, saveAdvantageAbilities: ['STR'] };
      expect(hasSaveAdvantage(effects, 'con', true)).toBe(false);
    });

    it('returns true when advantage count exceeds with restoreBalance', () => {
      const effects = { saveAdvantageCount: 3, saveDisadvantageCount: 0 };
      expect(hasSaveAdvantage(effects, 'con', true)).toBe(true);
    });

    it('returns false for against_spell advantage with restoreBalance (no-op, always true)', () => {
      const effects = { saveAdvantageCount: 0, saveAdvantage: ['against_spell'] };
      expect(hasSaveAdvantage(effects, 'con', true)).toBe(true);
    });

    it('returns false when effects is null', () => {
      expect(hasSaveAdvantage(null, 'con', true)).toBe(false);
    });
  });
});
