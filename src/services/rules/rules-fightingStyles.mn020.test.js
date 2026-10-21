// @maintained-by-ai
// MN-020: the Superior Technique style grant must carry the save spec tokens
// (saveDc:'ability', saveAbility:['STR','DEX']) mirroring the Battle Master major
// feature automation, so buildSaveDc resolves 8 + STR/DEX mod + PB at prompt time
// instead of falling back to DC 10 (bug-MN-020-trip-attack-save-dc-understated.md:
// rules-fightingStyles.js style grant lacked saveDc -> ||10).
// Ownership: this file is the zero-mock grant-shape owner. Downstream prompt-time DC
// resolution lives in executeAttackRider.mn020.test.js; token passthrough in
// combatSuperiorityQueries.mn020.test.js; info builder in automationInfoBuilder/
// combatSuperiority.test.js; getPlayerStats integration in core/
// rules-playerStats-fightingStyles-feats.test.js. Pure module: no mocks, no dice,
// no clocks — instantaneous pushes only.
import { describe, it, expect } from 'vitest';
import { applyFightingStyleSpecialActionsUniversal } from './rules-fightingStyles.js';

const host = (fightingStyles) => ({
    class: { fightingStyles },
    specialActions: [],
});

// Exact grant shape as pushed by rules-fightingStyles.js:203-218. The pre-fix
// implementation lacked saveDc/saveAbility, so no weaker-than-this assertion set
// can let the old bug pass: the full toEqual fails on the missing keys.
const combatSuperiorityGrant = () => ({
    name: 'Combat Superiority',
    description: 'You learn one maneuver of your choice from the Battle Master. You have one superiority die (d6) to fuel that maneuver. Use Combat Superiority during combat to deploy a maneuver.',
    type: 'combat_superiority',
    automation: {
        type: 'combat_superiority',
        dieExpression: '6',
        uses_max: 1,
        maxOptions: 1,
        maxOptionsScaling: {},
        saveDc: 'ability',
        saveAbility: ['STR', 'DEX'],
        hasAutomation: true,
    },
    hasAutomation: true,
});

describe('rules-fightingStyles.applyFightingStyleSpecialActionsUniversal — MN-020 save spec tokens on the Superior Technique grant', () => {
    it('pushes the exact full-set Combat Superiority payload for the disk-spaced style name', () => {
        const stats = host(['Superior Technique']);
        applyFightingStyleSpecialActionsUniversal(stats);

        // Full-array equality: exactly one action, exact keys, exact token values.
        expect(stats.specialActions).toEqual([combatSuperiorityGrant()]);
    });

    it('grants nothing for an absent or mismatched-case style list — gate matches the disk name byte-exactly', () => {
        // 'Superior Technique' is the byte-exact disk name (public/data/fighting-styles.json:51);
        // falsy triple: empty list, lowercase near-miss, missing key.
        for (const fightingStyles of [[], ['superior technique'], undefined]) {
            const stats = host(fightingStyles);
            applyFightingStyleSpecialActionsUniversal(stats);
            expect(stats.specialActions).toEqual([]);
        }
    });

    it('grants Blessed Warrior exactly without Combat Superiority bleed — each style block gates independently', () => {
        const stats = host(['Blessed Warrior']);
        applyFightingStyleSpecialActionsUniversal(stats);

        expect(stats.specialActions).toEqual([{
            name: 'Blessed Warrior',
            description: 'You gain a +2 bonus to attack rolls you make with melee weapons.',
            type: 'blessed_warrior',
            automation: { type: 'passive_rule', effect: 'blessed_warrior', hasAutomation: true },
            hasAutomation: true,
        }]);
    });

    it('is idempotent — re-running neither duplicates the grant nor rewrites the save spec tokens', () => {
        const stats = host(['Superior Technique']);
        applyFightingStyleSpecialActionsUniversal(stats);
        applyFightingStyleSpecialActionsUniversal(stats);

        // Exact length-1 array (not just "no duplicate found"): the existing-grant
        // guard at rules-fightingStyles.js:201 must be the only reason nothing is pushed.
        expect(stats.specialActions).toEqual([combatSuperiorityGrant()]);
    });
});
