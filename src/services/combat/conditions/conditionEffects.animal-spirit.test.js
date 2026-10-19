// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import { computeConditionEffects, combineAttackModes } from './conditionEffects.js';

// MA-0275 lane: Animal Spirit variant te CONSUMER folds in conditionEffects.js
// EARLY_TARGET_EFFECT_HANDLERS (marked_as_prey :329, pesky_swarm :342).
// Conditions family map: producers (te writes, rounds:2 clocks, grant logs)
// live in saveProcessing.animal-spirit.test.js; the generic vexTarget channel
// and raw adv/dis folding are owned by conditionEffects.test.js /
// conditionEffectsCompute.test.js (#964 engine-owned); registry truth is
// golden-once in targetEffectDefinitions.test.js (#820). Fortify (Forager)
// is THP-only in saveProcessing and never touches this engine — not here.
// Old→new map: old T1 strengthened (exact vex write bytes + producer-stamp
// te, #993); new T2 added (no-vexTarget fallback leg, guard-removal control
// #921); old T2 strengthened (exact count + combine fold, #825); old T3
// strengthened with dispatch proof so it can't pass vacuously (#842).
describe('MA-0275 Animal Spirit variant te consumers', () => {
    // Exact producer stamp: saveProcessing.js registerTargetEffect call for
    // the LORD-carried te (vexTarget = save target), via targetEffectDefinitions.js:1497.
    const preyTe = (vexTarget) => ({
        target: 'Animal Lord 1',
        effect: 'marked_as_prey',
        source: 'Animal Lord 1',
        duration: 'until_start_of_attacker_next_turn',
        vexTarget,
        actionName: 'Animal Spirit',
    });

    it('marked_as_prey with vexTarget records that target in vexAdvantageTargets and folds Advantage against it only', () => {
        const lordEffects = computeConditionEffects({ targetEffects: [preyTe('ElderPaladin')] });
        expect(lordEffects.vexAdvantageTargets).toEqual(['ElderPaladin']);
        expect(lordEffects.attackAdvantageCount).toBe(0);

        const empty = computeConditionEffects({});
        expect(combineAttackModes(lordEffects, empty, null, 'ElderPaladin')).toBe('advantage');
        expect(combineAttackModes(lordEffects, empty, null, 'Rogue')).toBe('normal');
    });

    it('marked_as_prey without vexTarget falls back to unconditional Advantage credited to the source', () => {
        const te = preyTe(undefined);
        delete te.vexTarget;
        const effects = computeConditionEffects({ targetEffects: [te] });
        expect(effects.attackAdvantageCount).toBe(1);
        expect(effects.attackAdvantageReasons).toEqual(['Animal Lord 1']);
        expect(effects.vexAdvantageTargets).toBeNull();
    });

    it('pesky_swarm gives the holder Disadvantage on attacks AND ability checks', () => {
        // Exact producer stamp: saveProcessing.js pesky_swarm grant — te on
        // the save TARGET, sourced from the lord.
        const holderEffects = computeConditionEffects({
            targetEffects: [{
                target: 'ElderPaladin',
                effect: 'pesky_swarm',
                source: 'Animal Lord 1',
                duration: 'until_end_of_next_turn',
                actionName: 'Animal Spirit',
            }],
        });
        expect(holderEffects.attackDisadvantageCount).toBe(1);
        expect(holderEffects.abilityCheckDisadvantage).toBe(true);
        expect(combineAttackModes(holderEffects, computeConditionEffects({}), null)).toBe('disadvantage');
    });

    it('non-variant tes dispatch normally and leave the Animal Spirit legs untouched', () => {
        const effects = computeConditionEffects({
            targetEffects: [{ effect: 'speed_half', target: 'ElderPaladin', source: 'Animal Lord 1' }],
        });
        // Dispatch proof: this te still lands its own legs...
        expect(effects.speedHalved).toBe(true);
        expect(effects.speedHalvedSource).toBe('Animal Lord 1');
        // ...while the variant legs stay inert.
        expect(effects.attackDisadvantageCount).toBe(0);
        expect(effects.abilityCheckDisadvantage).toBe(false);
        expect(effects.vexAdvantageTargets).toBeNull();
    });
});
