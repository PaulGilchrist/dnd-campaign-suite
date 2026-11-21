// @maintained-by-ai: 2026-11-21
// RAW no-stacking law (PHB 2024 "Cover": "when a target has cover from more
// than one source, only the greatest degree applies") across the COVER
// CHANNEL INTERSECTION: the §8.3 enforcement-zones stamp (campaign
// `_cover_shot`, +2 half cover, folded by computeTargetAc) vs the furniture/
// prop cover riding the shot context (contextBuilder-map → context.coverAc-
// Bonus, added by hitResolution's computeEffectiveAc). Pre-fix the two lanes
// SUMMED (+4 on one shot: raw 15 → effective 19, live-proved 2026-11-21 EEE)
// and the stamped audit prose self-contradicted (`vs AC 19 (1/2 Cover +2 AC)`
// — 15 + 2 ≠ 19). Law now: the stamp only folds when it BEATS the context
// bonus; whenever the context bonus carries cover, targetAc stays RAW so the
// row's own arithmetic (targetAc + coverAcBonus = adjudicated AC) reconciles.
// Single-source faces (pure-stamp folded-unannotated, pure-furniture
// annotated) keep their pinned bytes — see targetAcComputation.test.js and
// logService.cover.test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { computeTargetAc } from './targetAcComputation.js';
import { resolveHit } from './hitResolution.js';
import { deriveAuditText } from '../../services/ui/logService.js';

const store = {};

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((name, key) => (store[`${name}.${key}`] ?? null)),
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

// addEntry stays a no-op double; deriveAuditText (the audit-message producer)
// must ride UNMOCKED — the reconciliation under test is its arithmetic.
vi.mock('../../services/ui/logService.js', async () => {
    const actual = await vi.importActual('../../services/ui/logService.js');
    return { ...actual, addEntry: vi.fn(() => Promise.resolve()) };
});

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => null),
    getTargetFromAttacker: vi.fn(() => null),
}));

vi.mock('../../services/combat/automation/automationExpressions.js', () => ({
    evaluateAutoExpression: vi.fn(() => 6),
}));

const CAMPAIGN = 'test-campaign';
const ATTACKER = 'EvasiveFighter';
const GOBLIN = { name: 'Goblin', type: 'npc', ac: 15 };

// The exact live EEE stamp: FeyRanger interposes at (6,5), half cover +2.
function stampCoverShot() {
    store['campaign._cover_shot'] = {
        attackerName: ATTACKER, targetName: 'Goblin', ac: 2,
        blocker: 'FeyRanger', cell: '6,5', round: 1,
    };
}

function attackContext(coverAcBonus) {
    return {
        rollType: 'attack',
        attackerName: ATTACKER,
        targetName: 'Goblin',
        effectiveBonus: 7,
        bonus: 7,
        playerStats: { name: ATTACKER, level: 5, proficiency: 2 },
        ...(coverAcBonus ? { coverAcBonus, coverLevel: coverAcBonus >= 5 ? 'threeQuarter' : 'half' } : {}),
    };
}

// The EEE repro: pinned d20 11, +7 to hit → total 18. RAW half cover ⇒ AC 17
// ⇒ HIT. The stacked face judged 18 vs 19 ⇒ MISS.
function resolveAttack(coverAcBonus) {
    return resolveHit({
        characterName: ATTACKER,
        campaignName: CAMPAIGN,
        context: attackContext(coverAcBonus),
        bonus: 7,
        effectiveD20Roll: 11,
        target: GOBLIN,
        combatSummary: { creatures: [] },
        characters: [],
        logEntry: vi.fn(),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(store)) delete store[k];
});

describe('computeTargetAc — cover sources never stack (max applies)', () => {
    it('does NOT fold the half-cover stamp when equal furniture cover already rides the context', () => {
        stampCoverShot();
        const ctx = { ...attackContext(2) };
        // Raw 15 + max(2, 2) = the stamp never adds on top of the context +2.
        expect(computeTargetAc(ctx, GOBLIN, [], CAMPAIGN)).toBe(15);
    });

    it('does NOT fold the half-cover stamp under stronger three-quarter furniture cover', () => {
        stampCoverShot();
        const ctx = { ...attackContext(5) };
        expect(computeTargetAc(ctx, GOBLIN, [], CAMPAIGN)).toBe(15);
    });

    it('still folds the stamp alone (enforcement-only face stays byte-identical: 15 ⇒ 17)', () => {
        stampCoverShot();
        expect(computeTargetAc(attackContext(), GOBLIN, [], CAMPAIGN)).toBe(17);
    });

    it('stays byte-identical with no stamp (furniture/raw faces untouched)', () => {
        expect(computeTargetAc(attackContext(2), GOBLIN, [], CAMPAIGN)).toBe(15);
        expect(computeTargetAc(attackContext(), GOBLIN, [], CAMPAIGN)).toBe(15);
    });
});

describe('resolveHit — stamp × context-cover intersection', () => {
    it('judges the double-covered shot against ONE half cover (18 vs 17 = HIT, not 18 vs 19 MISS)', async () => {
        stampCoverShot();
        const covered = await resolveAttack(2);
        expect(covered.targetAc).toBe(15);
        expect(covered.effectiveAc).toBe(17);
        expect(covered.hit).toBe(true);
    });

    it('keeps the enforcement-only face: +2 folded into targetAc, effective AC 17', async () => {
        stampCoverShot();
        const stamped = await resolveAttack();
        expect(stamped.targetAc).toBe(17);
        expect(stamped.effectiveAc).toBe(17);
        expect(stamped.hit).toBe(true);
    });

    it('keeps the furniture-only face: raw targetAc + context +2 = effective AC 17', async () => {
        const furniture = await resolveAttack(2);
        expect(furniture.targetAc).toBe(15);
        expect(furniture.effectiveAc).toBe(17);
        expect(furniture.hit).toBe(true);
    });

    it('applies only the ¾ tier (+5) when the stamp rides the same shot', async () => {
        stampCoverShot();
        const threeQuarter = await resolveAttack(5);
        expect(threeQuarter.targetAc).toBe(15);
        expect(threeQuarter.effectiveAc).toBe(20);
        expect(threeQuarter.hit).toBe(false); // 18 vs 20 stays an honest miss
    });
});

describe('audit-message reconciliation on the stored row pair', () => {
    it('the annotated AC equals raw targetAc + the stated cover bonus (15 + 2 = 17)', () => {
        const row = {
            type: 'roll', rollType: 'attack', characterName: ATTACKER,
            targetName: 'Goblin', name: 'Shortbow', total: 11, bonus: 7,
            bonusDetail: '(+7 to hit)', targetAc: 15, effectiveAc: 17,
            coverLevel: 'half', coverAcBonus: 2, hit: true,
        };
        expect(deriveAuditText(row))
            .toBe('EvasiveFighter attacks Goblin with Shortbow: 11 +7 (+7 to hit) vs AC 17 (1/2 Cover +2 AC) — HIT');
    });
});
