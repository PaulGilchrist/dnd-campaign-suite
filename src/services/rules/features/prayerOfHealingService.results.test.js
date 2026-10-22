// @maintained-by-ai
// SP-091 family, RESULTS lane of the direct-service twin (5e, enforce=false via
// rules-less CLERIC_STATS). Lane split (READ prayerOfHealingService.js to confirm):
//   - prayerOfHealingService.test.js (base): trigger/name gate, combat-context
//     failure, selection (caster exclusion, latch refuse, 2024 cap 5, range filter,
//     distance sort, placedItems fallback), heal_at_slot_level ladder resolution,
//     clamp application, and the 2024 consume-side setRuntimeBatch stamp bytes.
//   - prayerOfHealingHandler.test.js: modal/handler confirm lane (latch contract
//     end-to-end, heal_multi payload, 5e twin byte-inertness on the handler side).
//   - restRules-longRest.sp091-prayer-latch.test.js (#1311): clear side of the
//     'prayerOfHealingAffected' latch — never re-pinned here.
// THIS lane owns the outcome-shape PRODUCED back to the caller for the 5e twin:
// exact envelope key-set, per-target rows (order, dice rolls, rawTotal-vs-
// healAmount over-log bytes, delta-0 rows), hp_change log payloads with frozen
// timestamps, exact applyHealingToTarget args, zero runtime writes (5e inert —
// writer=base #stamp, clearer=#1311, inert=here: the three-lane byte pair),
// 5e disk parity cap of SIX (public/data/spells.json "Up to six creatures"),
// maximization routing (global + per-target), and Fortified Health consumption
// via finalizePrayerPostCast — load-bearing: massHealingWordHandler.confirm.test.js
// removed its FH quartet citing THIS file as the service-lane FH owner.
// Disk identity (verified both rulesets): lv2, no save, 30 ft, Instantaneous,
// non-concentration => NO CLOCK (latchStamp is a round-counter stamp, never a
// countdown; 5e lane performs zero latch writes anyway).
// HP-key census: reads canonical 'currentHitPoints' (service:122) for kept
// targets; 'hitPoints' would be read ONLY for type:'player' rows (#1393
// per-target maxHp law) — this lane's creature rows carry maxHp directly, so
// the strict keyed store fake throws on any other owner/key/campaign/arity — a
// wrong-key refactor breaks here. Dice fixed-stub queues THROW past the last stub.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerPrayerOfHealing } from './prayerOfHealingService.js';

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionMaximized: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
    setRuntimeBatch: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn(),
}));

vi.mock('../combat/rangeCheck.js', () => ({
    isDistanceInRange: vi.fn((dist, range) => dist <= range),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
    resolveHealingBonusesWithDetails: vi.fn(),
    markFortifiedHealthUsed: vi.fn(),
    hasHealingMaximization: vi.fn(),
    hasHealingMaximizationForTarget: vi.fn(),
}));

import { rollExpression, rollExpressionMaximized } from '../../dice/diceRoller.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue, setRuntimeValue, setRuntimeBatch } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { getDistanceFeet, rangeToFeet } from '../combat/rangeValidation.js';
import { isDistanceInRange } from '../combat/rangeCheck.js';
import {
    resolveHealingBonusesWithDetails,
    markFortifiedHealthUsed,
    hasHealingMaximization,
    hasHealingMaximizationForTarget,
} from '../../combat/automation/automationService.js';

const CAMPAIGN_NAME = 'TestCampaign';
const MAP_NAME = 'testMap';
const FIXED_TS = new Date('2026-10-21T12:00:00.000Z').getTime();
// 5e twin: NO rules field => enforcementEnabled()===false => no latch reads/writes,
// cap 6 (disk: 'Up to six creatures'). 2024 latch/stamp bytes are owned by
// prayerOfHealingService.test.js; LR clear owned by sp091 latch test (#1311).
const CLERIC_STATS = {
    name: 'Cleric',
    spellAbilities: {
        spellCastingAbility: 'Wisdom',
        modifier: 3,
    },
    proficiency: 3,
    level: 5,
    abilities: [{ name: 'Wisdom', bonus: 3 }],
};
// 5e disk ladder (public/data/spells.json): '2d8 + MOD' at lv2.
const SPELL_LV2 = {
    name: 'Prayer of Healing',
    level: 2,
    range: '30 feet',
    heal_at_slot_level: {
        2: '2d8 + MOD',
        3: '3d8 + MOD',
        4: '4d8 + MOD',
        5: '5d8 + MOD',
    },
};

function buildParty(names, maxHp) {
    return {
        players: names.map((name, i) => ({ name, gridX: i + 1, gridY: 1 })),
        creatures: names.map((name, i) => ({ name, maxHp: maxHp[i] })),
        placedItems: [],
        round: 1,
    };
}

// Stateful store fake (#1372): argument-keyed, records read order, THROWS on
// unknown owner/key/campaign/arity. 5e lane must touch ONLY 'currentHitPoints'.
function seedStore(hpByTarget) {
    const reads = [];
    getRuntimeValue.mockImplementation(function (owner, key, campaign) {
        if (arguments.length !== 3) {
            throw new Error(`getRuntimeValue arity: expected 3, got ${arguments.length}`);
        }
        if (campaign !== CAMPAIGN_NAME) throw new Error(`Unknown campaign: ${campaign}`);
        if (key !== 'currentHitPoints') throw new Error(`Unknown key '${key}' for ${owner}`);
        if (!(owner in hpByTarget)) throw new Error(`Unknown owner: ${owner}`);
        reads.push([owner, key]);
        return hpByTarget[owner];
    });
    return reads;
}

// Fixed dice-stub queue (#1380): exact per-roll outcomes in call order; the
// (n+1)th roll THROWS, so target-count drift cannot hide behind a reused stub.
function seedDice(rolls) {
    let i = 0;
    return (expr) => {
        if (i >= rolls.length) throw new Error(`Unstubbed roll #${i + 1}: ${expr}`);
        return rolls[i++];
    };
}

function seedDefaults() {
    rangeToFeet.mockReturnValue(30);
    getDistanceFeet.mockReturnValue(10);
    isDistanceInRange.mockImplementation((dist, range) => dist <= range);
    resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    markFortifiedHealthUsed.mockResolvedValue(undefined);
    hasHealingMaximization.mockReturnValue(false);
    hasHealingMaximizationForTarget.mockReturnValue(false);
    applyHealingToTarget.mockReturnValue(undefined);
    setRuntimeValue.mockReturnValue(undefined);
    setRuntimeBatch.mockReturnValue(undefined);
    addEntry.mockResolvedValue(undefined);
    window.dispatchEvent = vi.fn();
}

describe('prayerOfHealingService results lane (5e twin outcome shape)', () => {
    let consoleSpy;

    beforeEach(() => {
        vi.resetAllMocks(); // #1312: full reset, then explicit re-seed
        seedDefaults();
        vi.useFakeTimers(); // #1388: freeze Date.now so log timestamps are byte-pinned
        vi.setSystemTime(FIXED_TS);
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.useRealTimers();
        consoleSpy.mockRestore();
    });

    it('produces the exact envelope, per-target rows, apply args, logs and zero runtime writes for a mixed heal/clamp/full-HP party', async () => {
        // Party: Ally1 clamped (roll 10, room 5), Ally2 raw-heals 15, Ally3 at full
        // HP => delta-0 row (quirk pinned: healAmount 0 still returns + logs).
        const ctx = buildParty(['Cleric', 'Ally1', 'Ally2', 'Ally3'], [60, 50, 30, 40]);
        getCombatContext.mockResolvedValue(ctx);
        const reads = seedStore({ Ally1: 45, Ally2: 10, Ally3: 40 });
        rollExpression.mockImplementation(seedDice([
            { total: 10, rolls: [4, 6] },
            { total: 15, rolls: [7, 8] },
            { total: 18, rolls: [9, 9] },
        ]));

        // undefined metaCtx exercises the optional chain; spell.level 2 fallback.
        const result = await triggerPrayerOfHealing(SPELL_LV2, undefined, CLERIC_STATS, CAMPAIGN_NAME, MAP_NAME);

        // Full envelope: exact key-set + self-consistent producer numbers.
        expect(Object.keys(result)).toEqual(['targets', 'formula', 'totalHealed', 'rolls', 'rawTotal']);
        expect(result).toEqual({
            targets: [
                { targetName: 'Ally1', healAmount: 5, rolls: [4, 6], rawTotal: 10 },
                { targetName: 'Ally2', healAmount: 15, rolls: [7, 8], rawTotal: 15 },
                { targetName: 'Ally3', healAmount: 0, rolls: [9, 9], rawTotal: 18 },
            ],
            formula: '2d8 + 3',
            totalHealed: 20,
            rolls: [4, 6, 7, 8, 9, 9],
            rawTotal: 43,
        });

        // Over-log census: rawTotal stays unclamped (10/15/18) while healAmount
        // clamps (5/15/0) — service:128-129 producer arithmetic.
        // Reads: canonical 'currentHitPoints' only, in target order.
        expect(reads).toEqual([
            ['Ally1', 'currentHitPoints'],
            ['Ally2', 'currentHitPoints'],
            ['Ally3', 'currentHitPoints'],
        ]);
        expect(rollExpression).toHaveBeenCalledTimes(3); // dice queue drained — no 4th roll
        expect(rollExpressionMaximized).not.toHaveBeenCalled();

        // Apply: exact amounts, exact pos; full-HP Ally3 skipped entirely.
        expect(applyHealingToTarget).toHaveBeenCalledTimes(2);
        expect(applyHealingToTarget).toHaveBeenNthCalledWith(1, ctx, 'Ally1', 5, CAMPAIGN_NAME);
        expect(applyHealingToTarget).toHaveBeenNthCalledWith(2, ctx, 'Ally2', 15, CAMPAIGN_NAME);

        // 5e twin write-budget: ZERO runtime writes (writer=base stamp lane,
        // clearer=#1311; here the 5e inertness half of the byte pair).
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(setRuntimeBatch).not.toHaveBeenCalled();

        // hp_change rows: one per target incl. the delta-0 row, full payload bytes.
        const rows = addEntry.mock.calls.map(c => c[1]);
        expect(addEntry).toHaveBeenCalledTimes(3);
        expect(addEntry.mock.calls.map(c => c[0])).toEqual([CAMPAIGN_NAME, CAMPAIGN_NAME, CAMPAIGN_NAME]);
        expect(rows).toEqual([
            { type: 'hp_change', targetName: 'Ally1', delta: 5, currentHp: 50, maxHp: 50, isHealing: true, sourceName: 'Cleric', note: 'Prayer of Healing', formula: '2d8 + 3', bonusDetails: undefined, timestamp: FIXED_TS },
            { type: 'hp_change', targetName: 'Ally2', delta: 15, currentHp: 25, maxHp: 30, isHealing: true, sourceName: 'Cleric', note: 'Prayer of Healing', formula: '2d8 + 3', bonusDetails: undefined, timestamp: FIXED_TS },
            { type: 'hp_change', targetName: 'Ally3', delta: 0, currentHp: 40, maxHp: 40, isHealing: true, sourceName: 'Cleric', note: 'Prayer of Healing', formula: '2d8 + 3', bonusDetails: undefined, timestamp: FIXED_TS },
        ]);
        // 5e twin: zero automation-envelope logs (refused/short-rest/range-advisory
        // are enforcement-only; base+handler lanes own those bytes).
        expect(rows.some(r => r.type === 'automation' || r.type === 'prayer_of_healing')).toBe(false);

        expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
        expect(window.dispatchEvent.mock.calls[0][0].type).toBe('combat-summary-updated');
    });

    it('heals exactly six targets and no more — 5e disk parity (public/data/spells.json "Up to six creatures")', async () => {
        // Non-enforce twin => maxTargets 6 (service:184); the 2024 cap-5 side is
        // pinned by prayerOfHealingService.test.js. Seven non-caster creatures:
        // only the first six may be rolled/rowed — queue drains at 6 and THROWS.
        const seven = ['Cleric', 'Ally1', 'Ally2', 'Ally3', 'Ally4', 'Ally5', 'Ally6', 'Ally7'];
        getCombatContext.mockResolvedValue(buildParty(seven, seven.map(() => 50)));
        const reads = seedStore(Object.fromEntries(seven.slice(1).map(n => [n, 10])));
        rollExpression.mockImplementation(seedDice(
            Array.from({ length: 6 }, (_, i) => ({ total: 10 + i, rolls: [i + 2, 8] })),
        ));

        const result = await triggerPrayerOfHealing(SPELL_LV2, {}, CLERIC_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(result.targets.map(t => t.targetName)).toEqual(['Ally1', 'Ally2', 'Ally3', 'Ally4', 'Ally5', 'Ally6']);
        expect(result.targets.map(t => t.healAmount)).toEqual([10, 11, 12, 13, 14, 15]);
        expect(result.totalHealed).toBe(75);
        expect(result.rawTotal).toBe(75);
        expect(rollExpression).toHaveBeenCalledTimes(6);
        expect(reads).toHaveLength(6);
        expect(addEntry).toHaveBeenCalledTimes(6);
    });

    it('routes dice to maximized rolls globally, and per-target only for the flagged target', async () => {
        // Phase A — global maximization: normal roller is a tripwire stub that
        // THROWS on any call; maximizer fed a fixed queue of 3.
        hasHealingMaximization.mockReturnValue(true);
        getCombatContext.mockResolvedValue(buildParty(['Cleric', 'Ally1', 'Ally2', 'Ally3'], [60, 50, 30, 40]));
        seedStore({ Ally1: 10, Ally2: 10, Ally3: 10 });
        rollExpression.mockImplementation((expr) => {
            throw new Error(`normal roller must not fire when maximized: ${expr}`);
        });
        rollExpressionMaximized.mockImplementation(seedDice([
            { total: 16, rolls: [8, 8] },
            { total: 16, rolls: [8, 8] },
            { total: 16, rolls: [8, 8] },
        ]));

        const globalMax = await triggerPrayerOfHealing(SPELL_LV2, {}, CLERIC_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(rollExpressionMaximized).toHaveBeenCalledTimes(3);
        expect(rollExpressionMaximized).toHaveBeenCalledWith('2d8 + 3');
        expect(globalMax.totalHealed).toBe(48);
        expect(globalMax.targets.map(t => t.rolls)).toEqual([[8, 8], [8, 8], [8, 8]]);

        // Phase B — per-target only Ally2 maximized, others normal (mixed queue).
        vi.resetAllMocks();
        seedDefaults();
        hasHealingMaximizationForTarget.mockImplementation((_stats, name) => name === 'Ally2');
        getCombatContext.mockResolvedValue(buildParty(['Cleric', 'Ally1', 'Ally2', 'Ally3'], [60, 50, 30, 40]));
        seedStore({ Ally1: 10, Ally2: 10, Ally3: 10 });
        rollExpression.mockImplementation(seedDice([
            { total: 10, rolls: [4, 6] },
            { total: 11, rolls: [3, 8] },
        ]));
        rollExpressionMaximized.mockImplementation(seedDice([{ total: 16, rolls: [8, 8] }]));

        const mixed = await triggerPrayerOfHealing(SPELL_LV2, {}, CLERIC_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(rollExpressionMaximized).toHaveBeenCalledTimes(1);
        expect(rollExpressionMaximized).toHaveBeenCalledWith('2d8 + 3');
        expect(rollExpression).toHaveBeenCalledTimes(2);
        expect(mixed.targets).toEqual([
            { targetName: 'Ally1', healAmount: 10, rolls: [4, 6], rawTotal: 10 },
            { targetName: 'Ally2', healAmount: 16, rolls: [8, 8], rawTotal: 16 },
            { targetName: 'Ally3', healAmount: 11, rolls: [3, 8], rawTotal: 11 },
        ]);
        expect(mixed.totalHealed).toBe(37);
    });

    it('consumes Fortified Health only when a real heal landed — FH ownership cited by massHealingWordHandler.confirm.test.js', async () => {
        // Bonus composition flows into rows AND formula/log bytes; zero-heal run
        // must NOT burn the passive (finalizePrayerPostCast healAmount>0 gate).
        const fhDetails = [{ name: 'Fortified Health', amount: 5 }];
        resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 5, details: fhDetails });
        getCombatContext.mockResolvedValue(buildParty(['Cleric', 'Ally1', 'Ally2', 'Ally3'], [60, 50, 30, 40]));
        seedStore({ Ally1: 10, Ally2: 10, Ally3: 10 });
        rollExpression.mockImplementation(seedDice([
            { total: 10, rolls: [4, 6] },
            { total: 15, rolls: [7, 8] },
            { total: 18, rolls: [9, 9] },
        ]));

        const result = await triggerPrayerOfHealing(SPELL_LV2, {}, CLERIC_STATS, CAMPAIGN_NAME, MAP_NAME);

        // +5 lands per target; Ally2 hits its max with EXACT fit (2d+mod+FH=20, room 20).
        expect(result.targets.map(t => t.healAmount)).toEqual([15, 20, 23]);
        expect(result.totalHealed).toBe(58);
        expect(resolveHealingBonusesWithDetails).toHaveBeenCalledTimes(1);
        expect(resolveHealingBonusesWithDetails.mock.calls[0][1]).toMatchObject({ prof: 3, level: 5, slotLevel: 2, campaignName: CAMPAIGN_NAME });
        expect(markFortifiedHealthUsed).toHaveBeenCalledTimes(1);
        expect(markFortifiedHealthUsed).toHaveBeenCalledWith(CLERIC_STATS, CAMPAIGN_NAME);
        const formulaRow = addEntry.mock.calls.map(c => c[1]).find(r => r.targetName === 'Ally1');
        expect(formulaRow.formula).toBe('2d8 + 3 + (5 Fortified Health)');
        expect(formulaRow.bonusDetails).toEqual(fhDetails);

        // Negative pass: whole party at full HP => all rows delta 0 => FH untouched.
        vi.resetAllMocks();
        seedDefaults();
        resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 5, details: fhDetails });
        getCombatContext.mockResolvedValue(buildParty(['Cleric', 'Ally1', 'Ally2', 'Ally3'], [60, 50, 30, 40]));
        seedStore({ Ally1: 50, Ally2: 30, Ally3: 40 });
        rollExpression.mockImplementation(seedDice([
            { total: 10, rolls: [4, 6] },
            { total: 15, rolls: [7, 8] },
            { total: 18, rolls: [9, 9] },
        ]));

        const dry = await triggerPrayerOfHealing(SPELL_LV2, {}, CLERIC_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(dry.targets.map(t => t.healAmount)).toEqual([0, 0, 0]);
        expect(markFortifiedHealthUsed).not.toHaveBeenCalled();
    });

    it('returns a zero envelope without logs or writes when every roll fails', async () => {
        getCombatContext.mockResolvedValue(buildParty(['Cleric', 'Ally1', 'Ally2', 'Ally3'], [60, 50, 30, 40]));
        seedStore({ Ally1: 10, Ally2: 10, Ally3: 10 });
        rollExpression.mockImplementation(seedDice([null, null, null]));

        const result = await triggerPrayerOfHealing(SPELL_LV2, {}, CLERIC_STATS, CAMPAIGN_NAME, MAP_NAME);

        expect(result).toEqual({ targets: [], formula: '2d8 + 3', totalHealed: 0, rolls: [], rawTotal: 0 });
        expect(rollExpression).toHaveBeenCalledTimes(3); // null-roll skip is per-target, loop continues
        expect(applyHealingToTarget).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled(); // refuse happens before the log write (service:126 precedes :141)
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(setRuntimeBatch).not.toHaveBeenCalled();
        expect(window.dispatchEvent).toHaveBeenCalledTimes(1);
    });

    it('completes the heal and reports log failures when every addEntry rejects', async () => {
        getCombatContext.mockResolvedValue(buildParty(['Cleric', 'Ally1', 'Ally2'], [60, 50, 30]));
        seedStore({ Ally1: 10, Ally2: 10 });
        rollExpression.mockImplementation(seedDice([
            { total: 10, rolls: [4, 6] },
            { total: 15, rolls: [7, 8] },
        ]));
        addEntry.mockRejectedValue(new Error('Log failed'));

        const result = await triggerPrayerOfHealing(SPELL_LV2, {}, CLERIC_STATS, CAMPAIGN_NAME, MAP_NAME);
        await vi.advanceTimersByTimeAsync(0); // flush the un-awaited .catch chains

        // Heal bytes survive log failure; the swallow is loud, not silent.
        expect(result.targets.map(t => t.healAmount)).toEqual([10, 15]);
        expect(result.totalHealed).toBe(25);
        expect(applyHealingToTarget).toHaveBeenCalledTimes(2);
        expect(addEntry).toHaveBeenCalledTimes(2);
        expect(consoleSpy).toHaveBeenCalledTimes(2);
        expect(consoleSpy.mock.calls.every(c => c[0] === '[prayerOfHealing] Error:')).toBe(true);
    });

    it('#1393 twin: maxHp-less ally is skipped LOUDLY while the rest heal — ledger stays non-negative, caster pool inert', async () => {
        // PRE-FIX capture (service.orig.js probe, 2026-10-22): maxHp fell back to
        // the CASTER's hitPoints 5 -> NoMaxAlly row healAmount min(10, 5-0)... the
        // strict store below had NO NoMaxAlly seed at all, and a 5-HP caster capped
        // any unresolved row at its own pool; negative deltas (5-HP caster healing a
        // wounded 20-HP ally => -bytes) polluted totalHealed. POST-FIX: skip +
        // console.error, healthy ally clamps on its OWN maxHp, zero negative bytes.
        const ctx = {
            players: [{ name: 'Cleric', gridX: 1, gridY: 1 }, { name: 'NoMaxAlly', gridX: 2, gridY: 1 }, { name: 'Ally1', gridX: 3, gridY: 1 }],
            creatures: [{ name: 'NoMaxAlly' }, { name: 'Ally1', maxHp: 20 }],
            placedItems: [],
            round: 1,
        };
        clearCalls2();
        getCombatContext.mockResolvedValue(ctx);
        const reads = seedStore({ Ally1: 10 }); // strict: any NoMaxAlly store read THROWS
        rollExpression.mockImplementation(seedDice([{ total: 15, rolls: [7, 8] }])); // one roll only

        const result = await triggerPrayerOfHealing(SPELL_LV2, {}, { ...CLERIC_STATS, hitPoints: 5 }, CAMPAIGN_NAME, MAP_NAME);

        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith('[prayerOfHealingService] Skipping NoMaxAlly: unresolved maxHp (target.maxHp=undefined, type=undefined). No roll, no write, no latch.');
        // Ally1 rolls 15 into room 10 => clamped to its OWN 20 (never the caster's 5).
        expect(result).toEqual({
            targets: [{ targetName: 'Ally1', healAmount: 10, rolls: [7, 8], rawTotal: 15 }],
            formula: '2d8 + 3',
            totalHealed: 10,
            rolls: [7, 8],
            rawTotal: 15,
        });
        expect(reads).toEqual([['Ally1', 'currentHitPoints']]);
        expect(rollExpression).toHaveBeenCalledTimes(1); // skipped target rolled NOTHING
        expect(applyHealingToTarget).toHaveBeenCalledTimes(1);
        expect(applyHealingToTarget).toHaveBeenCalledWith(ctx, 'Ally1', 10, CAMPAIGN_NAME);
        const rows = addEntry.mock.calls.map(c => c[1]);
        expect(rows).toHaveLength(1); // skip produced NO log row
        expect(rows[0]).toEqual({ type: 'hp_change', targetName: 'Ally1', delta: 10, currentHp: 20, maxHp: 20, isHealing: true, sourceName: 'Cleric', note: 'Prayer of Healing', formula: '2d8 + 3', bonusDetails: undefined, timestamp: FIXED_TS });
        expect(rows.every(r => r.delta >= 0)).toBe(true);
        // 5e twin write-budget unchanged: zero runtime writes.
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(setRuntimeBatch).not.toHaveBeenCalled();
    });
});

function clearCalls2() {
    [getCombatContext, rollExpression, rollExpressionMaximized, applyHealingToTarget, addEntry, getRuntimeValue]
        .forEach(m => m.mockClear());
}
