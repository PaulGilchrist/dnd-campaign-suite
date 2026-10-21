// @maintained-by-ai
/**
 * massCureWoundsService lane — AoE PRODUCER (multi-target, per-target dice).
 *
 * Producer vs forwarder verdict (#1335): this lane computes its own heals —
 * resolveHealExpression ladder + MOD substitute (:29-53), one dice roll PER
 * TARGET (:80), clamped to (maxHp - storedHp) per target (:84). It never
 * calls executeHandler. It OWNS its numbers; nothing here is opaque passthrough.
 *
 * LIVE export: triggerMassCureWounds — sole export, live caller
 * spellCastService/execution/triggerSpells.js:415 (handleMassCureWounds,
 * imported :36). No dead exports. Caller lane aoeHealingSpecial.test.js:123
 * mocks this module and owns caller-side routing — not re-pinned here.
 *
 * DISK DETERMINATION (both rulesets, imported below):
 *  5e   'Mass Cure Wounds': lv5, range 60ft, sphere 30, V/S,
 *       heal_at_slot_level 5:'3d8 + MOD' ... 9:'7d8 + MOD'.
 *  2024 'Mass Cure Wounds': lv5, 60ft, sphere 30-foot-radius,
 *       heal_at_slot_level 5:'5d8 + MOD' ... 9:'9d8 + MOD'.
 *  Cross-ruleset divergence at the same slot (3d8 vs 5d8 at lv5) is pinned;
 *  the old fixture's '5d8' ladder (no MOD, 5e slot count) matched NEITHER row.
 *  old fixture also used hitPoints {max,current} — source :76 reads NUMERIC
 *  playerStats.hitPoints; fixtures corrected to numeric.
 *
 * AoE/range delegation: source imports NO range util (old vi.mock of
 * rangeValidation.js was dead — removed). distance is never computed here;
 * range/affiliation selection is owned upstream (SaveAttackAoeModal family
 * #1345 precedent / aoeHealingSpecial caller lane). This lane pins its half:
 * slice(0,6) of combatSummary.creatures, ARRAY ORDER, distance-agnostic.
 * SOURCE BUGS (reported, not fixed):
 *  - :141-142 heals the FIRST 6 creatures in array order with no affiliation
 *    filter — hostiles in the list get healed; disk 60ft/30-sphere unenforced.
 *  - :92-104 over-log: every processed creature logs hp_change even with
 *    delta 0, and :84 lets negative actualHeal (storedHp > maxHp) reach the
 *    log and the returned totals (:106/:158). Both pinned as quirks.
 *  - :11 gate is case-sensitive while caller triggerSpells.js:414 gates on
 *    lowercased name — a case-drift name passes the caller then silently
 *    returns null here. Pinned in the guard table.
 *  - :18-20 ability found but bonus undefined → substituted nothing; dice
 *    receives literal '...+ MOD' bytes. Pinned quirk.
 *
 * Quirk scan: :0-swallow chains :125 (metaCtx.slotLevel||spell.level||5) and
 * :134 prof||0 / level||1 coercion census member (#1374 — coerces, not NaN,
 * not throw) — pinned. Stored HP uses != null && !== '' guard (:78) so
 * stored 0 heals; string HP coerces via Number (:78) — pinned. No latch
 * arming except markFortifiedHealthUsed (:162, only with heal>0 AND
 * 'Fortified Health' in details) — pinned both branches. No clocks: heals are
 * instantaneous; Date.now() stamps log payloads only, frozen at 0 by fake
 * timers; no expiry stored.
 *
 * Store audit: getRuntimeValue reads ONLY key 'currentHitPoints' per target
 * (#1371 canonical pair) at CAMPAIGN — strict fake throws on any other
 * key/campaign. ZERO setRuntimeValue / setRuntimeObject calls: the mocked
 * useRuntimeState module exports getRuntimeValue only, so any write attempt is
 * a machine-checked TypeError; skipSync positions: none exist in this lane.
 * Dice is a fixed-stub single queue asserting routing order: rollExpression /
 * rollExpressionMaximized THROW if called with no queued entry or the wrong
 * mode (unstubbed die throws, #1380). blessed-healer quirk: targetNames in
 * the post-cast meta (:115) lists ALL results, including zero-heal entries.
 * PRESERVED-CITED-BY: none — no src file cites this test (grep, only the
 * maintain queue lists it).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerMassCureWounds } from './massCureWoundsService.js';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';

// ── Mocks (module boundaries only) ────────────────────────────

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
    rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
    resolveHealingBonusesWithDetails: vi.fn(),
    hasHealingMaximization: vi.fn(),
    hasHealingMaximizationForTarget: vi.fn(),
    markFortifiedHealthUsed: vi.fn(),
}));

vi.mock('../spells/postCastHealService.js', () => ({
    triggerPostCastSelfHeals: vi.fn(),
}));

import { getCombatContext } from '../combat/damageUtils.js';
import { applyHealingToTarget } from '../combat/applyHealing.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';
import { rollExpression, rollExpressionMaximized } from '../../dice/diceRoller.js';
import { resolveHealingBonusesWithDetails, hasHealingMaximization, hasHealingMaximizationForTarget, markFortifiedHealthUsed } from '../../combat/automation/automationService.js';
import { triggerPostCastSelfHeals } from '../spells/postCastHealService.js';

// ── Canon helpers ─────────────────────────────────────────────

const CAMPAIGN = 'test-campaign';
const MAP = 'test-map';

function diskRow(spells, name) {
    const spell = spells.find(s => s.name === name);
    if (!spell) throw new Error(`spell missing from disk: ${name}`);
    return spell;
}
const mcw5e = diskRow(spells5e, 'Mass Cure Wounds');
const mcw2024 = diskRow(spells2024, 'Mass Cure Wounds');

function stats(overrides = {}) {
    return {
        name: 'Cleric',
        hitPoints: 50,
        abilities: [{ name: 'Wisdom', bonus: 4 }],
        spellAbilities: { spellCastingAbility: 'Wisdom', modifier: 4 },
        proficiency: 3,
        level: 8,
        ...overrides,
    };
}

// ── Shared fakes: single dice queue + strict store ────────────

let diceQ;      // [{ mode: 'normal'|'max', value: {total, rolls} | null }]
let store;      // 'entity|campaign' -> stored currentHitPoints
let reads;      // ordered store reads
let dispatchSpy;
let consoleSpy;

function roll(mode, total, rolls) {
    diceQ.push({ mode, value: { total, rolls } });
}
function rollNull() {
    diceQ.push({ mode: 'normal', value: null });
}
function seedHp(entity, value, campaign = CAMPAIGN) {
    store.set(`${entity}|${campaign}`, value);
}
function cs(creatures) {
    return { creatures };
}
function trigger(spell = mcw5e, metaCtx = { slotLevel: 5 }, casterStats = stats()) {
    return triggerMassCureWounds(spell, metaCtx, casterStats, CAMPAIGN, MAP);
}

function lastRollArg(mock) {
    return mock.mock.calls[mock.mock.calls.length - 1][0];
}

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(0);
    dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // explicit re-seed after reset (vitest-4 retains impls otherwise — #1312)
    diceQ = [];
    reads = [];
    store = new Map();
    const pop = (mode) => {
        const e = diceQ.shift();
        if (!e) throw new Error(`unstubbed dice: ${mode} roll has no queued entry`);
        if (e.mode !== mode) throw new Error(`dice routing drift: ${mode} called, queued ${e.mode}`);
        return e.value;
    };
    rollExpression.mockImplementation(() => pop('normal'));
    rollExpressionMaximized.mockImplementation(() => pop('max'));
    getRuntimeValue.mockImplementation((entity, key, campaign) => {
        if (key !== 'currentHitPoints') {
            throw new Error(`unexpected store key read: ${key} (massCure reads only currentHitPoints)`);
        }
        if (campaign !== CAMPAIGN) {
            throw new Error(`unexpected store read campaign: ${campaign}`);
        }
        reads.push(`${entity}|${key}`);
        return store.get(`${entity}|${campaign}`);
    });
    getCombatContext.mockImplementation(() => { throw new Error('unseeded combat context'); });
    resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 0, details: [] });
    hasHealingMaximization.mockReturnValue(false);
    hasHealingMaximizationForTarget.mockReturnValue(false);
    markFortifiedHealthUsed.mockResolvedValue(undefined);
    addEntry.mockReturnValue(Promise.resolve());
    triggerPostCastSelfHeals.mockResolvedValue(null);
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────

describe('massCureWoundsService.triggerMassCureWounds', () => {
    it.each([
        ['real-disk near-miss Cure Wounds (has heal tiers)', diskRow(spells5e, 'Cure Wounds')],
        ['real-disk family twin Mass Healing Word', diskRow(spells5e, 'Mass Healing Word')],
        ['real-disk near-miss Mass Heal', diskRow(spells5e, 'Mass Heal')],
        ['case-drift name (caller gates lowercase, service does not)', { name: 'mass cure wounds', level: 5, heal_at_slot_level: mcw5e.heal_at_slot_level }],
        ['missing name', { level: 5, heal_at_slot_level: mcw5e.heal_at_slot_level }],
        ['null name', { name: null, level: 5 }],
    ])('name gate rejects %s before any engine work', async (_label, spell) => {
        expect(await trigger(spell)).toBeNull();
        expect(getCombatContext).not.toHaveBeenCalled();
        expect(rollExpression).not.toHaveBeenCalled();
        expect(rollExpressionMaximized).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(reads).toEqual([]);
        expect(dispatchSpy).not.toHaveBeenCalled();
        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('short-circuits combat context: null context, missing creatures array (exact throw + log), empty creatures', async () => {
        getCombatContext.mockResolvedValueOnce(null);
        expect(await trigger()).toBeNull();
        expect(rollExpression).not.toHaveBeenCalled();

        // creatures absent: requireCreatures throws identically-shaped Error + exact console pair
        getCombatContext.mockResolvedValueOnce({});
        await expect(trigger()).rejects.toThrowError(new Error('Expected array, got undefined'));
        expect(consoleSpy).toHaveBeenCalledWith('[massCureWoundsService] Missing array:', undefined);
        expect(rollExpression).not.toHaveBeenCalled();

        // empty creatures: exact noTargets envelope, nothing downstream
        getCombatContext.mockResolvedValueOnce(cs([]));
        expect(await trigger()).toEqual({ noTargets: true });
        expect(applyHealingToTarget).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(triggerPostCastSelfHeals).not.toHaveBeenCalled();
        expect(dispatchSpy).not.toHaveBeenCalled();
        expect(getCombatContext).toHaveBeenCalledTimes(3);
        expect(getCombatContext).toHaveBeenLastCalledWith(CAMPAIGN);
    });

    it('disk ladder, both rulesets: reached tiers substituted and mutually distinguishable', async () => {
        getCombatContext.mockResolvedValue(cs([{ name: 'Ally', maxHp: 100 }]));
        seedHp('Ally', 50);
        const ladder = [[5, '3d8 + 4'], [6, '4d8 + 4'], [7, '5d8 + 4'], [8, '6d8 + 4'], [9, '7d8 + 4']];
        for (const [slot, expr] of ladder) {
            roll('normal', 20, [4, 4, 4, 4, 4]);
            const result = await trigger(mcw5e, { slotLevel: slot });
            expect(lastRollArg(rollExpression)).toBe(expr);
            expect(result.formula).toBe(expr);
        }
        // 2024 divergence: same lv5 slot, different dice count than 5e
        for (const [slot, expr] of [[5, '5d8 + 4'], [9, '9d8 + 4']]) {
            roll('normal', 20, [4, 4, 4, 4, 4]);
            const result = await trigger(mcw2024, { slotLevel: slot });
            expect(lastRollArg(rollExpression)).toBe(expr);
            expect(result.formula).toBe(expr);
        }
        expect(rollExpression).toHaveBeenCalledTimes(7);
        expect(rollExpressionMaximized).not.toHaveBeenCalled();
    });

    it('slot resolution chain: metaCtx > spell.level > 5 default, :0-swallow, highest-below fallback, null below ladder floor', async () => {
        getCombatContext.mockResolvedValue(cs([{ name: 'Ally', maxHp: 100 }]));
        seedHp('Ally', 50);
        const base = { name: 'Mass Cure Wounds', spellCastingAbility: 'Wisdom' };
        const full = { ...base, level: 5, heal_at_slot_level: { 5: '1d8 + MOD', 6: '2d8 + MOD', 7: '3d8 + MOD' } };
        const sparse = { ...base, level: 5, heal_at_slot_level: { 5: '4d8', 7: '6d8' } };

        roll('normal', 20, [20]);
        expect((await trigger(full, { slotLevel: 6 })).formula).toBe('2d8 + 4');       // metaCtx wins over spell.level 5
        roll('normal', 20, [20]);
        expect((await trigger({ ...full, level: 7 }, {})).formula).toBe('3d8 + 4');     // spell.level fallback
        roll('normal', 20, [20]);
        expect((await trigger({ ...full, level: undefined }, {})).formula).toBe('1d8 + 4'); // || 5 default
        roll('normal', 20, [20]);
        expect((await trigger({ ...full, level: 7 }, { slotLevel: 0 })).formula).toBe('3d8 + 4'); // :0 swallowed to spell.level
        roll('normal', 20, [20]);
        expect((await trigger(sparse, { slotLevel: 6 })).formula).toBe('4d8');           // exact miss -> highest below (5)
        roll('normal', 20, [20]);
        expect((await trigger(sparse, { slotLevel: 9 })).formula).toBe('6d8');           // beyond top -> highest (7)
        expect(await trigger(sparse, { slotLevel: 4 })).toBeNull();                       // below floor -> null, no roll
        expect(diceQ).toEqual([]);
    });

    it('spellcasting-mod sources: spell ability, negative byte, spellAbilities ability, modifier fallback, zero, unresolved-MOD leak quirk', async () => {
        getCombatContext.mockResolvedValue(cs([{ name: 'Ally', maxHp: 100 }]));
        seedHp('Ally', 50);
        // mcw5e's lv5 tier is '3d8 + MOD'; MOD replaced by String(bonus)

        roll('normal', 20, [20]);
        expect((await trigger({ ...mcw5e, spellCastingAbility: 'Intelligence' }, { slotLevel: 5 },
            stats({ abilities: [{ name: 'Wisdom', bonus: 4 }, { name: 'Intelligence', bonus: -3 }] }))).formula)
            .toBe('3d8 + -3'); // negative modifier concatenated verbatim
        roll('normal', 20, [20]);
        expect((await trigger({ ...mcw5e, spellCastingAbility: undefined }, { slotLevel: 5 },
            stats({ abilities: [{ name: 'Charisma', bonus: 2 }], spellAbilities: { spellCastingAbility: 'Charisma', modifier: 9 } }))).formula)
            .toBe('3d8 + 2'); // spellAbilities.spellCastingAbility path
        roll('normal', 20, [20]);
        expect((await trigger(mcw5e, { slotLevel: 5 },
            stats({ abilities: [], spellAbilities: { spellCastingAbility: 'Wisdom', modifier: 3 } }))).formula)
            .toBe('3d8 + 3'); // lookup miss -> spellAbilities.modifier
        roll('normal', 20, [20]);
        expect((await trigger(mcw5e, { slotLevel: 5 },
            { name: 'Cleric', hitPoints: 50 })).formula)
            .toBe('3d8 + 0'); // no abilities at all -> 0
        roll('normal', 20, [20]);
        expect((await trigger(mcw5e, { slotLevel: 5 },
            stats({ abilities: [{ name: 'Wisdom' }] }))).formula)
            .toBe('3d8 + MOD'); // QUIRK: ability found, bonus undefined -> MOD never substituted
    });

    it('healing-bonus ctx tuple: identity stats, prof/level coercion census (prof||0, level||1), resolved once per cast not per target', async () => {
        getCombatContext.mockResolvedValue(cs([
            { name: 'Ally1', maxHp: 100 }, { name: 'Ally2', maxHp: 100 }, { name: 'Ally3', maxHp: 100 },
        ]));
        seedHp('Ally1', 50); seedHp('Ally2', 50); seedHp('Ally3', 50);
        const caster = stats();
        roll('normal', 10, [10]); roll('normal', 10, [10]); roll('normal', 10, [10]);
        await trigger(mcw5e, { slotLevel: 5 }, caster);
        expect(resolveHealingBonusesWithDetails).toHaveBeenCalledTimes(1);
        const [statsArg, ctxArg] = resolveHealingBonusesWithDetails.mock.calls[0];
        expect(statsArg).toBe(caster);
        expect(ctxArg).toEqual({ prof: 3, level: 8, slotLevel: 5, campaignName: CAMPAIGN });

        const zeroed = stats({ proficiency: 0, level: 0 });
        roll('normal', 10, [10]); roll('normal', 10, [10]); roll('normal', 10, [10]);
        await trigger(mcw5e, { slotLevel: 5 }, zeroed);
        expect(resolveHealingBonusesWithDetails.mock.calls[1][1])
            .toEqual({ prof: 0, level: 1, slotLevel: 5, campaignName: CAMPAIGN });
    });

    it('flagship 3-target cast: per-target clamps, string/stored HP canon, full-HP zero-delta over-log, exact envelope, tuples, identities, single dispatch', async () => {
        const combatCtx = cs([
            { name: 'Goblin', maxHp: 7 },
            { name: 'Orc', maxHp: 15 },
            { name: 'Cleric', maxHp: 50 },
        ]);
        getCombatContext.mockResolvedValue(combatCtx);
        seedHp('Goblin', 5);
        seedHp('Orc', '9'); // string stored HP coerced by Number()
        // Cleric unseeded -> stored undefined -> current = maxHp

        roll('normal', 20, [4, 4, 4, 4, 4]);
        roll('normal', 8, [3, 3, 2]);
        roll('normal', 11, [5, 6]);
        const caster = stats();
        const result = await trigger(mcw5e, { slotLevel: 5 }, caster);

        expect(rollExpression).toHaveBeenCalledTimes(3); // one fixed roll per target
        expect(rollExpression).toHaveBeenCalledWith('3d8 + 4');
        expect(reads).toEqual(['Goblin|currentHitPoints', 'Orc|currentHitPoints', 'Cleric|currentHitPoints']);
        expect(hasHealingMaximization).toHaveBeenCalledWith(caster);
        expect(hasHealingMaximizationForTarget.mock.calls.map(c => [c[1], c[2]]))
            .toEqual([['Goblin', CAMPAIGN], ['Orc', CAMPAIGN], ['Cleric', CAMPAIGN]]);
        expect(applyHealingToTarget).toHaveBeenCalledTimes(2);
        expect(applyHealingToTarget).toHaveBeenNthCalledWith(1, combatCtx, 'Goblin', 2, CAMPAIGN);
        expect(applyHealingToTarget).toHaveBeenNthCalledWith(2, combatCtx, 'Orc', 6, CAMPAIGN);

        // over-log quirk: full-HP Cleric logged with delta 0 although never applied
        expect(addEntry).toHaveBeenCalledTimes(3);
        expect(addEntry.mock.calls.map(c => [c[0], c[1].targetName, c[1].delta]))
            .toEqual([['test-campaign', 'Goblin', 2], ['test-campaign', 'Orc', 6], ['test-campaign', 'Cleric', 0]]);
        const goblinLog = addEntry.mock.calls[0][1];
        expect(goblinLog).toEqual({
            type: 'hp_change',
            targetName: 'Goblin',
            delta: 2,
            currentHp: 7,
            maxHp: 7,
            isHealing: true,
            sourceName: 'Cleric',
            note: 'Mass Cure Wounds',
            formula: '3d8 + 4',
            bonusDetails: undefined,
            timestamp: 0,
        });

        expect(result).toEqual({
            targets: [
                { targetName: 'Goblin', healAmount: 2, rolls: [4, 4, 4, 4, 4], rawTotal: 20 },
                { targetName: 'Orc', healAmount: 6, rolls: [3, 3, 2], rawTotal: 8 },
                { targetName: 'Cleric', healAmount: 0, rolls: [5, 6], rawTotal: 11 },
            ],
            formula: '3d8 + 4',
            totalHealed: 8,
            rolls: [4, 4, 4, 4, 4, 3, 3, 2, 5, 6],
            rawTotal: 39,
        });
        const events = dispatchSpy.mock.calls.map(c => c[0]);
        expect(events.map(e => e.type)).toEqual(['combat-summary-updated']);
    });

    it('first-6 slice is array-order and affiliation-blind; maxHp falls back to numeric playerStats.hitPoints; stored HP above max yields negative delta quirk', async () => {
        const many = Array.from({ length: 8 }, (_, i) => ({ name: `C${i}`, maxHp: 100 }));
        getCombatContext.mockResolvedValue(cs(many));
        many.forEach(c => seedHp(c.name, 50));
        for (let i = 0; i < 6; i++) roll('normal', 10, [10]);
        const result = await trigger(mcw5e, { slotLevel: 5 });
        // selection boundary forwarded to this lane verbatim: slice(0, 6), no sorting/filtering here
        expect(result.targets.map(t => t.targetName)).toEqual(['C0', 'C1', 'C2', 'C3', 'C4', 'C5']);
        expect(rollExpression).toHaveBeenCalledTimes(6);
        expect(applyHealingToTarget).toHaveBeenCalledTimes(6);

        // creature without maxHp borrows numeric playerStats.hitPoints (50);
        // Titan stored above max -> heal clamps negative, apply skipped, log still written
        const combatCtx2 = cs([{ name: 'Armor' }, { name: 'Titan', maxHp: 50 }]);
        getCombatContext.mockResolvedValueOnce(combatCtx2);
        seedHp('Armor', 40);
        seedHp('Titan', '60');
        roll('normal', 25, [5, 20]);
        roll('normal', 10, [10]);
        const q = await trigger(mcw5e, { slotLevel: 5 });
        expect(q.targets).toEqual([
            { targetName: 'Armor', healAmount: 10, rolls: [5, 20], rawTotal: 25 },
            { targetName: 'Titan', healAmount: -10, rolls: [10], rawTotal: 10 },
        ]);
        expect(q.totalHealed).toBe(0);
        expect(applyHealingToTarget).toHaveBeenLastCalledWith(combatCtx2, 'Armor', 10, CAMPAIGN);
        expect(applyHealingToTarget.mock.calls.filter(c => c[1] === 'Titan')).toEqual([]);
        const titanLog = addEntry.mock.calls.find(c => c[1].targetName === 'Titan')[1];
        expect(titanLog).toMatchObject({ delta: -10, currentHp: 50, maxHp: 50, timestamp: 0 });
    });

    it('dice routing: global maximization, per-target maximization, null-roll target skipped silently', async () => {
        getCombatContext.mockResolvedValue(cs([{ name: 'Goblin', maxHp: 7 }, { name: 'Orc', maxHp: 15 }]));
        seedHp('Goblin', 1);
        seedHp('Orc', 1);
        const caster = stats();

        hasHealingMaximization.mockReturnValueOnce(true);
        roll('max', 24, [8, 8, 8]);
        roll('max', 24, [8, 8, 8]);
        const g = await trigger(mcw5e, { slotLevel: 5 }, caster);
        expect(rollExpression).not.toHaveBeenCalled();
        expect(rollExpressionMaximized).toHaveBeenNthCalledWith(1, '3d8 + 4');
        expect(g.totalHealed).toBe(20); // 6 + 14

        // per-target: only Goblin maximized (drift-proof queue asserts call order/mode)
        hasHealingMaximizationForTarget.mockImplementation((_s, name) => name === 'Goblin');
        roll('max', 24, [8, 8, 8]);
        roll('normal', 3, [3]);
        const p = await trigger(mcw5e, { slotLevel: 5 }, caster);
        expect(p.targets.map(t => t.healAmount)).toEqual([6, 3]);

        // null roll: target skipped — no result entry, no log for it, cast still dispatches
        hasHealingMaximizationForTarget.mockReturnValue(false);
        addEntry.mockClear();
        roll('normal', 4, [4]);
        rollNull();
        const n = await trigger(mcw5e, { slotLevel: 5 }, caster);
        expect(n.targets.map(t => t.targetName)).toEqual(['Goblin']);
        expect(addEntry.mock.calls.map(c => c[1].targetName)).toEqual(['Goblin']);
        expect(dispatchSpy).toHaveBeenCalledTimes(3);
    });

    it('healing bonuses: exact composed log formula, bonusDetails identity, Fortified-Health latch armed only on real heal', async () => {
        const details = [{ name: 'Inspiring Leader', amount: 2 }, { name: 'Fortified Health', amount: 1 }];
        resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 3, details });
        getCombatContext.mockResolvedValue(cs([{ name: 'Goblin', maxHp: 7 }]));
        seedHp('Goblin', 1);
        const caster = stats();

        roll('normal', 12, [4, 4, 4]);
        const r = await trigger(mcw5e, { slotLevel: 5 }, caster);
        expect(r.targets).toEqual([{ targetName: 'Goblin', healAmount: 6, rolls: [4, 4, 4], rawTotal: 15 }]);
        expect(addEntry.mock.calls[0][1]).toMatchObject({
            formula: '3d8 + 4 + (2 Inspiring Leader + 1 Fortified Health)',
            delta: 6,
            currentHp: 7,
        });
        expect(addEntry.mock.calls[0][1].bonusDetails).toBe(details);
        expect(markFortifiedHealthUsed).toHaveBeenCalledTimes(1);
        expect(markFortifiedHealthUsed).toHaveBeenCalledWith(caster, CAMPAIGN);

        // all full: zero heals must NOT arm the fortified latch (still over-logs delta 0)
        seedHp('Goblin', 7);
        roll('normal', 5, [5]);
        await trigger(mcw5e, { slotLevel: 5 }, caster);
        expect(markFortifiedHealthUsed).toHaveBeenCalledTimes(1);

        // fortified absent from details while healing happens: latch stays untouched
        resolveHealingBonusesWithDetails.mockReturnValue({ totalBonus: 2, details: [{ name: 'Inspiring Leader', amount: 2 }] });
        seedHp('Goblin', 1);
        roll('normal', 4, [4]);
        await trigger(mcw5e, { slotLevel: 5 }, caster);
        expect(markFortifiedHealthUsed).toHaveBeenCalledTimes(1);
    });

    it('CLA-038 blessed healer fires on non-caster heal with exact meta; targetNames include zero-heal entries (quirk)', async () => {
        getCombatContext.mockResolvedValue(cs([{ name: 'Cleric', maxHp: 50 }, { name: 'Goblin', maxHp: 7 }]));
        seedHp('Goblin', 3); // Cleric unseeded -> full -> healAmount 0
        roll('normal', 20, [20]);
        roll('normal', 5, [5]);
        const caster = stats();
        await trigger(mcw5e, { slotLevel: 5 }, caster);
        expect(triggerPostCastSelfHeals).toHaveBeenCalledTimes(1);
        expect(triggerPostCastSelfHeals).toHaveBeenCalledWith(mcw5e, { slotLevel: 5, targetNames: ['Cleric', 'Goblin'] }, caster, CAMPAIGN, MAP);
    });

    it('CLA-038 blessed healer stays silent when nothing healed or only the caster healed; rejection swallowed with exact log prefix', async () => {
        getCombatContext.mockResolvedValue(cs([{ name: 'Goblin', maxHp: 7 }]));
        seedHp('Goblin', 7);
        roll('normal', 20, [20]);
        await trigger(mcw5e, { slotLevel: 5 });
        expect(triggerPostCastSelfHeals).not.toHaveBeenCalled();

        // caster-only healed: some(r.targetName !== casterName) fails
        getCombatContext.mockResolvedValueOnce(cs([{ name: 'Cleric', maxHp: 50 }]));
        seedHp('Cleric', 1);
        roll('normal', 20, [20]);
        await trigger(mcw5e, { slotLevel: 5 });
        expect(triggerPostCastSelfHeals).not.toHaveBeenCalled();

        // rejection path: exact prefix + identical Error swallowed, cast completes
        getCombatContext.mockResolvedValueOnce(cs([{ name: 'Goblin', maxHp: 7 }]));
        seedHp('Goblin', 3);
        roll('normal', 5, [5]);
        triggerPostCastSelfHeals.mockRejectedValueOnce(new Error('boom'));
        const r = await trigger(mcw5e, { slotLevel: 5 });
        expect(r.totalHealed).toBe(4);
        expect(consoleSpy).toHaveBeenCalledWith('[massCureWoundsService] Post-cast self-heal failed:', new Error('boom'));
    });
});
