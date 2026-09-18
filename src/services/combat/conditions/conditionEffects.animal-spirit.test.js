import { describe, it, expect } from 'vitest';
import { computeConditionEffects, combineAttackModes } from './conditionEffects.js';

// MA-0275: Animal Lord "Animal Spirit" variant te consumers.
describe('MA-0275 Animal Spirit variant te consumers', () => {
    it('marked_as_prey with vexTarget folds Advantage against the marked target only', () => {
        const lordEffects = computeConditionEffects({
            targetEffects: [{ effect: 'marked_as_prey', target: 'Animal Lord 1', source: 'Animal Lord 1', vexTarget: 'ElderPaladin' }],
        });
        expect(lordEffects.vexAdvantageTargets).toContain('ElderPaladin');
        expect(combineAttackModes(lordEffects, computeConditionEffects({}), null, 'ElderPaladin')).toBe('advantage');
        expect(combineAttackModes(lordEffects, computeConditionEffects({}), null, 'Rogue')).toBe('normal');
    });

    it('pesky_swarm grants attack disadvantage AND abilityCheckDisadvantage to the holder', () => {
        const effects = computeConditionEffects({
            targetEffects: [{ effect: 'pesky_swarm', target: 'ElderPaladin', source: 'Animal Lord 1' }],
        });
        expect(effects.attackDisadvantageCount).toBeGreaterThanOrEqual(1);
        expect(effects.abilityCheckDisadvantage).toBe(true);
    });

    it('rows without the variant tes are inert', () => {
        const effects = computeConditionEffects({
            targetEffects: [{ effect: 'speed_half', target: 'ElderPaladin', source: 'Animal Lord 1' }],
        });
        expect(effects.attackDisadvantageCount).toBe(0);
        expect(effects.abilityCheckDisadvantage).toBe(false);
    });
});
