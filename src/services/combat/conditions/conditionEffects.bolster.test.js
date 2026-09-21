// MA-0694: Empyrean Bolster te consumer — te `bolster_advantage` ("Advantage
// on D20 Tests") stamped on the empyrean + allied combatants folds the SAME
// verified channels as foresight (minus the defender-disadvantage leg):
// attackAdvantageCount → combineAttackModes (holder attacks, monster + PC),
// saveAdvantageCount → CharAbilities/CharSheet save chips, abilityCheckAdvantage
// → CharAbilities/useCharActionsBaseActions checks.
import { describe, it, expect } from 'vitest';
import { computeConditionEffects, combineAttackModes } from './conditionEffects.js';

const BOLSTER_TE = { effect: 'bolster_advantage', target: 'Bandit 1', source: 'Empyrean 1' };

describe('MA-0694 bolster_advantage te consumer', () => {
  it('folds Advantage on attacks + saves + ability checks for the holder', () => {
    const effects = computeConditionEffects({ targetEffects: [BOLSTER_TE] });
    expect(effects.attackAdvantageCount).toBeGreaterThanOrEqual(1);
    expect(effects.attackAdvantageReasons).toContain('Empyrean 1');
    expect(effects.saveAdvantageCount).toBeGreaterThanOrEqual(1);
    expect(effects.saveAdvantageReasons).toContain('Empyrean 1');
    expect(effects.abilityCheckAdvantage).toBe(true);
    expect(effects.abilityCheckAdvantageReasons).toContain('Empyrean 1');
  });

  it('combineAttackModes returns advantage on the holder attack with no offsetting disadvantage', () => {
    const holderEffects = computeConditionEffects({ targetEffects: [BOLSTER_TE] });
    expect(combineAttackModes(holderEffects, computeConditionEffects({}), null, 'AasimarTest')).toBe('advantage');
  });

  it('does NOT grant creatures attacking the holder any advantage (no foresight defender leg)', () => {
    const holderEffects = computeConditionEffects({ targetEffects: [BOLSTER_TE] });
    const attackerEffects = computeConditionEffects({});
    expect(holderEffects.targetDisadvantageCount).toBe(0);
    expect(combineAttackModes(attackerEffects, computeConditionEffects({}), null, 'Bandit 1')).toBe('normal');
  });

  it('rows without the te stay inert', () => {
    const effects = computeConditionEffects({ targetEffects: [{ effect: 'speed_half', target: 'Bandit 1', source: 'Empyrean 1' }] });
    expect(effects.attackAdvantageCount).toBe(0);
    expect(effects.saveAdvantageCount).toBe(0);
    expect(effects.abilityCheckAdvantage).toBe(false);
  });
});
