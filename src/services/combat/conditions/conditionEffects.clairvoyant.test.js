import { describe, it, expect } from 'vitest';
import { computeConditionEffects, combineAttackModes } from './conditionEffects.js';

// CLA-053: Clairvoyant Combatant te fold — both legs must fire.
// te rides on the BONDED creature's bucket (target = bonded):
//   holder (warlock) attacks bonded  → Advantage  (targetAdvantageCount)
//   bonded attacks the holder        → Disadvantage (targetAttackDisadvantageCount)
describe('CLA-053 Clairvoyant Combatant te fold', () => {
    const te = {
        effect: 'clairvoyant_combatant',
        target: 'Bandit 1',
        source: 'Clairvoyant Combatant',
        attackerAdvantage: true,
        defenderDisadvantage: true,
    };

    it('holder attacks bonded → Advantage via targetAdvantageCount', () => {
        const bondedEffects = computeConditionEffects({ targetEffects: [te] });
        expect(bondedEffects.targetAdvantageCount).toBeGreaterThanOrEqual(1);
        expect(bondedEffects.targetAdvantageReasons).toContain('Clairvoyant Combatant');
        expect(combineAttackModes(computeConditionEffects({}), bondedEffects, null, 'Bandit 1')).toBe('advantage');
    });

    it('bonded attacks holder → Disadvantage via targetAttackDisadvantageCount (attacker bucket)', () => {
        const bondedEffects = computeConditionEffects({ targetEffects: [te] });
        expect(bondedEffects.targetAttackDisadvantageCount).toBeGreaterThanOrEqual(1);
        expect(combineAttackModes(bondedEffects, computeConditionEffects({}), null, 'HexWarlock')).toBe('disadvantage');
    });

    it('old defender-bucket fold is gone: te holder does NOT leak targetDisadvantageCount', () => {
        const bondedEffects = computeConditionEffects({ targetEffects: [te] });
        expect(bondedEffects.targetDisadvantageCount).toBe(0);
    });
});
