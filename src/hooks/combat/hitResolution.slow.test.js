// @maintained-by-ai: 2026-10-14
// SP-109 consumer seam: resolveHit folds context._slowAcPenalty into
// effectiveAc (hitResolution.js computeEffectiveAc) so the miss/hit boundary
// moves with the -2 AC the slow spell imposes (public/data/2024/spells.json
// "slow": "-2 penalty to AC"). Producer side (slow condition stamp →
// getSlowAcPenalty) is covered in loggedDiceRollUtils.slow.test.js.
import { describe, it, expect, vi } from 'vitest';

import { resolveHit } from './hitResolution.js';

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        DEBUG_FORCE_CRIT: false,
        getName: (n) => n || 'Unknown',
        guid: () => 'test-guid',
    },
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(() => false),
    hasAttackerTriggeredMajesty: vi.fn(() => false),
    markAttackerTriggeredMajesty: vi.fn(),
    getUnbreakableMajestySaveDc: vi.fn(),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    getGuardianProtectionAcBonus: vi.fn(() => 0),
    getParryAcBonus: vi.fn(() => 0),
    dispatchUnbreakableMajestySave: vi.fn(),
}));

vi.mock('../../services/combat/auras/bardicInspirationState.js', () => ({
    hasBardicInspirationDefense: vi.fn(() => false),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../services/combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(() => 6),
}));

const attackerName = 'Thug 1';
const campaignName = 'test-campaign';
const sorcerer = { name: 'AberrantSorcerer', type: 'player' };
const characters = [{ name: 'AberrantSorcerer', armorClass: 9 }];

// Attack roll with +5 bonus against base AC 9; slowed AC is 7.
function resolveAttack(effectiveD20Roll, slowAcPenalty) {
    return resolveHit({
        characterName: attackerName,
        campaignName,
        context: {
            rollType: 'attack',
            attackerName,
            targetName: sorcerer.name,
            effectiveBonus: 5,
            bonus: 5,
            isWeaponAttack: true,
            playerStats: { name: attackerName, level: 5, proficiency: 3 },
            ...(slowAcPenalty ? { _slowAcPenalty: slowAcPenalty } : {}),
        },
        bonus: 5,
        effectiveD20Roll,
        target: sorcerer,
        combatSummary: { creatures: [] },
        characters,
        logEntry: vi.fn(),
    });
}

describe('resolveHit — SP-109 Slow -2 AC', () => {
    it('folds the -2 penalty into effectiveAc, flipping a base-AC miss into a hit', async () => {
        // Total 8 vs slowed AC 7 → hit; base AC stays reported as 9.
        const slowed = await resolveAttack(3, 2);
        expect(slowed.targetAc).toBe(9);
        expect(slowed.effectiveAc).toBe(7);
        expect(slowed.hit).toBe(true);

        // Same roll against unslowed AC 9 → miss (penalty is what flipped it).
        const unslowed = await resolveAttack(3);
        expect(unslowed.effectiveAc).toBe(9);
        expect(unslowed.hit).toBe(false);
    });

    it('keeps a total below the slowed AC a miss', async () => {
        // Total 6 vs slowed AC 7 — guards against the penalty being
        // over-applied (e.g. double-subtracted) below the reported AC.
        const result = await resolveAttack(1, 2);
        expect(result.effectiveAc).toBe(7);
        expect(result.hit).toBe(false);
    });
});
