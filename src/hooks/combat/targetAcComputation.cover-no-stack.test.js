// @maintained-by-ai 2026-11-21: 2026-11-21
// RAW no-stacking law (PHB 2024 "Cover": "when a target has cover from more
// than one source, only the greatest degree applies") across the COVER
// CHANNEL INTERSECTION: the §8.3 enforcement-zones stamp (campaign
// `_cover_shot`, +2 half cover) vs the furniture/prop cover riding the shot
// context (contextBuilder-map → context.coverAcBonus, added by hitResolution's
// computeEffectiveAc). Pre-fix the two lanes SUMMED (+4 on one shot: raw 15 →
// effective 19, live-proved 2026-11-21 EEE) and the stamped audit prose
// self-contradicted (`vs AC 19 (1/2 Cover +2 AC)` — 15 + 2 ≠ 19). Law now: a
// winning stamp folds INTO THE CONTEXT COVER CHANNEL (coverAcBonus/coverLevel/
// coverReason) only when it BEATS the context bonus — targetAc always stays
// RAW, so every covered row's own arithmetic (targetAc + coverAcBonus =
// adjudicated AC) reconciles AND the enforcement-only face annotates in the
// furniture lane's chip vocabulary (`vs AC 17 (1/2 Cover +2 AC)`, improvement
// 2026-11-21 EEE: no more bare bumped `vs AC 17`). Furniture faces (equal +2 /
// stronger +5, source-named coverReason) keep their pinned bytes — see
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

function attackContext(coverAcBonus, coverReason) {
    return {
        rollType: 'attack',
        attackerName: ATTACKER,
        targetName: 'Goblin',
        effectiveBonus: 7,
        bonus: 7,
        playerStats: { name: ATTACKER, level: 5, proficiency: 2 },
        ...(coverAcBonus ? { coverAcBonus, coverLevel: coverAcBonus >= 5 ? 'threeQuarter' : 'half', coverReason } : {}),
    };
}

// The EEE repro: pinned d20 11, +7 to hit → total 18. RAW half cover ⇒ AC 17
// ⇒ HIT. The stacked face judged 18 vs 19 ⇒ MISS. The context object is
// returned so tests read the folded cover channel exactly as the log/popup
// builders do after the seam.
function resolveAttack(coverAcBonus, coverReason) {
    const context = attackContext(coverAcBonus, coverReason);
    return resolveHit({
        characterName: ATTACKER,
        campaignName: CAMPAIGN,
        context,
        bonus: 7,
        effectiveD20Roll: 11,
        target: GOBLIN,
        combatSummary: { creatures: [] },
        characters: [],
        logEntry: vi.fn(),
    }).then((result) => ({ result, context }));
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(store)) delete store[k];
});

describe('computeTargetAc — cover sources never stack (max applies)', () => {
    it('does NOT overwrite equal furniture cover already riding the context (stamp stays off, reason intact)', () => {
        stampCoverShot();
        const ctx = { ...attackContext(2, 'Barrel') };
        // Raw 15 + max(2, 2) = the stamp never adds on top of the context +2.
        expect(computeTargetAc(ctx, GOBLIN, [], CAMPAIGN)).toBe(15);
        expect(ctx.coverAcBonus).toBe(2);
        expect(ctx.coverLevel).toBe('half');
        expect(ctx.coverReason).toBe('Barrel');
    });

    it('does NOT fold the half-cover stamp under stronger three-quarter furniture cover', () => {
        stampCoverShot();
        const ctx = { ...attackContext(5, 'Altar') };
        expect(computeTargetAc(ctx, GOBLIN, [], CAMPAIGN)).toBe(15);
        expect(ctx.coverAcBonus).toBe(5);
        expect(ctx.coverLevel).toBe('threeQuarter');
        expect(ctx.coverReason).toBe('Altar');
    });

    it('folds the lone stamp into the context cover channel, targetAc stays RAW (15 + 2, not 17)', () => {
        stampCoverShot();
        const ctx = attackContext();
        expect(computeTargetAc(ctx, GOBLIN, [], CAMPAIGN)).toBe(15);
        expect(ctx.coverAcBonus).toBe(2);
        expect(ctx.coverLevel).toBe('half');
        expect(ctx.coverReason).toBe('FeyRanger');
    });

    it('leaves an auto-denied (AUTO-MISS) line untouched — the stamp cannot half-cover a decided shot', () => {
        stampCoverShot();
        const ctx = { ...attackContext(), isAutoMiss: true };
        expect(computeTargetAc(ctx, GOBLIN, [], CAMPAIGN)).toBe(15);
        expect(ctx).not.toHaveProperty('coverAcBonus');
        expect(ctx).not.toHaveProperty('coverLevel');
        expect(ctx).not.toHaveProperty('coverReason');
    });

    it('stays byte-identical with no stamp (furniture/raw faces untouched)', () => {
        expect(computeTargetAc(attackContext(2), GOBLIN, [], CAMPAIGN)).toBe(15);
        const bare = attackContext();
        expect(computeTargetAc(bare, GOBLIN, [], CAMPAIGN)).toBe(15);
        expect(bare).not.toHaveProperty('coverAcBonus');
    });
});

describe('resolveHit — stamp × context-cover intersection', () => {
    it('judges the double-covered shot against ONE half cover (18 vs 17 = HIT, not 18 vs 19 MISS)', async () => {
        stampCoverShot();
        const { result } = await resolveAttack(2);
        expect(result.targetAc).toBe(15);
        expect(result.effectiveAc).toBe(17);
        expect(result.hit).toBe(true);
    });

    it('enforcement-only face: RAW targetAc + folded channel +2 = effective AC 17', async () => {
        stampCoverShot();
        const { result, context } = await resolveAttack();
        expect(result.targetAc).toBe(15);
        expect(result.effectiveAc).toBe(17);
        expect(result.hit).toBe(true);
        expect(context.coverAcBonus).toBe(2);
        expect(context.coverLevel).toBe('half');
        expect(context.coverReason).toBe('FeyRanger');
    });

    it('keeps the furniture-only face: raw targetAc + context +2 = effective AC 17', async () => {
        const { result } = await resolveAttack(2);
        expect(result.targetAc).toBe(15);
        expect(result.effectiveAc).toBe(17);
        expect(result.hit).toBe(true);
    });

    it('applies only the ¾ tier (+5) when the stamp rides the same shot', async () => {
        stampCoverShot();
        const { result, context } = await resolveAttack(5, 'Altar');
        expect(result.targetAc).toBe(15);
        expect(result.effectiveAc).toBe(20);
        expect(result.hit).toBe(false); // 18 vs 20 stays an honest miss
        // The winning (highest-degree) source is annotated alone — never a sum,
        // and the furniture reason is never clobbered by the losing stamp.
        expect(context.coverAcBonus).toBe(5);
        expect(context.coverLevel).toBe('threeQuarter');
        expect(context.coverReason).toBe('Altar');
    });
});

// A row built from the seam (raw targetAc + the folded channel fields, exactly
// what useLoggedDiceRollAttack's buildRollLogEntry/buildPopupData read after
// propagateContextMutations) prints the SAME chip-vocabulary annotation as the
// furniture lane — the enforcement-folded row tells its own cover story.
function seamRow({ result, context }) {
    return {
        type: 'roll', rollType: 'attack', characterName: ATTACKER,
        targetName: 'Goblin', name: 'Shortbow', total: 11, bonus: 7,
        bonusDetail: '(+7 to hit)',
        targetAc: result.targetAc, effectiveAc: result.effectiveAc,
        coverLevel: context.coverLevel, coverAcBonus: context.coverAcBonus,
        coverReason: context.coverReason, hit: result.hit,
    };
}

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

    it('the enforcement-folded row annotates itself (no bare bumped vs AC 17)', async () => {
        stampCoverShot();
        const row = seamRow(await resolveAttack());
        expect(row.targetAc + row.coverAcBonus).toBe(row.effectiveAc);
        expect(deriveAuditText(row))
            .toBe('EvasiveFighter attacks Goblin with Shortbow: 11 +7 (+7 to hit) vs AC 17 (1/2 Cover +2 AC) — HIT');
    });

    it('a barrel+blocker intersection annotates the winning furniture source only', async () => {
        stampCoverShot();
        const row = seamRow(await resolveAttack(5, 'Altar'));
        expect(row.targetAc + row.coverAcBonus).toBe(row.effectiveAc);
        expect(deriveAuditText(row))
            .toBe('EvasiveFighter attacks Goblin with Shortbow: 11 +7 (+7 to hit) vs AC 20 (3/4 Cover +5 AC) — MISS');
    });

    it('a clear line stays unannotated with legacy bytes', async () => {
        const row = seamRow(await resolveAttack());
        expect(deriveAuditText(row))
            .toBe('EvasiveFighter attacks Goblin with Shortbow: 11 +7 (+7 to hit) vs AC 15 — HIT');
    });
});
